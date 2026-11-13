import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export type AuthMode = 'sign-in' | 'sign-up' | 'reset-password' | 'update-password'
type AuthMethod = 'password' | 'email-link'

type AuthPanelProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onPreview: () => void
}

export function AuthPanel({ mode, onModeChange, onPreview }: AuthPanelProps) {
  const [method, setMethod] = useState<AuthMethod>('password')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function changeMode(nextMode: AuthMode) {
    setMessage(null)
    setError(null)
    setPassword('')
    setConfirmPassword('')
    onModeChange(nextMode)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setError('Sign-in is unavailable until Supabase is configured.')
      return
    }

    if ((mode === 'sign-up' || mode === 'update-password') && password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }
    if ((mode === 'sign-up' || mode === 'update-password') && password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    if (mode === 'sign-up' && displayName.trim().length === 0) {
      setError('Enter your display name.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'reset-password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (resetError) throw new Error(resetError.message)
        setMessage('Password reset link sent. Check your email to continue.')
      } else if (mode === 'update-password') {
        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) throw new Error(updateError.message)
        setPassword('')
        setConfirmPassword('')
        setMessage('Password updated. You can continue to the marketplace.')
        onModeChange('sign-in')
      } else if (method === 'password' && mode === 'sign-up') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin,
          },
        })
        if (signUpError) throw new Error(signUpError.message)
        setMessage('Account created. Check your email to confirm your address and finish signing up.')
      } else if (method === 'password') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw new Error(signInError.message)
      } else {
        const { error: linkError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: mode === 'sign-up',
            emailRedirectTo: window.location.origin,
            ...(mode === 'sign-up' ? { data: { display_name: displayName.trim() } } : {}),
          },
        })
        if (linkError) throw new Error(linkError.message)
        setMessage(
          mode === 'sign-up'
            ? 'Account link sent. Confirm your email to finish signing up.'
            : 'Check your email for a secure sign-in link.',
        )
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete the account request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!supabase) {
    return (
      <section aria-labelledby="sign-in-title" className="auth-panel" id="auth-panel">
        <h2 id="sign-in-title">Sign in to Peer Exchange</h2>
        <p>Connect your Supabase project to create an account or sign in.</p>
        <div className="error-message" role="alert">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code>, then restart the app.
        </div>
        {import.meta.env.DEV && (
          <button className="secondary-button preview-entry" onClick={onPreview} type="button">
            Open read-only preview
          </button>
        )}
      </section>
    )
  }

  const isRecovery = mode === 'update-password'
  const isResetRequest = mode === 'reset-password'
  const title = isRecovery
    ? 'Choose a new password'
    : isResetRequest
      ? 'Reset your password'
      : mode === 'sign-up'
        ? 'Create your account'
        : 'Welcome back'

  return (
    <section aria-labelledby="sign-in-title" className="auth-panel" id="auth-panel">
      {!isRecovery && !isResetRequest && (
        <div aria-label="Account access" className="auth-tabs" role="group">
          <button
            aria-pressed={mode === 'sign-in'}
            className={mode === 'sign-in' ? 'auth-tab auth-tab-active' : 'auth-tab'}
            onClick={() => changeMode('sign-in')}
            type="button"
          >
            Sign in
          </button>
          <button
            aria-pressed={mode === 'sign-up'}
            className={mode === 'sign-up' ? 'auth-tab auth-tab-active' : 'auth-tab'}
            onClick={() => changeMode('sign-up')}
            type="button"
          >
            Create account
          </button>
        </div>
      )}
      <h2 id="sign-in-title">{title}</h2>
      <p>
        {isRecovery
          ? 'Set a new password for your account.'
          : isResetRequest
            ? 'We’ll email you a secure link to choose a new password.'
            : mode === 'sign-up'
              ? 'Create an account to publish adverts and contact other users.'
              : 'Sign in to view the marketplace and manage your adverts.'}
      </p>
      <form onSubmit={(event) => { void handleSubmit(event) }}>
        {!isRecovery && (
          <label htmlFor="auth-email">
            Email address
            <input
              autoComplete="email"
              id="auth-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
        )}
        {mode === 'sign-up' && (
          <label htmlFor="auth-display-name">
            Display name
            <input
              autoComplete="nickname"
              id="auth-display-name"
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </label>
        )}
        {!isResetRequest && !isRecovery && (
          <div aria-label="Sign-in method" className="auth-methods" role="group">
            <button
              aria-pressed={method === 'password'}
              className={method === 'password' ? 'auth-method auth-method-active' : 'auth-method'}
              onClick={() => setMethod('password')}
              type="button"
            >
              Password
            </button>
            <button
              aria-pressed={method === 'email-link'}
              className={method === 'email-link' ? 'auth-method auth-method-active' : 'auth-method'}
              onClick={() => setMethod('email-link')}
              type="button"
            >
              Email link
            </button>
          </div>
        )}
        {(isRecovery || (method === 'password' && !isResetRequest)) && (
          <label htmlFor="auth-password">
            {isRecovery ? 'New password' : 'Password'}
            <input
              autoComplete={isRecovery || mode === 'sign-up' ? 'new-password' : 'current-password'}
              id="auth-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
        )}
        {(isRecovery || (mode === 'sign-up' && method === 'password')) && (
          <label htmlFor="auth-confirm-password">
            Confirm password
            <input
              autoComplete="new-password"
              id="auth-confirm-password"
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
        )}
        {message && <p className="success-message" role="status">{message}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="contact-button" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? 'Please wait…'
            : isRecovery
              ? 'Save new password'
              : isResetRequest
                ? 'Send reset link'
                : mode === 'sign-up'
                  ? method === 'password' ? 'Create account' : 'Email me a sign-up link'
                  : method === 'password' ? 'Sign in' : 'Email me a sign-in link'}
        </button>
      </form>

      <div className="auth-footer-actions">
        {mode === 'sign-in' && method === 'password' && (
          <button className="text-button" onClick={() => changeMode('reset-password')} type="button">
            Forgot password?
          </button>
        )}
        {isResetRequest && (
          <button className="text-button" onClick={() => changeMode('sign-in')} type="button">
            Back to sign in
          </button>
        )}
      </div>
    </section>
  )
}
