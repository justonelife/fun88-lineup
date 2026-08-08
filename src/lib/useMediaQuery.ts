import { useEffect, useState } from 'react'

/**
 * Breakpoint as state, for the handful of decisions CSS cannot make — here, the
 * bench switching between a scrolling side column and a horizontal rail, which
 * is a different component shape rather than a different set of classes.
 * SSR-safe: falls back to `false` until the browser is there to ask.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
