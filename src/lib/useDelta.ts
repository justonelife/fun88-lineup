import { useEffect, useRef, useState } from 'react'

/**
 * Tracks the previous value of a number and surfaces the change for ~2s so the
 * UI can show "87 → 88" style feedback right where the number lives.
 */
export function useDelta(value: number, holdMs = 2400) {
  const prev = useRef(value)
  const [delta, setDelta] = useState<{ from: number; to: number } | null>(null)

  useEffect(() => {
    if (prev.current === value) return
    const from = prev.current
    prev.current = value
    setDelta({ from, to: value })
    const t = window.setTimeout(() => setDelta(null), holdMs)
    return () => window.clearTimeout(t)
  }, [value, holdMs])

  return delta
}
