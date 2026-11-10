import { Link } from 'react-router-dom'

export default function NotFound({
  title = 'This page doesn’t exist',
  body = 'The link may be old or mistyped.',
}: {
  title?: string
  body?: string
}) {
  return (
    <div className="mx-auto max-w-md px-4 pt-16 text-center">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-ink-soft">{body}</p>
      <Link
        to="/results"
        className="mt-6 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-bold text-white"
      >
        Back to search
      </Link>
    </div>
  )
}
