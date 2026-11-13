import { useState } from 'react'

const SIZES = { sm: 40, md: 64, lg: 112 }
const FONT = { sm: 'text-base', md: 'text-2xl', lg: 'text-5xl' }
const HUES = [12, 38, 150, 190, 215, 265, 320]

function hueOf(name: string): number {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return HUES[h % HUES.length]
}

/** A round photo, or the student's initial on a colour from their name. The caller prints the name beside it. */
export default function Avatar({
  name,
  url,
  size,
  muted = false,
}: {
  name: string
  url: string | null
  size: 'sm' | 'md' | 'lg'
  muted?: boolean
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const px = SIZES[size]
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?'
  const showImage = url !== null && failedUrl !== url
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${FONT[size]} ${
        muted ? 'bg-line text-ink-soft' : 'text-ink'
      }`}
      style={{
        width: px,
        height: px,
        ...(!muted && !showImage && { backgroundColor: `hsl(${hueOf(name.trim())} 70% 85%)` }),
      }}
    >
      {showImage ? (
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setFailedUrl(url)} />
      ) : (
        initial
      )}
    </span>
  )
}
