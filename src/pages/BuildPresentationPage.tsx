import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GenerateSlidesResult } from '../context/workspaceStoreContext'
import { collectBuildPreflightIssues } from '../data/buildPresentationPreflight'
import { buildReadyToGenerateChecklist, deriveBuildWorkflowSteps } from '../data/buildWorkflowProgress'
import { CompanyKnowledgeSuggestPanel } from '../components/builder/CompanyKnowledgeSuggestPanel'
import { ChartSuggestionsPanel } from '../components/builder/ChartSuggestionsPanel'
import { IntelReviewPanel } from '../components/builder/IntelReviewPanel'
import { SourceMaterialsSummary } from '../components/builder/SourceMaterialsSummary'
import { SourceCitationQAPanel } from '../components/builder/SourceCitationQAPanel'
import { SourceUploadDropzone } from '../components/builder/SourceUploadDropzone'
import { ToggleField } from '../components/builder/ToggleField'
import { UploadedFileList } from '../components/builder/UploadedFileList'
import { CommentsPanel } from '../components/collaboration/CommentsPanel'
import { useAuth } from '../context/useAuth'
import { useWorkspace } from '../context/useWorkspace'
import { getMembershipForOrgUser } from '../data/companyBrainMutations'
import { getActiveOrganizationBrandKit } from '../data/brandKitResolve'
import { getRelevantCompanyKnowledgeForUserWithExplanations } from '../data/companyKnowledgeRetrieval'
import { workspaceUserProfileFromAuth } from '../data/workspaceUserProfile'
import {
  canCollaboratorCommentOnSetup,
  canCollaboratorUpload,
  getSetupFieldLabel,
} from '../data/collaboration'
import { isAiBackendEnabled } from '../data/aiBackendFlags'
import { computeCitationQAStats } from '../data/sourceCitationReview'
import type { DeckSetup, FileContributorRole, SetupFieldKey } from '../types/models'

function effectiveMeetingGoal(setup: DeckSetup): string {
  if (setup.meetingGoal !== undefined && setup.meetingGoal.trim() !== '') {
    return setup.meetingGoal
  }

  return setup.goal
}

function effectiveBuyerPersona(setup: DeckSetup): string {
  if (setup.buyerPersona !== undefined && setup.buyerPersona.trim() !== '') {
    return setup.buyerPersona
  }

  return setup.audience
}

function effectiveDeckTypeValue(setup: DeckSetup): string {
  if (setup.deckType !== undefined && setup.deckType.trim() !== '') {
    return setup.deckType
  }

  return setup.presentationType
}

function painPointsToLines(setup: DeckSetup): string {
  return (setup.knownPainPoints ?? []).join('\n')
}

