import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartSuggestionsPanel } from '../components/builder/ChartSuggestionsPanel'
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
import type { FileContributorRole, SetupFieldKey } from '../types/models'

const setupFieldTargets: SetupFieldKey[] = [
  'goal',
  'audience',
  'tone',
  'presentationType',
  'requiredSections',
  'notes',
]

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

  if (!activeDeck) {
    return (
      <section className="page">
        <div className="page-header">
          <div>
            <span className="section-label">Build presentation</span>
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
          <span className="field-label">Presentation title</span>
          <input
            type="text"
            value={activeDeck.title}
            onChange={(event) => updateDeck(activeDeck.id, { title: event.target.value })}
          />
        </label>

        <div className="context-card">
          <span className="section-label">Project context</span>
          <h3>{activeProject?.name ?? 'No project assigned'}</h3>
          <p>{activeProject?.summary ?? 'Project details will appear here when available.'}</p>
          <div className="context-card__meta">
            <span>{activeDeck.status}</span>
            <span>{activeDeck.setup.presentationType}</span>
            <span>{deckAssets.length} files</span>
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
          {isGenerating ? 'Generating...' : 'Generate Slides'}
        </button>
      </div>

      <div className="builder-grid">
        <div className="builder-form panel-card">
          <div className="section-heading">
            <span className="section-label">Presentation setup</span>
            <h3>Define the input brief</h3>
          </div>

          <div className="form-grid">
            <label className="field-group field-group--wide">
              <span className="field-label">Presentation goal</span>
              <textarea
                rows={4}
                value={activeDeck.setup.goal}
                onChange={(event) =>
                  updateDeckSetup(activeDeck.id, { goal: event.target.value })
                }
              />
            </label>

            <label className="field-group">
              <span className="field-label">Audience</span>
              <input
                type="text"
                value={activeDeck.setup.audience}
                onChange={(event) =>
                  updateDeckSetup(activeDeck.id, { audience: event.target.value })
                }
              />
            </label>

            <label className="field-group">
              <span className="field-label">Tone / style</span>
              <input
                type="text"
                value={activeDeck.setup.tone}
                onChange={(event) =>
                  updateDeckSetup(activeDeck.id, { tone: event.target.value })
                }
              />
            </label>

            <label className="field-group">
              <span className="field-label">Presentation type</span>
              <select
                value={activeDeck.setup.presentationType}
                onChange={(event) =>
                  updateDeckSetup(activeDeck.id, { presentationType: event.target.value })
                }
              >
                <option>Board update</option>
                <option>Strategy update</option>
                <option>Sales pitch</option>
                <option>Launch debrief</option>
                <option>Internal review</option>
              </select>
            </label>

            <label className="field-group">
              <span className="field-label">Required sections</span>
              <textarea
                rows={5}
                value={activeDeck.setup.requiredSections.join('\n')}
                placeholder="One section per line"
                onChange={(event) =>
                  updateDeckSetup(activeDeck.id, {
                    requiredSections: event.target.value
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>

            <label className="field-group">
              <span className="field-label">Notes / context</span>
              <textarea
                rows={5}
                value={activeDeck.setup.notes}
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
              checked={activeDeck.setup.webResearch}
              onChange={(checked) => updateDeckSetup(activeDeck.id, { webResearch: checked })}
            />
            <ToggleField
              label="Use previous deck as context"
              description="Carry forward project narrative from a prior presentation."
              checked={activeDeck.setup.usePreviousDeckContext}
              onChange={(checked) =>
                updateDeckSetup(activeDeck.id, { usePreviousDeckContext: checked })
              }
            />
            <ToggleField
              label="Share setup inputs"
              description="Expose setup fields for collaborator comments when sharing is enabled."
              checked={activeDeck.setup.shareSetupInputs}
              onChange={(checked) =>
                updateDeckSetup(activeDeck.id, { shareSetupInputs: checked })
              }
            />
          </div>
        </div>

        <div className="builder-sidebar">
          <section className="panel-card upload-panel">
            <div className="section-heading">
              <div>
                <span className="section-label">Files</span>
                <h3>Upload and ingest source material</h3>
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
                  ? 'Collaborator uploads are highlighted for owner review.'
                  : 'Enable sharing and collaborator uploads to mock external source submission.'}
              </p>
            </div>

            <SourceUploadDropzone
              disabled={uploadRole === 'collaborator' && !canUploadAsCollaborator}
              disabledMessage="Collaborator uploads are disabled for this deck until sharing allows them."
              onFilesSelected={(files) => {
                uploadAssets(activeDeck.id, files, {
                  uploadedByRole: uploadRole,
                })
              }}
            />

            <UploadedFileList assets={deckAssets} onMarkReviewed={markAssetReviewed} />
          </section>

          <SourceMaterialsSummary
            assets={deckAssets}
            onAutoFill={() => autoFillDeckSetupFromFiles(activeDeck.id)}
          />

          <ChartSuggestionsPanel
            suggestions={chartSuggestions}
            assets={deckAssets}
            onAccept={acceptChartSuggestion}
            onReject={rejectChartSuggestion}
          />

          {activeDeck.setup.usePreviousDeckContext && previousDeck ? (
            <section className="panel-card">
              <div className="section-heading">
                <span className="section-label">Previous deck context</span>
                <h3>{previousDeck.title}</h3>
              </div>
              <p className="muted-copy">{previousDeck.setup.goal}</p>
            </section>
          ) : null}
        </div>
      </div>

      {activeDeck.collaboration.isShared && activeDeck.setup.shareSetupInputs ? (
        <CommentsPanel
          title="Setup input comments"
          description="Collect comment-only feedback on the presentation brief before generating slides."
          threads={setupCommentThreads}
          actorRole={commentRole}
          canCommentAsCollaborator={canCommentSetupAsCollaborator}
          targetOptions={[
            { value: 'general', label: 'General setup note' },
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
