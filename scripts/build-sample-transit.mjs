// Builds the hand-made SAMPLE bus network for Guelph used in v1.
// The real Guelph Transit GTFS feed could not be fetched from the build
// environment, so these routes and stops are approximate and for demo only.
// Run: node scripts/build-sample-transit.mjs
import { writeFileSync } from 'node:fs'

const CAMPUS = { name: 'University Centre', lat: 43.5305, lng: -80.2262 }

// Each route is a list of [name, lat, lng]; every vertex is a stop.
const routes = [
  {
    id: '99',
    name: 'Route 99 Mainline',
    color: '#2563eb',
    stops: [
      ['Woodlawn & Woolwich', 43.572, -80.262],
      ['Woolwich & Speedvale', 43.56, -80.256],
      ['Guelph Central Station', 43.544, -80.2485],
      ['Gordon & Wellington', 43.54, -80.242],
      ['Gordon & Dean', 43.536, -80.234],
      [CAMPUS.name, CAMPUS.lat, CAMPUS.lng],
      ['Gordon & Stone', 43.519, -80.225],
      ['Gordon & Kortright', 43.508, -80.22],
      ['Gordon & Clair', 43.496, -80.212],
    ],
  },
  {
    id: '50',
    name: 'Route 50 Stone Road',
    color: '#16a34a',
    stops: [
      ['Stone Road Mall', 43.515, -80.256],
      ['Stone & Scottsdale', 43.5165, -80.244],
      ['Stone & Hanlon Creek', 43.5185, -80.233],
      ['Stone & Gordon (west)', 43.525, -80.228],
      [CAMPUS.name, CAMPUS.lat, CAMPUS.lng],
      ['Stone & East Ring', 43.526, -80.218],
      ['Stone & Victoria', 43.527, -80.2],
      ['Stone & Watson', 43.53, -80.188],
    ],
  },
  {
    id: '20',
    name: 'Route 20 Edinburgh',
    color: '#c026d3',
    stops: [
      ['Edinburgh & Willow', 43.565, -80.278],
      ['Edinburgh & Speedvale', 43.552, -80.27],
      ['Edinburgh & Paisley', 43.545, -80.266],
      ['Edinburgh & College', 43.531, -80.26],
      ['College & Lansdown', 43.5315, -80.245],
      ['College & Gordon', 43.532, -80.234],
      [CAMPUS.name, CAMPUS.lat, CAMPUS.lng],
    ],
  },
  {
    id: '40',
    name: 'Route 40 Victoria',
    color: '#ea580c',
    stops: [
      ['Eramosa & Victoria', 43.556, -80.205],
      ['York & Victoria', 43.545, -80.213],
      ['Victoria & Ireland', 43.54, -80.215],
      ['College & Victoria', 43.533, -80.215],
      [CAMPUS.name, CAMPUS.lat, CAMPUS.lng],
    ],
  },
]

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const stops = new Map()
for (const r of routes) {
  for (const [name, lat, lng] of r.stops) {
    const id = name === CAMPUS.name ? 'campus' : slug(name)
    const s = stops.get(id) ?? { id, name, lat, lng, routes: [] }
    if (!s.routes.includes(r.id)) s.routes.push(r.id)
    stops.set(id, s)
  }
}

const stopsGeo = {
  type: 'FeatureCollection',
  features: [...stops.values()].map((s) => ({
    type: 'Feature',
    properties: { id: s.id, name: s.name, routes: s.routes },
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
  })),
}
const routesGeo = {
  type: 'FeatureCollection',
  features: routes.map((r) => ({
    type: 'Feature',
    properties: { id: r.id, name: r.name, color: r.color },
    geometry: { type: 'LineString', coordinates: r.stops.map(([, lat, lng]) => [lng, lat]) },
  })),
}
writeFileSync('src/data/transit/stops.geojson', JSON.stringify(stopsGeo, null, 2) + '\n')
writeFileSync('src/data/transit/routes.geojson', JSON.stringify(routesGeo, null, 2) + '\n')
console.log(`${stops.size} stops, ${routes.length} routes`)
