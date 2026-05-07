import {
  OwnerAiOrganizationSection,
  OwnerFolderStructureSection,
  OwnerKnowledgeMoveSection,
} from './OwnerConsolePanels'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type { CompanyKnowledgeOrganizationPlan } from '../../data/companyKnowledgeOrganization'
import type { CompanyKnowledgeItem, KnowledgeFolder } from '../../types/models'

type FolderSubsection = 'tree' | 'move-items' | 'suggestions'

export function OwnerFolderOrganizerModule({
  activeOrgId,
  admin,
  workspaceApi,
  folders,
  knowledgeItems,
  suggestionPlan,
  folderSubsection,
  setFolderSubsection,
}: {
  activeOrgId: string
  admin: boolean
  workspaceApi: WorkspaceContextValue
  folders: KnowledgeFolder[]
  knowledgeItems: CompanyKnowledgeItem[]
  suggestionPlan: CompanyKnowledgeOrganizationPlan
  folderSubsection: FolderSubsection
  setFolderSubsection: (subsection: FolderSubsection) => void
}) {
  return (
    <div className="owner-module-layout__content">
      <aside className="owner-module-layout__sidebar">
        {(
          [
            ['tree', 'Folder tree'],
            ['move-items', 'Move items'],
            ['suggestions', 'Suggestions'],
          ] as Array<[FolderSubsection, string]>
        ).map(([id, label]) => (
          <button key={id} type="button" className={folderSubsection === id ? 'is-active' : ''} onClick={() => setFolderSubsection(id)}>
            {label}
          </button>
        ))}
      </aside>
      <main className="owner-module-layout__main">
        <h2>Folder Organizer</h2>
        <p className="muted-copy">Build nested structure, move items, and manage staged organization suggestions.</p>
        {folderSubsection === 'tree' ? <OwnerFolderStructureSection activeOrgId={activeOrgId} admin={admin} workspaceApi={workspaceApi} folders={folders} /> : null}
        {folderSubsection === 'move-items' ? <OwnerKnowledgeMoveSection activeOrgId={activeOrgId} admin={admin} workspaceApi={workspaceApi} knowledgeItems={knowledgeItems} folders={folders} /> : null}
        {folderSubsection === 'suggestions' ? <OwnerAiOrganizationSection activeOrgId={activeOrgId} admin={admin} workspaceApi={workspaceApi} knowledgeItems={knowledgeItems} folders={folders} suggestionPlan={suggestionPlan} /> : null}
      </main>
    </div>
  )
}
