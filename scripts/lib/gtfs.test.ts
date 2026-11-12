import { describe, expect, it } from 'vitest'
import {
  buildNetwork,
  medianMinutes,
  parseCsv,
  parseTime,
  activeServicesByDate,
  representativeWeekday,
  scheduleLabel,
  serviceDates,
  simplifyLine,
  routeLabel,
  TRANSFER_MINUTES,
} from './gtfs.mjs'

// A tiny hand-written feed. Route 99 (colour FF0000) runs weekdays; BREW is excluded;
// route 7 only runs on Saturdays so it has no weekday trips.
const feed = {
  calendar: `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
1,1,1,1,1,1,0,0,20260104,20260502
2,0,0,0,0,0,1,0,20260104,20260502
`,
  routes: `route_id,agency_id,route_short_name,route_long_name,route_color
r99,1,99,Mainline,ff0000
rb,1,BREW,Brewery shuttle,00ff00
r7,1,7,Saturday only,0000ff
r50,1,50 U,Campus loop,112233
`,
  trips: `route_id,service_id,trip_id,trip_headsign,shape_id
r99,1,T1,Campus,S1
r99,1,T2,Campus,S2
r99,1,T3,Late,S1
r99,1,T4,Loop,S1
rb,1,TB,Brew,S1
r7,2,T7,Sat,S1
r50,1,T50,Loop,S3
r99,1,T5,Double,S1
r99,1,T6,Blank,S1
`,
  // Times carry a leading space like the real feed.
  stop_times: `trip_id,arrival_time,departure_time,stop_id,stop_sequence
T1, 7:00:00, 7:00:00,A,1
T1, 7:05:00, 7:05:00,B,2
T1, 7:07:00, 7:07:00,E,3
T1, 7:12:00, 7:12:00,U1,4
T1, 7:20:00, 7:20:00,C,5
T2, 8:00:00, 8:00:00,A,1
T2, 8:05:00, 8:05:00,B,2
T2, 8:09:00, 8:09:00,E,3
T2, 8:15:00, 8:15:00,U1,4
T3, 11:00:00, 11:00:00,A,1
T3, 11:05:00, 11:05:00,U1,2
T4, 9:00:00, 9:00:00,B,1
T4, 9:10:00, 9:10:00,U1,2
T4, 9:20:00, 9:20:00,A,3
T4, 9:30:00, 9:30:00,U2,4
TB, 7:00:00, 7:00:00,X,1
TB, 7:10:00, 7:10:00,U1,2
T7, 8:00:00, 8:00:00,Y,1
T5, 7:30:00, 7:30:00,F,1
T5, 7:40:00, 7:40:00,U1,2
T5, 7:45:00, 7:45:00,G,3
T5, 7:55:00, 7:55:00,U2,4
T6, 8:30:00,,H,1
T6,,,I,2
T6,, 8:40:00,U1,3
T50, 25:05:00, 25:05:00,U2,1
T50, 25:20:00, 25:20:00,A,2
`,
  stops: `stop_id,stop_name,stop_lat,stop_lon
A,Gordon A,43.5200,-80.2000
B,Gordon B,43.5300,-80.2000
C,Away From Campus,43.5400,-80.2000
E,Edinburgh E,43.5250,-80.2000
U1,University Centre 1,43.5310,-80.2100
U2,University Centre 2,43.5311,-80.2101
F,Gordon F,43.5100,-80.2000
G,Gordon G,43.5110,-80.2000
H,Gordon H,43.5120,-80.2000
I,Gordon I,43.5130,-80.2000
X,Brewery,43.55,-80.3
Y,Saturday Stop,43.56,-80.3
`,
  shapes: `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
S1,43.5,-80.2,1
S1,43.50002,-80.198,2
S1,43.5,-80.196,3
S1,43.502,-80.194,4
S1,43.502,-80.19,5
S2,43.5,-80.2,1
S2,43.50002,-80.198,2
S2,43.5,-80.196,3
S2,43.502,-80.194,4
S2,43.502,-80.19,5
S3,43.6,-80.3,1
S3,43.61,-80.3,2
`,
}

