import { create } from 'zustand'

export type ToastTone = 'ok' | 'warn' | 'danger'

export interface ToastItem {
  id: number
  text: string
  tone: ToastTone
}

interface ToastState {
  toasts: ToastItem[]
  push: (text: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

const LIFETIME_MS = 2800
let seq = 0

export const useToast = create<ToastState>()((set) => ({
  toasts: [],
  push: (text, tone = 'ok') => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }))
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), LIFETIME_MS)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Imperative entry point — usable from stores and event handlers alike. */
export const toast = (text: string, tone?: ToastTone) => useToast.getState().push(text, tone)
