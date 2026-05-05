import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useWorkspace } from '../context/useWorkspace'
import {
  canManageCompanyBrain,
  getMembershipForOrgUser,
} from '../data/companyBrainMutations'
import type {
  ApprovedMessagingItem,
  CaseStudyItem,
  CompanyBrainCatalogDepartment,
  CompanyBrainCatalogRole,
  CompanyKnowledgeItem,
  CompanyKnowledgeSourceType,
  KnowledgeApprovalStatus,
  KnowledgeVisibilityScope,
  MembershipAccessRole,
  ProductServiceItem,
} from '../types/models'
import { workspaceUserProfileFromAuth } from '../data/workspaceUserProfile'

type CompanyTab =
  | 'overview'
  | 'library'
  | 'review'
  | 'roles-depts'
  | 'brand'
  | 'messaging'
  | 'cases'
  | 'products'
  | 'members'
  | 'activity'

const TAB_LABELS: { id: CompanyTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'library', label: 'Knowledge Library' },
  { id: 'review', label: 'Needs Review' },
  { id: 'roles-depts', label: 'Roles & Departments' },
  { id: 'brand', label: 'Brand Kit' },
  { id: 'messaging', label: 'Approved Messaging' },
  { id: 'cases', label: 'Case Studies' },
  { id: 'products', label: 'Products & Services' },
  { id: 'members', label: 'Members' },
  { id: 'activity', label: 'Activity' },
]

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

