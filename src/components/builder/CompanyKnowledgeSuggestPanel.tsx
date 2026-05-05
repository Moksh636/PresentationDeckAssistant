import { Link } from 'react-router-dom'
import type { CompanyKnowledgeItem, DeckSetup } from '../../types/models'

interface CompanyKnowledgeSuggestPanelProps {
  deckId: string
  setup: DeckSetup
  suggestions: CompanyKnowledgeItem[]
  updateDeckSetup: (deckId: string, updates: Partial<DeckSetup>) => void
}

export function CompanyKnowledgeSuggestPanel({
  deckId,
  setup,
  suggestions,
  updateDeckSetup,
}: CompanyKnowledgeSuggestPanelProps) {
  const selectedIds = new Set(setup.selectedCompanyKnowledgeItemIds ?? [])

  const toggle = (itemId: string) => {
    const nextIds = selectedIds.has(itemId)
      ? (setup.selectedCompanyKnowledgeItemIds ?? []).filter((id) => id !== itemId)
      : [...(setup.selectedCompanyKnowledgeItemIds ?? []), itemId]

    updateDeckSetup(deckId, {
      selectedCompanyKnowledgeItemIds: nextIds.length > 0 ? nextIds : undefined,
    })
  }

  const applyTopSuggestions = () => {
    const next = suggestions.slice(0, Math.min(suggestions.length, 5)).map((item) => item.id)
    updateDeckSetup(deckId, {
      selectedCompanyKnowledgeItemIds: next.length ? next : undefined,
    })
  }

  return (
    <section className="panel-card company-knowledge-suggest-panel">
      <div className="section-heading">
        <div>
          <span className="section-label">Company Brain</span>
          <h3>Company knowledge suggested for this pitch</h3>
          <p className="muted-copy">
            Lightweight matching on approval, visibility, tags, source type, and your brief keywords—mock
            only, ready for relational sync later.
          </p>
        </div>
        <div className="company-knowledge-suggest-actions">
          <button type="button" className="ghost-button" onClick={applyTopSuggestions}>
            Select top picks
          </button>
          <Link to="/company" className="secondary-button secondary-button--sm">
            Open Company Brain
          </Link>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <p className="muted-copy">
          No overlapping company knowledge yet. Add approved items under{' '}
          <Link to="/company">Company Brain → Knowledge Library</Link>.
        </p>
      ) : (
        <ul className="company-knowledge-suggest-list">
          {suggestions.map((item) => (
            <li key={item.id}>
              <label className="company-knowledge-suggest-row">
                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} />
                <div>
                  <div className="company-knowledge-suggest-row__title">{item.title}</div>
                  <div className="muted-copy">{item.description || item.sourceType}</div>
                  {item.tags?.length ? (
                    <div className="company-knowledge-tags">{item.tags.map((t) => `#${t}`).join(' ')}</div>
                  ) : null}
                </div>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