describe('parseCsv / parseTime', () => {
  it('trims values, handles quotes and a BOM', () => {
    const rows = parseCsv('﻿a,b\r\n1, "x, y" \r\n2,"say ""hi"""\r\n')
    expect(rows).toEqual([
      { a: '1', b: 'x, y' },
      { a: '2', b: 'say "hi"' },
    ])
  })
  it('reads padded times and hours past 24', () => {
    expect(parseTime(' 6:00:00')).toBe(21600)
    expect(parseTime('25:05:30')).toBe(25 * 3600 + 5 * 60 + 30)
  })
})

describe('simplifyLine', () => {
  const line: [number, number][] = [
    [-80.2, 43.5],
    [-80.198, 43.50002],
    [-80.196, 43.5],
    [-80.194, 43.502],
    [-80.19, 43.502],
  ]
  it('keeps endpoints and drops points within tolerance', () => {
    const out = simplifyLine(line, 10)
    expect(out[0]).toEqual(line[0])
    expect(out[out.length - 1]).toEqual(line[4])
    // the 2 m wiggle at index 1 goes; the real bends stay
    expect(out).toEqual([line[0], line[2], line[3], line[4]])
  })
  it('keeps every point when the tolerance is tiny', () => {
    expect(simplifyLine(line, 0.1)).toHaveLength(5)
  })
  it('every dropped point is within the tolerance of the result', () => {
    const lat0 = 43.5
    const m = ([lon, lat]: number[]) => [lon * 111320 * Math.cos((lat0 * Math.PI) / 180), lat * 110574]
    const dist = (p: number[], a: number[], b: number[]) => {
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
    }
    // A wavy line of 200 points.
    const wavy: [number, number][] = Array.from({ length: 200 }, (_, i) => [-80.2 + i * 0.0002, 43.5 + Math.sin(i / 7) * 0.0006])
    const out = simplifyLine(wavy, 10)
    expect(out.length).toBeLessThan(wavy.length)
    for (const p of wavy) {
      let best = Infinity
      for (let i = 0; i < out.length - 1; i++) best = Math.min(best, dist(m(p), m(out[i]), m(out[i + 1])))
      expect(best).toBeLessThanOrEqual(10.5)
    }
  })
})

describe('medianMinutes', () => {
  it('rounds the median up and never goes below 1', () => {
    expect(medianMinutes([5, 6])).toBe(6)
    expect(medianMinutes([12, 15, 10])).toBe(12)
    expect(medianMinutes([0.2])).toBe(1)
    expect(medianMinutes([Number.NaN, 5, 6])).toBe(6)
  })
})

describe('buildNetwork', () => {
  const { routes, stops } = buildNetwork(feed)
  const stop = (id: string) => stops.features.find((f) => f.properties.id === id)?.properties

  it('drops excluded routes and routes with no weekday trips', () => {
    expect(routes.features.map((f) => f.properties.shortName)).toEqual(['50 U', '99'])
  })

  it('keeps colour (with #), names and one deduped multi-line per route', () => {
    const r = routes.features.find((f) => f.properties.shortName === '99')!
    expect(r.properties).toEqual({ id: 'r99', shortName: '99', longName: 'Mainline', label: '99', color: '#FF0000' })
    expect(r.geometry.type).toBe('MultiLineString')
    // S1 and S2 are identical, so they collapse into one simplified line.
    expect(r.geometry.coordinates).toEqual([
      [
        [-80.2, 43.5],
        [-80.196, 43.5],
        [-80.194, 43.502],
        [-80.19, 43.502],
      ],
    ])
  })

  it('lists only stops served by kept routes, with sorted routes', () => {
    const ids = stops.features.map((f) => f.properties.id)
    expect(ids).not.toContain('X')
    expect(ids).not.toContain('Y')
    expect(stop('A')?.routes).toEqual(['r50', 'r99'])
  })

  it('marks University Centre stops as campus and still lists their routes', () => {
    expect(stop('U1')).toMatchObject({ campus: true, routes: ['r99'], toCampus: {} })
    expect(stop('U2')?.campus).toBe(true)
    expect(stop('A')?.campus).toBeUndefined()
  })

  it('uses the median ride to the first campus arrival in 7-10, ignoring the 11:00 trip', () => {
    // A: T1 12 min, T2 15 min, T4 10 min (to the FIRST campus stop after it, U2 at 9:30)
    expect(stop('A')?.toCampus).toEqual({ r99: 12 })
    // B: 7, 10, and 10 min on the loop trip (U1 at 9:10, not the later U2).
    expect(stop('B')?.toCampus).toEqual({ r99: 10 })
  })

  it('rounds an even-count median up', () => {
    expect(stop('E')?.toCampus).toEqual({ r99: 6 })
  })

  it('uses the FIRST campus arrival after the stop, even when the trip passes campus twice', () => {
    // F's only in-window trip is F, U1 (7:40), G, U2 (7:55): 10 min to U1, not 25 to U2.
    expect(stop('F')?.toCampus).toEqual({ r99: 10 })
    // G comes after U1 and before U2: 10 min to U2 (a "first campus stop anywhere" rule would drop it).
    expect(stop('G')?.toCampus).toEqual({ r99: 10 })
  })

  it('falls back between arrival and departure and skips rows with no usable time', () => {
    // H: departure blank, arrival 8:30; U1: arrival blank, departure 8:40 -> 10 min.
    expect(stop('H')?.toCampus).toEqual({ r99: 10 })
    // I has neither time: served, but no ride time and no NaN/null.
    expect(stop('I')?.routes).toEqual(['r99'])
    expect(stop('I')?.toCampus).toEqual({})
    expect(JSON.stringify(stops)).not.toContain('null')
  })

  it('gives no ride time to a stop served only after the campus', () => {
    expect(stop('C')?.routes).toEqual(['r99'])
    expect(stop('C')?.toCampus).toEqual({})
  })

  it('ignores trips whose campus arrival is outside 7-10 (a 25:20 trip leaves A with no r50 time)', () => {
    expect(stop('A')?.toCampus).not.toHaveProperty('r50')
  })

  it('rounds coordinates to 5 decimals', () => {
    const f = stops.features.find((s) => s.properties.id === 'A')!
    expect(f.geometry.coordinates).toEqual([-80.2, 43.52])
  })
})

