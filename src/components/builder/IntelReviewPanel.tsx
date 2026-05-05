import type { DeckIntel, DeckSetup, FileAsset } from '../../types/models'
import {
  collectSourceTracesFromAssets,
  generateIntelDraftFromSources,
  mergeIntelDraftWithExisting,
} from '../../data/intelReview'

function linesFromArray(values?: string[]) {
  return (values ?? []).join('\n')
}

function arrayFromLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

interface IntelReviewPanelProps {
  deckId: string
  setup: DeckSetup
  fileAssets: FileAsset[]
  updateDeckSetup: (deckId: string, updates: Partial<DeckSetup>) => void
}

export function IntelReviewPanel({ deckId, setup, fileAssets, updateDeckSetup }: IntelReviewPanelProps) {
  const intel = setup.intel ?? {}

  const patchIntel = (partial: Partial<DeckIntel>) => {
    updateDeckSetup(deckId, { intel: { ...intel, ...partial } })
  }

  const handleGenerateDraft = () => {
    const draft = generateIntelDraftFromSources(setup, fileAssets)
    const merged = mergeIntelDraftWithExisting(intel, draft)
    updateDeckSetup(deckId, { intel: merged })
  }

  const handleRefreshCitations = () => {
    const traces = collectSourceTracesFromAssets(fileAssets)
    const base: DeckIntel = { ...intel }
    delete base.citations

    if (traces.length > 0) {
      base.citations = traces
    }

    updateDeckSetup(deckId, { intel: Object.keys(base).length > 0 ? base : undefined })
  }

  return (
    <section className="panel-card intel-review-card">
      <details className="builder-details intel-review-details" open>
        <summary>Intel Review</summary>
        <p className="muted-copy intel-review-lede">
          Review this account intel before generating the pitch deck. Claims with sources will be cited in
          the deck when available.
        </p>

        <div className="intel-review-toolbar">
          <button type="button" className="secondary-button" onClick={handleGenerateDraft}>
            Generate intel draft from sources
          </button>
          <button type="button" className="ghost-button" onClick={handleRefreshCitations}>
            Refresh citations from uploads
          </button>
        </div>

        <div className="form-grid intel-review-grid">
          <label className="field-group field-group--wide">
            <span className="field-label">Company summary</span>
            <textarea
              rows={4}
              value={intel.companySummary ?? ''}
              placeholder="Account context, trigger event, and why now."
              onChange={(event) => patchIntel({ companySummary: event.target.value })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Inferred priorities</span>
            <textarea
              rows={4}
              value={linesFromArray(intel.inferredPriorities)}
              placeholder={'One priority per line\ne.g. reduce cycle time'}
              onChange={(event) => patchIntel({ inferredPriorities: arrayFromLines(event.target.value) })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Pain points</span>
            <textarea
              rows={4}
              value={linesFromArray(intel.painPoints)}
              placeholder="One pain point per line"
              onChange={(event) => patchIntel({ painPoints: arrayFromLines(event.target.value) })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Proof points</span>
            <textarea
              rows={4}
              value={linesFromArray(intel.proofPoints)}
              placeholder="One proof point or metric per line"
              onChange={(event) => patchIntel({ proofPoints: arrayFromLines(event.target.value) })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Likely objections</span>
            <textarea
              rows={3}
              value={linesFromArray(intel.objections)}
              placeholder="One objection per line"
              onChange={(event) => patchIntel({ objections: arrayFromLines(event.target.value) })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Recommended pitch angle</span>
            <textarea
              rows={3}
              value={intel.recommendedPitchAngle ?? ''}
              placeholder="How you want to open and frame the story."
              onChange={(event) => patchIntel({ recommendedPitchAngle: event.target.value })}
            />
          </label>

          <div className="field-group field-group--wide">
            <span className="field-label">Citations / supporting sources</span>
            {intel.citations && intel.citations.length > 0 ? (
              <ul className="intel-citation-list">
                {intel.citations.map((citation, index) => (
                  <li key={`${citation.fileId}-${index}-${citation.extractedSnippet.slice(0, 24)}`}>
                    <strong>{citation.fileName}</strong>
                    <span className="intel-citation-meta">{citation.sourceType}</span>
                    <p>{citation.extractedSnippet}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-copy">
                No citations yet. Upload sources with traces, use &quot;Generate intel draft from
                sources&quot;, or &quot;Refresh citations from uploads&quot; when files include source
                metadata.
              </p>
            )}
          </div>
        </div>
      </details>
    </section>
  )
}
