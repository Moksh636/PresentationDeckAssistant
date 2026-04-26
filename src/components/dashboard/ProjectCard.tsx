import type { Project } from '../../types/models'
import { formatCountLabel, formatShortDate } from '../../utils/formatters'

interface ProjectCardProps {
  project: Project
  onShare?: () => void
}

export function ProjectCard({ project, onShare }: ProjectCardProps) {
  return (
    <article className="panel-card project-card">
      <div className="card-pill">{project.status}</div>
      <h3>{project.name}</h3>
      <p>{project.summary}</p>
      <div className="project-card__meta">
        <span>{project.owner}</span>
        <span>{formatCountLabel(project.deckIds.length, 'deck')}</span>
        <span>Updated {formatShortDate(project.updatedAt)}</span>
      </div>
      {onShare ? (
        <div className="deck-card__actions">
          <button type="button" className="secondary-button" onClick={onShare}>
            Share project
          </button>
        </div>
      ) : null}
    </article>
  )
}