describe('meta helpers', () => {
  it('labels the season from the start month', () => {
    expect(scheduleLabel('2026-01-04')).toBe('Winter 2026')
    expect(scheduleLabel('2026-05-04')).toBe('Summer 2026')
    expect(scheduleLabel('2026-09-08')).toBe('Fall 2026')
  })
  it('reads service dates from weekday calendar rows', () => {
    expect(serviceDates(feed.calendar)).toEqual({ serviceStart: '2026-01-04', serviceEnd: '2026-05-02' })
  })
})

describe('representative weekday (calendar_dates)', () => {
  // 2026-01-05 is a Monday. Service 12 (route r12, only via calendar_dates) is added on Mon 5th
  // and Tue 6th; service 1 is removed on Tue 6th. Wed 7th has service 1 only.
  const base = {
    ...feed,
    calendar: `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
1,1,1,1,1,1,0,0,20260105,20260107
`,
    routes: `route_id,route_short_name,route_long_name,route_color
r1,1,Regular,111111
r12,56 U,University,222222
`,
    trips: `route_id,service_id,trip_id,shape_id
r1,1,P1,
r12,12,Q1,
r12,12,Q2,
`,
    stop_times: `trip_id,arrival_time,departure_time,stop_id,stop_sequence
P1, 8:00:00, 8:00:00,A,1
P1, 8:10:00, 8:10:00,U1,2
Q1, 8:00:00, 8:00:00,B,1
Q1, 8:20:00, 8:20:00,U1,2
Q2, 9:00:00, 9:00:00,B,1
Q2, 9:20:00, 9:20:00,U1,2
`,
    shapes: 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n',
    calendar_dates: `service_id,date,exception_type
12,20260105,1
12,20260106,1
1,20260106,2
`,
  }

  it('applies additions and removals per date', () => {
    const by = activeServicesByDate(
      parseCsv(base.calendar),
      parseCsv(base.calendar_dates),
    )
    expect([...(by.get('20260105') ?? [])].sort()).toEqual(['1', '12'])
    expect([...(by.get('20260106') ?? [])]).toEqual(['12'])
    expect([...(by.get('20260107') ?? [])]).toEqual(['1'])
  })

  it('picks the weekday with the most trips, earliest on ties', () => {
    const by = activeServicesByDate(parseCsv(base.calendar), parseCsv(base.calendar_dates))
    // Mon: 1 + 2 = 3 trips; Tue: 2; Wed: 1.
    expect(representativeWeekday(by, parseCsv(base.trips))?.date).toBe('20260105')
    // Without P1: Mon 2 (Q1, Q2), Tue 2, Wed 0 -> a real tie, so the earlier Monday wins.
    const tie = representativeWeekday(by, parseCsv(base.trips).filter((t) => t.trip_id !== 'P1'))
    expect(tie?.date).toBe('20260105')
  })

  it('keeps a route served only by a calendar_dates service and gives it ride times', () => {
    const { routes, stops, representativeDate } = buildNetwork(base)
    expect(representativeDate).toBe('2026-01-05')
    expect(routes.features.map((f) => f.properties.shortName)).toEqual(['1', '56 U'])
    const b = stops.features.find((f) => f.properties.id === 'B')!
    expect(b.properties.toCampus).toEqual({ r12: 20 })
  })

  it('does not use a service removed on the chosen date', () => {
    // Service 12 is added only on Tue and service 1 is removed that day, so Tue runs just the
    // two r12 trips and beats Mon (one r1 trip). Route 1 must not appear on the chosen Tuesday.
    const heavy = { ...base, calendar_dates: 'service_id,date,exception_type\n12,20260106,1\n1,20260106,2\n', trips: base.trips }
    const { routes, representativeDate } = buildNetwork(heavy)
    expect(representativeDate).toBe('2026-01-06')
    expect(routes.features.map((f) => f.properties.shortName)).toEqual(['56 U'])
  })
})

