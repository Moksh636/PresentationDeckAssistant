import { Link } from 'react-router-dom'

export function LandingFinalCta() {
  return (
    <section className="landing-final" aria-labelledby="landing-final-title">
      <h2 id="landing-final-title">Build your company brain before your next pitch.</h2>
      <p>Create the workspace, configure knowledge, then invite the team when your storyline is ready.</p>
      <div className="landing-final__actions">
        <Link to="/signup" className="primary-button">
          Create company brain
        </Link>
        <Link to="/auth" className="secondary-button">
          Sign in
        </Link>
      </div>
    </section>
  )
}
