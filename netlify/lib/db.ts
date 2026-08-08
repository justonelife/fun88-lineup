import { getDatabase, type DatabaseConnection } from '@netlify/database'

/**
 * Cached across warm invocations so we are not reconnecting on every request.
 */
let connection: DatabaseConnection | undefined

function conn(): DatabaseConnection {
  connection ??= getDatabase()
  return connection
}

/**
 * Tagged-template query. Awaiting the result yields the rows directly:
 *
 *   const rows = await sql<TeamRow>`select * from teams where team_code = ${code}`
 *
 * The return type is annotated as `PromiseLike<T[]>` rather than inferred: the
 * driver's own template type lives in a transitive package that cannot be named
 * from here, and awaiting is the entire surface we use.
 */
export function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...params: unknown[]
): PromiseLike<T[]> {
  return conn().sql<T>(strings, ...params)
}

/** The subset of pg.PoolClient / neon PoolClient we rely on. */
export interface TxClient {
  query<R extends Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[] }>
  release(): void
}

/**
 * Runs `fn` inside a real transaction — a PUT touches the `teams` row and every
 * `versions` row together, and a reader must never observe one half without
 * the other.
 */
export async function transaction<T>(fn: (client: TxClient) => Promise<T>): Promise<T> {
  // The server (pg) and serverless (neon) drivers expose structurally identical
  // clients under nominally different types, hence the cast.
  const pool = conn().pool as unknown as { connect(): Promise<TxClient> }
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