describe('one-transfer trips (viaTransfer)', () => {
  // ra never reaches campus. rb (from H1) and rc (from H2) go straight to University Centre.
  // S rides ra to H1 (10 and 12 min) or H2 (20 and 30 min).
  const tf = {
    calendar: `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
1,1,0,0,0,0,0,0,20260105,20260105
`,
    routes: `route_id,route_short_name,route_long_name,route_color
ra,A,Feeder,111111
rb,B,To campus from H1,222222
rc,C,To campus from H2,333333
rd,D,Direct from D,444444
`,
    trips: `route_id,service_id,trip_id,shape_id
ra,1,a1,
ra,1,a2,
ra,1,a3,
ra,1,a4,
ra,1,a5,
rb,1,b1,
rb,1,b2,
rb,1,bq,
rc,1,c1,
rd,1,d1,
`,
    stop_times: `trip_id,arrival_time,departure_time,stop_id,stop_sequence
a1, 7:00:00, 7:00:00,S,1
a1, 7:10:00, 7:10:00,H1,2
a1, 7:20:00, 7:20:00,H2,3
a2, 8:00:00, 8:00:00,S,1
a2, 8:12:00, 8:12:00,H1,2
a2, 8:30:00, 8:30:00,H2,3
a3, 6:20:00, 6:20:00,V,1
a3, 6:30:00, 6:30:00,H1,2
a4, 9:45:00, 9:45:00,W,1
a4, 9:55:00, 9:55:00,H1,2
a5, 7:00:00, 7:00:00,D,1
a5, 7:05:00, 7:05:00,H1,2
b1, 7:30:00, 7:30:00,H1,1
b1, 7:45:00, 7:45:00,U1,2
b2, 8:30:00, 8:30:00,H1,1
b2, 8:46:00, 8:46:00,U1,2
bq, 6:50:00, 6:50:00,Q,1
bq, 7:00:00, 7:00:00,H1,2
bq, 7:10:00, 7:10:00,Z,3
c1, 7:50:00, 7:50:00,H2,1
c1, 8:00:00, 8:00:00,U1,2
d1, 7:00:00, 7:00:00,D,1
d1, 7:08:00, 7:08:00,U1,2
`,
    stops: `stop_id,stop_name,stop_lat,stop_lon
S,Suburb S,43.50,-80.20
V,Early V,43.51,-80.20
W,Late W,43.52,-80.20
D,Direct D,43.53,-80.20
Q,Same Route Q,43.54,-80.20
Z,End Z,43.55,-80.20
H1,Hub One,43.56,-80.20
H2,Hub Two,43.57,-80.20
U1,University Centre 1,43.58,-80.20
`,
    shapes: 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n',
  }
  const { stops } = buildNetwork(tf)
  const stop = (id: string) => stops.features.find((f) => f.properties.id === id)?.properties

  it('gives a stop with no direct bus the best ride + change + ride (min over hubs)', () => {
    expect(stop('S')?.toCampus).toEqual({})
    // via H1: median(10, 12) = 11, + 5, + 16 (median of 15 and 16 min, rounded up) = 32.
    // via H2: median(20, 30) = 25, + 5, + 10 = 40. The minimum wins.
    expect(TRANSFER_MINUTES).toBe(5)
    expect(stop('S')?.viaTransfer).toEqual({
      minutes: 32,
      firstRoute: 'ra',
      secondRoute: 'rb',
      transferStop: { id: 'H1', name: 'Hub One' },
    })
  })

  it('omits viaTransfer when a direct ride is at least as good', () => {
    expect(stop('D')?.toCampus).toEqual({ rd: 8 })
    expect(stop('D')?.viaTransfer).toBeUndefined()
    expect(stop('H1')?.viaTransfer).toBeUndefined()
  })

  it('does not count changing to the same route', () => {
    expect(stop('Q')?.viaTransfer).toBeUndefined()
  })

  it('only uses departures between 06:30 and 09:30', () => {
    expect(stop('V')?.viaTransfer).toBeUndefined()
    expect(stop('W')?.viaTransfer).toBeUndefined()
  })

  it('never adds viaTransfer to campus stops', () => {
    expect(stop('U1')?.viaTransfer).toBeUndefined()
  })
})

