import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [uploadRole, setUploadRole] = useState<FileContributorRole>('owner')
  const [commentRole, setCommentRole] = useState<FileContributorRole>('owner')
  const [selectedSetupTarget, setSelectedSetupTarget] = useState<string>('general')
  const aiBackendEnabled = isAiBackendEnabled()
  const {
    workspace,
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
  const deckTypeSelectSource = setup ? effectiveDeckTypeValue(setup) : ''
  const deckTypeOptions = activeDeck ? deckTypeSelectOptions(deckTypeSelectSource) : []
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

  if (!activeDeck || !setup) {
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

  const selectedKnowledgeCount = (setup.selectedCompanyKnowledgeItemIds ?? []).length

  const handleGenerateDeck = async () => {
    if (isGenerating) {
      return
    }

    setIsGenerating(true)

    try {
      const generatedDeckId = await generateSlides(activeDeck.id)

      if (generatedDeckId) {
        navigate('/edit')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const citationReviewMode = setup.citationReviewMode ?? 'permissive'
  const citationQAStats = computeCitationQAStats(deckAssets)
  const citationModeShortLabel = citationReviewMode === 'strict-approved-only' ? 'Strict' : 'Permissive'

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
            {setup.targetCompany?.trim() ? (
              <span className="builder-command-bar__target" title="Target company">
                {setup.targetCompany.trim()}
              </span>
            ) : null}
            <span className={`builder-ai-pill ${aiBackendEnabled ? 'builder-ai-pill--on' : ''}`}>
              {aiBackendEnabled ? 'AI backend on' : 'Local mode'}
            </span>
          </div>
        </div>
        <div className="builder-command-bar__actions builder-command-bar__actions--compact">
          <button
            type="button"
            className="primary-button builder-generate-cta"
            disabled={isGenerating}
            onClick={handleGenerateDeck}
          >
            {isGenerating ? 'Generating tailored deck...' : 'Generate tailored pitch deck'}
          </button>
        </div>
      </header>

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
                <div className="builder-inline-actions builder-inline-actions--tight">
                  <span className="field-label field-label--compact">Research uploads</span>
                  <a href="#qa" className="builder-jump-link">
                    Source QA
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
              <span className="builder-disclosure__meta muted-copy">{effectiveDeckTypeValue(setup)}</span>
            </summary>
            <div className="builder-disclosure__body">
              <div className="builder-step-surface builder-brief-surface">
                <div className="builder-brief-grid">
                  <label className="field-group">
                    <span className="field-label field-label--compact">Target company</span>
                    <input
                      type="text"
                      value={setup.targetCompany ?? ''}
                      placeholder="Account legal name or shorthand"
                      onChange={(event) =>
                        updateDeckSetup(activeDeck.id, { targetCompany: event.target.value })
                      }
                    />
                  </label>

                  <div className="builder-brief-grid__triple">
                    <label className="field-group">
                      <span className="field-label field-label--compact">Buyer persona / role</span>
                      <input
                        type="text"
                        value={effectiveBuyerPersona(setup)}
                        placeholder="Economic buyer, champion, or committee role"
                        onChange={(event) => {
                          const value = event.target.value
                          updateDeckSetup(activeDeck.id, { buyerPersona: value, audience: value })
                        }}
                      />
                    </label>

                    <label className="field-group">
                      <span className="field-label field-label--compact">Deck type</span>
                      <select
                        value={deckTypeSelectSource}
                        onChange={(event) => {
                          const value = event.target.value
                          updateDeckSetup(activeDeck.id, {
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
                        value={setup.tone}
                        onChange={(event) => updateDeckSetup(activeDeck.id, { tone: event.target.value })}
                      />
                    </label>
                  </div>

                  <label className="field-group field-group--wide">
                    <span className="field-label field-label--compact">Product or service being pitched</span>
                    <input
                      type="text"
                      value={setup.offeringSummary ?? ''}
                      placeholder="What you are asking them to buy, pilot, or expand"
                      onChange={(event) =>
                        updateDeckSetup(activeDeck.id, { offeringSummary: event.target.value })
                      }
                    />
                  </label>

                  <label className="field-group field-group--wide">
                    <span className="field-label field-label--compact">Meeting goal</span>
                    <textarea
                      className="builder-textarea--brief"
                      rows={2}
                      value={effectiveMeetingGoal(setup)}
                      placeholder="Outcome you need from this conversation"
                      onChange={(event) => {
                        const value = event.target.value
                        updateDeckSetup(activeDeck.id, { meetingGoal: value, goal: value })
                      }}
                    />
                  </label>

                  <label className="field-group field-group--wide">
                    <span className="field-label field-label--compact">Desired CTA</span>
                    <input
                      type="text"
                      value={setup.desiredCta ?? ''}
                      placeholder="Next step you want them to take"
                      onChange={(event) =>
                        updateDeckSetup(activeDeck.id, { desiredCta: event.target.value })
                      }
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
                        value={setup.targetWebsite ?? ''}
                        placeholder="https://…"
                        onChange={(event) =>
                          updateDeckSetup(activeDeck.id, { targetWebsite: event.target.value })
                        }
                      />
                    </label>
                    <label className="field-group field-group--wide">
                      <span className="field-label field-label--compact">Known pain points</span>
                      <textarea
                        className="builder-textarea--brief"
                        rows={2}
                        value={painPointsToLines(setup)}
                        placeholder={'One pain point per line\ne.g. manual reporting\nslow approvals'}
                        onChange={(event) =>
                          updateDeckSetup(activeDeck.id, {
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
                        value={setup.notes}
                        placeholder="Positioning, landmines, proof to emphasize, stakeholders to name-check"
                        onChange={(event) =>
                          updateDeckSetup(activeDeck.id, { notes: event.target.value })
                        }
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

                <div className="form-grid builder-brand-readonly">
                  <label className="field-group">
                    <span className="field-label">Brand kit id (read-only)</span>
                    <input type="text" readOnly value={setup.brandKitId ?? ''} placeholder="Not linked" />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Approved messaging IDs</span>
                    <input
                      type="text"
                      disabled
                      value={(setup.approvedMessagingIds ?? []).join(', ')}
                      placeholder="Coming soon"
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Case study IDs</span>
                    <input
                      type="text"
                      disabled
                      value={(setup.caseStudyIds ?? []).join(', ')}
                      placeholder="Coming soon"
                    />
                  </label>
                  <label className="field-group field-group--wide">
                    <span className="field-label">Product screenshot asset IDs</span>
                    <input
                      type="text"
                      disabled
                      value={(activeDeck.screenshotAssetIds ?? []).join(', ')}
                      placeholder="Coming soon"
                    />
                  </label>
                </div>
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
              onClick={handleGenerateDeck}
            >
              {isGenerating ? 'Generating…' : 'Generate tailored pitch deck'}
            </button>
          </div>

          <div className="builder-rail-card builder-rail-card--bare">
            <span className="field-label field-label--compact">Citation mode</span>
            <div className="scope-toggle builder-rail-scope" role="group" aria-label="Citation review mode">
              <button
                type="button"
                className={citationReviewMode === 'permissive' ? 'is-active' : ''}
                onClick={() => updateDeckSetup(activeDeck.id, { citationReviewMode: 'permissive' })}
              >
                Permissive
              </button>
              <button
                type="button"
                className={citationReviewMode === 'strict-approved-only' ? 'is-active' : ''}
                onClick={() =>
                  updateDeckSetup(activeDeck.id, { citationReviewMode: 'strict-approved-only' })
                }
              >
                Strict
              </button>
            </div>
          </div>

          <div className="builder-rail-inline-metrics muted-copy">
            <span>{deckAssets.length} sources</span>
            <span aria-hidden="true">
              ·
            </span>
            <span>{selectedKnowledgeCount} knowledge</span>
          </div>
        </aside>
      </div>
    </section>
  )
}