function linesToPainPoints(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const setupFieldTargets: SetupFieldKey[] = [
  'targetCompany',
  'targetWebsite',
  'meetingGoal',
  'buyerPersona',
  'offeringSummary',
  'knownPainPoints',
  'desiredCta',
  'tone',
  'deckType',
  'presentationType',
  'intel',
  'notes',
  'requiredSections',
  'goal',
  'audience',
]

/** Canonical deck type labels (synced to `presentationType` + `deckType` for generation compatibility). */
/** Demo scenario — kept in component state until explicitly applied (does not autosave by itself). */
const DEMO_METROFLOW_BRIEF: Partial<DeckSetup> = {
  targetCompany: 'MetroFlow Transit Authority',
  buyerPersona: 'Chief Operating Officer',
  audience: 'Chief Operating Officer',
  offeringSummary: 'Northstar Ops Suite — scheduling, incident orchestration, and workforce analytics',
  meetingGoal:
    'Secure a 90-day pilot covering two depots with measurable on-time performance lift and executive readouts.',
  goal: 'Secure a 90-day pilot covering two depots with measurable on-time performance lift and executive readouts.',
  desiredCta: 'Approve a scoped pilot charter and joint success metrics workshop.',
  tone: 'Confident, pragmatic, safety-first',
  deckType: 'Pilot proposal deck',
  presentationType: 'Pilot proposal deck',
  knownPainPoints: [
    'Manual crew roster edits delay recovery windows during disruptions',
    'Incident context scattered across radio, CAD, and spreadsheets',
  ],
  notes: 'Northstar × MetroFlow demo scenario — click “Apply demo to pitch brief” to save into this deck.',
}

const DECK_TYPE_OPTIONS: readonly string[] = [
  'Account pitch deck',
  'Discovery follow-up deck',
  'Sales proposal deck',
  'Pilot proposal deck',
  'Executive briefing deck',
  'Renewal / expansion deck',
  'Sponsor pitch deck',
  'Partnership pitch deck',
  'Client status / account review deck',
  'Custom deck',
]

function deckTypeSelectOptions(currentValue: string): string[] {
  const trimmed = currentValue.trim()

  if (!trimmed) {
    return [...DECK_TYPE_OPTIONS]
  }

  const matchesCanonical = DECK_TYPE_OPTIONS.some((option) => option === trimmed)

  if (!matchesCanonical) {
    return [currentValue, ...DECK_TYPE_OPTIONS]
  }

  if (DECK_TYPE_OPTIONS.includes(currentValue)) {
    return [...DECK_TYPE_OPTIONS]
  }

  return [currentValue, ...DECK_TYPE_OPTIONS.filter((option) => option !== trimmed)]
}

export function BuildPresentationPage() {
  const navigate = useNavigate()
  const { user, isLocalDevBypass } = useAuth()
  const profile = useMemo(
    () => workspaceUserProfileFromAuth(user ?? null, isLocalDevBypass),
    [user, isLocalDevBypass],
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [demoBriefOverlay, setDemoBriefOverlay] = useState<Partial<DeckSetup> | null>(null)
  const [preflightOpen, setPreflightOpen] = useState(false)
  const [uploadRole, setUploadRole] = useState<FileContributorRole>('owner')
  const [commentRole, setCommentRole] = useState<FileContributorRole>('owner')
  const [selectedSetupTarget, setSelectedSetupTarget] = useState<string>('general')
  const aiBackendEnabled = isAiBackendEnabled()
  const {
    workspace,
    recordWorkspaceActivity,
    updateDeck,
    updateDeckSetup,
    uploadAssets,
    markAssetReviewed,
    setFileAssetSourceReviewStatus,
    setFileAssetSnippetEnabled,
    setFileAssetSnippetLabelOverride,
    autoFillDeckSetupFromFiles,
    generateSlides,
    acceptChartSuggestion,
    rejectChartSuggestion,
    addComment,
  } = useWorkspace()

  const activeDeck =
    workspace.decks.find((deck) => deck.id === workspace.activeDeckId) ?? workspace.decks[0]

  const organizationId =
    workspace.companyBrain.activeOrganizationId ||
    workspace.companyBrain.organizations[0]?.id ||
    ''

  const activeOrganizationName =
    workspace.companyBrain.organizations.find((org) => org.id === organizationId)?.name ?? 'Organization'

  const activeBrandKit = useMemo(
    () => getActiveOrganizationBrandKit(workspace.companyBrain),
    [workspace.companyBrain],
  )

  const membership = useMemo(
    () =>
      organizationId
        ? getMembershipForOrgUser(workspace, organizationId, profile.userId)
        : undefined,
    [workspace, organizationId, profile.userId],
  )

  const catalogRoleNamesForOrg = useMemo(() => {
    if (!organizationId) {
      return []
    }
    return workspace.companyBrain.companyRoles
      .filter((r) => !r.archived && r.organizationId === organizationId)
      .map((r) => r.name)
  }, [workspace.companyBrain.companyRoles, organizationId])

  const catalogDepartmentNamesForOrg = useMemo(() => {
    if (!organizationId) {
      return []
    }
    return workspace.companyBrain.companyDepartments
      .filter((d) => !d.archived && d.organizationId === organizationId)
      .map((d) => d.name)
  }, [workspace.companyBrain.companyDepartments, organizationId])

  const companyKnowledgeRankedSuggestions = useMemo(() => {
    if (!organizationId || !activeDeck) {
      return []
    }

    return getRelevantCompanyKnowledgeForUserWithExplanations({
      organizationId,
      userRoleTitle: membership?.roleTitle ?? '',
      department: membership?.department ?? '',
      accessRole: membership?.accessRole ?? 'viewer',
      currentUserId: profile.userId,
      deckSetup: activeDeck.setup,
      knowledgeItems: workspace.companyBrain.knowledgeItems,
      companyCatalogRoleNames: catalogRoleNamesForOrg.length ? catalogRoleNamesForOrg : undefined,
      companyCatalogDepartmentNames: catalogDepartmentNamesForOrg.length
        ? catalogDepartmentNamesForOrg
        : undefined,
    })
  }, [
    organizationId,
    membership,
    profile.userId,
    workspace.companyBrain.knowledgeItems,
    activeDeck,
    catalogRoleNamesForOrg,
    catalogDepartmentNamesForOrg,
  ])

  const selectedCompanyKnowledgeItems = useMemo(() => {
    if (!activeDeck) {
      return undefined
    }

    const ids = activeDeck.setup.selectedCompanyKnowledgeItemIds ?? []

    if (!ids.length) {
      return undefined
    }

    const known = new Set(ids)
    return workspace.companyBrain.knowledgeItems.filter((item) => known.has(item.id))
  }, [activeDeck, workspace.companyBrain.knowledgeItems])

  const brainProcessesForIntel = useMemo(
    () =>
      organizationId
        ? workspace.companyBrain.brainProcesses.filter((p) => p.organizationId === organizationId)
        : [],
    [organizationId, workspace.companyBrain.brainProcesses],
  )

  const brainPoliciesForIntel = useMemo(
    () =>
      organizationId
        ? workspace.companyBrain.brainPolicies.filter((p) => p.organizationId === organizationId)
        : [],
    [organizationId, workspace.companyBrain.brainPolicies],
  )

  const brainSkillFilesForIntel = useMemo(
    () =>
      organizationId
        ? workspace.companyBrain.brainSkillFiles.filter((s) => s.organizationId === organizationId)
        : [],
    [organizationId, workspace.companyBrain.brainSkillFiles],
  )

  const rankedSelectedCompanyKnowledge = useMemo(() => {
    if (!activeDeck) {
      return undefined
    }

    const ids = activeDeck.setup.selectedCompanyKnowledgeItemIds ?? []

    if (!ids.length) {
      return undefined
    }

    const selected = new Set(ids)
    return companyKnowledgeRankedSuggestions.filter((entry) => selected.has(entry.item.id))
  }, [activeDeck, companyKnowledgeRankedSuggestions])
  const activeProject = workspace.projects.find((project) => project.id === activeDeck?.projectId)
  const deckAssets = workspace.fileAssets.filter((asset) => asset.deckId === activeDeck?.id)
  const chartSuggestions = workspace.chartSuggestions
    .filter((suggestion) => suggestion.deckId === activeDeck?.id)
    .sort((left, right) => {
      if (left.status === right.status) {
        return right.confidence - left.confidence
      }

      return left.status === 'suggested' ? -1 : 1
    })
  const previousDeck = workspace.decks.find(
    (deck) => deck.projectId === activeDeck?.projectId && deck.id !== activeDeck?.id,
  )
  const canUploadAsCollaborator = activeDeck ? canCollaboratorUpload(activeDeck) : false
  const canCommentSetupAsCollaborator = activeDeck
    ? canCollaboratorCommentOnSetup(activeDeck)
    : false
  const selectedSetupFieldKey =
    selectedSetupTarget === 'general' ? undefined : (selectedSetupTarget as SetupFieldKey)
  const setup = activeDeck?.setup
  const mergedSetup = useMemo(
    () => (setup ? { ...setup, ...(demoBriefOverlay ?? {}) } : undefined),
    [setup, demoBriefOverlay],
  )

  const patchBrief = (updates: Partial<DeckSetup>) => {
    if (!activeDeck) {
      return
    }
    if (demoBriefOverlay !== null) {
      setDemoBriefOverlay({ ...demoBriefOverlay, ...updates })
    } else {
      updateDeckSetup(activeDeck.id, updates)
    }
  }

  const deckTypeSelectSource = mergedSetup ? effectiveDeckTypeValue(mergedSetup) : ''
  const deckTypeOptions = activeDeck ? deckTypeSelectOptions(deckTypeSelectSource) : []

  const workflowSteps = useMemo(
    () =>
      mergedSetup
        ? deriveBuildWorkflowSteps({
            setup: mergedSetup,
            deckAssets,
            companyKnowledgeSuggestionCount: companyKnowledgeRankedSuggestions.length,
          })
        : [],
    [mergedSetup, deckAssets, companyKnowledgeRankedSuggestions.length],
  )

  const readyItems = useMemo(
    () =>
      mergedSetup
        ? buildReadyToGenerateChecklist({
            setup: mergedSetup,
            deckAssets,
            companyKnowledgeSuggestionCount: companyKnowledgeRankedSuggestions.length,
          })
        : [],
    [mergedSetup, deckAssets, companyKnowledgeRankedSuggestions.length],
  )

  const preflightIssues = useMemo(
    () => (mergedSetup ? collectBuildPreflightIssues(mergedSetup, deckAssets) : []),
    [mergedSetup, deckAssets],
  )

  const brainSuggestionEmpty = Boolean(organizationId && companyKnowledgeRankedSuggestions.length === 0)
  const selectedBrainEmpty = Boolean(
    mergedSetup && (mergedSetup.selectedCompanyKnowledgeItemIds?.length ?? 0) === 0 && companyKnowledgeRankedSuggestions.length > 0,
  )
  const setupCommentThreads = workspace.comments
    .filter(
      (thread) =>
        thread.deckId === activeDeck?.id &&
        !thread.slideId &&
        (selectedSetupFieldKey
          ? thread.inputFieldKey === selectedSetupFieldKey
          : !thread.inputFieldKey),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  const selectedKnowledgeCount = (setup?.selectedCompanyKnowledgeItemIds ?? []).length

  const runTailoredGeneration = async () => {
    if (isGenerating || !activeDeck) {
      return
    }

    setIsGenerating(true)

    try {
      const outcome = await generateSlides(activeDeck.id)

      if (outcome) {
        navigate('/edit', { state: { postGeneration: outcome as GenerateSlidesResult } })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const citationReviewMode = setup?.citationReviewMode ?? 'permissive'
  const citationQAStats = computeCitationQAStats(deckAssets)
  const citationModeShortLabel = citationReviewMode === 'strict-approved-only' ? 'Strict' : 'Permissive'

  if (!activeDeck || !setup || !mergedSetup) {
    return (
      <section className="page">
        <div className="page-header">
          <div>
            <span className="section-label">Build pitch deck</span>
            <h2>No deck selected</h2>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="page page--build page--build-calm">
      <header className="builder-command-bar builder-command-bar--compact">
        <div className="builder-command-bar__main builder-command-bar__main--compact">
          <label className="field-group builder-command-bar__title-field">
            <span className="field-label field-label--compact">Deck title</span>
            <input
              type="text"
              value={activeDeck.title}
              onChange={(event) => updateDeck(activeDeck.id, { title: event.target.value })}
            />
          </label>
          <div className="builder-command-bar__inline-meta">
            {mergedSetup.targetCompany?.trim() ? (
              <span className="builder-command-bar__target" title="Target company">
                {mergedSetup.targetCompany.trim()}
              </span>
            ) : null}
          </div>
        </div>
        <div className="builder-command-bar__actions builder-command-bar__actions--compact">
          <button
            type="button"
            className="primary-button builder-generate-cta"
            disabled={isGenerating}
            onClick={() => setPreflightOpen(true)}
          >
            {isGenerating ? 'Generating tailored deck...' : 'Generate tailored pitch deck'}
          </button>
        </div>
      </header>

      <div className="builder-progress-track" aria-label="Build progress">
        <ol className="builder-progress-steps">
          {workflowSteps.map((step) => (
            <li
              key={step.id}
              className={`builder-progress-step ${step.complete ? 'builder-progress-step--complete' : ''}`}
            >
              <span className="builder-progress-step__dot" aria-hidden />
              <span className="builder-progress-step__label">{step.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="builder-ready-panel">
        <div className="builder-ready-panel__header">
          <span className="field-label field-label--compact">Ready to generate?</span>
          <span className="muted-copy builder-ready-panel__hint">Non-blocking checklist — you can still generate anytime.</span>
        </div>
        <ul className="builder-ready-checklist">
          {readyItems.map((item) => (
            <li
              key={item.id}
              className={[
                item.ok ? 'is-ok' : '',
                !item.ok && item.optional ? 'is-optional-pending' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="builder-ready-checklist__status" aria-hidden>
                {item.ok ? '✓' : item.optional ? '—' : '○'}
              </span>
              <span>{item.label}</span>
              {!item.ok && item.hint ? <span className="muted-copy builder-ready-checklist__hint">{item.hint}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="builder-workspace">
        <div className="builder-workspace__main builder-workspace__main--calm">
          <details id="sources" className="builder-disclosure" open>
            <summary className="builder-disclosure__summary">
              <span className="builder-disclosure__title">
                <span className="builder-disclosure__num">1</span>
                Sources
              </span>
              <span className="builder-disclosure__meta muted-copy">
                {deckAssets.length} file{deckAssets.length === 1 ? '' : 's'}
              </span>
            </summary>
            <div className="builder-disclosure__body">
              <div className="upload-panel builder-step-surface">
                {deckAssets.length === 0 ? (
                  <div className="builder-empty-callout" role="status">
                    <strong>No sources yet.</strong>
                    <span className="muted-copy">
                      {' '}
                      Upload earnings decks, call notes, or RFP excerpts — the generator and Intel Review prioritize
                      citation-backed snippets from files you parse successfully.
                    </span>
                  </div>
                ) : null}
                <div className="builder-inline-actions builder-inline-actions--tight">
                  <span className="field-label field-label--compact">Research uploads</span>
                  <a href="#qa" className="builder-jump-link">
                    Review snippets in Source QA
                  </a>
                </div>
                <SourceUploadDropzone
                  disabled={uploadRole === 'collaborator' && !canUploadAsCollaborator}
                  disabledMessage="Collaborator uploads are disabled for this deck until sharing for this account workspace allows them."
                  onFilesSelected={(files) => {
                    uploadAssets(activeDeck.id, files, {
                      uploadedByRole: uploadRole,
                    })
                  }}
                />
                <UploadedFileList assets={deckAssets} onMarkReviewed={markAssetReviewed} />
                <SourceMaterialsSummary
                  variant="compact"
                  assets={deckAssets}
                  onAutoFill={() => autoFillDeckSetupFromFiles(activeDeck.id)}
                />
              </div>
            </div>
          </details>

          <details id="brief" className="builder-disclosure" open>
            <summary className="builder-disclosure__summary">
              <span className="builder-disclosure__title">
                <span className="builder-disclosure__num">2</span>
                Pitch brief
              </span>
              <span className="builder-disclosure__meta muted-copy">{effectiveDeckTypeValue(mergedSetup)}</span>
            </summary>
            <div className="builder-disclosure__body">
              <div className="builder-step-surface builder-brief-surface">
                <div className="builder-demo-actions">
                  <button
                    type="button"
                    className="ghost-button ghost-button--sm"
                    onClick={() => setDemoBriefOverlay(DEMO_METROFLOW_BRIEF)}
                  >
                    Use demo example (MetroFlow)
                  </button>
                  {demoBriefOverlay ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button secondary-button--sm"
                        onClick={() => {
                          updateDeckSetup(activeDeck.id, demoBriefOverlay)
                          setDemoBriefOverlay(null)
                        }}
                      >
                        Apply demo to pitch brief
                      </button>
                      <button
                        type="button"
                        className="ghost-button ghost-button--sm"
                        onClick={() => setDemoBriefOverlay(null)}
                      >
                        Discard demo overlay
                      </button>
                    </>
                  ) : null}
                </div>
                {demoBriefOverlay ? (
                  <p className="muted-copy builder-demo-hint">
                    Demo fields appear below but stay local until you apply — apply saves into this deck with your normal
                    workspace persistence.
                  </p>
                ) : null}
                <div className="builder-brief-grid">
                  <label className="field-group">
                    <span className="field-label field-label--compact">Target company</span>
                    <input
                      type="text"
                      value={mergedSetup.targetCompany ?? ''}
                      placeholder="Account legal name or shorthand"
                      onChange={(event) => patchBrief({ targetCompany: event.target.value })}
                    />
                  </label>

                  <div className="builder-brief-grid__triple">
                    <label className="field-group">
                      <span className="field-label field-label--compact">Buyer persona / role</span>
                      <input
                        type="text"
                        value={effectiveBuyerPersona(mergedSetup)}
                        placeholder="Economic buyer, champion, or committee role"
                        onChange={(event) => {
                          const value = event.target.value
                          patchBrief({ buyerPersona: value, audience: value })
                        }}
                      />
                    </label>

                    <label className="field-group">
                      <span className="field-label field-label--compact">Deck type</span>
                      <select
                        value={deckTypeSelectSource}
                        onChange={(event) => {
                          const value = event.target.value
                          patchBrief({
                            deckType: value,
                            presentationType: value,
                          })
                        }}
                      >
                        {!deckTypeSelectSource.trim() ? (
                          <option value="" disabled>
                            Select deck type…
                          </option>
                        ) : null}
                        {deckTypeOptions.map((option, index) => (
                          <option key={`${option}-${index}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-group">
                      <span className="field-label field-label--compact">Tone</span>
                      <input
                        type="text"
                        value={mergedSetup.tone}
                        onChange={(event) => patchBrief({ tone: event.target.value })}
                      />
                    </label>
                  </div>

                  <label className="field-group field-group--wide">
                    <span className="field-label field-label--compact">Product or service being pitched</span>
                    <input
                      type="text"
                      value={mergedSetup.offeringSummary ?? ''}
                      placeholder="What you are asking them to buy, pilot, or expand"
                      onChange={(event) => patchBrief({ offeringSummary: event.target.value })}
                    />
                  </label>

                  <label className="field-group field-group--wide">
                    <span className="field-label field-label--compact">Meeting goal</span>
                    <textarea
                      className="builder-textarea--brief"
                      rows={2}
                      value={effectiveMeetingGoal(mergedSetup)}
                      placeholder="Outcome you need from this conversation"
                      onChange={(event) => {
                        const value = event.target.value
                        patchBrief({ meetingGoal: value, goal: value })
                      }}
                    />
                  </label>

                  <label className="field-group field-group--wide">
                    <span className="field-label field-label--compact">Desired CTA</span>
                    <input
                      type="text"
                      value={mergedSetup.desiredCta ?? ''}
                      placeholder="Next step you want them to take"
                      onChange={(event) => patchBrief({ desiredCta: event.target.value })}
                    />
                  </label>
                </div>

                <details className="builder-more-fields">
                  <summary>More pitch fields</summary>
                  <div className="builder-more-fields__body">
                    <label className="field-group field-group--wide">
                      <span className="field-label field-label--compact">Target website</span>
                      <input
                        type="text"
                        value={mergedSetup.targetWebsite ?? ''}
                        placeholder="https://…"
                        onChange={(event) => patchBrief({ targetWebsite: event.target.value })}
                      />
                    </label>
                    <label className="field-group field-group--wide">
                      <span className="field-label field-label--compact">Known pain points</span>
                      <textarea
                        className="builder-textarea--brief"
                        rows={2}
                        value={painPointsToLines(mergedSetup)}
                        placeholder={'One pain point per line\ne.g. manual reporting\nslow approvals'}
                        onChange={(event) =>
                          patchBrief({
                            knownPainPoints: linesToPainPoints(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="field-group field-group--wide">
                      <span className="field-label field-label--compact">Pitch strategy notes</span>
                      <textarea
                        className="builder-textarea--brief"
                        rows={2}
                        value={mergedSetup.notes}
                        placeholder="Positioning, landmines, proof to emphasize, stakeholders to name-check"
                        onChange={(event) => patchBrief({ notes: event.target.value })}
                      />
                    </label>
                  </div>
                </details>
              </div>
            </div>
          </details>

          <details id="knowledge" className="builder-disclosure">
            <summary className="builder-disclosure__summary">
              <span className="builder-disclosure__title">
                <span className="builder-disclosure__num">3</span>
                Company knowledge
              </span>
              <span className="builder-disclosure__meta muted-copy">
                Selected {selectedKnowledgeCount} · {companyKnowledgeRankedSuggestions.length} suggestions
              </span>
            </summary>
            <div className="builder-disclosure__body">
              {brainSuggestionEmpty ? (
                <div className="builder-empty-callout" role="status">
                  <strong>No Brain matches yet.</strong>
                  <span className="muted-copy">
                    {' '}
                    Tune your pitch brief — roles, tone, and offering — then revisit suggestions, or add documents from the
                    Knowledge Library.
                  </span>
                </div>
              ) : null}
              {selectedBrainEmpty ? (
                <div className="builder-empty-callout builder-empty-callout--soft" role="status">
                  <strong>No Company Brain rows selected.</strong>
                  <span className="muted-copy">
                    {' '}
                    Pick approved snippets so citations stay grounded in curated messaging.
                  </span>
                </div>
              ) : null}
              <CompanyKnowledgeSuggestPanel
                introVariant="minimal"
                deckId={activeDeck.id}
                setup={setup}
                rankedSuggestions={companyKnowledgeRankedSuggestions}
                membership={{
                  roleTitle: membership?.roleTitle ?? '',
                  department: membership?.department ?? '',
                }}
                workspaceFileAssets={workspace.fileAssets}
                updateDeckSetup={updateDeckSetup}
              />
            </div>
          </details>

          <details id="qa" className="builder-disclosure">
            <summary className="builder-disclosure__summary">
              <span className="builder-disclosure__title">
                <span className="builder-disclosure__num">4</span>
                Source QA
              </span>
              <span className="builder-disclosure__meta muted-copy">
                {citationModeShortLabel} · {citationQAStats.approved} appr. · {citationQAStats.excluded} excl. ·{' '}
                {citationQAStats.snippetsEnabled} snippets
              </span>
            </summary>
            <div className="builder-disclosure__body">
              <SourceCitationQAPanel
                assets={deckAssets}
                citationReviewMode={citationReviewMode}
                onSetCitationReviewMode={(mode) =>
                  updateDeckSetup(activeDeck.id, { citationReviewMode: mode })
                }
                onSetSourceStatus={setFileAssetSourceReviewStatus}
                onSetSnippetEnabled={setFileAssetSnippetEnabled}
                onSetSnippetLabelOverride={setFileAssetSnippetLabelOverride}
                onApproveAllUsable={() => {
                  for (const asset of deckAssets) {
                    if (asset.status === 'parsed' && asset.sourceTrace.length > 0) {
                      setFileAssetSourceReviewStatus(asset.id, 'approved')
                    }
                  }
                }}
                onExcludeUnsupported={() => {
                  for (const asset of deckAssets) {
                    if (asset.status === 'parsed' && asset.sourceTrace.length === 0) {
                      setFileAssetSourceReviewStatus(asset.id, 'excluded')
                    }
                  }
                }}
                onClearDecisions={() => {
                  for (const asset of deckAssets) {
                    setFileAssetSourceReviewStatus(asset.id, 'pending')
                  }
                }}
              />
            </div>
          </details>

          <details id="intel" className="builder-disclosure" open>
            <summary className="builder-disclosure__summary">
              <span className="builder-disclosure__title">
                <span className="builder-disclosure__num">5</span>
                Intel Review
              </span>
              <span className="builder-disclosure__meta muted-copy">Generate &amp; refine citations</span>
            </summary>
            <div className="builder-disclosure__body">
              {!(setup.intel && Object.keys(setup.intel).length > 0) ? (
                <div className="builder-empty-callout builder-empty-callout--soft" role="status">
                  <strong>No intel captured yet.</strong>
                  <span className="muted-copy">
                    {' '}
                    Generate Intel Review after sources parse, or paste account research manually — strict citations still
                    respect Source QA decisions.
                  </span>
                </div>
              ) : null}
              <IntelReviewPanel
                deckId={activeDeck.id}
                setup={setup}
                fileAssets={deckAssets}
                workspaceFileAssets={workspace.fileAssets}
                companyKnowledgeItems={selectedCompanyKnowledgeItems}
                rankedSelectedKnowledge={rankedSelectedCompanyKnowledge}
                brainProcesses={brainProcessesForIntel}
                brainPolicies={brainPoliciesForIntel}
                brainSkillFiles={brainSkillFilesForIntel}
                updateDeckSetup={updateDeckSetup}
                recordActivity={recordWorkspaceActivity}
              />
            </div>
          </details>

          <details id="advanced" className="builder-disclosure builder-disclosure--advanced">
            <summary className="builder-disclosure__summary">
              <span className="builder-disclosure__title">Advanced settings</span>
              <span className="builder-disclosure__meta muted-copy">Collaboration, brand, charts</span>
            </summary>
            <div className="builder-disclosure__body builder-advanced-shell">
              <p className="muted-copy builder-advanced-shell__lede">
                Account: <strong>{activeProject?.name ?? '—'}</strong>
                {activeProject?.summary ? ` · ${activeProject.summary}` : null}
                {' · '}
                <span className={`builder-ai-pill ${aiBackendEnabled ? 'builder-ai-pill--on' : ''}`}>
                  {aiBackendEnabled ? 'AI backend on' : 'Local mode'}
                </span>
              </p>

              <div className="field-group">
                <span className="field-label field-label--compact">Upload actor</span>
                <div className="scope-toggle">
                  <button
                    type="button"
                    className={uploadRole === 'owner' ? 'is-active' : ''}
                    onClick={() => setUploadRole('owner')}
                  >
                    Owner
                  </button>
                  <button
                    type="button"
                    className={uploadRole === 'collaborator' ? 'is-active' : ''}
                    disabled={!canUploadAsCollaborator}
                    onClick={() => setUploadRole('collaborator')}
                  >
                    Collaborator
                  </button>
                </div>
                <p className="muted-copy muted-copy--tiny">
                  {canUploadAsCollaborator
                    ? 'Collaborator uploads are highlighted for account-owner review.'
                    : 'Enable sharing and collaborator uploads to collect account research from collaborators.'}
                </p>
              </div>

              <div className="toggle-grid">
                <ToggleField
                  label="Use previous deck as context"
                  description="Carry forward account narrative from a prior deck."
                  checked={setup.usePreviousDeckContext}
                  onChange={(checked) =>
                    updateDeckSetup(activeDeck.id, { usePreviousDeckContext: checked })
                  }
                />
                <ToggleField
                  label="Share setup inputs"
                  description="Expose setup fields for collaborator comments when sharing is enabled."
                  checked={setup.shareSetupInputs}
                  onChange={(checked) =>
                    updateDeckSetup(activeDeck.id, { shareSetupInputs: checked })
                  }
                />
              </div>

              {!aiBackendEnabled ? (
                <div className="toggle-grid">
                  <ToggleField
                    label="Web research"
                    description="Reserve a hook for future search-backed source collection (visible while generation runs locally)."
                    checked={setup.webResearch}
                    onChange={(checked) => updateDeckSetup(activeDeck.id, { webResearch: checked })}
                  />
                </div>
              ) : null}

              <div className="field-group builder-advanced__subsection">
                <span className="field-label field-label--compact">Slide outline · required sections</span>
                <textarea
                  rows={4}
                  value={setup.requiredSections.join('\n')}
                  placeholder="One section per line (optional)"
                  onChange={(event) =>
                    updateDeckSetup(activeDeck.id, {
                      requiredSections: event.target.value
                        .split('\n')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <p className="muted-copy muted-copy--tiny">
                  Optional structure for the generator; leave blank to infer from sources.
                </p>
              </div>

              {setup.usePreviousDeckContext && previousDeck ? (
                <div className="builder-prev-deck-card">
                  <span className="field-label field-label--compact">Previous deck context</span>
                  <p className="builder-prev-deck-card__title">{previousDeck.title}</p>
                  <p className="muted-copy muted-copy--tiny">{effectiveMeetingGoal(previousDeck.setup)}</p>
                </div>
              ) : null}

              <div className="builder-advanced__subsection">
                <span className="field-label field-label--compact">Brand and message library</span>
                <p className="muted-copy muted-copy--tiny">
                  Manage shared brand cues from <strong>Company Brain</strong>; linking fields stay available for future
                  sync.
                </p>

                {activeBrandKit ? (
                  <div className="builder-brand-block">
                    <ToggleField
                      label="Apply organization Brand Kit to this deck"
                      description={`When on, generated slides, Intel Brief previews, and PPTX export pick up ${activeOrganizationName} colors, font, and logo rules.`}
                      checked={setup.brandKitId === activeBrandKit.id}
                      onChange={(checked) =>
                        updateDeckSetup(activeDeck.id, {
                          brandKitId: checked ? activeBrandKit.id : undefined,
                        })
                      }
                    />
                    <div className="builder-brand-preview">
                      <span className="field-label builder-brand-preview__label">Active Brand Kit preview</span>
                      <span
                        title="Primary"
                        className="builder-brand-swatch"
                        style={{ background: activeBrandKit.primaryColor }}
                      />
                      <span
                        title="Secondary"
                        className="builder-brand-swatch"
                        style={{ background: activeBrandKit.secondaryColor }}
                      />
                      <span
                        title="Accent"
                        className="builder-brand-swatch"
                        style={{ background: activeBrandKit.accentColor }}
                      />
                      <span
                        className="muted-copy builder-brand-preview__font"
                        style={{ fontFamily: activeBrandKit.fontFamily }}
                      >
                        Aa {activeBrandKit.fontFamily}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="muted-copy muted-copy--tiny">
                    No Brand Kit for <strong>{activeOrganizationName}</strong> yet. Open{' '}
                    <strong>Company Brain → Brand</strong> to add colors, font, and an optional logo file from this
                    workspace.
                  </p>
                )}

                <label className="field-group">
                  <span className="field-label">Brand kit id (read-only)</span>
                  <input type="text" readOnly value={setup.brandKitId ?? ''} placeholder="Not linked" />
                </label>

                <details className="builder-advanced-future-linking">
                  <summary>Future advanced linking</summary>
                  <p className="muted-copy muted-copy--tiny">
                    Managed automatically in this demo version. Approved messaging, case studies, and product screenshots
                    are picked up from Company Brain when you generate the deck.
                  </p>
                </details>
              </div>

              <ChartSuggestionsPanel
                suggestions={chartSuggestions}
                assets={deckAssets}
                onAccept={acceptChartSuggestion}
                onReject={rejectChartSuggestion}
              />

              {activeDeck.collaboration.isShared && setup.shareSetupInputs ? (
                <details className="builder-collab-fold">
                  <summary>Collaboration · pitch setup comments</summary>
                  <CommentsPanel
                    title="Pitch setup comments"
                    description="Collect comment-only feedback on the account pitch brief before generating a tailored deck."
                    threads={setupCommentThreads}
                    actorRole={commentRole}
                    canCommentAsCollaborator={canCommentSetupAsCollaborator}
                    targetOptions={[
                      { value: 'general', label: 'General pitch setup note' },
                      ...setupFieldTargets.map((field) => ({
                        value: field,
                        label: getSetupFieldLabel(field),
                      })),
                    ]}
                    selectedTarget={selectedSetupTarget}
                    onActorRoleChange={setCommentRole}
                    onTargetChange={setSelectedSetupTarget}
                    onSubmit={({ message, authorRole, target }) =>
                      addComment({
                        projectId: activeDeck.projectId,
                        deckId: activeDeck.id,
                        inputFieldKey: target === 'general' ? undefined : (target as SetupFieldKey),
                        message,
                        authorRole,
                      })
                    }
                  />
                </details>
              ) : null}
            </div>
          </details>
        </div>

        <aside className="builder-workspace__rail builder-workspace__rail--compact" aria-label="Pitch workspace shortcuts">
          <nav className="builder-rail-nav builder-rail-nav--compact" aria-label="Section navigation">
            <a href="#sources">1 Sources</a>
            <a href="#brief">2 Brief</a>
            <a href="#knowledge">3 Knowledge</a>
            <a href="#qa">4 QA</a>
            <a href="#intel">5 Intel</a>
            <a href="#advanced">Advanced</a>
          </nav>

          <div className="builder-rail-card builder-rail-card--bare">
            <button
              type="button"
              className="primary-button builder-generate-cta"
              disabled={isGenerating}
              onClick={() => setPreflightOpen(true)}
            >
              {isGenerating ? 'Generating…' : 'Generate tailored pitch deck'}
            </button>
          </div>

          <div className="builder-rail-inline-metrics muted-copy">
            <span>{deckAssets.length} sources</span>
            <span aria-hidden="true">·</span>
            <span>{selectedKnowledgeCount} knowledge</span>
            <span aria-hidden="true">·</span>
            <span>{citationModeShortLabel} citations</span>
          </div>
        </aside>
      </div>

      {preflightOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPreflightOpen(false)}>
          <div
            className="modal-card builder-preflight-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preflight-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-card__header">
              <div>
                <span className="section-label">Preflight</span>
                <h3 id="preflight-title">Review before generating</h3>
                <p className="muted-copy">
                  Quick sanity checks before opening the editor — they are advisory, not blocking.
                </p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setPreflightOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-card__body">
              {preflightIssues.length === 0 ? (
                <p className="muted-copy">No major gaps detected from this workspace snapshot.</p>
              ) : (
                <ul className="builder-preflight-issues">
                  {preflightIssues.map((issue) => (
                    <li key={issue.id}>
                      <span className={`builder-preflight-severity builder-preflight-severity--${issue.severity}`}>
                        {issue.severity === 'warning' ? 'Warning' : 'Note'}
                      </span>
                      <span>{issue.message}</span>
                      {issue.fixHref ? (
                        <a className="builder-preflight-jump" href={issue.fixHref} onClick={() => setPreflightOpen(false)}>
                          Jump
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal-card__footer">
              <button type="button" className="ghost-button" onClick={() => setPreflightOpen(false)}>
                Back to edit
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isGenerating}
                onClick={async () => {
                  setPreflightOpen(false)
                  await runTailoredGeneration()
                }}
              >
                {isGenerating ? 'Generating…' : 'Generate tailored deck'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