describe('one-transfer trips between nearby stops (platforms)', () => {
  // Route ra rides from S to P1 (a platform where only ra stops). Route rb to campus boards at P2,
  // a different stop id. P2 is 55 m from P1 in the first network and 220 m in the second.
  const make = (p2Lat: number) => ({
    calendar: `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
1,1,0,0,0,0,0,0,20260105,20260105
`,
    routes: `route_id,route_short_name,route_long_name,route_color
ra,A,Feeder,111111
rb,B,To campus,222222
`,
    trips: `route_id,service_id,trip_id,shape_id
ra,1,a1,
ra,1,a2,
rb,1,b1,
`,
    stop_times: `trip_id,arrival_time,departure_time,stop_id,stop_sequence
a1, 7:00:00, 7:00:00,S,1
a1, 7:10:00, 7:10:00,P1,2
a2, 8:00:00, 8:00:00,S,1
a2, 8:10:00, 8:10:00,P1,2
b1, 7:30:00, 7:30:00,P2,1
b1, 7:45:00, 7:45:00,U1,2
`,
    stops: `stop_id,stop_name,stop_lat,stop_lon
S,Suburb S,43.50,-80.20
P1,Platform One,43.56,-80.20
P2,Platform Two,${p2Lat},-80.20
U1,University Centre 1,43.58,-80.20
`,
    shapes: 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n',
  })
  const via = (p2Lat: number) =>
    buildNetwork(make(p2Lat)).stops.features.find((f) => f.properties.id === 'S')?.properties.viaTransfer

  it('finds the trip when the second route boards at a stop 55 m away, adding the walk', () => {
    // 0.0005 deg is about 55.6 m: ceil(55.6 x 1.3 / 80) = 1 min. 10 + 1 + 5 + 15 = 31.
    expect(via(43.5605)).toEqual({
      minutes: 31,
      firstRoute: 'ra',
      secondRoute: 'rb',
      transferStop: { id: 'P2', name: 'Platform Two' },
      alightStop: { id: 'P1', name: 'Platform One' },
    })
  })

  it('does not use a stop 220 m away', () => {
    expect(via(43.562)).toBeUndefined()
  })

  it('rounds the walk up from the metres, with the detour factor', () => {
    // 0.0012 deg is about 133 m: ceil(133.4 x 1.3 / 80) = 3 min. 10 + 3 + 5 + 15 = 33.
    expect(via(43.5612)?.minutes).toBe(33)
  })

  it('charges at least 1 minute when the stops differ, even at the same spot', () => {
    expect(via(43.56)?.minutes).toBe(31)
  })
})

describe('routeLabel', () => {
  it('keeps number-like short names', () => {
    expect(routeLabel('99', 'Express')).toBe('99')
    expect(routeLabel('50 U', 'Whatever')).toBe('50 U')
  })
  it('uses the long name for internal codes', () => {
    expect(routeLabel('IroHarv', 'Ironwood Harvard')).toBe('Ironwood Harvard')
    expect(routeLabel('99Lite', '99 Lite')).toBe('99 Lite')
  })
})
