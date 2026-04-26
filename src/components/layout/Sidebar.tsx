import { NavLink, useNavigate } from 'react-router-dom'
import { useWorkspace } from '../../context/useWorkspace'
import { formatCountLabel, formatShortDate } from '../../utils/formatters'

export function Sidebar() {
  const navigate = useNavigate()
  const { workspace, createPresentation } = useWorkspace()

  const activeDeck = workspace.decks.find((deck) => deck.id === workspace.activeDeckId)

  const handleCreatePresentation = () => {
    const nextDeckId = createPresentation()

    if (nextDeckId) {
      navigate('/build')
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__eyebrow">AI-native workspace</span>
        <h1>Deckspace</h1>
        <p>Build, generate, and edit structured presentations from one room.</p>
      </div>

      <button type="button" className="primary-button primary-button--full" onClick={handleCreatePresentation}>
        New presentation
      </button>

      <nav className="sidebar__nav" aria-label="Primary">
        <NavLink to="/dashboard" className="sidebar__nav-link">
          Dashboard
        </NavLink>
        <NavLink to="/build" className="sidebar__nav-link">
          Build presentation
        </NavLink>
        <NavLink to="/edit" className="sidebar__nav-link">
          Edit presentation
        </NavLink>
      </nav>

      <section className="sidebar__panel">
        <div className="sidebar__panel-label">Workspace snapshot</div>
        <div className="sidebar__metric">
          <span>{formatCountLabel(workspace.projects.length, 'project')}</span>
          <strong>{formatCountLabel(workspace.decks.length, 'deck')}</strong>
        </div>
        <div className="sidebar__metric">
          <span>Versions tracked</span>
          <strong>{workspace.deckVersions.length}</strong>
        </div>
        <div className="sidebar__metric">
          <span>Comments</span>
          <strong>{workspace.comments.length}</strong>
        </div>
      </section>

      {activeDeck ? (
        <section className="sidebar__panel sidebar__panel--active">
          <div className="sidebar__panel-label">Active deck</div>
          <h2>{activeDeck.title}</h2>
          <p>{activeDeck.setup.presentationType}</p>
          <div className="sidebar__meta-row">
            <span>{activeDeck.status}</span>
            <span>{formatShortDate(activeDeck.updatedAt)}</span>
          </div>
        </section>
      ) : null}
    </aside>
  )
}
