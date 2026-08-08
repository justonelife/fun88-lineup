import { motion } from 'motion/react'
import { Sheet } from './ui/Sheet'
import { Avatar } from './ui/Avatar'
import { StatBar, staminaTone } from './ui/Bars'
import { OvrBadge } from './ui/OvrBadge'
import { Tappable } from './ui/Tappable'
import { club } from '../data/clubs'
import { effectiveOvr, type PosFit } from '../lib/chemistry'
import type { Player, Pos, Stats } from '../types'

const STAT_KEYS: Array<[label: string, key: keyof Stats]> = [
  ['PAC', 'pac'],
  ['SHO', 'sho'],
  ['PAS', 'pas'],
  ['DRI', 'dri'],
  ['DEF', 'def'],
  ['PHY', 'phy'],
]

const FIT_LABEL: Record<PosFit, string> = {
  3: 'Natural',
  2: 'Secondary',
  1: 'Related',
  0: 'Out of position',
}

const FIT_TONE: Record<PosFit, string> = {
  3: 'var(--color-chem-strong)',
  2: 'var(--color-chem-mid)',
  1: 'var(--color-chem-mid)',
  0: 'var(--color-chem-weak)',
}

export interface SheetAction {
  label: string
  hint?: string
  onTap: () => void
  primary?: boolean
  danger?: boolean
  disabled?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  player: Player | undefined
  /** Slot the player currently occupies, when opened from the pitch. */
  slotPos?: Pos
  fit?: PosFit
  chem?: number
  /** Where the player currently lives, shown as a membership tag. */
  membership?: 'xi' | 'bench' | 'reserve'
  /** Context line above the actions — used when the sheet is read-only. */
  note?: string
  actions: SheetAction[]
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="panel-inset flex flex-col gap-0.5 px-2.5 py-2">
      <span className="label-micro">{label}</span>
      <span className="display tnum text-sm leading-none" style={{ color: tone ?? 'var(--color-ink)' }}>
        {value}
      </span>
    </div>
  )
}

const MEMBERSHIP_LABEL = {
  xi: 'Starting seven',
  bench: 'On the bench',
  reserve: 'Reserve',
} as const

/**
 * One canonical player detail surface, reused by the pitch, the bench and the
 * squad database — same information architecture everywhere, only the action
 * row changes with context.
 */
export function PlayerSheet({
  open,
  onClose,
  player,
  slotPos,
  fit,
  chem,
  membership,
  note,
  actions,
}: Props) {
  return (
    <Sheet open={open && Boolean(player)} onClose={onClose} label={player?.name}>
      {player && (
        <div className="px-4 pb-6">
          {/* identity */}
          <div className="flex items-center gap-3">
            <Avatar player={player} size={58} />
            <div className="min-w-0 flex-1">
              <h2 className="display truncate text-xl leading-tight text-ink">{player.name}</h2>
              <p className="truncate text-xs text-ink-muted">
                {club(player.clubId).name} · {player.nation}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="display rounded bg-lime-500/15 px-1.5 text-2xs tracking-wider text-lime-200 uppercase ring-1 ring-lime-500/35">
                  {player.pos}
                </span>
                {player.alt.map((p) => (
                  <span
                    key={p}
                    className="display rounded bg-surface-3/70 px-1.5 text-2xs tracking-wider text-ink-muted uppercase ring-1 ring-hairline"
                  >
                    {p}
                  </span>
                ))}
                {membership && (
                  <span className="label-micro ml-auto">{MEMBERSHIP_LABEL[membership]}</span>
                )}
              </div>
            </div>
            <OvrBadge ovr={player.ovr} size={46} />
          </div>

          {/* condition facts */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            <Fact
              label="Stamina"
              value={`${player.stamina}`}
              tone={staminaTone(player.stamina)}
            />
            <Fact label="Form" value={`${player.form}/10`} />
            <Fact label="Effective" value={`${Math.round(effectiveOvr(player))}`} />
            {slotPos ? (
              <Fact
                label={`In ${slotPos}`}
                value={FIT_LABEL[fit ?? 0]}
                tone={FIT_TONE[fit ?? 0]}
              />
            ) : (
              <Fact label="Skill" value={'★'.repeat(Math.max(1, Math.min(5, player.skill)))} />
            )}
          </div>

          {typeof chem === 'number' && slotPos && (
            <p className="mt-2 text-xs text-ink-faint">
              Slot chemistry <span className="display tnum text-ink">{chem}/10</span> — driven by
              position fit and the links to neighbouring players.
            </p>
          )}

          {/* attributes */}
          <div className="panel mt-4 space-y-2.5 px-3 py-3">
            <h3 className="label-micro">Attributes</h3>
            {STAT_KEYS.map(([label, key], i) => (
              <StatBar key={key} label={label} value={player.stats[key]} delay={i * 0.045} />
            ))}
          </div>

          {note && <p className="measure mt-3 text-xs text-ink-muted">{note}</p>}

          {/* actions */}
          <div className="mt-4 grid gap-2">
            {actions.map((a) => (
              <Tappable
                key={a.label}
                disabled={a.disabled}
                onTap={a.onTap}
                ariaLabel={a.label}
                className={`tap flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left ${
                  a.primary ? 'btn-primary' : 'btn-ghost'
                } ${a.disabled ? 'opacity-40' : ''}`}
                style={a.danger ? { color: 'var(--color-danger)' } : undefined}
              >
                <span className="display text-sm tracking-wide">{a.label}</span>
                {a.hint && (
                  <motion.span
                    className={`text-2xs ${a.primary ? 'text-base/70' : 'text-ink-faint'}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {a.hint}
                  </motion.span>
                )}
              </Tappable>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
