import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Avatar } from '../components/ui/Avatar'
import { Tappable } from '../components/ui/Tappable'
import { Meter } from '../components/ui/Bars'
import { simulateMatch } from '../lib/match'
import { useDelta } from '../lib/useDelta'
import { shortName } from '../lib/lineup'
import { useDerived } from '../store/derived'
import { MAX_SUBS, useSquad } from '../store/useSquad'
import type { MatchEvent, MatchResult } from '../types'

const BEAT_MS = 520

const KIND_TONE: Record<MatchEvent['kind'], string> = {
  goal: 'var(--color-lime-300)',
  chance: 'var(--color-gold-300)',
  save: 'var(--color-info)',
  card: 'var(--color-danger)',
  sub: 'var(--color-ink-muted)',
  info: 'var(--color-ink-faint)',
  whistle: 'var(--color-ink-muted)',
}

function ratingTone(r: number): string {
  if (r >= 8) return 'var(--color-chem-strong)'
  if (r >= 6.5) return 'var(--color-lime-300)'
  if (r >= 5.5) return 'var(--color-chem-mid)'
  return 'var(--color-chem-weak)'
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel-inset px-3 py-2.5">
      <span className="label-micro block">{label}</span>
      <span className="display tnum block text-xl leading-none text-ink">{value}</span>
      {sub && <span className="label-micro mt-1 block">{sub}</span>}
    </div>
  )
}

interface Props {
  /** Bumped by the header Play button to kick a match off from anywhere. */
  playSignal: number
}

