import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Tappable } from './ui/Tappable'
import { toast } from '../store/useToast'

interface Album {
  id: string
  label: string
  photos: string[]
}

interface Manifest {
  albums: Album[]
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
}

/** Ignore scrim pointerdowns this soon after mount — same touch-safe pattern as Sheet. */
const SCRIM_GUARD_MS = 250
/** Thumbnails rendered per "load more" page — keeps the initial paint cheap across 602 photos. */
const PAGE_SIZE = 60

/** 512px centre-crop — ample for the largest avatar we render, and displaying it needs no CORS. */
const THUMB = '=w512-h512-c'

export function PhotoPicker({ open, onClose, onSelect }: Props) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState(false)
  const [albumId, setAlbumId] = useState<string>('all')
  const [page, setPage] = useState(1)
  const openedAt = useRef(0)

  useEffect(() => {
    if (!open || manifest || error) return
    let cancelled = false
    fetch('/team-photos.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<Manifest>
      })
      .then((data) => {
        if (!cancelled) setManifest(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, manifest, error])

  useEffect(() => {
    if (!open) return
    openedAt.current = performance.now()
    setPage(1)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  // Flattened list of { album label, index within album, url } for the active tab,
  // so "All" can still show a per-album badge on each card.
  const items = useMemo(() => {
    if (!manifest) return []
    const albums = albumId === 'all' ? manifest.albums : manifest.albums.filter((a) => a.id === albumId)
    return albums.flatMap((a) => a.photos.map((url, i) => ({ url, label: a.label, index: i + 1 })))
  }, [manifest, albumId])

  const visible = items.slice(0, page * PAGE_SIZE)

  const pick = (item: { url: string; label: string; index: number }) => {
    onSelect(item.url + THUMB)
    onClose()
    toast(`Photo set · ${item.label} · ${String(item.index).padStart(3, '0')}`)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col bg-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (performance.now() - openedAt.current < SCRIM_GUARD_MS) return
            onClose()
          }}
        >
          <header className="pt-safe flex shrink-0 items-center gap-3 border-b border-hairline bg-navy-900/95 px-3 py-2.5 backdrop-blur-xl">
            <Tappable
              ariaLabel="Close"
              onTap={onClose}
              className="tap btn-ghost grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </Tappable>
            <h2 className="display flex-1 truncate text-sm tracking-[0.18em] text-ink uppercase">
              Team gallery
            </h2>
          </header>

          {manifest && (
            <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-hairline px-3 py-2.5">
              {[{ id: 'all', label: 'All', photos: manifest.albums.flatMap((a) => a.photos) }, ...manifest.albums].map(
                (a) => (
                  <Tappable
                    key={a.id}
                    ariaLabel={a.label}
                    ariaSelected={albumId === a.id}
                    onTap={() => {
                      setAlbumId(a.id)
                      setPage(1)
                    }}
                    className={`tap shrink-0 rounded-full px-3 py-1.5 ${
                      albumId === a.id ? 'bg-lime-500/20 ring-1 ring-lime-500/50' : 'btn-ghost'
                    }`}
                  >
                    <span
                      className={`display text-2xs tracking-wider uppercase ${
                        albumId === a.id ? 'text-lime-200' : 'text-ink-muted'
                      }`}
                    >
                      {a.label} · {a.photos.length}
                    </span>
                  </Tappable>
                ),
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8">
            {error && (
              <p className="measure mt-6 text-center text-xs text-ink-faint">
                Could not load the team gallery. Check your connection and try again.
              </p>
            )}

            {!manifest && !error && (
              <p className="measure mt-6 text-center text-xs text-ink-faint">Loading gallery…</p>
            )}

            {manifest && (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {visible.map((item) => (
                    <Tappable
                      key={item.url}
                      as="div"
                      ariaLabel={`${item.label} photo ${item.index}`}
                      onTap={() => pick(item)}
                      className="tap relative aspect-square overflow-hidden rounded-xl border border-hairline bg-surface-2"
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '160px 160px' }}
                    >
                      <img
                        src={item.url + THUMB}
                        loading="lazy"
                        decoding="async"
                        alt=""
                        className="size-full object-cover"
                        draggable={false}
                      />
                      <span className="display absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] tracking-wide text-ink-muted uppercase">
                        {item.label} · {String(item.index).padStart(3, '0')}
                      </span>
                    </Tappable>
                  ))}
                </div>

                {visible.length < items.length && (
                  <div className="mt-4 flex justify-center">
                    <Tappable
                      ariaLabel="Load more photos"
                      onTap={() => setPage((p) => p + 1)}
                      className="tap btn-ghost rounded-xl px-4 py-2.5"
                    >
                      <span className="display text-xs tracking-wider uppercase">
                        Load more · {items.length - visible.length} left
                      </span>
                    </Tappable>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
