import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type { CompanyKnowledgeOrganizationPlan } from '../../data/companyKnowledgeOrganization'
import {
  buildKnowledgeFolderTree,
  flattenFolderTreeForSelect,
  normalizeKnowledgeFolderParent,
  type KnowledgeFolderTreeNode,
} from '../../data/knowledgeFolderTree'
import {
  reduceApproveKnowledgeFolderSuggestion,
  reduceRejectKnowledgeFolderSuggestion,
} from '../../data/knowledgeSuggestionApply'
import { buildDraftOrganizationMemberRow } from '../../data/ownerWorkerPrep'
import type {
  CompanyBrainCatalogDepartment,
  CompanyBrainCatalogRole,
  CompanyKnowledgeItem,
  CompanyKnowledgeSourceType,
  KnowledgeApprovalStatus,
  KnowledgeFolder,
  KnowledgeVisibilityScope,
  MembershipAccessRole,
} from '../../types/models'

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

function FolderTreeList({ nodes, depth = 0 }: { nodes: KnowledgeFolderTreeNode[]; depth?: number }) {
  if (!nodes.length) {
    return <p className="muted-copy">No folders yet—create a root folder below.</p>
  }
  return (
    <ul className={`owner-folder-tree${depth > 0 ? ' owner-folder-tree--nested' : ''}`}>
      {nodes.map(({ folder, children }) => (
        <li key={folder.id}>
          <div className="owner-folder-tree__row">
            <strong>{folder.name}</strong>
            {folder.suggestedByAi ? (
              <span className="muted-copy" title="Suggested by offline organizer">
                {' '}
                · AI staged
              </span>
            ) : null}
            {folder.ownerApproved ? <span className="muted-copy"> · Approved</span> : null}
          </div>
          {children.length ? <FolderTreeList nodes={children} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  )
}

export function OwnerKnowledgeUploadSection({
  activeOrgId,
  admin,
  workspaceApi,
  folders,
  deckFileOptions,
}: {
  activeOrgId: string
  admin: boolean
  workspaceApi: WorkspaceContextValue
  folders: KnowledgeFolder[]
  deckFileOptions: { id: string; name: string }[]
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState<CompanyKnowledgeSourceType>('notes')
  const [tagsRaw, setTagsRaw] = useState('')
  const [folderId, setFolderId] = useState('')
  const [visibility, setVisibility] = useState<KnowledgeVisibilityScope>('company')
  const [approvalStatus, setApprovalStatus] = useState<KnowledgeApprovalStatus>('needs-review')
  const [fileAssetId, setFileAssetId] = useState('')

  const folderOptions = useMemo(() => flattenFolderTreeForSelect(buildKnowledgeFolderTree(folders)), [folders])

  if (!admin) {
    return (
      <p className="muted-copy">
        Only owners and admins can register documents here. Open{' '}
        <Link to="/company">Company Brain</Link> as an admin to review entries.
      </p>
    )
  }

  const register = () => {
    workspaceApi.upsertCompanyKnowledgeItem(activeOrgId, {
      title: title.trim(),
      description: description.trim(),
      sourceType,
      tags: tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      folderId: folderId || undefined,
      visibility,
      approvalStatus,
      fileAssetId: fileAssetId || undefined,
    })
    setTitle('')
    setDescription('')
    setTagsRaw('')
  }

  return (
    <>
      <p className="muted-copy">
        Register narrative or linked deck files into the org library (same mutations as Company Brain). Files below
        come from the active deck’s asset list.
      </p>
      <div className="form-grid company-brain-register">
        <label className="field-group">
          <span className="field-label">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="QBR narrative" />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Description</span>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="field-group">
          <span className="field-label">Source type</span>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as CompanyKnowledgeSourceType)}>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span className="field-label">Tags</span>
          <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="finance, slg" />
        </label>
        <label className="field-group">
          <span className="field-label">Folder</span>
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">— None —</option>
            {folderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span className="field-label">Visibility</span>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as KnowledgeVisibilityScope)}
          >
            <option value="company">Company</option>
            <option value="department">Department</option>
            <option value="role">Role</option>
            <option value="private">Private</option>
          </select>
        </label>
        <label className="field-group">
          <span className="field-label">Approval</span>
          <select
            value={approvalStatus}
            onChange={(e) => setApprovalStatus(e.target.value as KnowledgeApprovalStatus)}
          >
            <option value="needs-review">Needs review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Attach active deck file (optional)</span>
          <select value={fileAssetId} onChange={(e) => setFileAssetId(e.target.value)}>
            <option value="">— No file —</option>
            {deckFileOptions.map((file) => (
              <option key={file.id} value={file.id}>
                {file.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field-group field-group--wide">
          <button type="button" className="primary-button" disabled={!title.trim()} onClick={register}>
            Register document
          </button>
          {!deckFileOptions.length ? (
            <p className="muted-copy helper-inset">
              Open a deck in Build to populate file assets, or skip linking for narrative-only rows.
            </p>
          ) : null}
        </div>
      </div>
    </>
  )
}

export function OwnerFolderStructureSection({
  activeOrgId,
  admin,
  workspaceApi,
  folders,
}: {
  activeOrgId: string
  admin: boolean
  workspaceApi: WorkspaceContextValue
  folders: KnowledgeFolder[]
}) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const tree = useMemo(() => buildKnowledgeFolderTree(folders), [folders])
  const flat = useMemo(() => flattenFolderTreeForSelect(tree), [tree])

  if (!admin) {
    return <p className="muted-copy">Folder edits require owner or admin access.</p>
  }

  const createFolder = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const map = new Map(folders.map((f) => [f.id, f]))
    const parentFolderId =
      parentId ? normalizeKnowledgeFolderParent(undefined, parentId, map) : undefined
    workspaceApi.upsertCompanyKnowledgeFolder(activeOrgId, {
      name: trimmed,
      parentFolderId,
    })
    setName('')
    setParentId('')
  }

  return (
    <>
      <p className="muted-copy">
        Nested folders use <code>parentFolderId</code> in workspace JSON—create children without drag-and-drop.
      </p>
      <FolderTreeList nodes={tree} />
      <div className="form-grid company-brain-mini-form owner-console-folder-form">
        <label className="field-group">
          <span className="field-label">New folder name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enablement / AE scripts" />
        </label>
        <label className="field-group">
          <span className="field-label">Parent (optional)</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Root —</option>
            {flat.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary-button" disabled={!name.trim()} onClick={createFolder}>
          Create folder
        </button>
      </div>
    </>
  )
}

export function OwnerKnowledgeMoveSection({
  activeOrgId,
  admin,
  workspaceApi,
  knowledgeItems,
  folders,
}: {
  activeOrgId: string
  admin: boolean
  workspaceApi: WorkspaceContextValue
  knowledgeItems: CompanyKnowledgeItem[]
  folders: KnowledgeFolder[]
}) {
  const tree = useMemo(() => buildKnowledgeFolderTree(folders), [folders])
  const flat = useMemo(() => flattenFolderTreeForSelect(tree), [tree])

  if (!admin) {
    return <p className="muted-copy">Assigning folders requires owner or admin access.</p>
  }

  const assignFolder = (item: CompanyKnowledgeItem, nextFolderId: string) => {
    workspaceApi.upsertCompanyKnowledgeItem(activeOrgId, {
      id: item.id,
      title: item.title,
      description: item.description,
      sourceType: item.sourceType,
      tags: item.tags,
      folderId: nextFolderId ? nextFolderId : null,
      suggestedFolderId: item.suggestedFolderId,
      ownerApprovedFolder: item.ownerApprovedFolder,
      visibility: item.visibility,
      approvalStatus: item.approvalStatus,
      allowedDepartments: item.allowedDepartments,
      allowedRoleTitles: item.allowedRoleTitles,
      fileAssetId: item.fileAssetId,
    })
  }

  if (!knowledgeItems.length) {
    return <p className="muted-copy">No knowledge rows yet—register a document above.</p>
  }

  return (
    <ul className="owner-knowledge-assign-list">
      {knowledgeItems.map((item) => (
        <li key={item.id} className="owner-knowledge-assign-list__row">
          <div>
            <strong>{item.title}</strong>
            <div className="muted-copy">
              {item.sourceType}
              {item.suggestedFolderId ? ' · suggestion pending' : ''}
            </div>
          </div>
          <label className="field-group owner-knowledge-assign-list__select">
            <span className="field-label">Folder</span>
            <select
              value={item.folderId ?? ''}
              onChange={(e) => assignFolder(item, e.target.value)}
              aria-label={`Folder for ${item.title}`}
            >
              <option value="">— None —</option>
              {flat.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </li>
      ))}
    </ul>
  )
}

export function OwnerAiOrganizationSection({
  activeOrgId,
  admin,
  workspaceApi,
  knowledgeItems,
  folders,
  suggestionPlan,
}: {
  activeOrgId: string
  admin: boolean
  workspaceApi: WorkspaceContextValue
  knowledgeItems: CompanyKnowledgeItem[]
  folders: KnowledgeFolder[]
  suggestionPlan: CompanyKnowledgeOrganizationPlan
}) {
  const pending = useMemo(
    () => knowledgeItems.filter((k) => Boolean(k.suggestedFolderId)),
    [knowledgeItems],
  )

  const folderName = (id: string | undefined) =>
    id ? folders.find((f) => f.id === id)?.name ?? id.slice(0, 10) : '—'

  if (!admin) {
    return <p className="muted-copy">Suggestion controls are limited to owners and admins.</p>
  }

  return (
    <>
      <p className="muted-copy">
        Offline heuristic planner (no APIs). Stage folders + suggested targets, then approve per item.
      </p>
      <button
        type="button"
        className="secondary-button"
        disabled={!suggestionPlan.items.length}
        onClick={() => workspaceApi.stageCompanyKnowledgeOrganizationPlan(activeOrgId, suggestionPlan)}
      >
        Stage suggestions on workspace
      </button>
      {!pending.length ? (
        <p className="muted-copy helper-inset">
          No pending suggestions—stage from the plan above or wait until knowledge items exist.
        </p>
      ) : (
        <ul className="owner-suggestion-list">
          {pending.map((item) => (
            <li key={item.id} className="owner-suggestion-list__row">
              <div>
                <strong>{item.title}</strong>
                <div className="muted-copy">
                  Suggested → {folderName(item.suggestedFolderId)} · current folder {folderName(item.folderId)}
                </div>
              </div>
              <div className="owner-suggestion-list__actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    const patch = reduceApproveKnowledgeFolderSuggestion(item)
                    if (patch) {
                      workspaceApi.upsertCompanyKnowledgeItem(activeOrgId, patch)
                    }
                  }}
                >
                  Approve move
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    const patch = reduceRejectKnowledgeFolderSuggestion(item)
                    if (patch) {
                      workspaceApi.upsertCompanyKnowledgeItem(activeOrgId, patch)
                    }
                  }}
                >
                  Reject suggestion
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function OwnerWorkerPrepSection({
  activeOrgId,
  admin,
  workspaceApi,
  departments,
  roles,
}: {
  activeOrgId: string
  admin: boolean
  workspaceApi: WorkspaceContextValue
  departments: CompanyBrainCatalogDepartment[]
  roles: CompanyBrainCatalogRole[]
}) {
  const activeDepartments = departments.filter((d) => !d.archived)
  const activeRoles = roles.filter((r) => !r.archived)

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [catalogDeptId, setCatalogDeptId] = useState('')
  const [manualDept, setManualDept] = useState('')
  const [catalogRoleId, setCatalogRoleId] = useState('')
  const [manualRole, setManualRole] = useState('')
  const [accessRole, setAccessRole] = useState<MembershipAccessRole>('member')
  const [roleLocked, setRoleLocked] = useState(false)
  const [departmentLocked, setDepartmentLocked] = useState(false)

  if (!admin) {
    return <p className="muted-copy">Worker prep stubs require owner or admin access.</p>
  }

  const save = () => {
    if (!email.trim()) return
    const deptName =
      catalogDeptId ? activeDepartments.find((d) => d.id === catalogDeptId)?.name ?? manualDept : manualDept
    const roleName = catalogRoleId ? activeRoles.find((r) => r.id === catalogRoleId)?.name ?? manualRole : manualRole

    const row = buildDraftOrganizationMemberRow(
      {
        email: email.trim(),
        displayName: displayName.trim(),
        roleTitle: roleName.trim() || 'Member',
        department: deptName.trim() || 'General',
        invitedRoleTitle: roleName.trim() || undefined,
        invitedDepartment: deptName.trim() || undefined,
        accessRole,
        roleLocked,
        departmentLocked,
      },
      {},
    )

    workspaceApi.addCompanyMember(activeOrgId, row)
    setEmail('')
    setDisplayName('')
    setManualDept('')
    setManualRole('')
    setCatalogDeptId('')
    setCatalogRoleId('')
    setRoleLocked(false)
    setDepartmentLocked(false)
  }

  return (
    <>
      <p className="muted-copy">
        Mock roster entries only—no outbound email. Uses placeholder user ids until accounts sync.
      </p>
      <div className="form-grid company-brain-mini-form">
        <label className="field-group">
          <span className="field-label">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@company.com" />
        </label>
        <label className="field-group">
          <span className="field-label">Display name (optional)</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex Rivera" />
        </label>
        <label className="field-group">
          <span className="field-label">Catalog department</span>
          <select value={catalogDeptId} onChange={(e) => setCatalogDeptId(e.target.value)}>
            <option value="">— Manual below —</option>
            {activeDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span className="field-label">Department override</span>
          <input value={manualDept} onChange={(e) => setManualDept(e.target.value)} placeholder="RevOps" />
        </label>
        <label className="field-group">
          <span className="field-label">Catalog role</span>
          <select value={catalogRoleId} onChange={(e) => setCatalogRoleId(e.target.value)}>
            <option value="">— Manual below —</option>
            {activeRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span className="field-label">Role override</span>
          <input value={manualRole} onChange={(e) => setManualRole(e.target.value)} placeholder="Solutions AE" />
        </label>
        <label className="field-group">
          <span className="field-label">Workspace access</span>
          <select value={accessRole} onChange={(e) => setAccessRole(e.target.value as MembershipAccessRole)}>
            <option value="member">member</option>
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label className="company-brain-check">
          <input type="checkbox" checked={roleLocked} onChange={(e) => setRoleLocked(e.target.checked)} />
          <span>Lock role selection at onboarding</span>
        </label>
        <label className="company-brain-check">
          <input
            type="checkbox"
            checked={departmentLocked}
            onChange={(e) => setDepartmentLocked(e.target.checked)}
          />
          <span>Lock department selection at onboarding</span>
        </label>
        <button type="button" className="primary-button" disabled={!email.trim()} onClick={save}>
          Save draft worker
        </button>
      </div>
    </>
  )
}
