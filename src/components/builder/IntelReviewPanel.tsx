import { useMemo, useState } from 'react'
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
  CompanyBrainPolicy,
  CompanyBrainProcess,
  CompanyBrainSkillFile,
  CompanyBrainSourceUsed,
  CompanyKnowledgeItem,
  CompanyActivityKind,
  DeckIntel,
  DeckSetup,
  FileAsset,
} from '../../types/models'
import { useToast } from '../feedback/toastContext'
import { aiClient } from '../../data/aiClient'
import {
  buildCompanyBrainMapContextUsed,
  collectSourceTracesFromAssets,
  mergeIntelDraftWithExisting,
} from '../../data/intelReview'
import { filterAssetsForCitationUse, resolveCitationReviewMode } from '../../data/sourceCitationReview'
import { isAiBackendEnabled } from '../../data/aiBackendFlags'

function linesFromArray(values?: string[]) {
  return (values ?? []).join('\n')
}

function arrayFromLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function dedupeLines(lines: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out
}

interface IntelReviewPanelProps {
  deckId: string
  setup: DeckSetup
  fileAssets: FileAsset[]
  workspaceFileAssets?: FileAsset[]
  companyKnowledgeItems?: CompanyKnowledgeItem[]
  rankedSelectedKnowledge?: RankedCompanyKnowledgeEntry[]
  brainProcesses?: CompanyBrainProcess[]
  brainPolicies?: CompanyBrainPolicy[]
  brainSkillFiles?: CompanyBrainSkillFile[]
  updateDeckSetup: (deckId: string, updates: Partial<DeckSetup>) => void
  recordActivity?: (input: { kind: CompanyActivityKind; detail: string }) => void
}

