export function LandingPitchWorkflow() {
  const steps = [
    {
      title: 'Capture context',
      body: 'Attach sources, CRM highlights, and snippets from Company Brain in one workspace.',
    },
    {
      title: 'Shape intel',
      body: 'Draft structured briefs with trace lines so bold claims stay accountable.',
    },
    {
      title: 'Generate slides',
      body: 'Move from narrative to slide outlines tuned to your storyline—not a blank canvas.',
    },
    {
      title: 'Review & tighten',
      body: 'Route feedback through comments while preserving approved language.',
    },
    {
      title: 'Export & present',
      body: 'Package for the room you are walking into, with versions tied to the account.',
    },
  ]

  return (
    <section className="landing-section" id="pitch-decks" aria-labelledby="landing-pitch-title">
      <div className="landing-section__head">
        <p className="landing-section__kicker">Pitch decks</p>
        <h2 id="landing-pitch-title" className="landing-section__title">
          A horizontal workflow from brief to boardroom
        </h2>
        <p className="landing-section__lede">
          Each step stays lightweight on the surface while holding enough structure for revenue teams to scale quality—not
          heroics.
        </p>
      </div>
      <div className="landing-rail-wrap">
        <div className="landing-rail">
          {steps.map((step, i) => (
            <article key={step.title} className="landing-rail__step">
              <span className="landing-rail__num">Step {i + 1}</span>
              <h4>{step.title}</h4>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
