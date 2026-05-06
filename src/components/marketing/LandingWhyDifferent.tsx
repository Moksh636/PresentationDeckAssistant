const rows: [string, string][] = [
  [
    'Keeps knowledge, intel generation, and decks in one workspace',
    'Slides and research usually split across tools with weak linkage',
  ],
  [
    'Citations anchor claims back to approved or uploaded sources',
    'Outputs often read confident but hide where assertions came from',
  ],
  [
    'Owner-defined layout and governance before invites go wide',
    'Folder chaos grows silently until someone audits permissions',
  ],
  [
    'Built around revenue motions—not generic document editing',
    'General assistants optimize for speed over organizational truth',
  ],
]

export function LandingWhyDifferent() {
  return (
    <section className="landing-section landing-section--band" aria-labelledby="landing-compare-title">
      <div className="landing-section__head">
        <p className="landing-section__kicker">Why Deckspace feels different</p>
        <h2 id="landing-compare-title" className="landing-section__title">
          Truth, velocity, and governance in one loop
        </h2>
        <p className="landing-section__lede">
          A practical comparison—without naming names—between how Deckspace is shaped and how patchwork toolchains
          usually behave.
        </p>
      </div>
      <div className="landing-compare">
        <div className="landing-compare__head">
          <span>Deckspace</span>
          <span>Typical slide + assistant stacks</span>
        </div>
        {rows.map(([deckspace, typical]) => (
          <div key={deckspace} className="landing-compare__row">
            <span>{deckspace}</span>
            <span>{typical}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
