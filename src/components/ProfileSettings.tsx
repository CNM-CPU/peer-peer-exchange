import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  removeProfileAvatar,
  saveProfileDisplayName,
  uploadProfileAvatar,
  type AccountProfile,
} from '../lib/profile'
import { supabase } from '../lib/supabase'

type ProfileSettingsProps = {
  session: Session
  profile: AccountProfile
  onBack: () => void
  onProfileUpdated: (profile: AccountProfile) => void
}

function fallbackInitials(session: Session, displayName: string) {
  const name = displayName || session.user.email || 'User'
  return name
    .split('@')[0]
    .split(/[ ._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U'
}

export function ProfileSettings({
  session,
  profile,
  onBack,
  onProfileUpdated,
}: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(
    profile.displayName ??
      (typeof session.user.user_metadata.display_name === 'string'
        ? session.user.user_metadata.display_name
        : ''),
  )
  const [email, setEmail] = useState(session.user.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSaveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = displayName.trim()
    if (value.length < 1 || value.length > 80) {
      setError('Your display name must be between 1 and 80 characters.')
      return
    }

    setIsSavingName(true)
    setError(null)
    setMessage(null)
    try {
      await saveProfileDisplayName(session.user.id, value)
      onProfileUpdated({ ...profile, displayName: value })
      setMessage('Display name updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your display name.')
    } finally {
      setIsSavingName(false)
    }
  }

  async function handleEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextEmail = email.trim()
    if (!nextEmail || nextEmail.toLowerCase() === session.user.email?.toLowerCase()) {
      setError('Enter an email address different from your current one.')
      return
    }
    if (!supabase) {
      setError('Email changes require a connected Supabase project.')
      return
    }

    setIsChangingEmail(true)
    setError(null)
    setMessage(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: nextEmail })
      if (updateError) throw new Error(updateError.message)
      setMessage('Check your email and follow the confirmation link to finish changing your address.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request an email change.')
    } finally {
      setIsChangingEmail(false)
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    if (!supabase) {
      setError('Password changes require a connected Supabase project.')
      return
    }

    setIsChangingPassword(true)
    setError(null)
    setMessage(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw new Error(updateError.message)
      setPassword('')
      setConfirmPassword('')
      setMessage('Password updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your password.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  async function handlePasswordResetRequest() {
    if (!supabase || !session.user.email) {
      setError('A signed-in email account is required to send a password reset link.')
      return
    }
    setError(null)
    setMessage(null)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(session.user.email, {
        redirectTo: window.location.origin,
      })
      if (resetError) throw new Error(resetError.message)
      setMessage('Password reset link sent. Check your email to continue.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a password reset link.')
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsUploadingAvatar(true)
    setError(null)
    setMessage(null)
    try {
      const avatar = await uploadProfileAvatar(session.user.id, file, profile.avatarPath)
      const nextProfile = { ...profile, ...avatar }
      onProfileUpdated(nextProfile)
      setMessage('Profile picture updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload your profile picture.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function handleAvatarRemove() {
    setIsRemovingAvatar(true)
    setError(null)
    setMessage(null)
    try {
      await removeProfileAvatar(session.user.id, profile.avatarPath)
      onProfileUpdated({ ...profile, avatarPath: null, avatarUrl: null })
      setMessage('Profile picture removed.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove your profile picture.')
    } finally {
      setIsRemovingAvatar(false)
    }
  }

  return (
    <section aria-labelledby="profile-title" className="profile-panel">
      <div className="panel-heading">
        <div>
          <h2 id="profile-title">Account settings</h2>
          <p>Update your profile and sign-in security.</p>
        </div>
        <button className="secondary-button" onClick={onBack} type="button">Back to marketplace</button>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      <section aria-labelledby="picture-title" className="profile-section">
        <div className="profile-avatar-preview">
          {profile.avatarUrl
            ? <img alt="" src={profile.avatarUrl} />
            : <span aria-hidden="true" className="avatar avatar-large">{fallbackInitials(session, displayName)}</span>}
          <div>
            <h3 id="picture-title">Profile picture</h3>
            <p>Private image, visible only to your account. JPG, PNG, or WebP up to 5 MB.</p>
          </div>
        </div>
        <div className="profile-actions">
          <label className="secondary-button file-button">
            {isUploadingAvatar ? 'Uploading…' : 'Upload picture'}
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={isUploadingAvatar}
              onChange={(event) => { void handleAvatarUpload(event) }}
              type="file"
            />
          </label>
          {profile.avatarPath && (
            <button
              className="user-action"
              disabled={isRemovingAvatar}
              onClick={() => { void handleAvatarRemove() }}
              type="button"
            >
              {isRemovingAvatar ? 'Removing…' : 'Remove picture'}
            </button>
          )}
        </div>
      </section>

      <form className="account-form profile-section" onSubmit={(event) => { void handleSaveName(event) }}>
        <h3>Personal details</h3>
        <label>
          Display name
          <input
            autoComplete="nickname"
            maxLength={80}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <button className="primary-button" disabled={isSavingName} type="submit">
          {isSavingName ? 'Saving…' : 'Save name'}
        </button>
      </form>

      <form className="account-form profile-section" onSubmit={(event) => { void handleEmailChange(event) }}>
        <h3>Email address</h3>
        <label>
          New email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <button className="secondary-button" disabled={isChangingEmail} type="submit">
          {isChangingEmail ? 'Sending confirmation…' : 'Change email'}
        </button>
      </form>

      <form className="account-form profile-section" onSubmit={(event) => { void handlePasswordChange(event) }}>
        <h3>Password</h3>
        <label>
          New password
          <input
            autoComplete="new-password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label>
          Confirm new password
          <input
            autoComplete="new-password"
            minLength={8}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>
        <button className="primary-button" disabled={isChangingPassword} type="submit">
          {isChangingPassword ? 'Updating…' : 'Update password'}
        </button>
        <button className="secondary-button" onClick={() => { void handlePasswordResetRequest() }} type="button">
          Email me a password reset link
        </button>
      </form>
    </section>
  )
}
