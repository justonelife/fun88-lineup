import { AnimatePresence, motion } from 'motion/react'
import { useDerived } from '../store/derived'
import { useSquad } from '../store/useSquad'
import { useDelta } from '../lib/useDelta'

function chemTone(v: number): string {
  if (v >= 75) return 'var(--color-chem-strong)'
  if (v >= 50) return 'var(--color-chem-mid)'
  return 'var(--color-chem-weak)'
}

function Delta({ delta }: { delta: { from: number; to: number } | null }) {
  const up = delta ? delta.to > delta.from : false
  return (
    <AnimatePresence>
      {delta && (
        <motion.span
          className="display tnum absolute -bottom-4 right-0 flex items-center gap-1 rounded-full px-1.5 py-px text-2xs whitespace-nowrap"
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

interface Props {
  onPlay: () => void
}

/**
 * Sticky team header. Hierarchy: OVR is the single largest number on screen
 * (primary), chemistry sits beside it as the thing you tune (secondary), squad
 * identity and formation are tertiary metadata.
 */
export function Header({ onPlay }: Props) {
  const { ovr, chem, formation } = useDerived()
  const subsLeft = useSquad((s) => s.subsLeft)
  const ovrDelta = useDelta(ovr.total)
  const chemDelta = useDelta(chem.team)

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-hairline bg-base/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        {/* identity — tertiary */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="display grid size-9 shrink-0 place-items-center rounded-lg text-sm text-base"
            style={{
              background: 'linear-gradient(150deg, var(--color-lime-300), var(--color-lime-600))',
              boxShadow: '0 0 18px -6px var(--color-lime-400)',
            }}
          >
            XI
          </span>
          <span className="min-w-0">
            <span className="display block truncate text-base leading-none tracking-wide text-ink">
              ULTRA XI
            </span>
            <span className="label-micro mt-1 block truncate">
              {formation.name} · {formation.shape}
            </span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {/* CHEM — secondary */}
          <div className="relative px-1 text-right">
            <span className="label-micro block">Chem</span>
            <span
              className="display tnum block text-lg leading-none"
              style={{ color: chemTone(chem.team) }}
            >
              {chem.team}
              <span className="text-xs">%</span>
            </span>
            <Delta delta={chemDelta} />
          </div>

          {/* OVR — primary, the single loudest number in the app */}
          <div className="relative px-1 text-right">
            <span className="label-micro block">Ovr</span>
            <motion.span
              key={ovr.total}
              className="display tnum block text-2xl leading-none text-gold-300"
              initial={{ scale: 0.82, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 480, damping: 22 }}
              style={{ textShadow: '0 0 18px rgba(247,201,72,.35)' }}
            >
              {ovr.total}
            </motion.span>
            <Delta delta={ovrDelta} />
          </div>

          <motion.button
            onClick={onPlay}
            whileTap={{ scale: 0.94 }}
            className="tap btn-primary ml-1 rounded-xl px-3 text-xs"
          >
            Play
          </motion.button>
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 pb-2 text-2xs">
        <span className="label-micro">Subs</span>
        <span className="flex gap-1" aria-label={`${subsLeft} substitutions remaining`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className="h-1 w-4 rounded-full transition-colors"
              style={{
                background: i < subsLeft ? 'var(--color-lime-400)' : 'var(--color-surface-4)',
              }}
            />
          ))}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-ink-faint">
          <span className="label-micro">Base {ovr.base}</span>
          {ovr.chemBonus !== 0 && (
            <span
              className="display tnum rounded px-1"
              style={{
                background: ovr.chemBonus > 0 ? 'rgba(46,232,122,.14)' : 'rgba(255,79,100,.14)',
                color: ovr.chemBonus > 0 ? 'var(--color-chem-strong)' : 'var(--color-chem-weak)',
              }}
            >
              {ovr.chemBonus > 0 ? '+' : ''}
              {ovr.chemBonus} chem
            </span>
          )}
          {ovr.tacticsBonus !== 0 && (
            <span
              className="display tnum rounded px-1"
              style={{
                background: ovr.tacticsBonus > 0 ? 'rgba(46,232,122,.14)' : 'rgba(255,79,100,.14)',
                color: ovr.tacticsBonus > 0 ? 'var(--color-chem-strong)' : 'var(--color-chem-weak)',
              }}
            >
              {ovr.tacticsBonus > 0 ? '+' : ''}
              {ovr.tacticsBonus} tac
            </span>
          )}
        </span>
      </div>
    </header>
  )
}
