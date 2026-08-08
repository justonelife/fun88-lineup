import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { PlayerToken } from './PlayerToken'
import { OvrBadge } from './ui/OvrBadge'
import { Tappable } from './ui/Tappable'
import { statTone } from './ui/Bars'
import { CLUBS } from '../data/clubs'
import { nextPlayerId } from '../data/players'
import {
  BLANK_STATS,
  POS_GROUPS,
  STAT_MAX,
  STAT_META,
  STAT_ORDER,
  clampStat,
  ovrFromStats,
  type StatKey,
} from '../lib/ovr'
import { readPhoto, photoWeightKB } from '../lib/photo'
import { tierOf } from '../lib/tiers'
import { useSquad } from '../store/useSquad'
import { toast } from '../store/useToast'
import type { Player, Pos, Stats } from '../types'

/* =============================================================================
   PLAYER EDITOR  —  the FIFA Online player-detail screen, made writable
   -----------------------------------------------------------------------------
   The reference screens all share one composition: the card art on the left,
   the numbers on the right, the overall rating the largest thing on the panel.
   This keeps that split on a laptop and stacks it on a phone, so the live card
   is always the first thing you see and the first thing that reacts.

   Visual hierarchy, top to bottom:
     1  the card + the OVR badge      — the result of every edit
     2  the six attribute rows        — the thing you actually manipulate
     3  identity (name/pos/club/nat)  — set once, rarely touched again
     4  the immutable id             — fine print, mono, deliberately quiet

   Every row is a common region (panel-inset) so a stat and its controls read as
   one object; the three sections are separated by a full spacing step so they
   never merge into a wall of inputs.
============================================================================= */

const NEW_DEFAULTS = { stamina: 100, skill: 3, form: 7 } as const

export interface PlayerEditorProps {
  mode: 'create' | 'edit'
  /** Required in edit mode. */
  player?: Player
  onClose: () => void
  /** Fired after a successful save with the player's id. */
  onSaved?: (id: string) => void
}

/* ── attribute row ─────────────────────────────────────────────────────────── */

function StatRow({
  statKey,
  value,
  onChange,
}: {
  statKey: StatKey
  value: number
  onChange: (v: number) => void
}) {
  const meta = STAT_META[statKey]
  const tone = statTone(value)

  return (
    <div className="panel-inset px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="display block text-sm leading-none tracking-widest text-ink">
            {meta.label}
          </span>
          <span className="mt-1 block truncate text-2xs text-ink-faint">
            {meta.name} · {meta.vi}
          </span>
        </span>

        <Tappable
          ariaLabel={`Decrease ${meta.name}`}
          className="tap btn-ghost grid size-11 shrink-0 place-items-center rounded-lg text-ink-muted"
          onTap={() => onChange(value - 1)}
        >
          <span className="display text-lg leading-none">−</span>
        </Tappable>

        <span
          className="display tnum w-9 shrink-0 text-center text-xl leading-none"
          style={{ color: tone }}
          aria-hidden
        >
          {value}
        </span>

        <Tappable
          ariaLabel={`Increase ${meta.name}`}
          className="tap btn-ghost grid size-11 shrink-0 place-items-center rounded-lg text-ink-muted"
          onTap={() => onChange(value + 1)}
        >
          <span className="display text-lg leading-none">+</span>
        </Tappable>
      </div>

      {/* Length first, colour second — the bar still reads in greyscale. */}
      <div className="relative mt-2 h-7">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-surface-4/80">
          <motion.div
            className="h-full rounded-full"
            style={{ background: tone }}
            initial={false}
            animate={{ width: `${(value / STAT_MAX) * 100}%` }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          />
        </div>
        <motion.div
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-base"
          style={{ borderColor: tone, boxShadow: `0 0 10px -1px ${tone}` }}
          initial={false}
          animate={{ left: `${(value / STAT_MAX) * 100}%` }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
        <input
          type="range"
          min={0}
          max={STAT_MAX}
          step={1}
          value={value}
          aria-label={`${meta.name} (${meta.label})`}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  )
}

/* ── section heading ───────────────────────────────────────────────────────── */

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mt-5 mb-2 flex items-baseline justify-between gap-3">
      <h3 className="label-micro">{title}</h3>
      {hint && <span className="text-2xs text-ink-faint">{hint}</span>}
    </div>
  )
}