export function MatchScreen({ playSignal }: Props) {
  const { ovr, chem, avgStamina, roster, lineup, formation, tactics } = useDerived()
  const subsLeft = useSquad((s) => s.subsLeft)
  const lastMatch = useSquad((s) => s.lastMatch)
  const finishMatch = useSquad((s) => s.finishMatch)
  const recover = useSquad((s) => s.recover)

  const [live, setLive] = useState<MatchResult | null>(null)
  const [shown, setShown] = useState(0)
  const feedRef = useRef<HTMLDivElement>(null)
  const appliedRef = useRef<number | null>(null)
  const ovrDelta = useDelta(ovr.total)

  const filled = lineup.filter(Boolean).length

  const kickOff = useCallback(() => {
    if (live || filled < 11) return
    const result = simulateMatch({
      roster,
      lineup,
      formationId: formation.id,
      tactics,
      teamOvr: ovr.total,
      chem: chem.team,
    })
    setLive(result)
    setShown(1)
  }, [live, filled, roster, lineup, formation.id, tactics, ovr.total, chem.team])

  // Header "Play" button — ignore the initial render.
  const seenSignal = useRef(playSignal)
  useEffect(() => {
    if (playSignal === seenSignal.current) return
    seenSignal.current = playSignal
    kickOff()
  }, [playSignal, kickOff])

  // Commentary ticker.
  useEffect(() => {
    if (!live || shown >= live.events.length) return
    const t = window.setTimeout(() => setShown((n) => n + 1), BEAT_MS)
    return () => window.clearTimeout(t)
  }, [live, shown])

  // Full time: apply stamina / rating consequences exactly once per result.
  useEffect(() => {
    if (!live || shown < live.events.length) return
    if (appliedRef.current === live.playedAt) return
    appliedRef.current = live.playedAt
    finishMatch(live)
  }, [live, shown, finishMatch])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [shown])

  const revealed = useMemo(() => (live ? live.events.slice(0, shown) : []), [live, shown])
  const homeGoals = revealed.filter((e) => e.kind === 'goal' && e.team === 'home').length
  const awayGoals = revealed.filter((e) => e.kind === 'goal' && e.team === 'away').length
  const minute = revealed.length ? (revealed[revealed.length - 1]?.minute ?? 0) : 0
  const finished = Boolean(live && shown >= live.events.length)

  const report = lastMatch
  const ratings = useMemo(
    () => (report ? [...report.ratings].sort((a, b) => b.rating - a.rating) : []),
    [report],
  )

  return (
    <div className="space-y-4 px-4 pb-6">
      {/* ── pre-match card ────────────────────────────────────────────────── */}
      <section className="panel overflow-hidden" aria-label="Match day">
        <div
          className="px-4 py-4"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 0%, rgba(147,220,18,.14), transparent 65%)',
          }}
        >
          <h2 className="label-micro">Match day</h2>
          <p className="display mt-1 text-2xl leading-none text-ink">Ultra XI</p>
          <p className="measure mt-1.5 text-xs text-ink-muted">
            {formation.name} · {formation.shape}. Ninety minutes against whoever the draw gives
            you — chemistry, tactical fit and tired legs all show up in the result.
          </p>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <Stat label="Ovr" value={`${ovr.total}`} sub={`base ${ovr.base}`} />
            <Stat label="Chem" value={`${chem.team}%`} />
            <Stat label="Stamina" value={`${avgStamina}`} sub="squad avg" />
            <Stat label="Subs" value={`${subsLeft}`} sub={`of ${MAX_SUBS}`} />
          </div>

          <div className="mt-3 flex gap-2">
            <Tappable
              ariaLabel="Play match"
              disabled={filled < 11 || Boolean(live)}
              onTap={kickOff}
              className={`tap btn-primary flex-1 rounded-xl px-4 py-3 text-sm ${
                filled < 11 || live ? 'opacity-45' : ''
              }`}
            >
              {live ? 'In progress…' : 'Play match'}
            </Tappable>
            <Tappable
              ariaLabel="Rest the squad"
              onTap={recover}
              className="tap btn-ghost display rounded-xl px-4 py-3 text-xs tracking-wide"
            >
              Rest squad
            </Tappable>
          </div>
          {filled < 11 && (
            <p className="mt-2 text-2xs" style={{ color: 'var(--color-chem-weak)' }}>
              {11 - filled} empty slot{filled === 10 ? '' : 's'} — fill the XI before kick off.
            </p>
          )}
        </div>
      </section>

      {/* ── post-match report ─────────────────────────────────────────────── */}
      {report && !live && (
        <motion.section
          className="panel px-4 py-4"
          aria-label="Last match report"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="label-micro">Last result</h2>
              <p className="display truncate text-sm text-ink">vs {report.opponent}</p>
            </div>
            <span
              className="display tnum text-3xl leading-none"
              style={{
                color:
                  report.homeGoals > report.awayGoals
                    ? 'var(--color-chem-strong)'
                    : report.homeGoals === report.awayGoals
                      ? 'var(--color-gold-300)'
                      : 'var(--color-chem-weak)',
              }}
            >
              {report.homeGoals}–{report.awayGoals}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Possession" value={`${report.possession}%`} />
            <Stat label="Shots" value={`${report.shots}`} sub={`${report.shotsAgainst} against`} />
            <Stat
              label="Team ovr"
              value={`${ovr.total}`}
              sub={ovrDelta ? `${ovrDelta.from} → ${ovrDelta.to}` : 'unchanged'}
            />
          </div>

          <h3 className="label-micro mt-4 mb-2">Player ratings</h3>
          <div className="grid gap-1.5">
            {ratings.map((r, i) => {
              const p = roster[r.playerId]
              if (!p) return null
              return (
                <motion.div
                  key={r.playerId}
                  className="glass flex items-center gap-2.5 rounded-xl px-2.5 py-1.5"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                >
                  <Avatar player={p} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="display block truncate text-xs text-ink">
                      {shortName(p.name)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="label-micro">{p.pos}</span>
                      {r.goals > 0 && (
                        <span className="text-2xs text-lime-300">
                          {'⚽'.repeat(Math.min(3, r.goals))}
                        </span>
                      )}
                      {r.assists > 0 && (
                        <span className="text-2xs text-info" style={{ color: 'var(--color-info)' }}>
                          {r.assists}A
                        </span>
                      )}
                      <span className="w-12">
                        <Meter value={p.stamina} height={3} />
                      </span>
                      <span className="label-micro">−{r.staminaLost} stam</span>
                    </span>
                  </span>

                  {r.ovrDelta !== 0 && (
                    <motion.span
                      className="display tnum text-2xs"
                      style={{
                        color:
                          r.ovrDelta > 0 ? 'var(--color-chem-strong)' : 'var(--color-chem-weak)',
                      }}
                      initial={{ opacity: 0, y: r.ovrDelta > 0 ? 6 : -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.03 }}
                    >
                      {r.ovrDelta > 0 ? '▲' : '▼'} {Math.abs(r.ovrDelta)} ovr
                    </motion.span>
                  )}

                  <span
                    className="display tnum shrink-0 rounded-md px-1.5 py-0.5 text-xs"
                    style={{
                      color: ratingTone(r.rating),
                      background: 'rgba(0,0,0,.4)',
                      border: `1px solid ${ratingTone(r.rating)}55`,
                    }}
                  >
                    {r.rating.toFixed(1)}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </motion.section>
      )}

      {!report && !live && (
        <p className="measure text-xs text-ink-faint">
          No match played yet. Tune the XI on the Lineup tab and your plan on Tactics, then kick
          off — the simulation reads both.
        </p>
      )}

      {/* ── live overlay ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {live && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-base/95 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* scoreboard */}
            <div className="pt-safe border-b border-hairline px-4 py-4">
              <div className="mx-auto flex max-w-3xl items-center gap-3">
                <span className="min-w-0 flex-1 text-right">
                  <span className="display block truncate text-sm text-lime-200">Ultra XI</span>
                  <span className="label-micro">Home</span>
                </span>
                <span className="display tnum shrink-0 rounded-xl bg-surface-2 px-4 py-2 text-3xl leading-none text-ink ring-1 ring-hairline">
                  <motion.span key={`h${homeGoals}`} initial={{ scale: 1.6, color: '#b8f13c' }} animate={{ scale: 1, color: '#e9eef6' }}>
                    {homeGoals}
                  </motion.span>
                  <span className="mx-1.5 text-ink-faint">–</span>
                  <motion.span key={`a${awayGoals}`} initial={{ scale: 1.6, color: '#ff4f64' }} animate={{ scale: 1, color: '#e9eef6' }}>
                    {awayGoals}
                  </motion.span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="display block truncate text-sm text-ink">{live.opponent}</span>
                  <span className="label-micro">Away</span>
                </span>
              </div>

              <div className="mx-auto mt-3 flex max-w-3xl items-center gap-2">
                <span className="display tnum text-2xs text-lime-300">{minute}'</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-4/80">
                  <motion.span
                    className="block h-full rounded-full bg-gradient-to-r from-lime-600 to-lime-300"
                    initial={false}
                    animate={{ width: `${Math.min(100, (minute / 90) * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                  />
                </span>
                <span className="label-micro">90'</span>
              </div>
            </div>

            {/* commentary */}
            <div ref={feedRef} className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-4">
              <div className="grid gap-1.5">
                {revealed.map((e, i) => (
                  <motion.div
                    key={`${i}-${e.minute}-${e.kind}`}
                    className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${
                      e.kind === 'goal' ? 'glass' : ''
                    }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={
                      e.kind === 'goal'
                        ? {
                            boxShadow:
                              e.team === 'home'
                                ? '0 0 0 1px var(--color-lime-500), 0 8px 26px -14px var(--color-lime-500)'
                                : '0 0 0 1px rgba(255,79,100,.6)',
                          }
                        : undefined
                    }
                  >
                    <span className="display tnum w-8 shrink-0 pt-0.5 text-2xs text-ink-faint">
                      {e.minute}'
                    </span>
                    <span
                      className="text-sm leading-snug"
                      style={{ color: KIND_TONE[e.kind] }}
                    >
                      {e.kind === 'goal' && (
                        <span className="display mr-1.5 text-2xs tracking-widest uppercase">
                          {e.team === 'home' ? 'Goal' : 'Conceded'}
                        </span>
                      )}
                      {e.text}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* controls */}
            <div className="pb-safe border-t border-hairline px-4 py-3">
              <div className="mx-auto flex max-w-3xl gap-2">
                {!finished ? (
                  <Tappable
                    ariaLabel="Skip to full time"
                    onTap={() => setShown(live.events.length)}
                    className="tap btn-ghost display flex-1 rounded-xl px-4 py-3 text-xs tracking-wide"
                  >
                    Skip to full time
                  </Tappable>
                ) : (
                  <Tappable
                    ariaLabel="Close match report"
                    onTap={() => {
                      setLive(null)
                      setShown(0)
                    }}
                    className="tap btn-primary flex-1 rounded-xl px-4 py-3 text-sm"
                  >
                    See the report
                  </Tappable>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
