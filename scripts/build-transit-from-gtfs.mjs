// Builds src/data/transit/{routes,stops}.geojson and meta.json from Guelph Transit's GTFS feed.
// Run: node scripts/build-transit-from-gtfs.mjs [path-to-zip]
// Without a path the latest feed is downloaded from the Mobility Database.
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { buildNetwork, scheduleLabel, serviceDates } from './lib/gtfs.mjs'

const FEED_URL = 'https://files.mobilitydatabase.org/mdb-3140/latest.zip'
const SOURCE = 'https://mobilitydatabase.org/feeds/gtfs/mdb-3140'
const out = (name) => new URL(`../src/data/transit/${name}`, import.meta.url)

const arg = process.argv[2]
let zip
if (arg) {
  zip = new Uint8Array(readFileSync(arg))
} else {
  const res = await fetch(FEED_URL)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  zip = new Uint8Array(await res.arrayBuffer())
}

const wanted = ['routes', 'trips', 'stop_times', 'stops', 'shapes', 'calendar', 'calendar_dates']
const entries = unzipSync(zip, { filter: (f) => wanted.some((w) => f.name === `${w}.txt`) })
const files = {}
for (const w of wanted) {
  if (w === 'calendar_dates' && !entries[`${w}.txt`]) continue
  if (!entries[`${w}.txt`]) throw new Error(`Feed is missing ${w}.txt`)
  files[w] = strFromU8(entries[`${w}.txt`])
}

const { routes, stops, representativeDate } = buildNetwork(files)
const { serviceStart, serviceEnd } = serviceDates(files.calendar)
const meta = {
  schedule: scheduleLabel(serviceStart),
  serviceStart,
  serviceEnd,
  source: SOURCE,
  representativeDate,
  generated: new Date().toISOString().slice(0, 10),
  note: 'Times come from one typical weekday timetable (representativeDate), the Mon-Fri date with the most trips after calendar_dates additions and removals. Ride times: median scheduled minutes to the University Centre for arrivals 07:00-10:00. One-transfer trips: departures 06:30-09:30, a walk of up to 150 m between stops if the second bus boards elsewhere, and 5 minutes added to change buses.',
}

writeFileSync(out('routes.geojson'), JSON.stringify(routes))
writeFileSync(out('stops.geojson'), JSON.stringify(stops))
writeFileSync(out('meta.json'), JSON.stringify(meta, null, 2) + '\n')

const pairs = stops.features.reduce((n, f) => n + Object.keys(f.properties.toCampus).length, 0)
const kb = (name) => (statSync(out(name)).size / 1024).toFixed(1) + ' KB'
console.log(`Schedule: ${meta.schedule} (${serviceStart} to ${serviceEnd})`)
console.log(`Representative weekday: ${representativeDate}`)
console.log(`Routes: ${routes.features.length} (${routes.features.reduce((n, f) => n + f.geometry.coordinates.length, 0)} lines)`)
console.log(`Stops: ${stops.features.length} (${stops.features.filter((f) => f.properties.campus).length} campus)`)
console.log(`Ride-time pairs: ${pairs}`)
console.log(`routes.geojson ${kb('routes.geojson')}, stops.geojson ${kb('stops.geojson')}`)
