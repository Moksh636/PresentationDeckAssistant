import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useWorkspace } from '../context/useWorkspace'
import { AuthLoadingScreen } from '../components/auth/AuthLoadingScreen'
import { resolveDefaultAuthenticatedPath } from '../data/postAuthRedirect'
import { supabase } from '../data/supabaseClient'

type AuthMode = 'signin' | 'signup'

export function AuthPage() {
  const auth = useAuth()
  const { workspace } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const fromState = (location.state as { from?: string } | null)?.from
  const destination =
    fromState && fromState.length > 0 && !fromState.startsWith('/auth')
      ? fromState
      : auth.user
        ? resolveDefaultAuthenticatedPath(workspace, auth.user.id)
        : '/dashboard'

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [magicOpen, setMagicOpen] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  if (auth.isLoading) {
    return <AuthLoadingScreen />
  }

  if (auth.canAccessApp) {
    return <Navigate to={destination} replace />
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setInfo(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Enter email and password.')
      return
    }

    setIsBusy(true)

    try {
      if (mode === 'signin') {
        await auth.signInWithPassword(trimmedEmail, password)
        const sessionUserId = (await supabase?.auth.getSession())?.data.session?.user?.id
        if (sessionUserId) {
          const nextPath =
            fromState && fromState.length > 0 && !fromState.startsWith('/auth')
              ? fromState
              : resolveDefaultAuthenticatedPath(workspace, sessionUserId)
          navigate(nextPath, { replace: true })
        } else {
          navigate(destination, { replace: true })
        }
      } else {
        await auth.signUpWithPassword(trimmedEmail, password)
        const nextSession = await supabase?.auth.getSession()
        if (nextSession?.data.session) {
          navigate(destination, { replace: true })
        } else {
          setInfo(
            'If your project requires email confirmation, check your inbox—then sign in. Otherwise try signing in now.',
          )
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setInfo(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Enter your email for the magic link.')
      return
    }

    setIsBusy(true)

    try {
      await auth.signInWithEmail(trimmedEmail)
      setInfo('Check your email for the sign-in link.')
      setPassword('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send email.'
      setError(message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setInfo(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Enter the email for your account.')
      return
    }

    setIsBusy(true)

    try {
      await auth.resetPasswordForEmail(trimmedEmail)
      setInfo('If an account exists, password reset instructions were sent to your email.')
      setForgotOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send reset email.'
      setError(message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleLocalDevContinue = () => {
    auth.enterLocalDevMode()
    navigate(destination, { replace: true })
  }

  if (!auth.isSupabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-page__hero">
          <span className="auth-page__logo">Deckspace</span>
          <p className="auth-page__tagline">Turn account research into cited, tailored pitch decks.</p>
        </div>

        <div className="auth-page__card auth-page__card--local">
          <span className="auth-page__badge">Local workspace mode</span>
          <h1 className="auth-page__title">Cloud sign-in unavailable</h1>
          <p className="auth-page__lede">
            Cloud settings are not present. Work saved in this mode stays in this browser and is not
            synced to your cloud workspace.
          </p>
          <button
            type="button"
            className="primary-button primary-button--full"
            onClick={handleLocalDevContinue}
          >
            Continue in local workspace mode
          </button>
          <p className="auth-page__fine-print">
            Use this only on trusted machines. Enable cloud settings for sign-in and cloud workspace sync.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-page__hero">
        <span className="auth-page__logo">Deckspace</span>
        <p className="auth-page__tagline">Turn account research into cited, tailored pitch decks.</p>
      </div>

      <div className="auth-page__card">
        <div className="auth-page__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`auth-page__tab ${mode === 'signin' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('signin')
              setError(null)
              setInfo(null)
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-page__tab ${mode === 'signup' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('signup')
              setError(null)
              setInfo(null)
            }}
          >
            Create account
          </button>
        </div>

        <form className="auth-page__form" onSubmit={handlePasswordSubmit}>
          <label className="auth-page__field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              disabled={isBusy}
              required
            />
          </label>

          <label className="auth-page__field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              disabled={isBusy}
              minLength={6}
              required
            />
          </label>

          {error ? <p className="auth-page__error">{error}</p> : null}
          {info ? <p className="auth-page__info">{info}</p> : null}

          <button type="submit" className="primary-button primary-button--full" disabled={isBusy}>
            {isBusy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-page__links">
          <button
            type="button"
            className="auth-page__link-button"
            onClick={() => setForgotOpen((open) => !open)}
          >
            Forgot password?
          </button>
        </div>

        {forgotOpen ? (
          <form className="auth-page__subform" onSubmit={handleForgotPassword}>
            <p className="auth-page__subform-label">Send reset link to your email</p>
            <button type="submit" className="secondary-button secondary-button--full" disabled={isBusy}>
              {isBusy ? 'Sending…' : 'Send reset email'}
            </button>
          </form>
        ) : null}

        <div className="auth-page__divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="ghost-button ghost-button--full"
          onClick={() => setMagicOpen((open) => !open)}
        >
          {magicOpen ? 'Hide email magic link' : 'Sign in with email link'}
        </button>

        {magicOpen ? (
          <form className="auth-page__subform" onSubmit={handleMagicLink}>
            <p className="muted-copy">
              We will email you a one-time link. Use the same email field above.
            </p>
            <button type="submit" className="secondary-button secondary-button--full" disabled={isBusy}>
              {isBusy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        ) : null}

        <p className="auth-page__fine-print">
          Private company workspace. Continue only with account content you are authorized to use.
        </p>
      </div>
    </div>
  )
}
