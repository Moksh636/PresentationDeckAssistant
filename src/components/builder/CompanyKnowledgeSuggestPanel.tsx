import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  CompanyKnowledgeRelevanceBand,
  RankedCompanyKnowledgeEntry,
} from '../../data/companyKnowledgeRetrieval'
import type { DeckSetup } from '../../types/models'

interface MembershipBrief {
  roleTitle: string
  department: string
}

interface CompanyKnowledgeSuggestPanelProps {
  deckId: string
  setup: DeckSetup
  rankedSuggestions: RankedCompanyKnowledgeEntry[]
  membership: MembershipBrief
  updateDeckSetup: (deckId: string, updates: Partial<DeckSetup>) => void
}

const SALES_READY_TYPES = new Set(['deck', 'proposal', 'case-study', 'notes'])

function bandLabel(band: CompanyKnowledgeRelevanceBand): string {
  switch (band) {
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    default:
      return 'Low'
  }
}

function whySuggestedLines(entry: RankedCompanyKnowledgeEntry, membership: MembershipBrief): string[] {
  const { item, explanation } = entry
  const lines: string[] = []

  if (explanation.visibilitySummary) {
    lines.push(explanation.visibilitySummary)
  }

  if (explanation.approvedSource) {
    lines.push('Approved in Company Brain')
  } else if (item.approvalStatus === 'needs-review') {
    lines.push('Needs review — visible because you uploaded or admin/owner')
  }

  if (explanation.matchedRole && membership.roleTitle.trim()) {
    lines.push(`Listed for your role title (${membership.roleTitle.trim()})`)
  }

  if (explanation.matchedDepartment && membership.department.trim()) {
    lines.push(`Department list includes yours (${membership.department.trim()})`)
  }

  if (explanation.catalogRoleBonus && membership.roleTitle.trim()) {
    lines.push('Catalog alignment bonus for your title')
  }

  if (explanation.catalogDepartmentBonus && membership.department.trim()) {
    lines.push('Catalog alignment bonus for your department')
  }

  if (explanation.matchedTags?.length) {
    lines.push(`Overlaps brief tokens with tags: ${explanation.matchedTags.join(', ')}`)
  }

  if (explanation.matchedTargetCompany) {
    lines.push('Overlaps brief target company tokens with title, summary, or tags')
  }

  if (explanation.matchedBuyerPersona) {
    lines.push('Overlaps buyer persona / audience tokens with this asset')
  }

  if (explanation.matchedOfferingSummary) {
    lines.push('Overlaps offering summary tokens with this asset')
  }

  if (explanation.matchedDeckGoalTokens) {
    const detail =
      typeof explanation.matchedDeckGoalTokens === 'string'
        ? `: ${explanation.matchedDeckGoalTokens}`
        : ''
    lines.push(`Overlaps meeting goal / goal tokens${detail}`)
  }

  if (explanation.matchedKnownPainPoints) {
    lines.push('Overlaps stated pain-point tokens with this asset')
  }

  if (explanation.sourceTypeRelevance) {
    lines.push(explanation.sourceTypeRelevance)
  }

  if (lines.length === 0) {
    lines.push('Surfaced after visibility and approval gates with general briefing overlap')
  }

  return lines
}

