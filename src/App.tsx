import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Header } from './components/Header'
import { TabBar, type Tab } from './components/TabBar'
import { LineupScreen } from './screens/LineupScreen'
import { TacticsScreen } from './screens/TacticsScreen'
import { SquadScreen } from './screens/SquadScreen'
import { MatchScreen } from './screens/MatchScreen'

/**
 * Shell: one sticky header (team identity + live OVR/chemistry), one scrolling
 * content column, one thumb-zone tab bar. Screens never draw their own chrome,
 * so the two fixed surfaces are the only constants on screen.
 */
export default function App() {
  const [tab, setTab] = useState<Tab>('lineup')
  const [playSignal, setPlaySignal] = useState(0)

  const play = () => {
    setTab('report')
    setPlaySignal((n) => n + 1)
  }

  return (
    <div className="relative z-10 min-h-full">
      <Header onPlay={play} />

      {/* The lineup board is a two-column workspace on a laptop; every other
          screen is a reading column and stays narrow. */}
      <main
        className={`mx-auto pt-3 ${tab === 'lineup' ? 'max-w-5xl' : 'max-w-3xl'}`}
        style={{ paddingBottom: 'calc(var(--app-tabbar-h) + var(--safe-bottom) + 1.5rem)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'lineup' && <LineupScreen />}
            {tab === 'tactics' && <TacticsScreen />}
            {tab === 'squad' && <SquadScreen />}
            {tab === 'report' && <MatchScreen playSignal={playSignal} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar tab={tab} onTab={setTab} />
    </div>
  )
}
