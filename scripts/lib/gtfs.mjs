// Pure helpers that turn a Guelph Transit GTFS feed into the small files the app reads.
// No file or network access in here, so everything is unit-testable.

/** @typedef {Record<string, string>} Row */
/** @typedef {[number, number]} LonLat */
/**
 * @typedef {object} GtfsFiles
 * @property {string} routes routes.txt
 * @property {string} trips trips.txt
 * @property {string} stop_times stop_times.txt
 * @property {string} stops stops.txt
 * @property {string} shapes shapes.txt
 * @property {string} calendar calendar.txt
 * @property {string} [calendar_dates] calendar_dates.txt (optional)
 */
/**
 * @typedef {object} BuildOptions
 * @property {string[]} [excludeRoutes] route_short_name values to drop
 * @property {string} [campusPrefix] stop names starting with this are the campus
 * @property {number} [tolerance] line simplification tolerance in metres
 * @property {number} [windowStart] earliest campus arrival, seconds after midnight
 * @property {number} [windowEnd] latest campus arrival, seconds after midnight
 */

export const EXCLUDED_ROUTES = ['BREW', 'ZehrsGS', 'HMidGCS', 'HMidUC']
export const CAMPUS_PREFIX = 'University Centre'
export const TOLERANCE_M = 10
export const WINDOW_START = 7 * 3600
export const WINDOW_END = 10 * 3600
/** Minutes allowed for changing buses on a one-transfer trip. */
export const TRANSFER_MINUTES = 5
/** Departures from the first stop of a transfer trip, seconds after midnight. */
export const TRANSFER_DEPART_START = 6.5 * 3600
export const TRANSFER_DEPART_END = 9.5 * 3600
/** The second bus may board at any stop within this many metres of where the first one stops. */
export const TRANSFER_RADIUS_M = 150
const DETOUR_FACTOR = 1.3
const WALK_M_PER_MIN = 80

/** Great-circle distance in metres between two { lat, lon } points. */
function metres(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** Minutes to walk a straight-line distance (detour x1.3 at 80 m/min); 0 for the same stop, at least 1 otherwise. */
export function transferWalkMinutes(m, sameStop = false) {
  return sameStop ? 0 : Math.max(1, Math.ceil((m * DETOUR_FACTOR) / WALK_M_PER_MIN - 1e-9))
}

/**
 * Parse CSV text (RFC 4180 quotes, optional BOM) into rows keyed by header.
 * Values are trimmed because the feed pads times with a leading space.
 * @param {string} text
 * @returns {Row[]}
 */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  /** @type {string[][]} */
  const records = []
  let record = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      record.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      record.push(field)
      field = ''
      if (record.length > 1 || record[0] !== '') records.push(record)
      record = []
    } else field += c
  }
  if (field !== '' || record.length) {
    record.push(field)
    records.push(record)
  }
  const [header = [], ...body] = records
  const keys = header.map((h) => h.trim())
  return body.map((r) => {
    /** @type {Row} */
    const row = {}
    keys.forEach((k, i) => {
      row[k] = (r[i] ?? '').trim()
    })
    return row
  })
}

/**
 * "6:05:30" (or " 25:10:00") to seconds after midnight; hours may exceed 24.
 * @param {string} s
 * @returns {number}
 */
export function parseTime(s) {
  const [h, m, sec] = s.trim().split(':').map(Number)
  return h * 3600 + m * 60 + (sec || 0)
}

/**
 * Service ids that run on at least one weekday (Mon-Fri).
 * @param {Row[]} calendar
 * @returns {Set<string>}
 */
export function weekdayServices(calendar) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  return new Set(calendar.filter((r) => days.some((d) => r[d] === '1')).map((r) => r.service_id))
}

/**
 * What riders see: the short name when it is a route number ("99", "50 U"),
 * otherwise the long name ("Ironwood Harvard") because codes like "IroHarv" mean nothing to students.
 * @param {string} shortName
 * @param {string} longName
 */
export function routeLabel(shortName, longName) {
  const short = (shortName ?? '').trim()
  return /^\d+(\s?[A-Za-z])?$/.test(short) ? short : (longName ?? '').trim() || short
}

/** @param {string} d YYYYMMDD */
const dayOfWeek = (d) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8))).getUTCDay()
/** @param {Date} dt */
const ymd = (dt) => dt.toISOString().slice(0, 10).replaceAll('-', '')

