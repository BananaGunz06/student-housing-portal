import { Link } from 'react-router-dom'
import type { StudentCard as Student } from '../lib/backend/types'
import { formatMoney } from '../lib/cost'
import { profileSummary, termLabel } from '../lib/profile'
import Avatar from './Avatar'

/** One student in the list; the whole card is a link to their profile. */
export default function StudentCard({ student }: { student: Student }) {
  const summary = profileSummary(student)
  const firstLine = student.bio.split('\n')[0].trim()
  return (
    <Link
      to={`/students/${student.id}`}
      className="flex min-h-11 items-start gap-3 rounded-2xl border border-line bg-card p-3"
    >
      <Avatar name={student.displayName} url={student.avatarUrl} size="md" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="break-words font-bold">{student.displayName}</span>
        {summary && <span className="break-words text-sm text-ink-soft">{summary}</span>}
        {student.moveInTerm && <span className="text-sm">{`Moving in ${termLabel(student.moveInTerm)}`}</span>}
        {student.budget !== null && <span className="text-sm">{`${formatMoney(student.budget)} a month`}</span>}
        {firstLine && <span className="min-w-0 truncate break-words text-sm text-ink-soft">{firstLine}</span>}
      </span>
    </Link>
  )
}
