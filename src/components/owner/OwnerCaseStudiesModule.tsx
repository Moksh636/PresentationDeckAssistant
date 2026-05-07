import { useState } from 'react'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type { CaseStudyItem } from '../../types/models'

export function OwnerCaseStudiesModule({
  activeOrgId,
  items,
  workspaceApi,
  search,
  setSearch,
}: {
  activeOrgId: string
  items: CaseStudyItem[]
  workspaceApi: WorkspaceContextValue
  search: string
  setSearch: (value: string) => void
}) {
  const [draft, setDraft] = useState<Omit<CaseStudyItem, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>({ title: '', customerName: '', industry: '', challenge: '', solution: '', outcome: '', approvedQuote: '', sourceKnowledgeItemIds: [] })
  const rows = items.filter((item) => `${item.title} ${item.customerName} ${item.industry}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <article className="owner-dashboard__card">
      <h2>Case Studies</h2>
      <div className="company-brain-filters"><label><span>Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
      <div className="form-grid">
        {(['title', 'customerName', 'industry'] as const).map((f) => <label key={f} className="field-group"><span className="field-label">{f}</span><input value={draft[f]} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))} /></label>)}
        {(['challenge', 'solution', 'outcome'] as const).map((f) => <label key={f} className="field-group field-group--wide"><span className="field-label">{f}</span><textarea rows={3} value={draft[f]} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))} /></label>)}
        <button type="button" className="primary-button" disabled={!draft.title.trim()} onClick={() => { workspaceApi.upsertCompanyCaseStudy(activeOrgId, draft); setDraft({ title: '', customerName: '', industry: '', challenge: '', solution: '', outcome: '', approvedQuote: '', sourceKnowledgeItemIds: [] }) }}>Save case study</button>
      </div>
      {!rows.length ? <p className="muted-copy">No case studies yet. Add your first approved customer story.</p> : (
        <ul className="company-brain-list">{rows.map((cs) => <li key={cs.id} className="company-brain-card"><strong>{cs.title}</strong><p className="muted-copy">{cs.customerName} · {cs.industry}</p><button type="button" className="ghost-button" onClick={() => workspaceApi.deleteCompanyCaseStudy(activeOrgId, cs.id)}>Delete</button></li>)}</ul>
      )}
    </article>
  )
}
