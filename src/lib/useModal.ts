import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'

/**
 * Dialog behaviour shared by the bottom sheets: focus moves in on open,
 * Tab stays inside, Escape closes, the page behind doesn't scroll, and focus
 * returns to whatever opened it.
 */
export function useModal<T extends HTMLElement>(
  onClose: () => void,
  initialFocus: RefObject<T | null>,
): RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Keep the latest onClose without re-running the open/close effect.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    initialFocus.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key !== 'Tab' || !dialogRef.current) return
      const els = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      opener?.focus()
    }
  }, [initialFocus])

  return dialogRef
}
