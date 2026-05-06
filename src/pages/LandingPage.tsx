import {
  LandingCompanyBrain,
  LandingCredibilityStrip,
  LandingFinalCta,
  LandingFooter,
  LandingHero,
  LandingNav,
  LandingPitchWorkflow,
  LandingProblem,
  LandingRoleIntel,
  LandingSecurity,
  LandingWhyDifferent,
} from '../components/marketing'
import '../styles/landing.css'

export function LandingPage() {
  return (
    <div className="landing-page">
      <LandingNav />
      <main className="landing-page__main">
        <LandingHero />
        <section id="product" className="landing-section">
          <LandingCredibilityStrip />
          <LandingProblem />
        </section>
        <LandingCompanyBrain />
        <LandingRoleIntel />
        <LandingPitchWorkflow />
        <LandingWhyDifferent />
        <LandingSecurity />
        <LandingFinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
