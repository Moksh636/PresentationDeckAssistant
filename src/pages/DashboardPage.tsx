import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShareProjectModal } from '../components/collaboration/ShareProjectModal'
import { DeckCard } from '../components/dashboard/DeckCard'
import { ProjectCard } from '../components/dashboard/ProjectCard'
import { useWorkspace } from '../context/useWorkspace'

export function DashboardPage() {
  const navigate = useNavigate()
  const { workspace, createPresentation, setActiveDeck, updateProjectCollaboration } = useWorkspace()
  const [shareProjectId, setShareProjectId] = useState<string>()

  const sortedDecks = [...workspace.decks].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )
  const selectedProject = workspace.projects.find((project) => project.id === shareProjectId)
  const projectDecks = useMemo(
    () => workspace.decks.filter((deck) => deck.projectId === selectedProject?.id),
    [selectedProject?.id, workspace.decks],
  )
  const projectShareSettings = {
    isShared: projectDecks.length > 0 && projectDecks.every((deck) => deck.collaboration.isShared),
    shareSetupInputs:
      projectDecks.length > 0 && projectDecks.every((deck) => deck.setup.shareSetupInputs),
    allowCollaboratorUploads:
      projectDecks.length > 0 &&
      projectDecks.every((deck) => deck.collaboration.allowCollaboratorUploads),
  }

  const handleCreatePresentation = () => {
    const nextDeckId = createPresentation()

    if (nextDeckId) {
      navigate('/build')
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <span className="section-label">Workspace dashboard</span>
          <h2>Projects, decks, and the current editing lane</h2>
          <p>
            Start from a project, open a deck, then move directly into generation and edit
            flows.
          </p>
        </div>

        <button type="button" className="primary-button" onClick={handleCreatePresentation}>
          Create new presentation
        </button>
      </div>

      <div className="stats-grid">
        <article className="panel-card">
          <span className="section-label">Projects</span>
          <strong>{workspace.projects.length}</strong>
          <p>Organize decks by workstream and keep narrative context grouped.</p>
        </article>
        <article className="panel-card">
          <span className="section-label">Decks</span>
          <strong>{workspace.decks.length}</strong>
          <p>Move between setup and editing without changing source-of-truth models.</p>
        </article>
        <article className="panel-card">
          <span className="section-label">Tracked versions</span>
          <strong>{workspace.deckVersions.length}</strong>
          <p>Alternate branches can stack without losing the current editable deck state.</p>
        </article>
      </div>

      <section className="section-stack">
        <div className="section-heading">
          <span className="section-label">Projects</span>
          <h3>Folder view</h3>
        </div>
        <div className="project-grid">
          {workspace.projects.length > 0 ? (
            workspace.projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onShare={() => setShareProjectId(project.id)}
              />
            ))
          ) : (
            <article className="empty-state-card">
              <span className="section-label">No projects</span>
              <h3>Create a project lane</h3>
              <p>Projects keep related decks, source material, and collaboration context grouped.</p>
            </article>
          )}
        </div>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <span className="section-label">Decks</span>
          <h3>Recent presentations</h3>
        </div>
        <div className="deck-grid">
          {sortedDecks.length > 0 ? (
            sortedDecks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                isActive={workspace.activeDeckId === deck.id}
                slideCount={workspace.slides.filter((slide) => slide.deckId === deck.id).length}
                assetCount={workspace.fileAssets.filter((asset) => asset.deckId === deck.id).length}
                versionCount={
                  workspace.deckVersions.filter((version) => version.deckId === deck.id).length
                }
                commentCount={
                  workspace.comments.filter((comment) => comment.deckId === deck.id).length
                }
                onBuild={() => {
                  setActiveDeck(deck.id)
                  navigate('/build')
                }}
                onEdit={() => {
                  setActiveDeck(deck.id)
                  navigate('/edit')
                }}
              />
            ))
          ) : (
            <article className="empty-state-card empty-state-card--wide">
              <span className="section-label">No decks</span>
              <h3>Start your first presentation</h3>
              <p>Use the build flow to collect inputs and generate an editable structured deck.</p>
              <button type="button" className="primary-button" onClick={handleCreatePresentation}>
                Create new presentation
              </button>
            </article>
          )}
        </div>
      </section>

      {selectedProject ? (
        <ShareProjectModal
          isOpen={Boolean(selectedProject)}
          title={`Share ${selectedProject.name}`}
          description="Apply comment-only collaboration settings across every deck in this project."
          initialSettings={projectShareSettings}
          onClose={() => setShareProjectId(undefined)}
          onSave={(settings) => updateProjectCollaboration(selectedProject.id, settings)}
        />
      ) : null}
    </section>
  )
}
