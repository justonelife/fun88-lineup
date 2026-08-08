import { AnimatePresence, motion } from 'motion/react'
import { useVersus, type TeamDerived } from '../store/derived'
import { MAX_SUBS, useSquad } from '../store/useSquad'
import { useDelta } from '../lib/useDelta'

function chemTone(v: number): string {
  if (v >= 75) return 'var(--color-chem-strong)'
  if (v >= 50) return 'var(--color-chem-mid)'
  return 'var(--color-chem-weak)'
}

function Delta({ delta, align }: { delta: { from: number; to: number } | null; align: 'left' | 'right' }) {
  const up = delta ? delta.to > delta.from : false
  return (
    <AnimatePresence>
      {delta && (
        <motion.span
          className={`display tnum absolute -bottom-3.5 rounded-full px-1.5 py-px text-2xs whitespace-nowrap ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{
            background: up ? 'rgba(46,232,122,.15)' : 'rgba(255,79,100,.15)',
            color: up ? 'var(--color-chem-strong)' : 'var(--color-chem-weak)',
          }}
          initial={{ opacity: 0, y: -4, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          {delta.from} → {delta.to}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function Pips({ n, accent, align }: { n: number; accent: string; align: 'left' | 'right' }) {
  return (
    <span
      className={`flex gap-1 ${align === 'right' ? 'justify-end' : ''}`}
      aria-label={`${n} substitutions remaining`}
    >
      {Array.from({ length: MAX_SUBS }, (_, i) => (
        <span
          key={i}
          className="h-1 w-3.5 rounded-full transition-colors"
          style={{ background: i < n ? accent : 'var(--color-surface-4)' }}
        />
      ))}
    </span>
  )
}

function TeamBlock({
  t,
  align,
  active,
}: {
  t: TeamDerived
  align: 'left' | 'right'
  active: boolean
}) {
  const ovrDelta = useDelta(t.ovr.total)
  const right = align === 'right'

  return (
    <div
      className={`relative min-w-0 flex-1 ${right ? 'text-right' : 'text-left'}`}
      style={{ opacity: active ? 1 : 0.66 }}
    >
      <span className="display block truncate text-xs leading-none" style={{ color: t.meta.accentSoft }}>
        {t.meta.name}
      </span>
      <div className={`mt-1 flex items-baseline gap-1.5 ${right ? 'justify-end' : ''}`}>
        <span
          className="display tnum text-2xl leading-none text-gold-300"
          style={{ textShadow: '0 0 18px rgba(247,201,72,.3)' }}
        >
          {t.ovr.total}
        </span>
        <span className="display tnum text-xs leading-none" style={{ color: chemTone(t.chem.team) }}>
          {t.chem.team}%
        </span>
      </div>
      <Delta delta={ovrDelta} align={align} />
      {active && (
        <motion.span
          layoutId="header-active-side"
          className={`absolute -bottom-1.5 h-0.5 w-8 rounded-full ${right ? 'right-0' : 'left-0'}`}
          style={{ background: t.meta.accent }}
          transition={{ type: 'spring', stiffness: 440, damping: 34 }}
        />
      )}
    </div>
  )
}

interface Props {
  onPlay: () => void
}

/**
 * Sticky versus header. Both teams are always on screen and always comparable:
 * same metrics, same type sizes, mirrored around the VS. The active side is the
 * only one at full opacity, with an accent rule under it.
 */
export function Header({ onPlay }: Props) {
  const { home, away, activeSide } = useVersus()
  const setActiveSide = useSquad((s) => s.setActiveSide)

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-hairline bg-base/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <button
          onClick={() => setActiveSide('home')}
          aria-label={`Edit home — ${home.meta.name}`}
          className="min-w-0 flex-1 text-left"
        >
          <TeamBlock t={home} align="left" active={activeSide === 'home'} />
        </button>

        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <span className="display text-2xs tracking-[0.28em] text-ink-faint uppercase">Vs</span>
          <motion.button
            onClick={onPlay}
            whileTap={{ scale: 0.94 }}
            className="tap btn-primary rounded-xl px-3.5 text-xs"
          >
            Play
          </motion.button>
        </div>

        <button
          onClick={() => setActiveSide('away')}
          aria-label={`Edit away — ${away.meta.name}`}
          className="min-w-0 flex-1 text-right"
        >
          <TeamBlock t={away} align="right" active={activeSide === 'away'} />
        </button>
      </div>

      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-2 text-2xs">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Pips n={home.subsLeft} accent={home.meta.accent} align="left" />
          <span className="label-micro truncate">{home.formation.name}</span>
        </span>
        <span className="label-micro shrink-0">7 a side</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="label-micro truncate">{away.formation.name}</span>
          <Pips n={away.subsLeft} accent={away.meta.accent} align="right" />
        </span>
      </div>
    </header>
  )
}
