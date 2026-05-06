export function LandingCompanyBrain() {
  return (
    <section className="landing-section" id="company-brain" aria-labelledby="landing-brain-title">
      <div className="landing-section__head">
        <p className="landing-section__kicker">Company Brain</p>
        <h2 id="landing-brain-title" className="landing-section__title">
          One structured library—not another shared drive
        </h2>
        <p className="landing-section__lede">
          Organize approved stories, proof, and guardrails in folders your operators define. Everyone pulls from the
          same source of truth before a deck ships.
        </p>
      </div>
      <div className="landing-brain">
        <div className="landing-brain__visual">
          <div className="landing-brain__tree" aria-hidden="true">
            <div>
              <span>/company-brain</span>
            </div>
            <div>
              ├─ <span>brand/</span> voice + positioning
            </div>
            <div>
              ├─ <span>security/</span> standard answers
            </div>
            <div>
              ├─ <span>customers/</span> redacted wins
            </div>
            <div>
              └─ <span>pricing/</span> guardrails &amp; bundles
            </div>
          </div>
          <div className="landing-approval">
            <div>
              <div className="landing-approval__tag">Governance</div>
              <p className="landing-approval__copy">Sensitive snippets route through review before they surface in intel.</p>
            </div>
            <span className="landing-approval__pill">Approval recorded</span>
          </div>
        </div>
        <div className="landing-brain__roles">
          <article className="landing-role-card">
            <div className="landing-role-card__badge" aria-hidden="true">
              ◎
            </div>
            <div>
              <h4>Owners</h4>
              <p>Set departments, roles, and folder layout before the wider team joins—policy stays upstream.</p>
            </div>
          </article>
          <article className="landing-role-card">
            <div className="landing-role-card__badge" aria-hidden="true">
              ◇
            </div>
            <div>
              <h4>Builders</h4>
              <p>Draft account intel and decks with guardrails visible—not buried three clicks deep.</p>
            </div>
          </article>
          <article className="landing-role-card">
            <div className="landing-role-card__badge" aria-hidden="true">
              ○
            </div>
            <div>
              <h4>Reviewers</h4>
              <p>Comment-only visibility keeps feedback sharp without risking stray edits to approved sources.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
