import { useLayoutEffect, useRef } from 'react'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../lib/backend/demoData'

/** A slim bar above every screen in demo mode. Publishes its height as --banner-h so full-height views can allow for it. */
export default function DemoBanner() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const root = document.documentElement
    if (!el) return
    const set = () => root.style.setProperty('--banner-h', `${el.offsetHeight}px`)
    set()
    if (typeof ResizeObserver === 'undefined') return () => root.style.removeProperty('--banner-h')
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--banner-h')
    }
  }, [])
  return (
    <aside ref={ref} aria-label="Demo mode" className="bg-ink px-4 py-1.5 text-center text-xs leading-snug text-on-ink">
      <p className="font-bold">Demo mode: sample data, nothing is saved. Refresh to start over.</p>
      <p>
        Demo sign-in: <span className="sr-only">email </span>
        {DEMO_EMAIL}
        <span aria-hidden="true"> · </span>
        <span className="sr-only">, password </span>
        {DEMO_PASSWORD}
      </p>
    </aside>
  )
}