/**
 * First of the given time strings that parses to a number, else NaN.
 * @param {...string} times
 */
function firstFinite(...times) {
  for (const t of times) {
    const n = t ? parseTime(t) : NaN
    if (Number.isFinite(n)) return n
  }
  return NaN
}

/**
 * Service ids active on each date: calendar.txt weekday flags inside start/end, plus
 * calendar_dates exception 1 (added), minus exception 2 (removed).
 * @param {Row[]} calendar
 * @param {Row[]} calendarDates
 * @returns {Map<string, Set<string>>} YYYYMMDD to service ids
 */
export function activeServicesByDate(calendar, calendarDates) {
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  /** @type {Map<string, Set<string>>} */
  const byDate = new Map()
  const at = (/** @type {string} */ d) => {
    if (!byDate.has(d)) byDate.set(d, new Set())
    return /** @type {Set<string>} */ (byDate.get(d))
  }
  for (const r of calendar) {
    const end = Date.UTC(+r.end_date.slice(0, 4), +r.end_date.slice(4, 6) - 1, +r.end_date.slice(6, 8))
    for (let t = Date.UTC(+r.start_date.slice(0, 4), +r.start_date.slice(4, 6) - 1, +r.start_date.slice(6, 8)); t <= end; t += 86400000) {
      const d = ymd(new Date(t))
      if (r[names[new Date(t).getUTCDay()]] === '1') at(d).add(r.service_id)
    }
  }
  for (const e of calendarDates) if (e.exception_type === '1') at(e.date).add(e.service_id)
  for (const e of calendarDates) if (e.exception_type === '2') byDate.get(e.date)?.delete(e.service_id)
  return byDate
}

/**
 * The Monday-Friday date whose active services run the most trips (ties: earliest).
 * @param {Map<string, Set<string>>} byDate
 * @param {Row[]} trips
 * @returns {{ date: string, services: Set<string> } | null} date is YYYYMMDD
 */
export function representativeWeekday(byDate, trips) {
  /** @type {Map<string, number>} */
  const perService = new Map()
  for (const t of trips) perService.set(t.service_id, (perService.get(t.service_id) ?? 0) + 1)
  let best = null
  let bestCount = -1
  for (const date of [...byDate.keys()].sort()) {
    const dow = dayOfWeek(date)
    if (dow < 1 || dow > 5) continue
    const services = /** @type {Set<string>} */ (byDate.get(date))
    let count = 0
    for (const id of services) count += perService.get(id) ?? 0
    if (count > bestCount) {
      bestCount = count
      best = { date, services }
    }
  }
  return best
}

/**
 * Metres east/north of a reference point (equirectangular, fine at city scale).
 * @param {LonLat} p
 * @param {number} lat0
 */
function project([lon, lat], lat0) {
  const R = 6371008.8
  const rad = Math.PI / 180
  return [R * lon * rad * Math.cos(lat0 * rad), R * lat * rad]
}

/**
 * Distance in metres from point p to segment a-b (all projected).
 * @param {number[]} p
 * @param {number[]} a
 * @param {number[]} b
 */
