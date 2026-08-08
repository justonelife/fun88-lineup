import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useCloud } from './store/useCloud.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Cloud boot per plans/database.md §3.2: local persist has already rehydrated
// and painted above — this only ever runs if a device opted into a code.
void useCloud.getState().bootSync()

let hiddenAt = 0
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenAt = performance.now()
    useCloud.getState().flushBeacon()
  } else if (performance.now() - hiddenAt > 60_000) {
    useCloud.getState().onVisible()
  }
})
window.addEventListener('pagehide', () => useCloud.getState().flushBeacon())
window.addEventListener('online', () => useCloud.getState().onOnline())
