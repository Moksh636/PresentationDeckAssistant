export function AuthLoadingScreen() {
  return (
    <div className="auth-loading-screen" role="status" aria-live="polite">
      <div className="auth-loading-screen__card">
        <span className="auth-loading-screen__label">Loading</span>
        <p>Checking your session…</p>
      </div>
    </div>
  )
}
