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
  /** Start an empty budget from the search budget (the setup screen). Account starts from the stored value only. */
  suggestBudget?: boolean
}

/** The student details and photo, read and saved through the account. Name and phone are edited elsewhere. */
export default function ProfileForm(props: FormProps) {
  const { profile, profileStatus, reloadProfile } = useAccount()
  // The fields start from the stored profile, so wait until it has loaded. The secondary action stays available.
  if (profile) return <LoadedForm {...props} profile={profile} />
  return (
    <div className="flex flex-col items-start gap-3">
      {profileStatus === 'error' ? (
        <>
          <p role="alert" className="font-bold text-over">
            Couldn't load your profile.
          </p>
          <button type="button" className={buttonClass} onClick={reloadProfile}>
            Try again
          </button>
        </>
      ) : (
        <p className="text-ink-soft">Loading…</p>
      )}
      {props.secondary}
    </div>
  )
}

function LoadedForm({ submitLabel, onSaved, secondary, suggestBudget = false, profile }: FormProps & { profile: Profile }) {
  const { saveProfile, uploadAvatar, removeAvatar } = useAccount()
  const { budget: searchBudget } = useAppState()
  const [bio, setBio] = useState(profile.bio ?? '')
  const [program, setProgram] = useState(profile.program ?? '')
  const [year, setYear] = useState<StudyYear | null>(profile.year ?? null)
  const [term, setTerm] = useState<string | null>(profile.moveInTerm ?? null)
  const [budgetText, setBudgetText] = useState(String(profile.budget ?? (suggestBudget ? searchBudget : null) ?? ''))
  const [roommates, setRoommates] = useState(profile.lookingForRoommates ?? false)
  const [errors, setErrors] = useState<Partial<Record<keyof StudentDetails, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [photoBusy, setPhotoBusy] = useState<'uploading' | 'removing' | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [terms] = useState(() => upcomingTerms(new Date()))
  const photoId = useId()
  const switchId = useId()

  const termOptions = term && !terms.some((t) => t.value === term) ? [{ value: term, label: termLabel(term) }, ...terms] : terms

  async function choosePhoto(file: File | undefined) {
    if (!file) return
    setPhotoError(null)
    const problem = checkPhoto(file)
    if (problem) {
      if (fileRef.current) fileRef.current.value = ''
      return setPhotoError(PHOTO_ERRORS[problem])
    }
    setPhotoBusy('uploading')
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
      setPhotoBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function dropPhoto() {
    setPhotoError(null)
    setPhotoBusy('removing')
    try {
      await removeAvatar()
    } catch {
      setPhotoError(SAVE_ERROR)
    } finally {
      setPhotoBusy(null)
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
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
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
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Avatar name={profile.displayName} url={profile.avatarUrl} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <input
              ref={fileRef}
              id={photoId}
              type="file"
              aria-label="Photo"
              accept="image/jpeg,image/png,image/webp"
              disabled={photoBusy !== null}
              onChange={(e) => void choosePhoto(e.target.files?.[0])}
              className="peer sr-only"
            />
            <label
              htmlFor={photoId}
              className={`${buttonClass} inline-flex cursor-pointer items-center peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-disabled:opacity-60`}
            >
              Choose photo
            </label>
            {profile.avatarUrl && (
              <button type="button" className={buttonClass} disabled={photoBusy !== null} onClick={() => void dropPhoto()}>
                Remove photo
              </button>
            )}
          </div>
        </div>
        {photoBusy && (
          <span role="status" className="text-sm text-ink-soft">
            {photoBusy === 'removing' ? 'Removing…' : 'Uploading…'}
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
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span id={`${switchId}-label`} className="font-bold">
            Looking for roommates
          </span>
          <span className="flex items-center gap-2">
            <input
              id={switchId}
              type="checkbox"
              role="switch"
              checked={roommates}
              aria-labelledby={`${switchId}-label`}
              aria-describedby={`${switchId}-hint`}
              onChange={(e) => setRoommates(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-7 w-12 shrink-0 rounded-full border-2 border-ink bg-card transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-checked:[&>span]:translate-x-5 peer-checked:[&>span]:bg-card"
            >
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-ink transition-transform" />
            </span>
            <span className="w-8 text-sm font-bold">{roommates ? 'On' : 'Off'}</span>
          </span>
        </label>
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
        <button type="submit" disabled={saving || photoBusy !== null} className="min-h-11 rounded-xl bg-highlight px-5 font-bold text-ink disabled:opacity-60">
          {submitLabel}
        </button>
        {secondary}
      </div>
    </form>
  )
}
