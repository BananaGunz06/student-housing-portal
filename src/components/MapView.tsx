import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { CAMPUS } from '../data/campus'
import { TRANSIT_META } from '../data/transit'
import { HOUSING_TYPE_LABELS } from '../data/types'
import { shortCommute } from '../lib/commute'
import { formatMoney } from '../lib/cost'
import type { ListingResult } from '../lib/filters'
import FitBadge from './FitBadge'
import { campusIcon, TILE_ATTRIBUTION, TILE_URL } from './mapShared'
import { pricePinHtml } from './pricePin'
import SaveButton from './SaveButton'
import TransitLayer from './TransitLayer'

/** Every matching listing as a price pin, plus bus routes and campus. */
export default function MapView({
  results,
  onShowList,
}: {
  results: ListingResult[]
  onShowList: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)
  const selected = results.find((r) => r.listing.id === selectedId) ?? null

  const icons = useMemo(
    () =>
      new Map(
        results.map((r) => [
          r.listing.id,
          L.divIcon({
            className: 'pin-icon',
            html: pricePinHtml(r, r.listing.id === selectedId),
            iconSize: [0, 0],
          }),
        ]),
      ),
    [results, selectedId],
  )

  return (
    <div className="relative h-[calc(100dvh-14rem)] min-h-80">
      <h1 className="sr-only">Map of places in Guelph for your budget</h1>
      <MapContainer center={[CAMPUS.lat, CAMPUS.lng]} zoom={13} className="h-full w-full">
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
        <TransitLayer
          highlightRoute={selected?.commute.mode === 'bus' ? selected.commute.route.id : undefined}
        />
        <Marker position={[CAMPUS.lat, CAMPUS.lng]} icon={campusIcon} zIndexOffset={500}>
          <Tooltip>{CAMPUS.name}</Tooltip>
        </Marker>
        {results.map((r) => (
          <Marker
            key={r.listing.id}
            position={[r.listing.lat, r.listing.lng]}
            icon={icons.get(r.listing.id)!}
            zIndexOffset={r.listing.id === selectedId ? 1000 : r.fit === 'over' ? -100 : 0}
            title={`${formatMoney(r.cost.total)} a month: ${r.listing.title}`}
            alt={`${formatMoney(r.cost.total)} a month: ${r.listing.title}`}
            eventHandlers={{ click: () => setSelectedId(r.listing.id) }}
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

      {selected && (
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
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
