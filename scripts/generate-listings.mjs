// Generates 40 fictional but realistically priced Guelph listings.
// Deterministic (seeded), so re-running gives the same file.
// Run: node scripts/generate-listings.mjs
import { writeFileSync } from 'node:fs'

let seed = 20261110
function rand() {
  // mulberry32
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (lo, hi) => lo + rand() * (hi - lo)
const int = (lo, hi) => Math.round(between(lo, hi))
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const chance = (p) => rand() < p
const round5 = (n) => Math.round(n / 5) * 5
const round25 = (n) => Math.round(n / 25) * 25

const hoods = [
  { name: 'Old University', lat: 43.537, lng: -80.237, streets: ['Dean Ave', 'Harvard Rd', 'Forest St', 'Mary St'], premium: 60 },
  { name: 'College Ave West', lat: 43.5305, lng: -80.246, streets: ['College Ave W', 'Lansdown Dr', 'Chancellors Way'], premium: 50 },
  { name: 'Kortright Hills', lat: 43.513, lng: -80.24, streets: ['Kortright Rd W', 'Ironwood Rd', 'Scottsdale Dr'], premium: 0 },
  { name: 'Stone Road East', lat: 43.5255, lng: -80.207, streets: ['Stone Rd E', 'Janefield Ave', 'Victoria Rd S'], premium: 20 },
  { name: 'South End', lat: 43.502, lng: -80.215, streets: ['Gordon St', 'Clair Rd E', 'Arkell Rd'], premium: -40 },
  { name: 'Downtown', lat: 43.5445, lng: -80.248, streets: ['Wyndham St N', 'Macdonell St', 'Quebec St', 'Suffolk St W'], premium: 40 },
  { name: 'The Ward', lat: 43.548, lng: -80.236, streets: ['Ontario St', 'Alice St', 'York Rd'], premium: -20 },
  { name: 'Exhibition Park', lat: 43.554, lng: -80.261, streets: ['Exhibition St', 'Kathleen St', 'Palmer St'], premium: -30 },
  { name: 'Edinburgh', lat: 43.538, lng: -80.268, streets: ['Edinburgh Rd S', 'Water St', 'Yorkshire St S'], premium: -10 },
  { name: 'Hanlon Creek', lat: 43.507, lng: -80.232, streets: ['Hanlon Creek Blvd', 'Downey Rd', 'Niska Rd'], premium: -20 },
]

// [type, bedrooms, bathrooms, rentLo, rentHi, count]
const mix = [
  ['room', 1, 1, 650, 950, 16],
  ['studio', 0, 1, 1250, 1500, 5],
  ['basement', 1, 1, 1150, 1450, 7],
  ['apartment', 1, 1, 1450, 1850, 6],
  ['apartment', 2, 1, 1950, 2400, 4],
  ['house', 3, 2, 2600, 3200, 2],
]

const months = ['2026-12', '2027-01', '2027-01', '2027-05', '2027-05', '2027-09', '2027-09', '2027-09']

const extras = {
  room: ['Shared kitchen', 'Laundry in house', 'Backyard', 'Bike storage', 'Parking spot', 'Cleaning rota', 'Desk and chair'],
  studio: ['Laundry in building', 'Kitchenette', 'Bike storage', 'Secure entry', 'Parking spot'],
  basement: ['Private entrance', 'Shared laundry', 'Parking spot', 'Full kitchen'],
  apartment: ['Laundry in building', 'Balcony', 'Dishwasher', 'Parking spot', 'Elevator', 'Gym'],
  house: ['Laundry in house', 'Backyard', 'Driveway parking', 'Dishwasher', 'Basement storage'],
}

const titles = {
  room: ['Bright room', 'Quiet room', 'Furnished room', 'Large room', 'Cozy room', 'Room with big window'],
  studio: ['Compact studio', 'Bright studio', 'Renovated studio'],
  basement: ['Basement 1-bed', 'Walk-out basement suite', 'Cozy basement apartment'],
  apartment: ['Modern apartment', 'Apartment with balcony', 'Sunny apartment', 'Updated apartment'],
  house: ['Whole house', 'Family-style house'],
}

const blurbs = {
  room: 'Share a house with other students. Common areas are cleaned on a rota and the landlord lives off-site.',
  studio: 'A self-contained studio with its own kitchenette and bathroom. Good for one person who wants their own space.',
  basement: 'A private suite in the lower level of a family home. Separate entrance, its own kitchen and bathroom.',
  apartment: 'An apartment in a small building with on-site management. Heat and water are managed by the building.',
  house: 'Rent the whole house with friends. Tenants split rent and set up utilities in their own names.',
}

const listings = []
let n = 1
// Spread types across neighbourhoods round-robin so every area has a mix.
let h = 0
for (const [type, bedrooms, bathrooms, lo, hi, count] of mix) {
  for (let i = 0; i < count; i++, h++) {
    const hood = hoods[h % hoods.length]
    const rent = round25(between(lo, hi) + hood.premium * (type === 'house' ? 2 : 1))
    const shared = type === 'room'
    const utilitiesIncluded = shared ? chance(0.6) : type === 'apartment' ? chance(0.3) : type === 'basement' ? chance(0.5) : false
    const internetIncluded = shared ? chance(0.5) : type === 'basement' ? chance(0.3) : false
    const utilitiesEstimate = utilitiesIncluded
      ? 0
      : round5(type === 'house' ? between(260, 360) : shared ? between(70, 110) : between(90, 160) + bedrooms * 20)
    const internetEstimate = internetIncluded ? 0 : round5(shared ? between(25, 35) : type === 'house' ? 75 : between(55, 75))
    const furnished = shared ? chance(0.75) : type === 'studio' ? chance(0.4) : chance(0.15)
    const leaseMonths = shared ? pick([4, 8, 12, 12]) : type === 'studio' ? pick([8, 12]) : 12
    const street = pick(hood.streets)
    const included = [...extras[type]].sort(() => rand() - 0.5).slice(0, int(2, 4))
    if (utilitiesIncluded) included.unshift('Utilities (heat, hydro, water)')
    if (internetIncluded) included.unshift('Internet')
    if (furnished) included.push('Furnished')
    const bedLabel = type === 'apartment' || type === 'house' ? `${bedrooms}-bed ` : ''
    const title = `${pick(titles[type])}${type === 'apartment' ? ` (${bedLabel.trim()})` : ''} on ${street}`
    listings.push({
      id: `gue-${String(n).padStart(3, '0')}`,
      title,
      address: `${int(10, 480)} ${street}, Guelph`,
      neighbourhood: hood.name,
      type,
      bedrooms,
      bathrooms: type === 'house' ? 2 : bathrooms,
      lat: Number((hood.lat + between(-0.004, 0.004)).toFixed(5)),
      lng: Number((hood.lng + between(-0.005, 0.005)).toFixed(5)),
      rent,
      utilitiesIncluded,
      utilitiesEstimate,
      internetIncluded,
      internetEstimate,
      furnished,
      leaseMonths,
      availableFrom: pick(months),
      included,
      description: blurbs[type],
    })
    n++
  }
}

// Posters use their own seed so the listing fields above never change.
// Phones are in the reserved fictional 555-01xx range and emails use
// example.com, so no real person or company is listed.
seed = 20261111
const firstNames = ['Sam', 'Priya', 'Daniel', 'Mei', 'Omar', 'Grace', 'Luca', 'Aisha', 'Tom', 'Nadia', 'Ben', 'Hana', 'Marco', 'Leah', 'Ravi', 'Chloe', 'Kwame', 'Ines', 'Jordan', 'Sofia']
const lastInitials = 'ABCDFGHJKLMNPRSTW'
const companies = ['Bluebird Rentals', 'Cedarline Property Co.', 'Lantern Lane Homes', 'Northstar Student Suites']
const replyTimes = ['Usually replies within a few hours', 'Usually replies within a day', 'Usually replies within a day', 'Usually replies within 2 days']
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')
let phoneN = 0
for (const l of listings) {
  const role =
    l.type === 'room' ? (chance(0.35) ? 'student-sublet' : 'landlord')
    : l.type === 'apartment' || l.type === 'studio' ? (chance(0.6) ? 'property-manager' : 'landlord')
    : 'landlord'
  const name = role === 'property-manager' ? pick(companies) : `${pick(firstNames)} ${pick([...lastInitials])}.`
  // About half share nothing beyond in-app messages.
  const r = rand()
  const sharePhone = r >= 0.5 && r < 0.65 || r >= 0.85
  const shareEmail = r >= 0.65
  const poster = { name, role, replyTime: role === 'property-manager' ? replyTimes[0] : pick(replyTimes) }
  if (sharePhone) poster.phone = `519-555-01${String(phoneN++ % 100).padStart(2, '0')}`
  if (shareEmail) poster.email = `${slug(name)}@example.com`
  l.poster = poster
}

writeFileSync('src/data/listings.json', JSON.stringify(listings, null, 2) + '\n')
console.log(`${listings.length} listings`)