export function CompanyBrainPage() {
  const { user, isLocalDevBypass } = useAuth()
  const profile = workspaceUserProfileFromAuth(user ?? null, isLocalDevBypass)
  const workspaceApi = useWorkspace()

  const { workspace } = workspaceApi
  const slice = workspace.companyBrain

  const [tab, setTab] = useState<CompanyTab>('overview')

  const activeOrgId = slice.activeOrganizationId || slice.organizations[0]?.id || ''
  const activeOrg = slice.organizations.find((o) => o.id === activeOrgId)

  const membership = useMemo(
    () =>
      activeOrgId ? getMembershipForOrgUser(workspace, activeOrgId, profile.userId) : undefined,
    [workspace, activeOrgId, profile.userId],
  )

  const admin = Boolean(activeOrgId && canManageCompanyBrain(workspace, activeOrgId, profile.userId))

  /** Knowledge Library tab local filters */
  const [kApproval, setKApproval] = useState<KnowledgeApprovalStatus | 'any'>('any')
  const [kSource, setKSource] = useState<CompanyKnowledgeSourceType | 'any'>('any')
  const [kDept, setKDept] = useState('')
  const [kTag, setKTag] = useState('')
  const [kMine, setKMine] = useState(false)
  const [gridView, setGridView] = useState(false)

  const knowledgeForOrg = slice.knowledgeItems.filter((k) => k.organizationId === activeOrgId)

  const filteredKnowledge = knowledgeForOrg.filter((k) => {
    if (kApproval !== 'any' && k.approvalStatus !== kApproval) {
      return false
    }
    if (kSource !== 'any' && k.sourceType !== kSource) {
      return false
    }
    const deptFilter = kDept.trim().toLowerCase()
    if (deptFilter) {
      const inAllowed = k.allowedDepartments?.some((d) => d.toLowerCase().includes(deptFilter))
      const inTags = k.tags.some((t) => t.toLowerCase().includes(deptFilter))
      if (!inAllowed && !inTags && !membership?.department?.toLowerCase().includes(deptFilter)) {
        return false
      }
    }
    const tagFilter = kTag.trim().toLowerCase()
    if (tagFilter && !k.tags.some((t) => t.toLowerCase().includes(tagFilter))) {
      return false
    }
    if (kMine && k.uploadedByUserId !== profile.userId) {
      return false
    }

    return true
  })

  const needsReview = knowledgeForOrg.filter((k) => k.approvalStatus === 'needs-review')

  const folders = slice.knowledgeFolders.filter((f) => f.organizationId === activeOrgId)
  const brandKit =
    slice.brandKits.find((b) => b.organizationId === activeOrgId) ?? null
  const messaging = slice.approvedMessaging.filter((m) => m.organizationId === activeOrgId)
  const caseStudies = slice.caseStudies.filter((c) => c.organizationId === activeOrgId)
  const products = slice.productsServices.filter((p) => p.organizationId === activeOrgId)
  const members = slice.organizationMemberships.filter((m) => m.organizationId === activeOrgId)
  const logs = slice.activityLogs.filter((l) => l.organizationId === activeOrgId)

  const deckFileOptions = workspace.fileAssets.filter((a) => a.deckId === workspace.activeDeckId)

  const handleOrgChange = (organizationId: string) => {
    workspaceApi.setCompanyActiveOrganization(organizationId)
  }

  if (!activeOrgId || !activeOrg) {
    return (
      <section className="page page--company">
        <div className="company-brain-empty panel-card">
          <h2>Company Brain</h2>
          <p className="muted-copy">
            Create a company workspace from the dashboard setup prompt, or continue without one—your decks are
            unaffected.
          </p>
          <Link to="/dashboard" className="secondary-button">
            Back to dashboard
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page page--company">
      <header className="company-brain-header">
        <div>
          <span className="section-label">Company workspace</span>
          <h2>Company Brain</h2>
          <p className="muted-copy">
            Org memory, brand, and messaging scaffolding—local/mock for now, with Supabase tables ready for
            future sync.
          </p>
        </div>
        <div className="company-brain-org-row">
          <label className="field-group company-brain-org-select">
            <span className="field-label">Active organization</span>
            <select
              value={activeOrgId}
              onChange={(e) => handleOrgChange(e.target.value)}
              aria-label="Active organization"
            >
              {slice.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <Link className="ghost-button" to="/dashboard">
            Workspace
          </Link>
        </div>
      </header>

      <div className="company-brain-tabs" role="tablist" aria-label="Company Brain sections">
        {TAB_LABELS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="panel-card company-brain-panel">
          <h3>Overview</h3>
          <div className="company-brain-metrics">
            <div>
              <span className="muted-copy">Your access</span>
              <strong>{membership?.accessRole ?? 'viewer'}</strong>
            </div>
            <div>
              <span className="muted-copy">Knowledge items</span>
              <strong>{knowledgeForOrg.length}</strong>
            </div>
            <div>
              <span className="muted-copy">Needs review</span>
              <strong>{needsReview.length}</strong>
            </div>
            <div>
              <span className="muted-copy">Members</span>
              <strong>{members.length}</strong>
            </div>
          </div>
          <p className="muted-copy">
            Membership role and department drive visibility rules in the knowledge library. Use the Roles &
            Departments tab for Company-managed catalogs. Build suggests knowledge that fits your pitch brief.
          </p>
        </div>
      ) : null}

      {tab === 'library' ? (
        <KnowledgeLibrarySection
          activeOrgId={activeOrgId}
          profileUserId={profile.userId}
          admin={admin}
          gridView={gridView}
          setGridView={setGridView}
          kApproval={kApproval}
          setKApproval={setKApproval}
          kSource={kSource}
          setKSource={setKSource}
          kDept={kDept}
          setKDept={setKDept}
          kTag={kTag}
          setKTag={setKTag}
          kMine={kMine}
          setKMine={setKMine}
          filteredKnowledge={filteredKnowledge}
          folders={folders}
          deckFileOptions={deckFileOptions}
          workspaceApi={workspaceApi}
        />
      ) : null}

      {tab === 'review' ? (
        <div className="panel-card company-brain-panel">
          <h3>Needs review</h3>
          <KnowledgeList
            items={needsReview}
            admin={admin}
            profileUserId={profile.userId}
            workspaceApi={workspaceApi}
            activeOrgId={activeOrgId}
          />
        </div>
      ) : null}

      {tab === 'roles-depts' ? (
        <RolesDepartmentsCatalogTab
          activeOrgId={activeOrgId}
          admin={admin}
          departments={slice.companyDepartments.filter((row) => row.organizationId === activeOrgId)}
          roles={slice.companyRoles.filter((row) => row.organizationId === activeOrgId)}
          workspaceApi={workspaceApi}
        />
      ) : null}

      {tab === 'brand' ? (
        <BrandKitSection
          activeOrgId={activeOrgId}
          organizationName={activeOrg?.name ?? ''}
          brandKit={brandKit}
          deckFileOptions={deckFileOptions}
          workspaceApi={workspaceApi}
        />
      ) : null}

      {tab === 'messaging' ? (
        <MessagingSection activeOrgId={activeOrgId} items={messaging} workspaceApi={workspaceApi} />
      ) : null}

      {tab === 'cases' ? (
        <CaseStudySection activeOrgId={activeOrgId} items={caseStudies} workspaceApi={workspaceApi} />
      ) : null}

      {tab === 'products' ? (
        <ProductSection activeOrgId={activeOrgId} items={products} workspaceApi={workspaceApi} />
      ) : null}

      {tab === 'members' ? (
        <MembersSection
          activeOrgId={activeOrgId}
          members={members}
          admin={admin}
          workspaceApi={workspaceApi}
        />
      ) : null}

      {tab === 'activity' ? (
        <div className="panel-card company-brain-panel">
          <h3>Activity</h3>
          {admin ? (
            <ul className="company-brain-activity">
              {logs.length === 0 ? <li className="muted-copy">No activity yet.</li> : null}
              {logs.map((log) => (
                <li key={log.id}>
                  <span className="company-brain-activity__kind">{log.kind}</span>
                  <span className="muted-copy">{new Date(log.createdAt).toLocaleString()}</span>
                  <div>{log.detail}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">Owners and admins can view the full activity log.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function RolesDepartmentsCatalogTab({
  activeOrgId,
  admin,
  roles,
  departments,
  workspaceApi,
}: {
  activeOrgId: string
  admin: boolean
  roles: CompanyBrainCatalogRole[]
  departments: CompanyBrainCatalogDepartment[]
  workspaceApi: ReturnType<typeof useWorkspace>
}) {
  const [departmentNameDraft, setDepartmentNameDraft] = useState('')
  const [departmentDescDraft, setDepartmentDescDraft] = useState('')
  const [roleNameDraft, setRoleNameDraft] = useState('')
  const [roleDescDraft, setRoleDescDraft] = useState('')
  const [defaultDepartmentIdDraft, setDefaultDepartmentIdDraft] = useState('')

  const activeDepartments = departments.filter((row) => !row.archived)
  const archivedDepartments = departments.filter((row) => row.archived)
  const activeRoles = roles.filter((row) => !row.archived)
  const archivedRoles = roles.filter((row) => row.archived)

  return (
    <div className="panel-card company-brain-panel company-brain-org-catalog">
      <h3>Company structure</h3>
      <p className="muted-copy">
        Company-managed roles and Company departments control what coworkers pick during workspace setup—local/mock
        for now.
      </p>

      <div className="company-brain-org-catalog__sections">
        <section className="company-brain-org-catalog__block">
          <h4>Company departments</h4>
          {!admin ? (
            <p className="muted-copy">Owners and admins can add, edit, and archive departments.</p>
          ) : (
            <>
              <div className="form-grid company-brain-mini-form">
                <label className="field-group">
                  <span className="field-label">Department name</span>
                  <input
                    value={departmentNameDraft}
                    onChange={(e) => setDepartmentNameDraft(e.target.value)}
                    placeholder="Engineering"
                  />
                </label>
                <label className="field-group field-group--wide">
                  <span className="field-label">Description (optional)</span>
                  <input
                    value={departmentDescDraft}
                    onChange={(e) => setDepartmentDescDraft(e.target.value)}
                    placeholder="Technical product development"
                  />
                </label>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!departmentNameDraft.trim()}
                  onClick={() => {
                    workspaceApi.upsertCompanyCatalogDepartment(activeOrgId, {
                      name: departmentNameDraft.trim(),
                      description: departmentDescDraft.trim() || undefined,
                    })
                    setDepartmentNameDraft('')
                    setDepartmentDescDraft('')
                  }}
                >
                  Add department
                </button>
              </div>
            </>
          )}
          <ul className="company-brain-inline-list">
            {activeDepartments.map((row) => (
              <li key={row.id}>
                <span>
                  <strong>{row.name}</strong>
                  {row.description ? <span className="muted-copy"> — {row.description}</span> : null}
                </span>
                {!admin ? null : (
                  <span className="company-brain-inline-list__actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        const next = window.prompt('Department name', row.name)
                        if (!next?.trim()) {
                          return
                        }
                        workspaceApi.upsertCompanyCatalogDepartment(activeOrgId, {
                          id: row.id,
                          name: next.trim(),
                          description: row.description,
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => workspaceApi.archiveCompanyCatalogDepartment(activeOrgId, row.id)}
                    >
                      Archive
                    </button>
                  </span>
                )}
              </li>
            ))}
            {activeDepartments.length === 0 ? (
              <li className="muted-copy">No active departments configured.</li>
            ) : null}
          </ul>

          {!archivedDepartments.length ? null : (
            <details className="company-brain-collapsed-detail">
              <summary>Archived departments ({archivedDepartments.length})</summary>
              <ul className="company-brain-inline-list">
                {archivedDepartments.map((row) => (
                  <li key={row.id} className="muted-copy">
                    {row.name}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="company-brain-org-catalog__block">
          <h4>Company-managed roles</h4>
          {!admin ? (
            <p className="muted-copy">Owners and admins can add, edit, and archive roles.</p>
          ) : (
            <>
              <div className="form-grid company-brain-mini-form">
                <label className="field-group">
                  <span className="field-label">Role title</span>
                  <input
                    value={roleNameDraft}
                    onChange={(e) => setRoleNameDraft(e.target.value)}
                    placeholder="Account Executive"
                  />
                </label>
                <label className="field-group field-group--wide">
                  <span className="field-label">Description (optional)</span>
                  <input
                    value={roleDescDraft}
                    onChange={(e) => setRoleDescDraft(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span className="field-label">Default department (optional)</span>
                  <select
                    value={defaultDepartmentIdDraft}
                    onChange={(e) => setDefaultDepartmentIdDraft(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {activeDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!roleNameDraft.trim()}
                  onClick={() => {
                    workspaceApi.upsertCompanyCatalogRole(activeOrgId, {
                      name: roleNameDraft.trim(),
                      description: roleDescDraft.trim() || undefined,
                      defaultDepartmentId: defaultDepartmentIdDraft || undefined,
                    })
                    setRoleNameDraft('')
                    setRoleDescDraft('')
                    setDefaultDepartmentIdDraft('')
                  }}
                >
                  Add role
                </button>
              </div>
            </>
          )}
          <ul className="company-brain-inline-list">
            {activeRoles.map((row) => (
              <li key={row.id}>
                <span>
                  <strong>{row.name}</strong>
                  {row.description ? <span className="muted-copy"> — {row.description}</span> : null}
                </span>
                {!admin ? null : (
                  <span className="company-brain-inline-list__actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        const next = window.prompt('Role title', row.name)
                        if (!next?.trim()) {
                          return
                        }
                        workspaceApi.upsertCompanyCatalogRole(activeOrgId, {
                          id: row.id,
                          name: next.trim(),
                          description: row.description,
                          defaultDepartmentId: row.defaultDepartmentId,
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => workspaceApi.archiveCompanyCatalogRole(activeOrgId, row.id)}
                    >
                      Archive
                    </button>
                  </span>
                )}
              </li>
            ))}
            {activeRoles.length === 0 ? (
              <li className="muted-copy">No active roles configured.</li>
            ) : null}
          </ul>

          {!archivedRoles.length ? null : (
            <details className="company-brain-collapsed-detail">
              <summary>Archived roles ({archivedRoles.length})</summary>
              <ul className="company-brain-inline-list">
                {archivedRoles.map((row) => (
                  <li key={row.id} className="muted-copy">
                    {row.name}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </div>
  )
}

function KnowledgeLibrarySection({
  activeOrgId,
  profileUserId,
  admin,
  gridView,
  setGridView,
  kApproval,
  setKApproval,
  kSource,
  setKSource,
  kDept,
  setKDept,
  kTag,
  setKTag,
  kMine,
  setKMine,
  filteredKnowledge,
  folders,
  deckFileOptions,
  workspaceApi,
}: {
  activeOrgId: string
  profileUserId: string
  admin: boolean
  gridView: boolean
  setGridView: (v: boolean) => void
  kApproval: KnowledgeApprovalStatus | 'any'
  setKApproval: (v: KnowledgeApprovalStatus | 'any') => void
  kSource: CompanyKnowledgeSourceType | 'any'
  setKSource: (v: CompanyKnowledgeSourceType | 'any') => void
  kDept: string
  setKDept: (v: string) => void
  kTag: string
  setKTag: (v: string) => void
  kMine: boolean
  setKMine: (v: boolean) => void
  filteredKnowledge: CompanyKnowledgeItem[]
  folders: { id: string; name: string }[]
  deckFileOptions: { id: string; name: string }[]
  workspaceApi: ReturnType<typeof useWorkspace>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState<CompanyKnowledgeSourceType>('notes')
  const [tagsRaw, setTagsRaw] = useState('')
  const [folderId, setFolderId] = useState<string>('')
  const [visibility, setVisibility] = useState<KnowledgeVisibilityScope>('company')
  const [approvalStatus, setApprovalStatus] = useState<KnowledgeApprovalStatus>('needs-review')
  const [allowedDepartmentsRaw, setAllowedDepartmentsRaw] = useState('')
  const [allowedRolesRaw, setAllowedRolesRaw] = useState('')
  const [fileAssetId, setFileAssetId] = useState<string>('')

  const registerItem = () => {
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
      allowedDepartments: allowedDepartmentsRaw
        ? allowedDepartmentsRaw.split(',').map((d) => d.trim()).filter(Boolean)
        : undefined,
      allowedRoleTitles: allowedRolesRaw
        ? allowedRolesRaw.split(',').map((d) => d.trim()).filter(Boolean)
        : undefined,
      fileAssetId: fileAssetId || undefined,
    })
    setTitle('')
    setDescription('')
    setTagsRaw('')
  }

  const newFolder = () => {
    const name = window.prompt('Folder name')
    if (!name?.trim()) {
      return
    }
    workspaceApi.upsertCompanyKnowledgeFolder(activeOrgId, { name: name.trim() })
  }

  return (
    <div className="panel-card company-brain-panel">
      <div className="company-brain-panel__toolbar">
        <h3>Knowledge Library</h3>
        <div className="company-brain-toggle">
          <button
            type="button"
            className={gridView ? 'ghost-button' : 'secondary-button'}
            onClick={() => setGridView(false)}
          >
            List
          </button>
          <button
            type="button"
            className={gridView ? 'secondary-button' : 'ghost-button'}
            onClick={() => setGridView(true)}
          >
            Grid
          </button>
        </div>
      </div>

      <div className="form-grid company-brain-register">
        <label className="field-group">
          <span className="field-label">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Executive briefing" />
        </label>

        <label className="field-group field-group--wide">
          <span className="field-label">Description</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
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
          <span className="field-label">Tags (comma-separated)</span>
          <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="expansion, slg" />
        </label>

        <label className="field-group">
          <span className="field-label">Folder</span>
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">— None —</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="ghost-button" onClick={newFolder}>
          New folder
        </button>

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
          <span className="field-label">Approval status</span>
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

        <label className="field-group">
          <span className="field-label">Allowed departments</span>
          <input
            value={allowedDepartmentsRaw}
            onChange={(e) => setAllowedDepartmentsRaw(e.target.value)}
            placeholder="cs, onboarding"
          />
        </label>

        <label className="field-group">
          <span className="field-label">Allowed role titles</span>
          <input
            value={allowedRolesRaw}
            onChange={(e) => setAllowedRolesRaw(e.target.value)}
            placeholder="AES, Managers"
          />
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
          <button type="button" className="primary-button" disabled={!title.trim()} onClick={registerItem}>
            Register knowledge item
          </button>
          {!deckFileOptions.length ? (
            <p className="muted-copy helper-inset">
              Open a deck in Build and attach sources—or skip file linking for purely narrative entries.
            </p>
          ) : null}
        </div>
      </div>

      <div className="company-brain-filters">
        <label>
          <span>Approval</span>
          <select value={kApproval} onChange={(e) => setKApproval(e.target.value as typeof kApproval)}>
            <option value="any">Any</option>
            <option value="approved">Approved</option>
            <option value="needs-review">Needs review</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          <span>Source</span>
          <select value={kSource} onChange={(e) => setKSource(e.target.value as typeof kSource)}>
            <option value="any">Any</option>
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Department overlap</span>
          <input value={kDept} onChange={(e) => setKDept(e.target.value)} placeholder="cs" />
        </label>
        <label>
          <span>Tag contains</span>
          <input value={kTag} onChange={(e) => setKTag(e.target.value)} />
        </label>
        <label className="company-brain-check">
          <input type="checkbox" checked={kMine} onChange={(e) => setKMine(e.target.checked)} />
          <span>Uploaded by me</span>
        </label>
      </div>

      <KnowledgeList
        items={filteredKnowledge}
        variant={gridView ? 'grid' : 'list'}
        admin={admin}
        profileUserId={profileUserId}
        workspaceApi={workspaceApi}
        activeOrgId={activeOrgId}
      />
      {!filteredKnowledge.length ? <p className="muted-copy">No items match filters.</p> : null}
    </div>
  )
}

function KnowledgeList({
  items,
  variant = 'list',
  admin,
  profileUserId,
  workspaceApi,
  activeOrgId,
}: {
  items: CompanyKnowledgeItem[]
  variant?: 'grid' | 'list'
  admin: boolean
  profileUserId: string
  workspaceApi: ReturnType<typeof useWorkspace>
  activeOrgId: string
}) {
  return (
    <ul className={variant === 'grid' ? 'company-brain-grid' : 'company-brain-list'}>
      {items.map((item) => (
        <li key={item.id} className="company-brain-card">
          <header>
            <strong>{item.title}</strong>
            <span className={`company-chip company-chip--${item.approvalStatus}`}>{item.approvalStatus}</span>
          </header>
          <p className="muted-copy">{item.description || 'No description.'}</p>
          <footer>
            <span className="muted-copy">
              {item.sourceType} · {item.visibility}
            </span>
            <div className="company-brain-actions">
              {admin ? (
                <>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      workspaceApi.setCompanyKnowledgeApproval(activeOrgId, item.id, 'approved', 'Approved')
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      workspaceApi.setCompanyKnowledgeApproval(activeOrgId, item.id, 'rejected', 'Rejected')
                    }
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      workspaceApi.setCompanyKnowledgeApproval(activeOrgId, item.id, 'archived', 'Archived')
                    }
                  >
                    Archive
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="ghost-button"
                onClick={() => workspaceApi.markCompanyKnowledgeReviewed(activeOrgId, item.id)}
              >
                Mark reviewed
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  const next = window.prompt('Rename knowledge item', item.title)
                  if (!next?.trim()) {
                    return
                  }
                  workspaceApi.upsertCompanyKnowledgeItem(activeOrgId, {
                    id: item.id,
                    title: next.trim(),
                    description: item.description,
                    tags: item.tags,
                    visibility: item.visibility,
                    approvalStatus: item.approvalStatus,
                    sourceType: item.sourceType,
                    folderId: item.folderId,
                    fileAssetId: item.fileAssetId,
                    allowedDepartments: item.allowedDepartments,
                    allowedRoleTitles: item.allowedRoleTitles,
                  })
                }}
              >
                Rename
              </button>
              {(admin || item.uploadedByUserId === profileUserId) && item.approvalStatus === 'needs-review' ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() =>
                    workspaceApi.deleteCompanyKnowledgeItem(activeOrgId, item.id)
                  }
                >
                  Delete
                </button>
              ) : admin ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() =>
                    workspaceApi.deleteCompanyKnowledgeItem(activeOrgId, item.id)
                  }
                >
                  Delete
                </button>
              ) : null}
            </div>
          </footer>
        </li>
      ))}
    </ul>
  )
}

function BrandKitSection({
  activeOrgId,
  organizationName,
  brandKit,
  deckFileOptions,
  workspaceApi,
}: {
  activeOrgId: string
  organizationName: string
  brandKit: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    fontFamily: string
    defaultDeckTone: string
    logoAssetId?: string
    id?: string
  } | null
  deckFileOptions: { id: string; name: string }[]
  workspaceApi: ReturnType<typeof useWorkspace>
}) {
  const [primary, setPrimary] = useState(brandKit?.primaryColor ?? '#111827')
  const [secondary, setSecondary] = useState(brandKit?.secondaryColor ?? '#6b7280')
  const [accent, setAccent] = useState(brandKit?.accentColor ?? '#2563eb')
  const [fontFamily, setFontFamily] = useState(brandKit?.fontFamily ?? 'system-ui')
  const [tone, setTone] = useState(brandKit?.defaultDeckTone ?? '')
  const [logoId, setLogoId] = useState(brandKit?.logoAssetId ?? '')

  const handleSave = () => {
    workspaceApi.upsertCompanyBrandKit(activeOrgId, {
      id: brandKit?.id,
      primaryColor: primary,
      secondaryColor: secondary,
      accentColor: accent,
      fontFamily,
      defaultDeckTone: tone,
      logoAssetId: logoId || undefined,
    })
  }

  const logoPickLabel = deckFileOptions.find((f) => f.id === logoId)?.name

  return (
    <div className="panel-card company-brain-panel">
      <h3>Brand Kit</h3>
      <p className="muted-copy">
        Saved tokens for <strong>{organizationName || 'your organization'}</strong>. Pitches use them when
        &quot;Apply organization Brand Kit&quot; is turned on in Build Pitch Deck: mock generation writes
        colors and fonts into slide blocks, PPTX export maps those styles, and Intel Brief previews pick up
        light header accents.
      </p>

      <div
        className="panel-card"
        style={{
          marginTop: '14px',
          marginBottom: '18px',
          padding: '14px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <span className="field-label" style={{ width: '100%' }}>
          Live preview
        </span>
        <span
          title="Primary"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: primary,
            border: '1px solid rgba(24,32,45,0.12)',
          }}
        />
        <span
          title="Secondary"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: secondary,
            border: '1px solid rgba(24,32,45,0.12)',
          }}
        />
        <span
          title="Accent"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: accent,
            border: '1px solid rgba(24,32,45,0.12)',
          }}
        />
        <span style={{ fontFamily, fontSize: '18px', fontWeight: 600 }}>Aa {fontFamily}</span>
        <span className="muted-copy" style={{ flex: '1 1 220px' }}>
          Logo:{' '}
          {logoId
            ? logoPickLabel ?? `Asset ${logoId.slice(0, 8)}…`
            : `none selected — decks fall back to a text mark (${organizationName || 'org name'}) when no image preview exists.`}
        </span>
      </div>

      <div className="form-grid">
        <label className="field-group">
          <span className="field-label">Primary</span>
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
        </label>
        <label className="field-group">
          <span className="field-label">Secondary</span>
          <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
        </label>
        <label className="field-group">
          <span className="field-label">Accent</span>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
        </label>
        <label className="field-group">
          <span className="field-label">Font family</span>
          <input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Default deck tone</span>
          <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Confident & concise" />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Logo from current workspace deck files</span>
          <select value={logoId} onChange={(e) => setLogoId(e.target.value)}>
            <option value="">None</option>
            {deckFileOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary-button" onClick={handleSave}>
          Save brand kit
        </button>
      </div>
    </div>
  )
}

function MessagingSection({
  activeOrgId,
  items,
  workspaceApi,
}: {
  activeOrgId: string
  items: ApprovedMessagingItem[]
  workspaceApi: ReturnType<typeof useWorkspace>
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('Playbook')
  const [tags, setTags] = useState('')

  return (
    <div className="panel-card company-brain-panel">
      <h3>Approved messaging</h3>
      <div className="form-grid">
        <label className="field-group">
          <span className="field-label">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field-group">
          <span className="field-label">Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Content</span>
          <textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Tags</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <button
          type="button"
          className="primary-button"
          disabled={!title.trim()}
          onClick={() => {
            workspaceApi.upsertCompanyApprovedMessaging(activeOrgId, {
              title,
              content,
              category,
              tags: tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              approvalStatus: 'approved',
            })
            setTitle('')
            setContent('')
          }}
        >
          Save messaging snippet
        </button>
      </div>
      <ul className="company-brain-list">
        {items.map((msg) => (
          <li key={msg.id} className="company-brain-card">
            <strong>{msg.title}</strong>
            <p className="muted-copy">{msg.content}</p>
            <footer>
              <button
                type="button"
                className="ghost-button"
                onClick={() => workspaceApi.deleteCompanyApprovedMessaging(activeOrgId, msg.id)}
              >
                Archive / delete
              </button>
            </footer>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CaseStudySection({
  activeOrgId,
  items,
  workspaceApi,
}: {
  activeOrgId: string
  items: CaseStudyItem[]
  workspaceApi: ReturnType<typeof useWorkspace>
}) {
  const [draft, setDraft] = useState<Omit<CaseStudyItem, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>({
    title: '',
    customerName: '',
    industry: '',
    challenge: '',
    solution: '',
    outcome: '',
    approvedQuote: '',
    sourceKnowledgeItemIds: [],
  })

  return (
    <div className="panel-card company-brain-panel">
      <h3>Case studies</h3>
      <div className="form-grid">
        {(['title', 'customerName', 'industry'] as const).map((field) => (
          <label key={field} className="field-group">
            <span className="field-label">{field}</span>
            <input
              value={draft[field]}
              onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
            />
          </label>
        ))}
        {(['challenge', 'solution', 'outcome'] as const).map((field) => (
          <label key={field} className="field-group field-group--wide">
            <span className="field-label">{field}</span>
            <textarea
              rows={3}
              value={draft[field]}
              onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
            />
          </label>
        ))}
        <button
          type="button"
          className="primary-button"
          disabled={!draft.title.trim()}
          onClick={() => {
            workspaceApi.upsertCompanyCaseStudy(activeOrgId, draft)
            setDraft({
              title: '',
              customerName: '',
              industry: '',
              challenge: '',
              solution: '',
              outcome: '',
              approvedQuote: '',
              sourceKnowledgeItemIds: [],
            })
          }}
        >
          Save case study
        </button>
      </div>
      <ul className="company-brain-list">
        {items.map((cs) => (
          <li key={cs.id} className="company-brain-card">
            <strong>{cs.title}</strong>
            <p className="muted-copy">
              {cs.customerName} · {cs.industry}
            </p>
            <footer>
              <button
                type="button"
                className="ghost-button"
                onClick={() => workspaceApi.deleteCompanyCaseStudy(activeOrgId, cs.id)}
              >
                Delete
              </button>
            </footer>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProductSection({
  activeOrgId,
  items,
  workspaceApi,
}: {
  activeOrgId: string
  items: ProductServiceItem[]
  workspaceApi: ReturnType<typeof useWorkspace>
}) {
  const [draft, setDraft] = useState<Omit<ProductServiceItem, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>(
    {
      name: '',
      description: '',
      targetBuyer: '',
      keyBenefits: [],
      proofPoints: [],
      commonObjections: [],
    },
  )

  const [benefitsLines, setBenefitsLines] = useState('')
  const [proofLines, setProofLines] = useState('')
  const [objectionsLines, setObjectionsLines] = useState('')

  const save = () => {
    workspaceApi.upsertCompanyProductService(activeOrgId, {
      ...draft,
      keyBenefits: benefitsLines.split('\n').map((line) => line.trim()).filter(Boolean),
      proofPoints: proofLines.split('\n').map((line) => line.trim()).filter(Boolean),
      commonObjections: objectionsLines.split('\n').map((line) => line.trim()).filter(Boolean),
    })
    setDraft({
      name: '',
      description: '',
      targetBuyer: '',
      keyBenefits: [],
      proofPoints: [],
      commonObjections: [],
    })
    setBenefitsLines('')
    setProofLines('')
    setObjectionsLines('')
  }

  return (
    <div className="panel-card company-brain-panel">
      <h3>Products & services</h3>
      <div className="form-grid">
        <label className="field-group">
          <span className="field-label">Name</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="field-group">
          <span className="field-label">Primary buyer</span>
          <input
            value={draft.targetBuyer}
            onChange={(e) => setDraft({ ...draft, targetBuyer: e.target.value })}
          />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Description</span>
          <textarea
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Key benefits (one per line)</span>
          <textarea rows={3} value={benefitsLines} onChange={(e) => setBenefitsLines(e.target.value)} />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Proof points (one per line)</span>
          <textarea rows={3} value={proofLines} onChange={(e) => setProofLines(e.target.value)} />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Common objections (one per line)</span>
          <textarea
            rows={3}
            value={objectionsLines}
            onChange={(e) => setObjectionsLines(e.target.value)}
          />
        </label>
        <button type="button" className="primary-button" disabled={!draft.name.trim()} onClick={save}>
          Save offering
        </button>
      </div>
      <ul className="company-brain-list">
        {items.map((product) => (
          <li key={product.id} className="company-brain-card">
            <strong>{product.name}</strong>
            <p className="muted-copy">{product.description}</p>
            <footer>
              <button
                type="button"
                className="ghost-button"
                onClick={() => workspaceApi.deleteCompanyProductService(activeOrgId, product.id)}
              >
                Delete
              </button>
            </footer>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MembersSection({
  activeOrgId,
  members,
  admin,
  workspaceApi,
}: {
  activeOrgId: string
  members: { id: string; displayName: string; email: string; accessRole: MembershipAccessRole }[]
  admin: boolean
  workspaceApi: ReturnType<typeof useWorkspace>
}) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [accessRole, setAccessRole] = useState<MembershipAccessRole>('member')

  return (
    <div className="panel-card company-brain-panel">
      <h3>Members</h3>
      {!admin ? <p className="muted-copy">Only owners and admins manage membership in this scaffold.</p> : null}

      <ul className="company-brain-list">
        {members.map((memberRow) => (
          <li key={memberRow.id} className="company-brain-card">
            <strong>{memberRow.displayName}</strong>
            <div className="muted-copy">{memberRow.email}</div>
            <span className={`company-chip company-chip--approved`}>{memberRow.accessRole}</span>
          </li>
        ))}
      </ul>

      {admin ? (
        <>
          <h4>Add member (mock id)</h4>
          <p className="muted-copy">
            For local scaffolding, collaborators are placeholders until Supabase memberships sync accounts.
          </p>
          <div className="form-grid">
            <label className="field-group">
              <span className="field-label">Name</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">Title</span>
              <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">Department</span>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </label>
            <label className="field-group">
              <span className="field-label">Role</span>
              <select
                value={accessRole}
                onChange={(e) => setAccessRole(e.target.value as MembershipAccessRole)}
              >
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={!displayName.trim() || !email.trim()}
              onClick={() => {
                workspaceApi.addCompanyMember(activeOrgId, {
                  userId: `placeholder-${crypto.randomUUID()}`,
                  email,
                  displayName,
                  roleTitle,
                  department,
                  accessRole,
                })
                setDisplayName('')
                setEmail('')
              }}
            >
              Register member stub
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
