import { useState } from 'react'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type { ApprovedMessagingItem } from '../../types/models'

export function OwnerMessagingModule({
  activeOrgId,
  items,
  workspaceApi,
  search,
  setSearch,
}: {
  activeOrgId: string
  items: ApprovedMessagingItem[]
  workspaceApi: WorkspaceContextValue
  search: string
  setSearch: (value: string) => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('Playbook')
  const [tags, setTags] = useState('')
  const rows = items.filter((item) =>
    `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <article className="owner-dashboard__card">
      <h2>Approved Messaging</h2>
      <div className="company-brain-filters"><label><span>Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="title, content, tags" /></label></div>
      <div className="form-grid">
        <label className="field-group"><span className="field-label">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field-group"><span className="field-label">Category</span><input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Content</span><textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Tags</span><input value={tags} onChange={(e) => setTags(e.target.value)} /></label>
        <button type="button" className="primary-button" disabled={!title.trim()} onClick={() => { workspaceApi.upsertCompanyApprovedMessaging(activeOrgId, { title, content, category, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), approvalStatus: 'approved' }); setTitle(''); setContent('') }}>Save snippet</button>
      </div>
      {!rows.length ? <p className="muted-copy">No messaging snippets match current filters.</p> : (
        <ul className="company-brain-list">{rows.map((msg) => <li key={msg.id} className="company-brain-card"><strong>{msg.title}</strong><p className="muted-copy">{msg.content}</p><div className="owner-suggestion-list__actions"><span className="company-chip company-chip--approved">{msg.approvalStatus}</span><button type="button" className="ghost-button" onClick={() => workspaceApi.deleteCompanyApprovedMessaging(activeOrgId, msg.id)}>Archive / delete</button></div></li>)}</ul>
      )}
    </article>
  )
}
