import { motion } from 'motion/react'
import { Slider } from '../components/ui/Slider'
import { Tappable } from '../components/ui/Tappable'
import { SideToggle } from '../components/SideToggle'
import { PRESETS, TACTIC_KEYS, matchPreset } from '../data/tactics'
import { tacticsFit } from '../lib/chemistry'
import { useDelta } from '../lib/useDelta'
import { useActiveTeam } from '../store/derived'
import { useSquad } from '../store/useSquad'

function fitTone(v: number): string {
  if (v >= 68) return 'var(--color-chem-strong)'
  if (v >= 45) return 'var(--color-chem-mid)'
  return 'var(--color-chem-weak)'
}

function fitVerdict(v: number): string {
  if (v >= 78) return 'This plan suits these players.'
  if (v >= 60) return 'Coherent. Small tweaks left on the table.'
  if (v >= 45) return 'Workable, but you are asking for things they cannot give.'
  return 'The instructions fight the personnel. Expect to be picked off.'
}

/**
 * Tactics board for one side at a time. The fit gauge is the single loudest
 * element — every slider feeds it, so the screen always answers "did that
 * help?" in one glance, for whichever team the switch points at.
 */
export function TacticsScreen() {
  const activeSide = useSquad((s) => s.activeSide)
  const { fit, ovr, xi, formation, tactics, meta } = useActiveTeam()
  const setTactic = useSquad((s) => s.setTactic)
  const applyTactics = useSquad((s) => s.applyTactics)

  const fitDelta = useDelta(fit)
  const ovrDelta = useDelta(ovr.total)
  const activePreset = matchPreset(tactics)

  return (
    <div className="space-y-4 px-4 pb-6">
      <SideToggle hint={`Presets and sliders below apply to ${meta.name}.`} />

      {/* ── fit gauge ─────────────────────────────────────────────────────── */}
      <section className="panel px-4 py-4" aria-label="Tactical fit">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="label-micro">
              Tactical fit · <span style={{ color: meta.accent }}>{meta.label}</span>
            </h2>
            <div className="flex items-baseline gap-2">
              <motion.span
                key={fit}
                className="display tnum text-4xl leading-none"
                style={{ color: fitTone(fit) }}
                initial={{ scale: 0.85, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              >
                {fit}
              </motion.span>
              {fitDelta && (
                <motion.span
                  className="display tnum text-xs"
                  style={{
                    color:
                      fitDelta.to > fitDelta.from
                        ? 'var(--color-chem-strong)'
                        : 'var(--color-chem-weak)',
                  }}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {fitDelta.to > fitDelta.from ? '▲' : '▼'} {Math.abs(fitDelta.to - fitDelta.from)}
                </motion.span>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="label-micro block">Team ovr</span>
            <span className="display tnum text-2xl leading-none text-gold-300">{ovr.total}</span>
            <span className="label-micro mt-0.5 block">
              {ovr.tacticsBonus >= 0 ? '+' : ''}
              {ovr.tacticsBonus} from tactics
              {ovrDelta ? ` · ${ovrDelta.from}→${ovrDelta.to}` : ''}
            </span>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-4/80">
          <motion.div
            className="h-full rounded-full"
            style={{ background: fitTone(fit) }}
            initial={false}
            animate={{ width: `${fit}%` }}
            transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          />
        </div>
        <p className="measure mt-2 text-xs text-ink-muted">{fitVerdict(fit)}</p>
        <p className="mt-1 text-2xs text-ink-faint">
          Measured against {formation.name} and the {xi.length} players currently starting for{' '}
          {meta.name}.
        </p>
      </section>

      {/* ── presets ───────────────────────────────────────────────────────── */}
      <section aria-label="Presets">
        <h2 className="label-micro mb-2">Presets</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRESETS.map((preset) => {
            const active = activePreset === preset.id
            const projected = tacticsFit(preset.values, formation.id, xi)
            return (
              <Tappable
                key={preset.id}
                ariaLabel={`Apply ${preset.name} to ${meta.label}`}
                onTap={() => applyTactics(activeSide, preset.values)}
                ripple={`color-mix(in srgb, ${meta.accent} 42%, transparent)`}
                className="tap relative flex flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left"
                style={active ? { color: meta.onAccent } : undefined}
              >
                {active ? (
                  <motion.span
                    layoutId="preset-active"
                    className="absolute inset-0 -z-10 rounded-xl"
                    style={{
                      background: `linear-gradient(160deg, ${meta.accent}, ${meta.accentDeep})`,
                      boxShadow: `0 6px 22px -8px ${meta.accent}`,
                    }}
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                  />
                ) : (
                  <span className="glass absolute inset-0 -z-10 rounded-xl" />
                )}
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="display text-sm leading-none tracking-wide">{preset.name}</span>
                  <span
                    className="display tnum text-2xs"
                    style={{ color: active ? undefined : fitTone(projected), opacity: active ? 0.7 : 1 }}
                  >
                    {projected}
                  </span>
                </span>
                <span
                  className={`display text-2xs tracking-widest uppercase ${
                    active ? 'opacity-70' : 'text-ink-faint'
                  }`}
                >
                  {preset.tag}
                </span>
                <span className={`text-2xs ${active ? 'opacity-80' : 'text-ink-muted'}`}>
                  {preset.blurb}
                </span>
              </Tappable>
            )
          })}
        </div>
      </section>

      {/* ── sliders ───────────────────────────────────────────────────────── */}
      <section aria-label="Custom instructions" className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="label-micro">Custom instructions</h2>
          <span className="text-2xs text-ink-faint">
            {activePreset ? 'Matching a preset' : 'Custom plan'}
          </span>
        </div>
        {TACTIC_KEYS.map((t) => (
          <Slider
            key={`${activeSide}-${t.key}`}
            label={t.label}
            low={t.low}
            high={t.high}
            hint={t.hint}
            value={tactics[t.key]}
            accent={meta.accent}
            accentSoft={meta.accentSoft}
            accentDeep={meta.accentDeep}
            onChange={(v) => setTactic(activeSide, t.key, v)}
          />
        ))}
      </section>
    </div>
  )
}
