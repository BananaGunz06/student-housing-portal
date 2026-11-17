import { upcomingTerms } from '../profile'
import type { Backend } from './types'
import { createMemoryBackend } from './memory'
import type { FakeOptions } from './memory'

export const DEMO_EMAIL = 'demo@example.com'
export const DEMO_PASSWORD = 'demo-pass1'

type DemoStudent = NonNullable<FakeOptions['students']>[number]

/** A simple illustrated avatar: a coloured background with a drawn shape. No faces, no outside hosts. */
function avatar(bg: string, fg: string, shape: 'circle' | 'diamond' | 'hills' | 'sun' | 'bars'): string {
  const art = {
    circle: `<circle cx="48" cy="48" r="22" fill="${fg}"/>`,
    diamond: `<path d="M48 18 78 48 48 78 18 48Z" fill="${fg}"/>`,
    hills: `<path d="M0 78 30 44 52 68 70 52 96 80V96H0Z" fill="${fg}"/>`,
    sun: `<circle cx="48" cy="40" r="14" fill="${fg}"/><path d="M16 80a32 22 0 0 1 64 0Z" fill="${fg}"/>`,
    bars: `<rect x="20" y="46" width="14" height="30" fill="${fg}"/><rect x="41" y="30" width="14" height="46" fill="${fg}"/><rect x="62" y="38" width="14" height="38" fill="${fg}"/>`,
  }[shape]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="${bg}"/>${art}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const BIO_300 =
  'I am a second-year who loves early mornings, long walks by the river and cooking huge pots of soup on Sundays. ' +
  'I keep a tidy kitchen, happily share groceries, and study best in a quiet flat with the odd board game night. ' +
  'Looking for two calm, friendly people near the tram line. A balcony is a bonus.'

/** Sample people, oldest to newest: the last one listed shows first in Students. All fictional. */
export function demoStudents(): (DemoStudent & { lookingForRoommates: boolean })[] {
  const terms = upcomingTerms(new Date()).map((t) => t.value)
  const term = (i: number) => terms[i % terms.length]
  return [
  { email: 'hidden.rowan@example.com', name: 'Rowan Okafor', lookingForRoommates: false, program: 'Law', year: '4', moveInTerm: term(1), budget: 900, bio: 'Not looking right now.' },
  { email: 'hidden.mei@example.com', name: 'Mei Tanaka', lookingForRoommates: false, program: 'Architecture', year: '2', moveInTerm: term(2), budget: 700, bio: 'Sorted for next term.' },
  { email: 'priya.nair@example.com', name: 'Priya Nair', lookingForRoommates: true, program: 'Computer Science', year: '2', moveInTerm: term(0), budget: 550, bio: 'Night owl, tea drinker, always up for a hackathon. Want a place with fast wifi.', avatarUrl: avatar('#cfe8dc', '#1f7a4d', 'circle') },
  { email: 'tomas.lindqvist@example.com', name: 'Tomas Lindqvist', lookingForRoommates: true, program: 'Mechanical Engineering', year: '3', moveInTerm: term(1), budget: 720, bio: 'Cyclist and amateur baker. I will bring fresh bread, you bring the playlist.', avatarUrl: avatar('#fbefd6', '#8c5a0e', 'hills') },
  { email: 'amara.diallo@example.com', name: 'Amara Diallo', lookingForRoommates: true, program: 'Nursing', year: '1', moveInTerm: term(0), budget: 480, bio: '' },
  { email: 'jonas.weber@example.com', name: 'Jonas Weber', lookingForRoommates: true, program: 'Business', year: '4', moveInTerm: term(2), budget: 950, bio: 'Final year, mostly at the library. Quiet evenings, loud Saturdays.', avatarUrl: avatar('#dbe4f3', '#2b4c8c', 'bars') },
  { email: 'lucia.fernandez@example.com', name: 'Lucia Fernandez', lookingForRoommates: true, program: 'Biology', year: 'grad', moveInTerm: term(0), budget: 1150, bio: 'Master\'s student in marine biology. Plants everywhere, no pets please.', avatarUrl: avatar('#e3f2e9', '#1f7a4d', 'sun') },
  { email: 'kwame.mensah@example.com', name: 'Kwame Mensah', lookingForRoommates: true, program: 'Economics', year: '5+', moveInTerm: term(3), budget: null, bio: 'Open on budget, strict on dishes.' },
  { email: 'sofia.petrova@example.com', name: 'Sofia Petrova', lookingForRoommates: true, program: 'Art History', year: '2', moveInTerm: term(1), budget: 780, bio: BIO_300, avatarUrl: avatar('#fbe4e7', '#b4233a', 'diamond') },
  { email: 'daniel.ochoa@example.com', name: 'Daniel Ochoa', lookingForRoommates: true, program: 'Computer Science', year: '3', moveInTerm: term(0), budget: 620, bio: 'Gamer, climber, decent cook. Looking for a relaxed flat close to campus.' },
  ]
}

/** A fresh pretend backend: sample students, signed in as Demo Student with an empty profile. Held in memory only. */
export function createDemoBackend(): Backend {
  return createMemoryBackend({
    users: [{ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: 'Demo Student' }],
    students: demoStudents(),
    sessionEmail: DEMO_EMAIL,
    delayMs: 300,
    photoUrl: (photo) => URL.createObjectURL(photo),
  })
}
