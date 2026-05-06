import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { RankedCompanyKnowledgeEntry } from '../../data/companyKnowledgeRetrieval'
import {
  INTEL_REVIEW_COMPANY_BRAIN_BUCKET_ORDER,
  groupCompanyKnowledgeByIntelBucket,
  companyBrainIntelBucketLabel,
  knowledgeItemHasCitationBackedTraces,
  mergeAssetsForKnowledgeTraceLookup,
} from '../../data/companyBrainDeckPipeline'
import type {
  CompanyBrainSourceUsed,
  CompanyKnowledgeItem,
  DeckIntel,
  DeckSetup,
  FileAsset,
} from '../../types/models'
import { useToast } from '../feedback/toastContext'
import { aiClient } from '../../data/aiClient'
import {
  collectSourceTracesFromAssets,
  mergeIntelDraftWithExisting,
} from '../../data/intelReview'
import { filterAssetsForCitationUse } from '../../data/sourceCitationReview'

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
  workspaceFileAssets?: FileAsset[]
  companyKnowledgeItems?: CompanyKnowledgeItem[]
  rankedSelectedKnowledge?: RankedCompanyKnowledgeEntry[]
  updateDeckSetup: (deckId: string, updates: Partial<DeckSetup>) => void
}

export function IntelReviewPanel({
  deckId,
  setup,
  fileAssets,
  workspaceFileAssets = [],
  companyKnowledgeItems,
  rankedSelectedKnowledge,
  updateDeckSetup,
}: IntelReviewPanelProps) {
  const { showToast } = useToast()
  const [lastBrainSourcesMeta, setLastBrainSourcesMeta] = useState<CompanyBrainSourceUsed[] | undefined>(
    undefined,
  )
  const intel = setup.intel ?? {}

  const patchIntel = (partial: Partial<DeckIntel>) => {
    updateDeckSetup(deckId, { intel: { ...intel, ...partial } })
  }

  const handleGenerateDraft = async () => {
    const reviewableAssets = filterAssetsForCitationUse(fileAssets)
    const response = await aiClient.generateIntelReview({
      setup,
      fileAssets: reviewableAssets,
      sourceTraces: collectSourceTracesFromAssets(reviewableAssets),
      webResearchEnabled: setup.webResearch,
      companyKnowledgeItems,
      selectedCompanyKnowledgeItemIds: setup.selectedCompanyKnowledgeItemIds,
      workspaceFileAssets,
    })
    const merged = mergeIntelDraftWithExisting(intel, response.intel)
    updateDeckSetup(deckId, { intel: merged })
    setLastBrainSourcesMeta(response.companyBrainSourcesUsed)

    if (response.warnings.length > 0) {
      showToast(response.warnings[0], 'info')
    }
  }

  const handleRefreshCitations = () => {
    const traces = collectSourceTracesFromAssets(filterAssetsForCitationUse(fileAssets))
    const base: DeckIntel = { ...intel }
    delete base.citations

    if (traces.length > 0) {
      base.citations = traces
    }

    updateDeckSetup(deckId, { intel: Object.keys(base).length > 0 ? base : undefined })
  }

  const selectedIds = setup.selectedCompanyKnowledgeItemIds ?? []
  const hasBrainSelection = selectedIds.length > 0
  const assetLookup = mergeAssetsForKnowledgeTraceLookup(fileAssets, workspaceFileAssets)
  const rankById = new Map((rankedSelectedKnowledge ?? []).map((entry) => [entry.item.id, entry]))
  const brainMetaById = new Map((lastBrainSourcesMeta ?? []).map((row) => [row.id, row]))
  const buckets = companyKnowledgeItems?.length
    ? groupCompanyKnowledgeByIntelBucket(companyKnowledgeItems)
    : null

  return (
    <section className="panel-card intel-review-card">
      <details className="builder-details intel-review-details" open>
        <summary>Intel Review</summary>
        <p className="muted-copy intel-review-lede">
          Review this account intel before generating the pitch deck. Uploaded files with trace metadata can
          surface as citations; Company Brain memory-only rows stay honest (no fabricated file traces).
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
            <span className="field-label">Company Brain sources used</span>
            {!hasBrainSelection ? (
              <p className="muted-copy">
                No Company Brain items selected for this pitch. Choose suggestions under Company knowledge
                above, or pull collateral from <Link to="/company">Company Brain</Link>.
              </p>
            ) : !companyKnowledgeItems?.length ? (
              <p className="muted-copy">
                Selection ids are present but no matching knowledge rows were found in this workspace.
              </p>
            ) : (
              <div className="intel-company-brain-groups">
                {INTEL_REVIEW_COMPANY_BRAIN_BUCKET_ORDER.map((bucketId) => {
                  const bucketItems = buckets?.get(bucketId) ?? []
                  if (bucketItems.length === 0) {
                    return null
                  }

                  return (
                    <div key={bucketId} className="intel-company-brain-bucket">
                      <h4 className="intel-company-brain-bucket-title">
                        {companyBrainIntelBucketLabel(bucketId)}
                      </h4>
                      <ul className="intel-company-knowledge-list">
                        {bucketItems.map((item) => {
                          const meta = brainMetaById.get(item.id)
                          const cited =
                            meta !== undefined
                              ? meta.citationBacked
                              : knowledgeItemHasCitationBackedTraces(item, assetLookup)
                          const ranked = rankById.get(item.id)

                          return (
                            <li key={item.id}>
                              <div className="intel-knowledge-row-heading">
                                <strong>{item.title}</strong>
                                <span
                                  className={`intel-knowledge-backing-pill ${cited ? 'intel-knowledge-backing-pill--cited' : ''}`}
                                >
                                  {cited
                                    ? `Cited source (linked file trace)${meta && meta.citationCount > 0 ? ` · ${meta.citationCount}` : ''}`
                                    : 'Company knowledge, not citation-backed'}
                                </span>
                              </div>
                              <div className="intel-knowledge-meta-row">
                                <span className="intel-knowledge-meta-chip">{item.sourceType}</span>
                                <span className="intel-knowledge-meta-chip">{item.approvalStatus}</span>
                                {ranked ? (
                                  <span className="intel-knowledge-meta-chip">
                                    Relevance: {ranked.band} ({Math.round(ranked.score)})
                                  </span>
                                ) : null}
                              </div>
                              <p className="muted-copy">{item.description?.trim() || item.title}</p>
                              {cited ? (
                                <p className="muted-copy intel-knowledge-citation-hint">
                                  File-linked traces can appear in deck citations when the library asset
                                  retains parsed metadata.
                                </p>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

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
