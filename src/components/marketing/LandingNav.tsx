import { Link } from 'react-router-dom'

const anchors = [
  { href: '#product', label: 'Product' },
  { href: '#company-brain', label: 'Company Brain' },
  { href: '#pitch-decks', label: 'Pitch Decks' },
  { href: '#security', label: 'Security' },
] as const

export function LandingNav() {
  return (
    <header className="landing-nav">
      <div className="landing-nav__brand">
        <span className="landing-nav__logo">Deckspace</span>
        <span className="landing-nav__mark">Workspace</span>
      </div>
      <nav className="landing-nav__links" aria-label="Marketing">
        {anchors.map(({ href, label }) => (
          <a key={href} className="landing-nav__anchor" href={href}>
            {label}
          </a>
        ))}
        <div className="landing-nav__actions">
          <Link to="/auth" className="ghost-button">
            Sign in
          </Link>
          <Link to="/signup" className="primary-button">
            Create company brain
          </Link>
        </div>
      </nav>
    </header>
  )
}
