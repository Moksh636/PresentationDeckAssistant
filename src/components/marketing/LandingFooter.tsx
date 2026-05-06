import { Link } from 'react-router-dom'

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <span>Deckspace · revenue workspace</span>
      <Link to="/auth">Workspace sign-in</Link>
    </footer>
  )
}
