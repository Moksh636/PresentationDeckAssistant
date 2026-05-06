import { Link } from 'react-router-dom'
import { LandingHeroMockup } from './LandingHeroMockup'

export function LandingHero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <div className="landing-hero__grid">
        <div>
          <p className="landing-eyebrow">Deckspace</p>
          <h1 id="landing-hero-title" className="landing-hero__title">
            Turn company knowledge into cited, tailored pitch decks.
          </h1>
          <p className="landing-hero__sub">
            Deckspace gives every team a company brain that organizes source material, understands roles, and helps
            generate sales decks, Intel Briefs, and client-ready narratives from approved company context.
          </p>
          <div className="landing-hero__actions">
            <Link to="/signup" className="primary-button">
              Create company brain
            </Link>
            <Link to="/auth" className="secondary-button">
              Sign in
            </Link>
          </div>
          <p className="landing-hero__fine">
            Private workspace for material you are authorized to use. Designed for revenue teams who live in live
            cycles—not slide factories.
          </p>
        </div>
        <LandingHeroMockup />
      </div>
    </section>
  )
}
