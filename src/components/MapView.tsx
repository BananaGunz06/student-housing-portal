import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { CAMPUS } from '../data/campus'
import { TRANSIT_META } from '../data/transit'
import { HOUSING_TYPE_LABELS } from '../data/types'
import { shortCommute } from '../lib/commute'
import { formatMoney } from '../lib/cost'
import type { ListingResult } from '../lib/filters'
import CommuteLayers from './CommuteLayers'
import FitBadge from './FitBadge'
import { campusIcon, TILE_ATTRIBUTION, TILE_URL } from './mapShared'
import { pricePinHtml } from './pricePin'
import SaveButton from './SaveButton'
import TransitLayer from './TransitLayer'

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Laptop split view: flies to the selected place, goes back to showing every pin when
 * the selection is cleared, and keeps Leaflet's size right when the column resizes.
 */
function SelectionCamera({ results, selected }: { results: ListingResult[]; selected: ListingResult | null }) {
  const map = useMap()
  const selectedId = selected?.listing.id ?? null
  const had = useRef(false)
  // The latest results and place, without re-running the camera when they merely re-render.
  const latest = useRef({ results, selected })
  useEffect(() => {
    latest.current = { results, selected }
  })

  useEffect(() => {
    const animate = !prefersReducedMotion()
    const { results: all, selected: sel } = latest.current
    if (sel) {
      const target: L.LatLngExpression = [sel.listing.lat, sel.listing.lng]
      if (animate) map.flyTo(target, 15, { duration: 0.8 })
      else map.setView(target, 15, { animate: false })
      had.current = true
    } else if (had.current) {
      had.current = false
      const points: L.LatLngTuple[] = [[CAMPUS.lat, CAMPUS.lng], ...all.map((r): L.LatLngTuple => [r.listing.lat, r.listing.lng])]
      map.fitBounds(points, { padding: [40, 40], animate })
    }
  }, [map, selectedId])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])

  return null
}

const iconCache = new Map<string, L.DivIcon>()
/** One icon per distinct look, so hovering doesn't rebuild every marker. */
function pinIcon(r: ListingResult, selected: boolean, hovered: boolean): L.DivIcon {
  const html = pricePinHtml(r, selected, hovered)
  let icon = iconCache.get(html)
  if (!icon) {
    icon = L.divIcon({ className: 'pin-icon', html, iconSize: [0, 0] })
    iconCache.set(html, icon)
  }
  return icon
}

/**
 * Every matching listing as a price pin, plus bus routes and campus.
 * On laptops the page passes onSelect: a pin click then selects the place (the page shows its
 * details and this map shows its commute) instead of opening the preview card used on phones.
 */
export default function MapView({
  results,
  onShowList,
  selectedId: selectedProp = null,
  hoveredId = null,
  onSelect,
  className = 'h-[calc(100dvh-14rem)] min-h-80',
  showHeading = true,
}: {
  results: ListingResult[]
  onShowList: () => void
  selectedId?: string | null
  hoveredId?: string | null
  onSelect?: (id: string) => void
  className?: string
  showHeading?: boolean
}) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)
  const selectedId = onSelect ? selectedProp : previewId
  const selected = results.find((r) => r.listing.id === selectedId) ?? null
  const select = (id: string) => (onSelect ? onSelect(id) : setPreviewId(id))

  return (
    <div className={`relative ${className}`}>
      {showHeading && <h1 className="sr-only">Map of places in Guelph for your budget</h1>}
      <MapContainer center={[CAMPUS.lat, CAMPUS.lng]} zoom={13} className="h-full w-full">
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
        <TransitLayer
          highlightRoute={selected?.commute.mode === 'bus' ? selected.commute.route.id : undefined}
        />
        {onSelect && <SelectionCamera results={results} selected={selected} />}
        {onSelect && selected && (
          <CommuteLayers key={selected.listing.id} listing={selected.listing} commute={selected.commute} />
        )}
        <Marker position={[CAMPUS.lat, CAMPUS.lng]} icon={campusIcon} zIndexOffset={500}>
          <Tooltip>{CAMPUS.name}</Tooltip>
        </Marker>
        {results.map((r) => (
          <Marker
            key={r.listing.id}
            position={[r.listing.lat, r.listing.lng]}
            icon={pinIcon(r, r.listing.id === selectedId, r.listing.id === hoveredId)}
            zIndexOffset={r.listing.id === selectedId ? 1000 : r.listing.id === hoveredId ? 800 : r.fit === 'over' ? -100 : 0}
            title={`${formatMoney(r.cost.total)} a month: ${r.listing.title}`}
            alt={`${formatMoney(r.cost.total)} a month: ${r.listing.title}`}
            eventHandlers={{ click: () => select(r.listing.id) }}
          />
        ))}
      </MapContainer>

      <p className="pointer-events-none absolute top-3 right-3 left-14 z-[1000] w-fit rounded-full bg-card/95 px-3 py-1 text-sm">
        {results.length} places, all-in prices. Bus routes: Guelph Transit, {TRANSIT_META.schedule} schedule.
      </p>

      {tilesFailed && (
        <div
          role="status"
          className="absolute inset-x-3 top-14 z-[1000] mx-auto max-w-md rounded-2xl border-2 border-over bg-card p-3"
        >
          <p className="font-bold">The map background couldn’t load.</p>
          <p className="text-sm text-ink-soft">Prices and bus routes still show. The list has everything too.</p>
          <button
            type="button"
            onClick={onShowList}
            className="mt-2 min-h-11 rounded-full bg-ink px-4 font-bold text-white"
          >
            Show list
          </button>
        </div>
      )}

      {selected && !onSelect && (
        <section
          aria-label="Selected place"
          className="absolute inset-x-3 bottom-3 z-[1000] mx-auto max-w-md rounded-2xl border border-line bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-bold">
                {formatMoney(selected.cost.total)}
                <span className="font-sans text-sm font-normal text-ink-soft"> a month, all-in</span>
              </p>
              <p className="text-sm text-ink-soft">
                {HOUSING_TYPE_LABELS[selected.listing.type]}, {shortCommute(selected.commute, { toCampus: true })}
              </p>
            </div>
            <FitBadge fit={selected.fit} />
          </div>
          <Link to={`/listing/${selected.listing.id}`} className="mt-2 block font-bold underline">
            {selected.listing.title}
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <SaveButton id={selected.listing.id} title={selected.listing.title} />
            <button
              type="button"
              className="ml-auto min-h-11 px-3 font-bold underline"
              onClick={() => setPreviewId(null)}
            >
              Close
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
