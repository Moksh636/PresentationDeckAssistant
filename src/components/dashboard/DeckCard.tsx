import type { Deck } from '../../types/models'
import { formatCountLabel, formatShortDate } from '../../utils/formatters'

interface DeckCardProps {
  deck: Deck
  isActive: boolean
  slideCount: number
  assetCount: number
  versionCount: number
  commentCount: number
  onBuild: () => void
  onEdit: () => void
}

export function DeckCard({
  deck,
  isActive,
  slideCount,
  assetCount,
  versionCount,
  commentCount,
  onBuild,
  onEdit,
}: DeckCardProps) {
  return (
    <article className={`panel-card deck-card ${isActive ? 'deck-card--active' : ''}`}>
      <div className="deck-card__header">
        <div>
          <div className="card-pill">{deck.status}</div>
          <h3>{deck.title}</h3>
        </div>
        <span className="deck-card__date">{formatShortDate(deck.updatedAt)}</span>
      </div>

      <p>{deck.setup.goal || 'Presentation setup has not been filled in yet.'}</p>

      <div className="deck-card__metrics">
        <span>{formatCountLabel(slideCount, 'slide')}</span>
        <span>{formatCountLabel(assetCount, 'asset')}</span>
        <span>{formatCountLabel(versionCount, 'version')}</span>
        <span>{formatCountLabel(commentCount, 'comment')}</span>
      </div>

      <div className="deck-card__actions">
        <button type="button" className="secondary-button" onClick={onBuild}>
          Build
        </button>
        <button type="button" className="primary-button" onClick={onEdit}>
          Edit
        </button>
      </div>
    </article>
  )
}
