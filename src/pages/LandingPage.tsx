import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="marketing-page">
      <header className="marketing-nav">
        <div className="marketing-nav__brand">
          <span className="marketing-nav__logo">Deckspace</span>
          <span className="marketing-nav__tag">AI-native revenue workspace</span>
        </div>
        <nav className="marketing-nav__actions" aria-label="Account">
          <Link to="/auth" className="ghost-button marketing-nav__link">
            Sign in
          </Link>
          <Link to="/signup" className="primary-button marketing-nav__cta">
            Sign up
          </Link>
        </nav>
      </header>

      <main>
        <section className="marketing-hero">
          <div className="marketing-hero__grid">
            <div>
              <p className="section-label">Deckspace</p>
              <h1 className="marketing-hero__title">
                Turn live account research into polished, cited pitch decks—without losing your brand voice.
              </h1>
              <p className="marketing-hero__lede">
                Bring proposals, intel briefs, and approved messaging into one workspace. Generate structured
                decks, collaborate with comment-only reviewers, and export when leadership is ready.
              </p>
              <div className="marketing-hero__actions">
                <Link to="/signup" className="primary-button">
                  Create your workspace
                </Link>
                <Link to="/auth" className="secondary-button">
                  Sign in
                </Link>
              </div>
              <p className="marketing-hero__fine-print">
                Private company workspace—bring content you are authorized to use. No Stripe billing in this MVP.
              </p>
            </div>
            <div className="marketing-hero__panel" aria-hidden="true">
              <div className="marketing-hero__panel-inner">
                <span className="marketing-hero__panel-label">Snapshot</span>
                <ul>
                  <li>
                    <strong>Company Brain</strong> keeps narratives, proof, and guardrails organized.
                  </li>
                  <li>
                    <strong>Build</strong> turns briefs into slide-ready intel with source traces.
                  </li>
                  <li>
                    <strong>Edit</strong> refines layout, exports PPTX, and shares safely.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="product">
          <div className="marketing-section__header">
            <h2>Everything revenue teams need before the live call</h2>
            <p>
              A focused shell for account-specific decks—structured inputs, traceable sources, and repeatability
              across reps.
            </p>
          </div>
          <div className="marketing-cards">
            <article className="marketing-card">
              <h3>Account workspace</h3>
              <p>Organize decks, intel briefs, and uploads alongside each opportunity—not buried in drives.</p>
            </article>
            <article className="marketing-card">
              <h3>Company Brain</h3>
              <p>
                Shared messaging, case studies, brand defaults, and knowledge folders keep pitches aligned with what
                leadership approved.
              </p>
            </article>
            <article className="marketing-card">
              <h3>Editor &amp; export</h3>
              <p>Slide editing with present mode and structured export paths so GTM can move fast without chaos.</p>
            </article>
          </div>
        </section>

        <section className="marketing-section marketing-section--alt" id="how">
          <div className="marketing-section__header">
            <h2>How teams use Deckspace</h2>
            <p>Three calm steps from brief to board-ready slides.</p>
          </div>
          <ol className="marketing-steps">
            <li>
              <strong>Capture context</strong>
              <span>Upload sources, pull approved snippets from Company Brain, and lock tone with Brand Kit.</span>
            </li>
            <li>
              <strong>Generate &amp; refine intel</strong>
              <span>Mock AI scaffolding drafts structured intel locally—expand with your backend when ready.</span>
            </li>
            <li>
              <strong>Ship the deck</strong>
              <span>Edit slides, review comments, export PPTX, and keep versions linked to the account.</span>
            </li>
          </ol>
        </section>

        <section className="marketing-section" id="owners">
          <div className="marketing-section__header">
            <h2>Built for owners &amp; operators</h2>
            <p>
              Owners configure knowledge layout preferences, departments, roles, and governance before inviting the
              broader team—workers land directly in the pitch workspace.
            </p>
          </div>
          <div className="marketing-highlight">
            <p>
              After signup, run the guided onboarding to stand up your company workspace, then manage policies from
              the <strong>Owner console</strong> without touching pitch workflows.
            </p>
          </div>
        </section>

        <section className="marketing-section marketing-section--alt" id="trust">
          <div className="marketing-section__header">
            <h2>Trust &amp; control</h2>
            <p>Browser-first workspace with optional Supabase auth—your data stays under your policies.</p>
          </div>
          <ul className="marketing-trust">
            <li>Private login remains the default gate for workspace routes.</li>
            <li>No paid third-party AI keys bundled—mock paths stay local until you wire your backend.</li>
            <li>Manual cloud snapshots—no silent exfiltration of workspace JSON.</li>
          </ul>
        </section>

        <section className="marketing-cta">
          <h2>Ready when your team is</h2>
          <p>Spin up the MVP shell, invite collaborators, and iterate toward production AI behind your controls.</p>
          <div className="marketing-hero__actions">
            <Link to="/signup" className="primary-button">
              Get started
            </Link>
            <Link to="/auth" className="ghost-button">
              Already have access?
            </Link>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <span>Deckspace · MVP shell</span>
        <Link to="/auth">Workspace sign-in</Link>
      </footer>
    </div>
  )
}
