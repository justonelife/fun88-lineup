import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export type Tab = 'lineup' | 'squad' | 'tactics' | 'report'

const ICONS: Record<Tab, ReactNode> = {
  lineup: (
    <>
      <rect x="3" y="2.5" width="18" height="19" rx="2.5" />
      <path d="M3 12h18M9 2.5v3h6v-3M9 21.5v-3h6v3" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  squad: (
    <>
      <circle cx="8" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.2 2.5-5.5 5.5-5.5S13.5 16.8 13.5 20" />
      <path d="M16 6.5h5.5M16 11h5.5M16 15.5h5.5M16 20h5.5" />
    </>
  ),
  tactics: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="7" cy="18" r="2.2" />
    </>
  ),
  report: (
    <>
      <path d="M4 20V9M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
}

/* Key order drives render order: Versus → Tactics → Squad → Match. */
const LABELS: Record<Tab, string> = {
  lineup: 'Versus',
  tactics: 'Tactics',
  squad: 'Squad',
  report: 'Match',
}

interface Props {
  tab: Tab
  onTab: (t: Tab) => void
}

/** Thumb-zone navigation: 4 targets, each ≥44px, active state carried by an
 *  animated pill (shared layout) plus colour + weight, never colour alone. */
export function TabBar({ tab, onTab }: Props) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-base/90 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2">
        {(Object.keys(LABELS) as Tab[]).map((t) => {
          const active = tab === t
          return (
            <li key={t} className="flex-1">
              <button
                onClick={() => {
                  navigator.vibrate?.(6)
                  onTab(t)
                }}
                aria-current={active ? 'page' : undefined}
                className="tap relative flex w-full flex-col items-center justify-center gap-1 py-2.5"
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-x-2 inset-y-1 -z-10 rounded-xl bg-lime-500/12 ring-1 ring-lime-500/25"
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  />
                )}
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={active ? 'text-lime-300' : 'text-ink-faint'}
                >
                  {ICONS[t]}
                </svg>
                <span
                  className={`display text-2xs tracking-widest uppercase ${
                    active ? 'text-lime-200' : 'text-ink-faint'
                  }`}
                >
                  {LABELS[t]}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
