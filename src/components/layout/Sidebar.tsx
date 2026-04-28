import { NavLink, useNavigate } from 'react-router-dom'
import { useWorkspace } from '../../context/useWorkspace'
import { formatCountLabel, formatShortDate } from '../../utils/formatters'

interface SidebarProps {
  variant?: 'full' | 'compact'
}

export function Sidebar({ variant = 'full' }: SidebarProps) {
  const navigate = useNavigate()
  const { workspace, createPresentation } = useWorkspace()

  const activeDeck = workspace.decks.find((deck) => deck.id === workspace.activeDeckId)

  const handleCreatePresentation = () => {
    const nextDeckId = createPresentation()

    if (nextDeckId) {
      navigate('/build')
    }
  }

  const isCompact = variant === 'compact'

  return (
    <aside className={`sidebar ${isCompact ? 'sidebar--compact' : ''}`}>
      <div className="sidebar__brand">
        <span className="sidebar__eyebrow">{isCompact ? 'AI' : 'AI-native workspace'}</span>
        <h1>{isCompact ? 'DS' : 'Deckspace'}</h1>
        <p>Build, generate, and edit structured presentations from one room.</p>
      </div>

      <button
        type="button"
        className="primary-button primary-button--full"
        title="New presentation"
        onClick={handleCreatePresentation}
      >
        {isCompact ? 'New' : 'New presentation'}
      </button>

      <nav className="sidebar__nav" aria-label="Primary">
        <NavLink to="/dashboard" className="sidebar__nav-link" title="Dashboard">
          <span className="sidebar__nav-icon" aria-hidden="true">
            D
          </span>
          <span className="sidebar__nav-text">Dashboard</span>
        </NavLink>
        <NavLink to="/build" className="sidebar__nav-link" title="Build presentation">
          <span className="sidebar__nav-icon" aria-hidden="true">
            B
          </span>
          <span className="sidebar__nav-text">Build presentation</span>
        </NavLink>
        <NavLink to="/edit" className="sidebar__nav-link" title="Edit presentation">
          <span className="sidebar__nav-icon" aria-hidden="true">
            E
          </span>
          <span className="sidebar__nav-text">Edit presentation</span>
        </NavLink>
      </nav>

      {!isCompact ? (
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
      ) : null}

      {activeDeck && !isCompact ? (
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