/* ── the editor ────────────────────────────────────────────────────────────── */

export function PlayerEditor({ mode, player, onClose, onSaved }: PlayerEditorProps) {
  const roster = useSquad((s) => s.roster)
  const addPlayer = useSquad((s) => s.addPlayer)
  const updatePlayer = useSquad((s) => s.updatePlayer)

  const [name, setName] = useState(player?.name ?? '')
  const [pos, setPos] = useState<Pos>(player?.pos ?? 'CM')
  const [alt, setAlt] = useState<Pos[]>(player?.alt ?? [])
  const [clubId, setClubId] = useState(player?.clubId ?? CLUBS[0]!.id)
  const [nation, setNation] = useState(player?.nation ?? '')
  const [stats, setStats] = useState<Stats>({ ...(player?.stats ?? BLANK_STATS) })
  const [photo, setPhoto] = useState<string | undefined>(player?.photo)
  const [touchedName, setTouchedName] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const ovr = ovrFromStats(pos, stats)
  const trimmed = name.trim()
  const nameError = trimmed.length === 0 ? 'A player needs a name.' : null

  // In create mode the id follows the name until the moment you save, so the
  // footer always shows the id you are actually about to get.
  const id = useMemo(
    () => (mode === 'edit' && player ? player.id : nextPlayerId((x) => x in roster, trimmed || 'player')),
    [mode, player, roster, trimmed],
  )

  const preview: Player = {
    id,
    name: trimmed || 'New player',
    pos,
    alt,
    ovr,
    stats,
    clubId,
    nation: nation.trim(),
    stamina: player?.stamina ?? NEW_DEFAULTS.stamina,
    skill: player?.skill ?? NEW_DEFAULTS.skill,
    form: player?.form ?? NEW_DEFAULTS.form,
    photo,
  }

  const nations = useMemo(
    () => Array.from(new Set(Object.values(roster).map((p) => p.nation).filter(Boolean))).sort(),
    [roster],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const setStat = (k: StatKey, v: number) => setStats((s) => ({ ...s, [k]: clampStat(v) }))

  const togglePos = (p: Pos) => {
    if (p === pos) return
    setPos(p)
    // The new natural position can't also be a secondary one.
    setAlt((a) => a.filter((x) => x !== p))
  }

  const toggleAlt = (p: Pos) => {
    if (p === pos) return
    setAlt((a) => (a.includes(p) ? a.filter((x) => x !== p) : [...a, p]))
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await readPhoto(file)
      setPhoto(dataUrl)
      toast(`Photo added · ~${photoWeightKB(dataUrl)}KB`)
    } catch {
      toast('That file could not be read as an image.', 'danger')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = () => {
    if (nameError) {
      setTouchedName(true)
      toast(nameError, 'danger')
      return
    }
    const payload = { ...preview, name: trimmed, nation: nation.trim() }
    if (mode === 'edit' && player) {
      const { id: _id, ...patch } = payload
      updatePlayer(player.id, patch)
      toast(`${trimmed} updated · OVR ${ovr}`)
    } else {
      addPlayer(payload)
      toast(`${trimmed} signed · ${pos} ${ovr}`)
    }
    onSaved?.(payload.id)
    onClose()
  }

  const tier = tierOf(ovr)

  /* The centrepiece: six rows, one per face attribute, each its own region. */
  const attributes = (
    <>
      <Section title="Attributes" hint="0 – 99" />
      <div className="grid gap-1.5">
        {STAT_ORDER.map((k) => (
          <StatRow key={k} statKey={k} value={stats[k]} onChange={(v) => setStat(k, v)} />
        ))}
      </div>
    </>
  )

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col bg-base sm:items-center sm:justify-center sm:bg-black/72 sm:p-6 sm:backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'create' ? 'Add player' : `Edit ${player?.name ?? 'player'}`}
        className="flex min-h-0 w-full flex-1 flex-col bg-base sm:max-h-[92vh] sm:max-w-[36rem] sm:flex-none sm:overflow-hidden sm:rounded-3xl sm:border sm:border-hairline sm:shadow-[0_40px_90px_-30px_rgba(0,0,0,.95)]"
        initial={{ y: 24, scale: 0.99 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      >
        {/* ── chrome ─────────────────────────────────────────────────────── */}
        <header className="pt-safe flex shrink-0 items-center gap-3 border-b border-hairline bg-navy-900/95 px-3 py-2.5 backdrop-blur-xl">
          <Tappable
            ariaLabel="Cancel"
            onTap={onClose}
            className="tap btn-ghost grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </Tappable>
          <h2 className="display flex-1 truncate text-sm tracking-[0.18em] text-ink uppercase">
            {mode === 'create' ? 'Sign a player' : 'Edit player'}
          </h2>
          <span className="label-micro shrink-0">{tier}</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
          {/* ── live card + rating ───────────────────────────────────────── */}
          <div
            className="mt-3 flex items-center gap-4 rounded-2xl border border-hairline px-4 py-4"
            style={{
              background:
                'linear-gradient(150deg, var(--color-navy-700) 0%, var(--color-navy-900) 62%)',
            }}
          >
            <div className="shrink-0">
              <PlayerToken player={preview} width={92} still />
            </div>

            <div className="min-w-0 flex-1">
              <span className="label-micro">Overall</span>
              <div className="mt-0.5 flex items-center gap-3">
                <motion.span
                  key={ovr}
                  className="display tnum text-3xl leading-none"
                  style={{ color: 'var(--color-gold-200)' }}
                  initial={{ scale: 0.85, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                >
                  {ovr}
                </motion.span>
                <OvrBadge ovr={ovr} size={38} />
              </div>
              <p className="measure mt-2 text-2xs text-ink-faint">
                Derived from the six attributes, weighted for {pos}. You tune the numbers; the
                rating follows.
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="display rounded bg-lime-500/15 px-1.5 text-2xs tracking-wider text-lime-200 uppercase ring-1 ring-lime-500/35">
                  {pos}
                </span>
                {alt.map((p) => (
                  <span
                    key={p}
                    className="display rounded bg-surface-3/70 px-1.5 text-2xs tracking-wider text-ink-muted uppercase ring-1 ring-hairline"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* photo controls sit with the card they change */}
          <div className="mt-2 flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label="Upload player photo"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Tappable
              ariaLabel="Upload photo"
              onTap={() => fileRef.current?.click()}
              className="tap btn-ghost flex flex-1 items-center justify-center rounded-xl px-3 py-2.5"
            >
              <span className="display text-xs tracking-wider uppercase">
                {photo ? 'Replace photo' : 'Upload photo'}
              </span>
            </Tappable>
            {photo && (
              <Tappable
                ariaLabel="Remove photo"
                onTap={() => {
                  setPhoto(undefined)
                  toast('Photo removed')
                }}
                className="tap btn-ghost flex items-center justify-center rounded-xl px-3 py-2.5"
                style={{ color: 'var(--color-danger)' }}
              >
                <span className="display text-xs tracking-wider uppercase">Remove</span>
              </Tappable>
            )}
          </div>

          {/* Editing an existing player is a tuning job, so the attribute rows
              lead. Signing a new one is a form, and a form whose required field
              sits under six sliders is a form people abandon — so identity leads
              in create mode and the numbers follow. */}
          {mode === 'edit' && attributes}

          {/* ── identity ─────────────────────────────────────────────────── */}
          <Section title="Identity" />
          <div className="panel-inset px-3 py-3">
            <label className="block">
              <span className="label-micro">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouchedName(true)}
                placeholder="e.g. Nguyen Van A"
                aria-label="Player name"
                aria-invalid={Boolean(touchedName && nameError)}
                autoComplete="off"
                className="display mt-1 w-full rounded-lg border bg-base/60 px-3 py-2.5 text-lg text-ink outline-none placeholder:text-ink-faint focus:border-lime-500/60"
                style={{
                  borderColor:
                    touchedName && nameError ? 'var(--color-danger)' : 'var(--color-hairline)',
                }}
              />
            </label>
            {touchedName && nameError && (
              <p className="mt-1.5 text-2xs" style={{ color: 'var(--color-danger)' }}>
                {nameError}
              </p>
            )}

            <div className="mt-3">
              <span className="label-micro">Position</span>
              <div className="mt-1.5 grid gap-1.5">
                {POS_GROUPS.map((g) => (
                  <div key={g.line} className="flex items-center gap-2">
                    <span className="label-micro w-8 shrink-0">{g.line}</span>
                    <div className="scroll-x flex flex-1 gap-1.5">
                      {g.list.map((p) => {
                        const active = p === pos
                        const secondary = alt.includes(p)
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => togglePos(p)}
                            aria-pressed={active}
                            className={`display relative shrink-0 rounded-full px-3 py-2 text-2xs tracking-widest uppercase ${
                              active
                                ? 'bg-lime-400 text-base'
                                : secondary
                                  ? 'text-lime-200 ring-1 ring-lime-500/45'
                                  : 'text-ink-muted ring-1 ring-hairline'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-2xs text-ink-faint">
                Tap to set the natural position. Secondary positions below keep chemistry when the
                shape asks him to cover.
              </p>
              <div className="scroll-x mt-1.5 flex gap-1.5">
                {POS_GROUPS.flatMap((g) => g.list)
                  .filter((p) => p !== pos)
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleAlt(p)}
                      aria-pressed={alt.includes(p)}
                      className={`display shrink-0 rounded px-2 py-1.5 text-2xs tracking-wider uppercase ${
                        alt.includes(p)
                          ? 'bg-lime-500/20 text-lime-200 ring-1 ring-lime-500/45'
                          : 'text-ink-faint ring-1 ring-hairline'
                      }`}
                    >
                      {alt.includes(p) ? `✓ ${p}` : p}
                    </button>
                  ))}
              </div>
            </div>

            <div className="mt-3">
              <span className="label-micro">Club</span>
              <div className="scroll-x mt-1.5 flex gap-1.5">
                {CLUBS.map((c) => {
                  const active = c.id === clubId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClubId(c.id)}
                      aria-pressed={active}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 ${
                        active ? 'bg-surface-3 ring-1 ring-lime-500/50' : 'ring-1 ring-hairline'
                      }`}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: c.primary }}
                        aria-hidden
                      />
                      <span
                        className={`display text-2xs tracking-wider uppercase ${
                          active ? 'text-ink' : 'text-ink-muted'
                        }`}
                      >
                        {c.short}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="mt-3 block">
              <span className="label-micro">Nation</span>
              <input
                value={nation}
                onChange={(e) => setNation(e.target.value)}
                list="editor-nations"
                placeholder="e.g. Vietnam"
                aria-label="Nation"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-hairline bg-base/60 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-lime-500/60"
              />
              <datalist id="editor-nations">
                {nations.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
          </div>

          {mode === 'create' && attributes}

          {/* fine print: the one field nobody may change */}
          <p className="mt-3 text-2xs text-ink-faint">
            <span className="label-micro">ID</span>{' '}
            <code className="font-mono text-ink-muted">{id}</code> · fixed for life — it keys{' '}
            <code className="font-mono">public/players/{id}.jpg</code> and every lineup reference.
          </p>
        </div>

        {/* ── sticky commit bar ──────────────────────────────────────────── */}
        <div className="pb-safe flex shrink-0 gap-2 border-t border-hairline bg-surface-1/95 px-4 py-3 backdrop-blur-xl">
          <Tappable
            ariaLabel="Cancel"
            onTap={onClose}
            className="tap btn-ghost flex items-center justify-center rounded-xl px-5 py-3"
          >
            <span className="display text-sm tracking-wide">Cancel</span>
          </Tappable>
          <Tappable
            ariaLabel={mode === 'create' ? 'Save new player' : 'Save changes'}
            onTap={save}
            className={`tap btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 ${
              nameError ? 'opacity-45' : ''
            }`}
          >
            <span className="display text-sm tracking-widest uppercase">
              {mode === 'create' ? 'Sign player' : 'Save'}
            </span>
            <span className="display tnum text-sm opacity-80">OVR {ovr}</span>
          </Tappable>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default PlayerEditor