export function IntelReviewPanel({
  deckId,
  setup,
  fileAssets,
  workspaceFileAssets = [],
  companyKnowledgeItems,
  rankedSelectedKnowledge,
  brainProcesses = [],
  brainPolicies = [],
  brainSkillFiles = [],
  updateDeckSetup,
  recordActivity,
}: IntelReviewPanelProps) {
  const { showToast } = useToast()
  const [lastBrainSourcesMeta, setLastBrainSourcesMeta] = useState<CompanyBrainSourceUsed[] | undefined>(
    undefined,
  )
  const [lastFallbackWarning, setLastFallbackWarning] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const intel = useMemo(() => setup.intel ?? {}, [setup.intel])
  const citationReviewMode = resolveCitationReviewMode(setup)
  const aiBackendEnabled = isAiBackendEnabled()

  const patchIntel = (partial: Partial<DeckIntel>) => {
    updateDeckSetup(deckId, { intel: { ...intel, ...partial } })
  }

  const intelChecklist = useMemo(() => {
    return [
      { id: 'summary', label: 'Company summary', ok: Boolean(intel.companySummary?.trim()) },
      { id: 'priorities', label: 'Inferred priorities', ok: (intel.inferredPriorities ?? []).some((p) => p.trim()) },
      { id: 'pains', label: 'Pain points', ok: (intel.painPoints ?? []).some((p) => p.trim()) },
      { id: 'proof', label: 'Proof points', ok: (intel.proofPoints ?? []).some((p) => p.trim()) },
      { id: 'objections', label: 'Likely objections', ok: (intel.objections ?? []).some((p) => p.trim()) },
      { id: 'angle', label: 'Recommended pitch angle', ok: Boolean(intel.recommendedPitchAngle?.trim()) },
      { id: 'citations', label: 'Citations present', ok: Boolean(intel.citations && intel.citations.length > 0) },
    ]
  }, [intel])

  const handleGenerateDraft = async () => {
    if (isGenerating) {
      return
    }

    setIsGenerating(true)

    try {
      const reviewableAssets = filterAssetsForCitationUse(fileAssets, citationReviewMode)
      const response = await aiClient.generateIntelReview({
        setup,
        fileAssets: reviewableAssets,
        sourceTraces: collectSourceTracesFromAssets(reviewableAssets),
        webResearchEnabled: setup.webResearch,
        companyKnowledgeItems,
        selectedCompanyKnowledgeItemIds: setup.selectedCompanyKnowledgeItemIds,
        workspaceFileAssets,
        brainProcesses,
        brainPolicies,
        brainSkillFiles,
      })
      const merged = mergeIntelDraftWithExisting(intel, response.intel)
      updateDeckSetup(deckId, { intel: merged })
      setLastBrainSourcesMeta(response.companyBrainSourcesUsed)

      const usedFallback = response.warnings.some((w) =>
        /AI backend unavailable|local intel draft fallback/i.test(w),
      )
      if (usedFallback) {
        const message =
          'Gemini Intel Review was unavailable — a local deterministic draft was applied instead. Review fields before generating your deck.'
        setLastFallbackWarning(message)
        showToast('AI backend unavailable; used local intel draft fallback.', 'info')
      } else {
        setLastFallbackWarning(null)
        if (response.warnings.length > 0) {
          showToast(response.warnings[0], 'info')
        }
      }

      recordActivity?.({
        kind: 'intel-review-generated',
        detail: `Intel Review draft updated (${aiBackendEnabled ? 'Gemini Intel Review edge path when reachable' : 'local deterministic pipeline'}).`,
      })
    } catch {
      showToast('Intel Review generation failed. Try again or edit fields manually.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClearIntel = () => {
    updateDeckSetup(deckId, { intel: undefined })
    setLastBrainSourcesMeta(undefined)
    setLastFallbackWarning(null)
  }

  const handleApplyIntelToBrief = () => {
    const baseGoal = setup.meetingGoal?.trim() || setup.goal?.trim() || ''
    const angle = intel.recommendedPitchAngle?.trim()
    const nextGoal =
      angle && !baseGoal.includes(angle)
        ? [baseGoal, `Pitch angle:\n${angle}`].filter(Boolean).join('\n\n')
        : baseGoal

    const mergedPains = [...(setup.knownPainPoints ?? []), ...(intel.painPoints ?? [])]

    const intelNotes = [
      setup.notes?.trim(),
      intel.companySummary?.trim() && `Intel — company summary:\n${intel.companySummary.trim()}`,
      (intel.objections ?? []).length > 0 && `Likely objections:\n${(intel.objections ?? []).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    updateDeckSetup(deckId, {
      meetingGoal: nextGoal || setup.meetingGoal,
      goal: nextGoal || setup.goal,
      knownPainPoints: dedupeLines(mergedPains),
      notes: intelNotes || setup.notes,
    })
  }

  const handleRefreshCitations = () => {
    const traces = collectSourceTracesFromAssets(
      filterAssetsForCitationUse(fileAssets, citationReviewMode),
    )
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

  const brainMapContextRows = useMemo(() => {
    if (!hasBrainSelection || !companyKnowledgeItems?.length) {
      return []
    }
    const ids = setup.selectedCompanyKnowledgeItemIds ?? []
    const assetLookup = mergeAssetsForKnowledgeTraceLookup(fileAssets, workspaceFileAssets)
    return buildCompanyBrainMapContextUsed(
      ids,
      companyKnowledgeItems,
      assetLookup,
      brainProcesses,
      brainPolicies,
      brainSkillFiles,
    )
  }, [
    hasBrainSelection,
    companyKnowledgeItems,
    setup.selectedCompanyKnowledgeItemIds,
    fileAssets,
    workspaceFileAssets,
    brainProcesses,
    brainPolicies,
    brainSkillFiles,
  ])

  return (
    <div className="intel-review-card intel-review-card--compact">
      <div className="intel-review-panel__intro intel-review-panel__intro--compact">
        <div className="intel-review-toolbar">
          <button type="button" className="primary-button" disabled={isGenerating} onClick={handleGenerateDraft}>
            {isGenerating ? 'Generating…' : 'Generate Intel Review'}
          </button>
          <button
            type="button"
            className="secondary-button secondary-button--sm"
            disabled={isGenerating}
            onClick={handleGenerateDraft}
          >
            {isGenerating ? 'Generating…' : 'Regenerate'}
          </button>
          <button type="button" className="ghost-button ghost-button--sm" onClick={handleClearIntel}>
            Clear intel
          </button>
          <button type="button" className="ghost-button ghost-button--sm" onClick={handleApplyIntelToBrief}>
            Apply to pitch brief
          </button>
          <button type="button" className="ghost-button ghost-button--sm" onClick={handleRefreshCitations}>
            Refresh citations
          </button>
        </div>
        <p className="intel-ai-mode-pill" aria-label="Intel Review AI mode">
          {aiBackendEnabled
            ? 'Gemini Intel Review edge path · Company Brain filters preserved'
            : 'Local deterministic intel · bundled heuristics only'}
        </p>
        {lastFallbackWarning ? (
          <div className="intel-fallback-banner" role="status">
            <strong>Intel fallback active.</strong> {lastFallbackWarning}
          </div>
        ) : null}
        <ul className="intel-field-checklist muted-copy">
          {intelChecklist.map((row) => (
            <li key={row.id} className={row.ok ? 'is-ok' : ''}>
              <span aria-hidden>{row.ok ? '✓' : '○'}</span> {row.label}
            </li>
          ))}
        </ul>
        <p className="muted-copy intel-review-mode-line intel-review-mode-line--compact">
          Citations use approved source snippets; memory-only Brain rows stay non-file-backed.
        </p>
        <details className="intel-review-about-fold">
          <summary>How Intel Review uses sources</summary>
          <p className="muted-copy intel-review-lede">
            Review this account intel before generating the pitch deck. Uploaded files with trace metadata can surface as
            citations; Company Brain memory-only rows stay honest (no fabricated file traces).
          </p>
          <p className="muted-copy intel-review-mode-line">
            Intel runs{' '}
            {aiBackendEnabled ? 'through the configured edge backend when available.' : 'offline with bundled heuristics.'}
          </p>
        </details>
      </div>

      <div className="form-grid intel-review-grid">
          <label className="field-group field-group--wide">
            <span className="field-label">Company summary</span>
            <textarea
              rows={3}
              className="intel-review-textarea"
              value={intel.companySummary ?? ''}
              placeholder="Account context, trigger event, and why now."
              onChange={(event) => patchIntel({ companySummary: event.target.value })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Inferred priorities</span>
            <textarea
              rows={3}
              className="intel-review-textarea"
              value={linesFromArray(intel.inferredPriorities)}
              placeholder={'One priority per line\ne.g. reduce cycle time'}
              onChange={(event) => patchIntel({ inferredPriorities: arrayFromLines(event.target.value) })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Pain points</span>
            <textarea
              rows={3}
              className="intel-review-textarea"
              value={linesFromArray(intel.painPoints)}
              placeholder="One pain point per line"
              onChange={(event) => patchIntel({ painPoints: arrayFromLines(event.target.value) })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Proof points</span>
            <textarea
              rows={3}
              className="intel-review-textarea"
              value={linesFromArray(intel.proofPoints)}
              placeholder="One proof point or metric per line"
              onChange={(event) => patchIntel({ proofPoints: arrayFromLines(event.target.value) })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Likely objections</span>
            <textarea
              rows={2}
              className="intel-review-textarea"
              value={linesFromArray(intel.objections)}
              placeholder="One objection per line"
              onChange={(event) => patchIntel({ objections: arrayFromLines(event.target.value) })}
            />
          </label>

          <label className="field-group field-group--wide">
            <span className="field-label">Recommended pitch angle</span>
            <textarea
              rows={2}
              className="intel-review-textarea"
              value={intel.recommendedPitchAngle ?? ''}
              placeholder="How you want to open and frame the story."
              onChange={(event) => patchIntel({ recommendedPitchAngle: event.target.value })}
            />
          </label>

          <details className="intel-review-brain-fold">
            <summary className="intel-review-brain-fold__summary">
              Company Brain sources used
              {hasBrainSelection && companyKnowledgeItems?.length ? (
                <span className="muted-copy intel-review-brain-fold__hint"> · {companyKnowledgeItems.length} selected</span>
              ) : null}
            </summary>
            {!hasBrainSelection ? (
              <p className="muted-copy">
                No Company Brain items selected for this pitch. Choose suggestions under Company knowledge above, or pull
                collateral from <Link to="/company">Company Brain</Link>.
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
                                    ? `Cited source (linked file)${meta && meta.citationCount > 0 ? ` · ${meta.citationCount}` : ''}`
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
                                  Linked file snippets can appear as deck citations when the library asset
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
          </details>

          <details className="intel-review-brain-fold">
            <summary className="intel-review-brain-fold__summary">
              Company Brain context used (Brain Map)
              {brainMapContextRows.length > 0 ? (
                <span className="muted-copy intel-review-brain-fold__hint"> · {brainMapContextRows.length} links</span>
              ) : null}
            </summary>
            {!hasBrainSelection ? (
              <p className="muted-copy">
                Select Company Brain knowledge for this pitch to surface linked Brain Map processes, policies, and skill
                files.
              </p>
            ) : !brainMapContextRows.length ? (
              <p className="muted-copy">
                No Brain Map rows reference the selected knowledge yet. Add links under Owner Console → Brain Map, or
                generate again after updating selections.
              </p>
            ) : (
              <ul className="intel-company-knowledge-list">
                {brainMapContextRows.map((row) => (
                  <li key={`${row.kind}-${row.id}`}>
                    <div className="intel-knowledge-row-heading">
                      <strong>
                        {row.kind === 'process'
                          ? 'Process'
                          : row.kind === 'policy'
                            ? 'Policy'
                            : 'Skill file'}
                        : {row.title}
                      </strong>
                      <span
                        className={`intel-knowledge-backing-pill ${row.backing === 'citation-backed' ? 'intel-knowledge-backing-pill--cited' : ''}`}
                      >
                        {row.backing === 'citation-backed'
                          ? `Citation-backed (linked knowledge sources)${row.citationCount ? ` · ${row.citationCount}` : ''}`
                          : 'Memory-only (linked knowledge has no file sources)'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </details>

          <div className="field-group field-group--wide intel-review-citations-field">
            <span className="field-label">Citations / supporting sources</span>
            {intel.citations && intel.citations.length > 0 ? (
              <details className="intel-review-citations-fold">
                <summary>
                  {intel.citations.length} citation{intel.citations.length === 1 ? '' : 's'} · expand to review
                </summary>
                <ul className="intel-citation-list intel-citation-list--compact">
                  {intel.citations.map((citation, index) => (
                    <li key={`${citation.fileId}-${index}-${citation.extractedSnippet.slice(0, 24)}`}>
                      <details className="intel-citation-entry">
                        <summary className="intel-citation-entry__summary">
                          <strong>{citation.fileName}</strong>
                          <span className="intel-citation-meta">{citation.sourceType}</span>
                        </summary>
                        <p>{citation.extractedSnippet}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="muted-copy">
                No citations yet. Upload sources with traces, use &quot;Generate Intel Review&quot;, or
                &quot;Refresh citations from uploads&quot; when files include source metadata.
              </p>
            )}
          </div>
      </div>
    </div>
  )
}
