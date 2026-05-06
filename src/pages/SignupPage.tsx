import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useWorkspace } from '../context/useWorkspace'
import { AuthLoadingScreen } from '../components/auth/AuthLoadingScreen'
import { resolveDefaultAuthenticatedPath } from '../data/postAuthRedirect'
import { supabase } from '../data/supabaseClient'

export function SignupPage() {
  const auth = useAuth()
  const { workspace } = useWorkspace()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const destination = auth.user
    ? resolveDefaultAuthenticatedPath(workspace, auth.user.id)
    : '/dashboard'

  if (auth.isLoading) {
    return <AuthLoadingScreen />
  }

  const handleLocalDevContinue = () => {
    auth.enterLocalDevMode()
    navigate(destination, { replace: true })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
      await auth.signUpWithPassword(trimmedEmail, password)
      const nextSession = await supabase?.auth.getSession()
      if (nextSession?.data.session) {
        navigate('/onboarding/company', { replace: true })
      } else {
        setInfo(
          'If your project requires email confirmation, check your inbox—then sign in to continue onboarding.',
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setIsBusy(false)
    }
  }

  if (!auth.isSupabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-page__hero">
          <span className="auth-page__logo">Deckspace</span>
          <p className="auth-page__tagline">Cloud signup is disabled in this environment.</p>
        </div>
        <div className="auth-page__card auth-page__card--local">
          <p className="auth-page__lede">
            Supabase is not configured for this workspace, but you can still spin up a local demo
            workspace to explore Deckspace without cloud signup.
          </p>
          <button
            type="button"
            className="primary-button primary-button--full"
            onClick={handleLocalDevContinue}
          >
            Continue in local demo workspace
          </button>
          <p className="auth-page__fine-print">
            Prefer to start from the sign-in screen?{' '}
            <Link to="/auth">Open local workspace mode from sign in</Link>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-page__hero">
        <span className="auth-page__logo">Deckspace</span>
        <p className="auth-page__tagline">Create your workspace—then tell us about your company.</p>
      </div>

      <div className="auth-page__card">
        <h1 className="auth-page__title">Sign up</h1>
        <p className="auth-page__lede">
          After account creation you will continue to owner onboarding ({' '}
          <Link to="/onboarding/company">wizard</Link>).
        </p>

        <form className="auth-page__form" onSubmit={handleSubmit}>
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
              autoComplete="new-password"
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
            {isBusy ? 'Please wait…' : 'Continue'}
          </button>
        </form>

        <p className="auth-page__fine-print">
          Already have an account? <Link to="/auth">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