export function CompanyKnowledgeSuggestPanel({
  deckId,
  setup,
  rankedSuggestions,
  membership,
  updateDeckSetup,
}: CompanyKnowledgeSuggestPanelProps) {
  const selectedIds = new Set(setup.selectedCompanyKnowledgeItemIds ?? [])

  const [approvedOnly, setApprovedOnly] = useState(false)
  const [myRoleOnly, setMyRoleOnly] = useState(false)
  const [myDeptOnly, setMyDeptOnly] = useState(false)
  const [salesReadyOnly, setSalesReadyOnly] = useState(false)
  const [filterProductDocs, setFilterProductDocs] = useState(false)
  const [filterCaseStudies, setFilterCaseStudies] = useState(false)
  const [filterContractsLegal, setFilterContractsLegal] = useState(false)

  const filtered = useMemo(() => {
    const categoryOn = filterProductDocs || filterCaseStudies || filterContractsLegal

    return rankedSuggestions.filter((entry) => {
      const { item, explanation } = entry

      if (approvedOnly && item.approvalStatus !== 'approved') {
        return false
      }
      if (myRoleOnly && !explanation.matchedRole) {
        return false
      }
      if (myDeptOnly && !explanation.matchedDepartment) {
        return false
      }
      if (salesReadyOnly) {
        if (item.approvalStatus !== 'approved' || !SALES_READY_TYPES.has(item.sourceType)) {
          return false
        }
      }

      if (categoryOn) {
        const matches =
          (filterProductDocs && item.sourceType === 'product-doc') ||
          (filterCaseStudies && item.sourceType === 'case-study') ||
          (filterContractsLegal && item.sourceType === 'contract')
        if (!matches) {
          return false
        }
      }

      return true
    })
  }, [
    rankedSuggestions,
    approvedOnly,
    myRoleOnly,
    myDeptOnly,
    salesReadyOnly,
    filterProductDocs,
    filterCaseStudies,
    filterContractsLegal,
  ])

  const toggle = (itemId: string) => {
    const nextIds = selectedIds.has(itemId)
      ? (setup.selectedCompanyKnowledgeItemIds ?? []).filter((id) => id !== itemId)
      : [...(setup.selectedCompanyKnowledgeItemIds ?? []), itemId]

    updateDeckSetup(deckId, {
      selectedCompanyKnowledgeItemIds: nextIds.length > 0 ? nextIds : undefined,
    })
  }

  const applyTopSuggestions = () => {
    const next = filtered.slice(0, Math.min(filtered.length, 5)).map((row) => row.item.id)
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
            Ranked from visibility, approval, your role and department, tag overlap with brief tokens, source
            type vs deck setup — heuristic only (no embeddings).
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

      <div className="company-knowledge-filter-bar" aria-label="Suggestion filters">
        <label className="company-knowledge-filter-chip">
          <input
            type="checkbox"
            checked={approvedOnly}
            onChange={() => setApprovedOnly((v) => !v)}
          />{' '}
          Approved only
        </label>
        <label className="company-knowledge-filter-chip">
          <input type="checkbox" checked={myRoleOnly} onChange={() => setMyRoleOnly((v) => !v)} /> My role
        </label>
        <label className="company-knowledge-filter-chip">
          <input type="checkbox" checked={myDeptOnly} onChange={() => setMyDeptOnly((v) => !v)} /> My
          department
        </label>
        <label className="company-knowledge-filter-chip">
          <input
            type="checkbox"
            checked={salesReadyOnly}
            onChange={() => setSalesReadyOnly((v) => !v)}
          />{' '}
          Sales-ready
        </label>
        <label className="company-knowledge-filter-chip">
          <input
            type="checkbox"
            checked={filterProductDocs}
            onChange={() => setFilterProductDocs((v) => !v)}
          />{' '}
          Product docs
        </label>
        <label className="company-knowledge-filter-chip">
          <input
            type="checkbox"
            checked={filterCaseStudies}
            onChange={() => setFilterCaseStudies((v) => !v)}
          />{' '}
          Case studies
        </label>
        <label className="company-knowledge-filter-chip">
          <input
            type="checkbox"
            checked={filterContractsLegal}
            onChange={() => setFilterContractsLegal((v) => !v)}
          />{' '}
          Contracts / legal
        </label>
      </div>

      {rankedSuggestions.length === 0 ? (
        <p className="muted-copy">
          No overlapping company knowledge yet. Add approved items under{' '}
          <Link to="/company">Company Brain → Knowledge Library</Link>.
        </p>
      ) : filtered.length === 0 ? (
        <p className="muted-copy">
          No suggestions match these filters. Try widening filters or open{' '}
          <Link to="/company">Company Brain → Knowledge Library</Link>.
        </p>
      ) : (
        <ul className="company-knowledge-suggest-list">
          {filtered.map((row) => (
            <SuggestedKnowledgeRow
              key={row.item.id}
              row={row}
              membership={membership}
              selected={selectedIds.has(row.item.id)}
              onToggle={() => toggle(row.item.id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function SuggestedKnowledgeRow({
  row,
  membership,
  selected,
  onToggle,
}: {
  row: RankedCompanyKnowledgeEntry
  membership: MembershipBrief
  selected: boolean
  onToggle: () => void
}) {
  const { item, score, band, explanation } = row
  const bullets = whySuggestedLines(row, membership)

  return (
    <li>
      <div className="company-knowledge-suggest-row">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${item.title}`} />
        <div className="company-knowledge-suggest-body">
          <div className="company-knowledge-suggest-heading">
            <div className="company-knowledge-suggest-row__title">{item.title}</div>
            <span className={`company-knowledge-band company-knowledge-band--${band}`}>
              {bandLabel(band)} · score {Math.round(score)}
            </span>
          </div>
          <div className="muted-copy">{item.description || item.sourceType}</div>
          {item.tags?.length ? (
            <div className="company-knowledge-tags">{item.tags.map((t) => `#${t}`).join(' ')}</div>
          ) : null}
          <div className="company-knowledge-why">
            <span className="company-knowledge-why-label">Why suggested</span>
            <ul>
              {bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <details className="company-knowledge-preview">
            <summary>Preview metadata</summary>
            <dl className="company-knowledge-preview-dl">
              <dt>Description</dt>
              <dd>{item.description?.trim() || '—'}</dd>
              <dt>Tags</dt>
              <dd>{item.tags?.length ? item.tags.join(', ') : '—'}</dd>
              <dt>Source type</dt>
              <dd>{item.sourceType}</dd>
              <dt>Visibility</dt>
              <dd>{explanation.visibilitySummary ?? item.visibility}</dd>
              <dt>Approval</dt>
              <dd>{item.approvalStatus}</dd>
              <dt>Allowed departments</dt>
              <dd>{item.allowedDepartments?.length ? item.allowedDepartments.join(', ') : '—'}</dd>
              <dt>Allowed role titles</dt>
              <dd>{item.allowedRoleTitles?.length ? item.allowedRoleTitles.join(', ') : '—'}</dd>
            </dl>
          </details>
        </div>
      </div>
    </li>
  )
}
