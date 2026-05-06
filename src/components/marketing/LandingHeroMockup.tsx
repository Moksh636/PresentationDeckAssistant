export function LandingHeroMockup() {
  return (
    <div className="landing-mock" aria-hidden="true">
      <div className="landing-mock__inner">
        <div className="landing-mock__col">
          <span className="landing-mock__label">Knowledge library</span>
          <div className="landing-mock__tree">
            <div className="landing-mock__folder landing-mock__folder--active">Brand &amp; messaging</div>
            <div className="landing-mock__folder landing-mock__folder--nested">Approved narratives</div>
            <div className="landing-mock__folder landing-mock__folder--nested">Security FAQs</div>
            <div className="landing-mock__folder">Case studies</div>
            <div className="landing-mock__folder">Pricing guardrails</div>
          </div>
        </div>
        <div className="landing-mock__col landing-mock__intel">
          <span className="landing-mock__label">Live intel</span>
          <div className="landing-mock__intel-head">Account brief · Northwind Logistics</div>
          <p className="landing-mock__paragraph">
            Expansion signals point to a consolidation play in regional freight. Leadership emphasizes{' '}
            <strong>cost visibility</strong>
            <span className="landing-mock__cite" title="Sourced from approved library">
              [1]
            </span>{' '}
            over net-new tooling spend.
          </p>
          <p className="landing-mock__paragraph">
            Competitors pitch fleet telemetry; your wedge is <strong>forecast-grade ops reporting</strong>
            <span className="landing-mock__cite">[2]</span> aligned to how their board reviews ROI.
          </p>
          <div className="landing-mock__chips">
            <span className="landing-chip">10-Q · risk factors</span>
            <span className="landing-chip landing-chip--mint">CRM notes</span>
            <span className="landing-chip">Leadership podcast</span>
            <span className="landing-chip">Brand voice kit</span>
          </div>
        </div>
        <div className="landing-mock__col landing-mock__slides">
          <span className="landing-mock__label">Deck preview</span>
          <div className="landing-slide landing-slide--glow" />
          <div className="landing-slide" />
          <div className="landing-slide" />
        </div>
      </div>
    </div>
  )
}
