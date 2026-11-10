import type { HousingType } from '../data/types'

const SKIES = ['#dbe7ec', '#e4ebde', '#e9e2ee', '#dfe5f0', '#e6efe9']
const WALLS = ['#6f8fa6', '#7f9152', '#b5654a', '#7a6c9c', '#b98a2f', '#5d7f74']
const LIT = '#f1e84a'
const DARK = '#1c2a35'

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export type ArtVariant = 'exterior' | 'room' | 'kitchen'

/**
 * Generated illustration standing in for listing photos (v1 has no real
 * photos). Deterministic per listing id.
 */
export default function ListingArt({
  id,
  type,
  variant = 'exterior',
  className = '',
}: {
  id: string
  type: HousingType
  variant?: ArtVariant
  className?: string
}) {
  const h = hash(id + variant)
  const sky = SKIES[h % SKIES.length]
  const wall = WALLS[(h >> 3) % WALLS.length]
  const lit = (i: number) => ((h >> (i % 24)) & 1 ? LIT : '#ffffff')

  let scene
  if (variant === 'room') {
    scene = (
      <>
        <rect width="320" height="180" fill={wall} opacity="0.35" />
        <rect y="130" width="320" height="50" fill="#c9b79c" />
        <rect x="190" y="30" width="90" height="70" fill={sky} stroke={DARK} strokeWidth="4" />
        <line x1="235" y1="30" x2="235" y2="100" stroke={DARK} strokeWidth="3" />
        <rect x="30" y="100" width="130" height="45" rx="6" fill="#ffffff" stroke={DARK} strokeWidth="3" />
        <rect x="30" y="88" width="34" height="22" rx="5" fill={wall} />
        <rect x="200" y="112" width="80" height="8" fill={DARK} />
        <rect x="206" y="120" width="5" height="25" fill={DARK} />
        <rect x="270" y="120" width="5" height="25" fill={DARK} />
      </>
    )
  } else if (variant === 'kitchen') {
    scene = (
      <>
        <rect width="320" height="180" fill="#eef1ec" />
        <rect x="20" y="30" width="280" height="40" fill={wall} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={24 + i * 70} y="34" width="62" height="32" fill="none" stroke="#ffffff" strokeWidth="2" />
        ))}
        <rect x="20" y="105" width="280" height="12" fill={DARK} />
        <rect x="20" y="117" width="280" height="63" fill={wall} opacity="0.8" />
        <circle cx="90" cy="98" r="9" fill="none" stroke={DARK} strokeWidth="3" />
        <rect x="200" y="85" width="30" height="20" rx="3" fill="#ffffff" stroke={DARK} strokeWidth="2" />
      </>
    )
  } else if (type === 'apartment' || type === 'studio') {
    const cols = type === 'apartment' ? 4 : 2
    const rows = type === 'apartment' ? 4 : 3
    const w = type === 'apartment' ? 170 : 100
    const x0 = (320 - w) / 2
    const top = type === 'apartment' ? 28 : 60
    scene = (
      <>
        <rect width="320" height="180" fill={sky} />
        <rect x={x0} y={top} width={w} height={160 - top} fill={wall} />
        <rect x={x0 - 6} y={top - 6} width={w + 12} height="8" fill={DARK} />
        {Array.from({ length: rows * cols }, (_, i) => (
          <rect
            key={i}
            x={x0 + 14 + (i % cols) * ((w - 28) / cols)}
            y={top + 12 + Math.floor(i / cols) * 28}
            width={(w - 28) / cols - 10}
            height="16"
            fill={lit(i)}
          />
        ))}
        {type === 'studio' && <circle cx="250" cy="125" r="26" fill="#5d7f74" />}
        <rect y="160" width="320" height="20" fill="#c9d3c4" />
      </>
    )
  } else {
    const basement = type === 'basement'
    scene = (
      <>
        <rect width="320" height="180" fill={sky} />
        <rect x="95" y="75" width="130" height="85" fill={wall} />
        <polygon points="82,78 160,28 238,78" fill={DARK} />
        <rect x="148" y="112" width="24" height="48" fill={DARK} />
        <rect x="110" y="92" width="26" height="20" fill={lit(1)} />
        <rect x="184" y="92" width="26" height="20" fill={lit(2)} />
        <rect y={basement ? 148 : 160} width="320" height={basement ? 32 : 20} fill="#c9d3c4" />
        {basement && (
          <>
            <rect x="182" y="140" width="34" height="16" fill={LIT} stroke={DARK} strokeWidth="2" />
            <rect x="232" y="148" width="40" height="6" fill={DARK} />
            <rect x="240" y="156" width="32" height="6" fill={DARK} />
          </>
        )}
        {type === 'room' && <circle cx="262" cy="118" r="30" fill="#7f9152" />}
      </>
    )
  }

  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className={`block bg-paper ${className}`}
      aria-hidden="true"
    >
      {scene}
    </svg>
  )
}
