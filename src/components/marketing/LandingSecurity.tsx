export function LandingSecurity() {
  return (
    <section className="landing-section" id="security" aria-labelledby="landing-security-title">
      <div className="landing-section__head">
        <p className="landing-section__kicker">Security &amp; trust</p>
        <h2 id="landing-security-title" className="landing-section__title">
          Controls you can explain to security—not buzzwords
        </h2>
        <p className="landing-section__lede">
          Deckspace is browser-first and built to sit behind your authentication choices. We describe what the shell does
          today; we do not claim certifications we have not earned.
        </p>
      </div>
      <div className="landing-security-grid">
        <article className="landing-security-card">
          <h3>Workspace access</h3>
          <p>
            Protected routes stay gated behind login. Signed-out visitors see marketing and authentication entry points
            only—your workspace data stays on authenticated paths.
          </p>
        </article>
        <article className="landing-security-card">
          <h3>Your AI posture</h3>
          <p>
            The MVP shell keeps scaffolding local until you connect your own backend and models. That lets legal and
            security sign off on data flows on your terms—not ours by default.
          </p>
        </article>
        <article className="landing-security-card">
          <h3>Cloud snapshots</h3>
          <p>
            Where cloud persistence is enabled, synchronization is explicit—there is no silent background export of your
            workspace JSON.
          </p>
        </article>
        <article className="landing-security-card">
          <h3>Compliance language</h3>
          <p>
            Need SOC 2 or HIPAA specifics? Treat those as diligence questions tied to your deployment—not generic claims
            on a landing page.
          </p>
        </article>
      </div>
    </section>
  )
}
