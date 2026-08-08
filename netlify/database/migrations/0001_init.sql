-- fun88-lineup: one row per team code, one row per named squad version.
--
-- Design notes:
--  * `updated_at`/`v`/`bytes` on `teams` mirror the cloud envelope's own
--    fields byte-for-byte (epoch-ms, schema version, wire size) so a GET can
--    reconstruct the exact envelope the client last PUT without any lossy
--    timestamp conversion — hence bigint, not timestamptz, for the ms value
--    the client actually compares against.
--  * `versions.position` preserves the client's array order (newest-created
--    first, NOT sorted by `updated_at`) — Postgres has no row order of its
--    own, so this is the only thing standing between a round-trip and a
--    reshuffled version list.
--  * A PUT always carries the whole version set, so a version deleted on one
--    device must disappear from the table too; `on delete cascade` from
--    `teams` only handles whole-team deletes, so the function itself deletes
--    any `versions` row not present in the incoming envelope.

create table if not exists teams (
  team_code          text primary key,
  active_version_id  text        not null,
  v                  integer     not null,
  device             text,
  bytes              integer     not null,
  updated_at         bigint      not null,
  created_at         timestamptz not null default now()
);

create table if not exists versions (
  team_code   text    not null references teams (team_code) on delete cascade,
  version_id  text    not null,
  name        text    not null,
  state       jsonb   not null,
  position    integer not null default 0,
  updated_at  bigint  not null,
  primary key (team_code, version_id)
);

create index if not exists versions_team_idx on versions (team_code, position);
