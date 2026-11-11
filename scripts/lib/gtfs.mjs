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

/** @param {string} d YYYYMMDD */
const dayOfWeek = (d) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8))).getUTCDay()
/** @param {Date} dt */
const ymd = (dt) => dt.toISOString().slice(0, 10).replaceAll('-', '')

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
  const v = values.slice().sort((a, b) => a - b)
  const mid = v.length >> 1
  const med = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
  return Math.max(1, Math.ceil(med - 1e-9))
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
  const rep = representativeWeekday(
    activeServicesByDate(parseCsv(files.calendar), parseCsv(files.calendar_dates ?? '')),
    allTrips,
  )
  const services = rep?.services ?? new Set()
  const trips = allTrips.filter((t) => services.has(t.service_id))
  const tripsByRoute = new Map()
  for (const t of trips) {
    if (!tripsByRoute.has(t.route_id)) tripsByRoute.set(t.route_id, [])
    tripsByRoute.get(t.route_id).push(t)
  }
  const routes = parseCsv(files.routes)
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
      const arrival = parseTime(list[nextCampus].arrival_time || list[nextCampus].departure_time)
      if (arrival < winStart || arrival > winEnd) continue
      const depart = parseTime(st.departure_time || st.arrival_time)
      const key = `${st.stop_id}|${routeId}`
      if (!rides.has(key)) rides.set(key, [])
      rides.get(key)?.push((arrival - depart) / 60)
    }
  }

  const stopFeatures = [...stopRoutes.keys()]
    .filter((id) => stopRows.has(id))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((id) => {
      const s = stopRows.get(id)
      const routeIds = [...(stopRoutes.get(id) ?? [])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      /** @type {Record<string, number>} */
      const toCampus = {}
      for (const rid of routeIds) {
        const v = rides.get(`${id}|${rid}`)
        if (v?.length) toCampus[rid] = medianMinutes(v)
      }
      /** @type {Record<string, unknown>} */
      const properties = { id, name: s?.stop_name, routes: routeIds, toCampus }
      if (isCampus(id)) properties.campus = true
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
