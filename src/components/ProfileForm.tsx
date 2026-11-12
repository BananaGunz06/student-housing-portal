import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { checkPhoto, toSquareJpeg, type PhotoError } from '../lib/avatar'
import type { Profile, StudentDetails, StudyYear } from '../lib/backend/types'
import { BIO_MAX, termLabel, upcomingTerms, validateDetails, YEARS } from '../lib/profile'
import { useAccount } from '../state/AccountState'
import { useAppState } from '../state/AppState'
import Avatar from './Avatar'

const SAVE_ERROR = "Couldn't save. Check your connection and try again."
const PHOTO_ERRORS: Record<PhotoError, string> = {
  type: 'Choose a JPEG, PNG or WebP image.',
  size: 'That photo is over 5 MB. Choose a smaller one.',
  unreadable: "We couldn't read that image. Try another one.",
}

const fieldClass = 'min-h-11 w-full rounded-xl border-2 border-line bg-card px-3 py-2 aria-[invalid=true]:border-over'
const buttonClass = 'min-h-11 rounded-xl border-2 border-line bg-card px-4 font-bold disabled:opacity-60'

function Field({
  label,
  hint,
  error,
  aside,
  children,
}: {
  label: string
  hint?: string
  error?: string
  aside?: ReactNode
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode
}) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      {hint && (
        <span id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </span>
      )}
      {children({ id, 'aria-describedby': describedBy, ...(error && { 'aria-invalid': true as const }) })}
      {error && (
        <span id={`${id}-error`} className="text-sm font-bold text-over">
          {error}
        </span>
      )}
      {aside}
    </div>
  )
}

interface FormProps {
  submitLabel: string
  onSaved: () => void
  secondary?: ReactNode
}

/** The student details and photo, read and saved through the account. Name and phone are edited elsewhere. */
export default function ProfileForm(props: FormProps) {
  const { profile } = useAccount()
  // The fields start from the stored profile, so wait until it has loaded.
  return profile ? <LoadedForm {...props} profile={profile} /> : null
}

function LoadedForm({ submitLabel, onSaved, secondary, profile }: FormProps & { profile: Profile }) {
  const { saveProfile, uploadAvatar, removeAvatar } = useAccount()
  const { budget: searchBudget } = useAppState()
  const [bio, setBio] = useState(profile.bio ?? '')
  const [program, setProgram] = useState(profile.program ?? '')
  const [year, setYear] = useState<StudyYear | null>(profile.year ?? null)
  const [term, setTerm] = useState<string | null>(profile.moveInTerm ?? null)
  const [budgetText, setBudgetText] = useState(String(profile.budget ?? searchBudget ?? ''))
  const [roommates, setRoommates] = useState(profile.lookingForRoommates ?? false)
  const [errors, setErrors] = useState<Partial<Record<keyof StudentDetails, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [terms] = useState(() => upcomingTerms(new Date()))
  const photoId = useId()
  const switchId = useId()

  const termOptions = term && !terms.some((t) => t.value === term) ? [{ value: term, label: termLabel(term) }, ...terms] : terms

  async function choosePhoto(file: File | undefined) {
    if (!file) return
    setPhotoError(null)
    const problem = checkPhoto(file)
    if (problem) return setPhotoError(PHOTO_ERRORS[problem])
    setPhotoBusy(true)
    try {
      let jpeg: Blob
      try {
        jpeg = await toSquareJpeg(file)
      } catch {
        return setPhotoError(PHOTO_ERRORS.unreadable)
      }
      try {
        await uploadAvatar(jpeg)
      } catch {
        setPhotoError(SAVE_ERROR)
      }
    } finally {
      setPhotoBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function dropPhoto() {
    setPhotoError(null)
    setPhotoBusy(true)
    try {
      await removeAvatar()
    } catch {
      setPhotoError(SAVE_ERROR)
    } finally {
      setPhotoBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmedBudget = budgetText.trim()
    const details: StudentDetails = {
      bio: bio.trim(),
      program: program.trim(),
      year,
      moveInTerm: term,
      budget: trimmedBudget === '' ? null : Number(trimmedBudget),
      lookingForRoommates: roommates,
    }
    const found = validateDetails(details)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setSaveError(false)
    try {
      await saveProfile({ displayName: profile.displayName, ...details })
    } catch {
      setSaveError(true)
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
  }

  const nameMissing = roommates && profile.displayName.trim() === ''

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Avatar name={profile.displayName} url={profile.avatarUrl} size="lg" />
          <div className="flex flex-col items-start gap-2">
            <label htmlFor={photoId} className="font-bold">
              Photo
            </label>
            <input
              ref={fileRef}
              id={photoId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={photoBusy}
              onChange={(e) => void choosePhoto(e.target.files?.[0])}
              className="min-h-11 max-w-full text-sm"
            />
            {profile.avatarUrl && (
              <button type="button" className={buttonClass} disabled={photoBusy} onClick={() => void dropPhoto()}>
                Remove photo
              </button>
            )}
          </div>
        </div>
        {photoBusy && (
          <span role="status" className="text-sm text-ink-soft">
            Uploading…
          </span>
        )}
        {photoError && (
          <span role="alert" className="text-sm font-bold text-over">
            {photoError}
          </span>
        )}
      </div>

      <Field
        label="Bio"
        error={errors.bio}
        aside={
          <span className={`self-end text-sm ${bio.length > BIO_MAX ? 'font-bold text-over' : 'text-ink-soft'}`}>
            {`${bio.length} / ${BIO_MAX}`}
          </span>
        }
      >
        {(p) => <textarea {...p} rows={4} value={bio} onChange={(e) => setBio(e.target.value)} className={fieldClass} />}
      </Field>

      <Field label="Program" error={errors.program}>
        {(p) => <input {...p} type="text" value={program} onChange={(e) => setProgram(e.target.value)} className={fieldClass} />}
      </Field>

      <Field label="Year">
        {(p) => (
          <select {...p} value={year ?? ''} onChange={(e) => setYear((e.target.value || null) as StudyYear | null)} className={fieldClass}>
            <option value="">Prefer not to say</option>
            {YEARS.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Move-in term">
        {(p) => (
          <select {...p} value={term ?? ''} onChange={(e) => setTerm(e.target.value || null)} className={fieldClass}>
            <option value="">Not sure yet</option>
            {termOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Monthly budget" hint="Leave empty to show no budget." error={errors.budget}>
        {(p) => (
          <input {...p} type="number" inputMode="numeric" value={budgetText} onChange={(e) => setBudgetText(e.target.value)} className={fieldClass} />
        )}
      </Field>

      <div className="flex flex-col gap-1">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <label htmlFor={switchId} className="font-bold">
            Looking for roommates
          </label>
          <input
            id={switchId}
            type="checkbox"
            role="switch"
            checked={roommates}
            aria-describedby={`${switchId}-hint`}
            onChange={(e) => setRoommates(e.target.checked)}
            className="h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-line bg-card transition-colors checked:border-highlight checked:bg-highlight"
          />
        </div>
        <span id={`${switchId}-hint`} className="text-sm text-ink-soft">
          Shows your profile in the Students tab.
        </span>
        {nameMissing && <span className="text-sm font-bold text-over">Add your name to appear in Students.</span>}
      </div>

      {saveError && (
        <p role="alert" className="font-bold text-over">
          {SAVE_ERROR}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || photoBusy} className="min-h-11 rounded-xl bg-highlight px-5 font-bold text-ink disabled:opacity-60">
          {submitLabel}
        </button>
        {secondary}
      </div>
    </form>
  )
}
