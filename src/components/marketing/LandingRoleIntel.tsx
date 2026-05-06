export function LandingRoleIntel() {
  return (
    <section className="landing-section landing-section--band" aria-labelledby="landing-role-intel-title">
      <div className="landing-section__head">
        <p className="landing-section__kicker">Role-aware intelligence</p>
        <h2 id="landing-role-intel-title" className="landing-section__title">
          The right depth for how someone works the deal
        </h2>
        <p className="landing-section__lede">
          Deckspace keeps context layered so sellers move fast while operators retain control—without forcing everyone
          into the same view.
        </p>
      </div>
      <div className="landing-role-grid">
        <article className="landing-role-intel">
          <h3>Account executives</h3>
          <ul>
            <li>Slide-ready talking points tied to buyer motions</li>
            <li>Citations that jump back to approved snippets</li>
            <li>Less rewriting between CRM notes and the deck</li>
          </ul>
        </article>
        <article className="landing-role-intel">
          <h3>Sales leadership</h3>
          <ul>
            <li>Consistent storyline checks across opportunities</li>
            <li>Visibility into what reps pulled before customer calls</li>
            <li>Fewer emergency rebuilds the night before a review</li>
          </ul>
        </article>
        <article className="landing-role-intel">
          <h3>Revenue operations</h3>
          <ul>
            <li>Repeatable structure for intel and deck outputs</li>
            <li>Cleaner handoffs between research, marketing, and sales</li>
            <li>Room to wire your own AI stack behind the scenes</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
