import {
  OwnerFolderStructureSection,
  OwnerKnowledgeUploadSection,
} from './OwnerConsolePanels'
import { useRenameModal } from '../workspace/useRenameModal'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type {
  CompanyKnowledgeItem,
  CompanyKnowledgeSourceType,
  KnowledgeApprovalStatus,
  KnowledgeFolder,
} from '../../types/models'

type KnowledgeSubsection =
  | 'all'
  | 'needs-review'
  | 'approved'
  | 'archived'
  | 'folders'
  | 'upload'

const SOURCE_OPTIONS: CompanyKnowledgeSourceType[] = [
  'contract',
  'deck',
  'proposal',
  'notes',
  'case-study',
  'product-doc',
  'policy',
  'transcript',
  'other',
]

export function OwnerKnowledgeLibraryModule({
  activeOrgId,
  admin,
  workspaceApi,
  folders,
  deckFileOptions,
  knowledgeSubsection,
  setKnowledgeSubsection,
  knowledgeSearch,
  setKnowledgeSearch,
  knowledgeSourceFilter,
  setKnowledgeSourceFilter,
  knowledgeStatusFilter,
  setKnowledgeStatusFilter,
  knowledgeFolderFilter,
  setKnowledgeFolderFilter,
  filteredKnowledge,
}: {
  activeOrgId: string
  admin: boolean
  workspaceApi: WorkspaceContextValue
  folders: KnowledgeFolder[]
  deckFileOptions: { id: string; name: string }[]
  knowledgeSubsection: KnowledgeSubsection
  setKnowledgeSubsection: (subsection: KnowledgeSubsection) => void
  knowledgeSearch: string
  setKnowledgeSearch: (value: string) => void
  knowledgeSourceFilter: CompanyKnowledgeSourceType | 'any'
  setKnowledgeSourceFilter: (value: CompanyKnowledgeSourceType | 'any') => void
  knowledgeStatusFilter: KnowledgeApprovalStatus | 'any'
  setKnowledgeStatusFilter: (value: KnowledgeApprovalStatus | 'any') => void
  knowledgeFolderFilter: string
  setKnowledgeFolderFilter: (value: string) => void
  filteredKnowledge: CompanyKnowledgeItem[]
}) {
  const { openRename, renameModal } = useRenameModal()

  return (
    <div className="owner-module-layout__content">
      <aside className="owner-module-layout__sidebar">
        {(
          [
            ['all', 'All documents'],
            ['needs-review', 'Needs review'],
            ['approved', 'Approved'],
            ['archived', 'Excluded/Archived'],
            ['folders', 'Folders'],
            ['upload', 'Upload/Register'],
          ] as Array<[KnowledgeSubsection, string]>
        ).map(([id, label]) => (
          <button key={id} type="button" className={knowledgeSubsection === id ? 'is-active' : ''} onClick={() => setKnowledgeSubsection(id)}>
            {label}
          </button>
        ))}
      </aside>
      <main className="owner-module-layout__main">
        <h2>Knowledge Library</h2>
        <p className="muted-copy">Browse, filter, review, and manage document metadata from one place.</p>
        {knowledgeSubsection === 'upload' ? (
          <OwnerKnowledgeUploadSection
            activeOrgId={activeOrgId}
            admin={admin}
            workspaceApi={workspaceApi}
            folders={folders}
            deckFileOptions={deckFileOptions}
          />
        ) : knowledgeSubsection === 'folders' ? (
          <OwnerFolderStructureSection activeOrgId={activeOrgId} admin={admin} workspaceApi={workspaceApi} folders={folders} />
        ) : (
          <>
            <div className="company-brain-filters">
              <label><span>Search</span><input value={knowledgeSearch} onChange={(e) => setKnowledgeSearch(e.target.value)} placeholder="title, tags, description" /></label>
              <label><span>Source</span><select value={knowledgeSourceFilter} onChange={(e) => setKnowledgeSourceFilter(e.target.value as CompanyKnowledgeSourceType | 'any')}><option value="any">Any</option>{SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <label><span>Status</span><select value={knowledgeStatusFilter} onChange={(e) => setKnowledgeStatusFilter(e.target.value as KnowledgeApprovalStatus | 'any')}><option value="any">Any</option><option value="needs-review">Needs review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="archived">Archived</option></select></label>
              <label><span>Folder</span><select value={knowledgeFolderFilter} onChange={(e) => setKnowledgeFolderFilter(e.target.value)}><option value="any">Any</option><option value="">No folder</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
            </div>
            <OwnerKnowledgeTable
              activeOrgId={activeOrgId}
              workspaceApi={workspaceApi}
              onEditTitle={(item) =>
                openRename({
                  title: 'Edit title',
                  initialValue: item.title,
                  inputLabel: 'Title',
                  saveLabel: 'Save',
                  onSave: (title) => workspaceApi.upsertCompanyKnowledgeItem(activeOrgId, { ...item, title }),
                })
              }
              items={filteredKnowledge.filter((row) => {
                if (knowledgeSubsection === 'needs-review') return row.approvalStatus === 'needs-review'
                if (knowledgeSubsection === 'approved') return row.approvalStatus === 'approved'
                if (knowledgeSubsection === 'archived') {
                  return row.approvalStatus === 'archived' || row.approvalStatus === 'rejected'
                }
                return true
              })}
              folders={folders}
            />
          </>
        )}
      </main>
      {renameModal}
    </div>
  )
}

function OwnerKnowledgeTable({
  activeOrgId,
  workspaceApi,
  items,
  folders,
  onEditTitle,
}: {
  activeOrgId: string
  workspaceApi: WorkspaceContextValue
  items: CompanyKnowledgeItem[]
  folders: { id: string; name: string }[]
  onEditTitle: (item: CompanyKnowledgeItem) => void
}) {
  if (!items.length) {
    return <p className="muted-copy">No documents matched this subsection and filter set.</p>
  }
  return (
    <ul className="company-brain-list">
      {items.map((item) => (
        <li key={item.id} className="company-brain-card">
          <header>
            <strong>{item.title}</strong>
            <span className={`company-chip company-chip--${item.approvalStatus}`}>{item.approvalStatus}</span>
          </header>
          <p className="muted-copy">{item.description || 'No description'}</p>
          <p className="muted-copy">
            Source: {item.sourceType} · Folder: {folders.find((f) => f.id === item.folderId)?.name ?? 'none'}
          </p>
          <div className="owner-suggestion-list__actions">
            <button type="button" className="ghost-button" onClick={() => window.alert(item.description || 'No preview content.')}>Preview</button>
            <button type="button" className="ghost-button" onClick={() => workspaceApi.setCompanyKnowledgeApproval(activeOrgId, item.id, 'approved', 'Approved')}>Approve</button>
            <button type="button" className="ghost-button" onClick={() => workspaceApi.setCompanyKnowledgeApproval(activeOrgId, item.id, 'rejected', 'Rejected')}>Reject</button>
            <button type="button" className="ghost-button" onClick={() => workspaceApi.setCompanyKnowledgeApproval(activeOrgId, item.id, 'archived', 'Archived')}>Archive</button>
            <select value={item.folderId ?? ''} onChange={(e) => workspaceApi.upsertCompanyKnowledgeItem(activeOrgId, { ...item, folderId: e.target.value || null })}>
              <option value="">Move to folder...</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
            <button type="button" className="ghost-button" onClick={() => onEditTitle(item)}>
              Edit metadata
            </button>
            <button type="button" className="ghost-button" onClick={() => workspaceApi.deleteCompanyKnowledgeItem(activeOrgId, item.id)}>
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
