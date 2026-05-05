import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartSuggestionsPanel } from '../components/builder/ChartSuggestionsPanel'
import { IntelReviewPanel } from '../components/builder/IntelReviewPanel'
import { SourceMaterialsSummary } from '../components/builder/SourceMaterialsSummary'
import { SourceUploadDropzone } from '../components/builder/SourceUploadDropzone'
import { ToggleField } from '../components/builder/ToggleField'
import { UploadedFileList } from '../components/builder/UploadedFileList'
import { CommentsPanel } from '../components/collaboration/CommentsPanel'
import { useWorkspace } from '../context/useWorkspace'
import {
  canCollaboratorCommentOnSetup,
  canCollaboratorUpload,
  getSetupFieldLabel,
} from '../data/collaboration'
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
  const [isGenerating, setIsGenerating] = useState(false)
  const [uploadRole, setUploadRole] = useState<FileContributorRole>('owner')
  const [commentRole, setCommentRole] = useState<FileContributorRole>('owner')
  const [selectedSetupTarget, setSelectedSetupTarget] = useState<string>('general')
  const {
    workspace,
    updateDeck,
    updateDeckSetup,
    uploadAssets,
    markAssetReviewed,
    autoFillDeckSetupFromFiles,
    generateSlides,
    acceptChartSuggestion,
    rejectChartSuggestion,
    addComment,
  } = useWorkspace()

  const activeDeck =
    workspace.decks.find((deck) => deck.id === workspace.activeDeckId) ?? workspace.decks[0]
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

  return (
    <section className="page">
      <div className="builder-topbar">
        <label className="field-group">
          <span className="field-label">Deck title</span>
          <input
            type="text"
            value={activeDeck.title}
            onChange={(event) => updateDeck(activeDeck.id, { title: event.target.value })}
          />
        </label>

        <div className="context-card">
          <span className="section-label">Account context</span>
          <h3>{activeProject?.name ?? 'No account assigned'}</h3>
          <p>{activeProject?.summary ?? 'Account details will appear here when available.'}</p>
          <div className="context-card__meta">
            <span>{activeDeck.status}</span>
            <span>{setup.targetCompany?.trim() || 'Company TBD'}</span>
            <span>{effectiveDeckTypeValue(setup)}</span>
            <span>{deckAssets.length} sources</span>
          </div>
        </div>

        <button
          type="button"
          className="primary-button builder-generate-cta"
          disabled={isGenerating}
          onClick={async () => {
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
          }}
        >
          {isGenerating ? 'Generating tailored deck...' : 'Generate tailored pitch deck'}
        </button>
      </div>

      <div className="builder-grid">
        <div className="builder-main-column">
          <div className="builder-form panel-card">
            <div className="section-heading">
              <span className="section-label">Account pitch brief</span>
              <h3>Target account → tailored pitch deck</h3>
              <p className="muted-copy">
                Capture who you are selling to and what outcome you need from the meeting. This brief keeps
                your account intel and deck generation aligned.
              </p>
            </div>

            <div className="form-grid">
              <label className="field-group">
                <span className="field-label">Target company</span>
                <input
                  type="text"
                  value={setup.targetCompany ?? ''}
                  placeholder="Account legal name or shorthand"
                  onChange={(event) =>
                    updateDeckSetup(activeDeck.id, { targetCompany: event.target.value })
                  }
                />
              </label>

              <label className="field-group">
                <span className="field-label">Target website</span>
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
                <span className="field-label">Buyer persona / role</span>
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

              <label className="field-group field-group--wide">
                <span className="field-label">Product or service being pitched</span>
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
                <span className="field-label">Meeting goal</span>
                <textarea
                  rows={4}
                  value={effectiveMeetingGoal(setup)}
                  placeholder="Outcome you need from this conversation"
                  onChange={(event) => {
                    const value = event.target.value
                    updateDeckSetup(activeDeck.id, { meetingGoal: value, goal: value })
                  }}
                />
              </label>

              <label className="field-group field-group--wide">
                <span className="field-label">Known pain points</span>
                <textarea
                  rows={4}
                  value={painPointsToLines(setup)}
                  placeholder={'One pain point per line\ne.g. manual reporting\nslow approvals'}
                  onChange={(event) =>
                    updateDeckSetup(activeDeck.id, {
                      knownPainPoints: linesToPainPoints(event.target.value),
                    })
                  }
                />
              </label>

              <label className="field-group">
                <span className="field-label">Desired CTA</span>
                <input
                  type="text"
                  value={setup.desiredCta ?? ''}
                  placeholder="Next step you want them to take"
                  onChange={(event) =>
                    updateDeckSetup(activeDeck.id, { desiredCta: event.target.value })
                  }
                />
              </label>

              <label className="field-group">
                <span className="field-label">Tone</span>
                <input
                  type="text"
                  value={setup.tone}
                  onChange={(event) => updateDeckSetup(activeDeck.id, { tone: event.target.value })}
                />
              </label>

              <label className="field-group field-group--wide">
                <span className="field-label">Deck type</span>
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

              <label className="field-group field-group--wide">
                <span className="field-label">Pitch strategy notes</span>
                <textarea
                  rows={5}
                  value={setup.notes}
                  placeholder="Positioning, landmines, proof to emphasize, stakeholders to name-check"
                  onChange={(event) =>
                    updateDeckSetup(activeDeck.id, { notes: event.target.value })
                  }
                />
              </label>
            </div>

            <div className="toggle-grid">
              <ToggleField
                label="Web research"
                description="Reserve a hook for future search-backed source collection."
                checked={setup.webResearch}
                onChange={(checked) => updateDeckSetup(activeDeck.id, { webResearch: checked })}
              />
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

            <details className="builder-details">
              <summary>Slide outline</summary>
              <div className="field-group" style={{ marginTop: '12px' }}>
                <span className="field-label">Required sections</span>
                <textarea
                  rows={5}
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
                <p className="muted-copy">
                  Optional structure for the generator; leave blank to infer from sources.
                </p>
              </div>
            </details>

            <details className="builder-details builder-details--muted">
              <summary>Brand and message library</summary>
              <p className="muted-copy" style={{ marginTop: '10px' }}>
                Brand kit, approved messaging, case studies, and product screenshots can be managed from
                the company workspace as this area expands.
              </p>
              <div className="form-grid" style={{ marginTop: '14px', opacity: 0.72 }}>
                <label className="field-group">
                  <span className="field-label">Brand kit</span>
                  <input type="text" disabled value={setup.brandKitId ?? ''} placeholder="Coming soon" />
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
            </details>
          </div>

          <IntelReviewPanel
            deckId={activeDeck.id}
            setup={setup}
            fileAssets={deckAssets}
            updateDeckSetup={updateDeckSetup}
          />

          <section className="panel-card upload-panel">
            <div className="section-heading">
              <div>
                <span className="section-label">Source materials</span>
                <h3>Account research &amp; supporting sources</h3>
                <p className="muted-copy">
                  Upload account research, sales notes, case studies, product docs, call transcripts, and
                  any files you want cited in the pitch. Parsed previews help autofill the brief above.
                </p>
              </div>
            </div>

            <div className="field-group">
              <span className="field-label">Upload actor</span>
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
              <p className="muted-copy">
                {canUploadAsCollaborator
                  ? 'Collaborator uploads are highlighted for account-owner review.'
                  : 'Enable sharing and collaborator uploads to collect account research from collaborators.'}
              </p>
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
              assets={deckAssets}
              onAutoFill={() => autoFillDeckSetupFromFiles(activeDeck.id)}
            />
          </section>
        </div>

        <div className="builder-sidebar">
          <ChartSuggestionsPanel
            suggestions={chartSuggestions}
            assets={deckAssets}
            onAccept={acceptChartSuggestion}
            onReject={rejectChartSuggestion}
          />

          {setup.usePreviousDeckContext && previousDeck ? (
            <section className="panel-card">
              <div className="section-heading">
                <span className="section-label">Previous deck context</span>
                <h3>{previousDeck.title}</h3>
              </div>
              <p className="muted-copy">{effectiveMeetingGoal(previousDeck.setup)}</p>
            </section>
          ) : null}
        </div>
      </div>

      {activeDeck.collaboration.isShared && setup.shareSetupInputs ? (
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
      ) : null}
    </section>
  )
}