function segDistance(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/**
 * Douglas-Peucker line simplification with the tolerance in metres.
 * Endpoints are always kept; every dropped point lies within tolerance of the result.
 * @param {LonLat[]} points [lon, lat] pairs
 * @param {number} toleranceM
 * @returns {LonLat[]}
 */
export function simplifyLine(points, toleranceM) {
  if (points.length <= 2) return points.slice()
  const lat0 = points.reduce((s, p) => s + p[1], 0) / points.length
  const xy = points.map((p) => project(p, lat0))
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [lo, hi] = /** @type {number[]} */ (stack.pop())
    let worst = -1
    let at = -1
    for (let i = lo + 1; i < hi; i++) {
      const d = segDistance(xy[i], xy[lo], xy[hi])
      if (d > worst) {
        worst = d
        at = i
      }
    }
    if (worst > toleranceM) {
      keep[at] = 1
      stack.push([lo, at], [at, hi])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** @param {number} n */
const round5 = (n) => Math.round(n * 1e5) / 1e5

/**
 * Median of numbers, rounded up, at least 1.
 * @param {number[]} values
 */
export function medianMinutes(values) {
  return Math.max(1, Math.ceil(rawMedian(values) - 1e-9))
}

/**
 * Median without rounding (NaN when there are no finite values).
 * @param {number[]} values
 */
function rawMedian(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b)
  const mid = v.length >> 1
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

/**
 * Natural-ish order for route short names: numbers first by value, then text.
 * @param {string} a
 * @param {string} b
 */
const byShortName = (a, b) => a.localeCompare(b, 'en', { numeric: true })

/**
 * Build the app's routes and stops GeoJSON from raw GTFS file contents.
 * Uses one representative weekday (the Mon-Fri date with the most trips, after applying
 * calendar_dates additions and removals); its date is returned as `representativeDate`.
 * @param {GtfsFiles} files
 * @param {BuildOptions} [options]
 */
export function buildNetwork(files, options = {}) {
  const excluded = new Set(options.excludeRoutes ?? EXCLUDED_ROUTES)
  const campusPrefix = options.campusPrefix ?? CAMPUS_PREFIX
  const tolerance = options.tolerance ?? TOLERANCE_M
  const winStart = options.windowStart ?? WINDOW_START
  const winEnd = options.windowEnd ?? WINDOW_END

  const allTrips = parseCsv(files.trips)
  const allRoutes = parseCsv(files.routes)
  const keptRouteIds = new Set(allRoutes.filter((r) => !excluded.has(r.route_short_name)).map((r) => r.route_id))
  const rep = representativeWeekday(
    activeServicesByDate(parseCsv(files.calendar), parseCsv(files.calendar_dates ?? '')),
    allTrips.filter((t) => keptRouteIds.has(t.route_id)),
  )
  const services = rep?.services ?? new Set()
  const trips = allTrips.filter((t) => services.has(t.service_id))
  const tripsByRoute = new Map()
  for (const t of trips) {
    if (!tripsByRoute.has(t.route_id)) tripsByRoute.set(t.route_id, [])
    tripsByRoute.get(t.route_id).push(t)
  }
  const routes = allRoutes
    .filter((r) => !excluded.has(r.route_short_name) && tripsByRoute.has(r.route_id))
    .sort((a, b) => byShortName(a.route_short_name, b.route_short_name))
  const keptIds = new Set(routes.map((r) => r.route_id))
  const tripRoute = new Map()
  for (const t of trips) if (keptIds.has(t.route_id)) tripRoute.set(t.trip_id, t.route_id)

  // Route lines: every distinct shape, simplified, deduped.
  const shapePoints = new Map()
  for (const p of parseCsv(files.shapes)) {
    if (!shapePoints.has(p.shape_id)) shapePoints.set(p.shape_id, [])
    shapePoints.get(p.shape_id).push([Number(p.shape_pt_sequence), Number(p.shape_pt_lon), Number(p.shape_pt_lat)])
  }
  const routeFeatures = routes.map((r) => {
    const seen = new Set()
    /** @type {LonLat[][]} */
    const lines = []
    const shapeIds = [...new Set(tripsByRoute.get(r.route_id).map((t) => t.shape_id).filter(Boolean))]
    for (const id of shapeIds) {
      const pts = (shapePoints.get(id) ?? []).sort((a, b) => a[0] - b[0]).map((p) => /** @type {LonLat} */ ([p[1], p[2]]))
      if (pts.length < 2) continue
      const line = simplifyLine(pts, tolerance).map(([x, y]) => /** @type {LonLat} */ ([round5(x), round5(y)]))
      const key = JSON.stringify(line)
      if (seen.has(key)) continue
      seen.add(key)
      lines.push(line)
    }
    return {
      type: 'Feature',
      properties: {
        id: r.route_id,
        shortName: r.route_short_name,
        longName: r.route_long_name,
        label: routeLabel(r.route_short_name, r.route_long_name),
        color: '#' + (r.route_color || '888888').replace(/^#/, '').toUpperCase(),
      },
      geometry: { type: 'MultiLineString', coordinates: lines },
    }
  })

  // Stops and ride times.
  const stopRows = new Map(parseCsv(files.stops).map((s) => [s.stop_id, s]))
  const isCampus = (/** @type {string} */ id) => (stopRows.get(id)?.stop_name ?? '').startsWith(campusPrefix)

  /** @type {Map<string, Row[]>} */
  const timesByTrip = new Map()
  for (const st of parseCsv(files.stop_times)) {
    if (!tripRoute.has(st.trip_id)) continue
    if (!timesByTrip.has(st.trip_id)) timesByTrip.set(st.trip_id, [])
    timesByTrip.get(st.trip_id)?.push(st)
  }
  /** @type {Map<string, Set<string>>} */
  const stopRoutes = new Map()
  /** @type {Map<string, number[]>} key `${stopId}|${routeId}` */
  const rides = new Map()
  for (const [tripId, list] of timesByTrip) {
    const routeId = tripRoute.get(tripId)
    list.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence))
    for (const st of list) {
      if (!stopRoutes.has(st.stop_id)) stopRoutes.set(st.stop_id, new Set())
      stopRoutes.get(st.stop_id)?.add(routeId)
    }
    // Walk backwards so `nextCampus` is always the first campus stop after i.
    let nextCampus = -1
    for (let i = list.length - 1; i >= 0; i--) {
      const st = list[i]
      if (isCampus(st.stop_id)) {
        nextCampus = i
        continue
      }
      if (nextCampus < 0) continue
      // Blank times fall back to the other column; rows with neither are skipped.
      const arrival = firstFinite(list[nextCampus].arrival_time, list[nextCampus].departure_time)
      const depart = firstFinite(st.departure_time, st.arrival_time)
      if (!Number.isFinite(arrival) || !Number.isFinite(depart)) continue
      if (arrival < winStart || arrival > winEnd) continue
      const key = `${st.stop_id}|${routeId}`
      if (!rides.has(key)) rides.set(key, [])
      rides.get(key)?.push((arrival - depart) / 60)
    }
  }

  // Direct ride times per stop: stop id to { routeId: minutes }.
  /** @type {Map<string, Record<string, number>>} */
  const direct = new Map()
  for (const [id, routeSet] of stopRoutes) {
    /** @type {Record<string, number>} */
    const toCampus = {}
    for (const rid of [...routeSet].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
      const v = rides.get(`${id}|${rid}`)?.filter(Number.isFinite)
      if (v?.length) toCampus[rid] = medianMinutes(v)
    }
    direct.set(id, toCampus)
  }

  // One-transfer trips: ride route R1 from S to a later stop B (before the trip reaches campus),
  // then board a different route R2 at B or at any other non-campus stop within TRANSFER_RADIUS_M of B
  // (walk there, then TRANSFER_MINUTES to change) that goes directly to campus.
  /** @type {Map<string, number[]>} key `S|R1|B` */
  const legs = new Map()
  for (const [tripId, list] of timesByTrip) {
    const r1 = tripRoute.get(tripId)
    for (let i = 0; i < list.length; i++) {
      const from = list[i]
      if (isCampus(from.stop_id)) continue
      const depart = firstFinite(from.departure_time, from.arrival_time)
      if (!Number.isFinite(depart) || depart < TRANSFER_DEPART_START || depart > TRANSFER_DEPART_END) continue
      for (let j = i + 1; j < list.length; j++) {
        const to = list[j]
        if (isCampus(to.stop_id)) break
        if (to.stop_id === from.stop_id) continue
        const arrive = firstFinite(to.arrival_time, to.departure_time)
        if (!Number.isFinite(arrive)) continue
        const key = `${from.stop_id}|${r1}|${to.stop_id}`
        if (!legs.has(key)) legs.set(key, [])
        legs.get(key)?.push((arrive - depart) / 60)
      }
    }
  }

  // Neighbour index: for each stop, the boarding stops (itself first) within the radius that have a direct ride.
  const CELL = 0.002 // degrees; larger than the radius in both directions at this latitude
  const pos = (/** @type {string} */ id) => {
    const r = stopRows.get(id)
    return { lat: Number(r?.stop_lat), lon: Number(r?.stop_lon) }
  }
  const cellOf = (/** @type {{lat:number,lon:number}} */ p) => [Math.floor(p.lat / CELL), Math.floor(p.lon / CELL)]
  /** @type {Map<string, string[]>} */
  const grid = new Map()
  const boardable = [...direct.keys()]
    .filter((id) => stopRows.has(id) && !isCampus(id) && Object.keys(direct.get(id) ?? {}).length > 0)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  for (const id of boardable) {
    const [cy, cx] = cellOf(pos(id))
    const k = `${cy}|${cx}`
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k)?.push(id)
  }
  /** @type {Map<string, { id: string, walk: number }[]>} */
  const neighbours = new Map()
  const boardingOptions = (/** @type {string} */ b) => {
    const cached = neighbours.get(b)
    if (cached) return cached
    const p = pos(b)
    const [cy, cx] = cellOf(p)
    /** @type {{ id: string, walk: number }[]} */
    const found = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const id of grid.get(`${cy + dy}|${cx + dx}`) ?? []) {
          if (id === b) continue
          const m = metres(p, pos(id))
          if (m <= TRANSFER_RADIUS_M) found.push({ id, walk: transferWalkMinutes(m) })
        }
      }
    }
    found.sort((x, y) => x.walk - y.walk || x.id.localeCompare(y.id, 'en', { numeric: true }))
    const out = (direct.get(b) && Object.keys(direct.get(b)).length && !isCampus(b) ? [{ id: b, walk: 0 }] : []).concat(found)
    neighbours.set(b, out)
    return out
  }

  /** @type {Map<string, { total: number, firstRoute: string, secondRoute: string, board: string, alight: string }>} */
  const bestTransfer = new Map()
  for (const key of [...legs.keys()].sort()) {
    const [sid, r1, bid] = key.split('|')
    const ride = rawMedian(/** @type {number[]} */ (legs.get(key)))
    for (const { id: nid, walk } of boardingOptions(bid)) {
      for (const [r2, rideTwo] of Object.entries(direct.get(nid) ?? {})) {
        if (r2 === r1) continue
        const total = ride + walk + TRANSFER_MINUTES + rideTwo
        const cur = bestTransfer.get(sid)
        if (!cur || total < cur.total) bestTransfer.set(sid, { total, firstRoute: r1, secondRoute: r2, board: nid, alight: bid })
      }
    }
  }

  const stopFeatures = [...stopRoutes.keys()]
    .filter((id) => stopRows.has(id))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((id) => {
      const s = stopRows.get(id)
      const routeIds = [...(stopRoutes.get(id) ?? [])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      const toCampus = direct.get(id) ?? {}
      /** @type {Record<string, unknown>} */
      const properties = { id, name: s?.stop_name, routes: routeIds, toCampus }
      if (isCampus(id)) properties.campus = true
      const t = bestTransfer.get(id)
      if (t && !isCampus(id)) {
        const minutes = Math.max(1, Math.ceil(t.total - 1e-9))
        const best = Math.min(...Object.values(toCampus))
        // Only worth storing when no direct ride is at least as good.
        if (!(best <= minutes)) {
          properties.viaTransfer = {
            minutes,
            firstRoute: t.firstRoute,
            secondRoute: t.secondRoute,
            transferStop: { id: t.board, name: stopRows.get(t.board)?.stop_name },
          }
          if (t.alight !== t.board) {
            properties.viaTransfer.alightStop = { id: t.alight, name: stopRows.get(t.alight)?.stop_name }
          }
        }
      }
      return {
        type: 'Feature',
        properties,
        geometry: { type: 'Point', coordinates: [round5(Number(s?.stop_lon)), round5(Number(s?.stop_lat))] },
      }
    })

  return {
    routes: { type: 'FeatureCollection', features: routeFeatures },
    stops: { type: 'FeatureCollection', features: stopFeatures },
    representativeDate: rep ? isoDate(rep.date) : null,
  }
}

/** @param {string} d YYYYMMDD */
export const isoDate = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`

/**
 * "Winter 2026" from a YYYY-MM-DD service start (Jan-Apr Winter, May-Aug Summer, Sep-Dec Fall).
 * @param {string} serviceStart
 */
export function scheduleLabel(serviceStart) {
  const month = Number(serviceStart.slice(5, 7))
  const season = month <= 4 ? 'Winter' : month <= 8 ? 'Summer' : 'Fall'
  return `${season} ${serviceStart.slice(0, 4)}`
}

/**
 * Service dates from the weekday calendar rows (earliest start, latest end).
 * @param {string} calendarText
 */
export function serviceDates(calendarText) {
  const rows = parseCsv(calendarText).filter((r) => weekdayServices([r]).size)
  const starts = rows.map((r) => r.start_date).sort()
  const ends = rows.map((r) => r.end_date).sort()
  return { serviceStart: isoDate(starts[0]), serviceEnd: isoDate(ends[ends.length - 1]) }
}
