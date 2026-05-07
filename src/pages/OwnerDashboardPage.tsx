import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RolesDepartmentsCatalogTab } from '../components/companyBrain/RolesDepartmentsCatalogTab'
import {
  OwnerAiOrganizationSection,
  OwnerFolderStructureSection,
  OwnerKnowledgeMoveSection,
  OwnerKnowledgeUploadSection,
  OwnerWorkerPrepSection,
} from '../components/owner/OwnerConsolePanels'
import { useAuth } from '../context/useAuth'
import { useWorkspace } from '../context/useWorkspace'
import { canManageCompanyBrain, getMembershipForOrgUser } from '../data/companyBrainMutations'
import { suggestCompanyKnowledgeOrganization } from '../data/companyKnowledgeOrganization'
import { loadDemoWorkspaceLocally, resetDemoWorkspaceLocally } from '../data/demoWorkspaceActions'
import { seedWorkspaceState } from '../data/mockWorkspace'
import { workspaceUserProfileFromAuth } from '../data/workspaceUserProfile'
import { useToast } from '../components/feedback/toastContext'
import { formatShortDate } from '../utils/formatters'
import type {
  ApprovedMessagingItem,
  CaseStudyItem,
  CompanyKnowledgeItem,
  CompanyKnowledgeSourceType,
  KnowledgeApprovalStatus,
  ProductServiceItem,
} from '../types/models'

type OwnerSection =
  | 'knowledge-library'
  | 'folder-organizer'
  | 'team-roles'
  | 'brand-kit'
  | 'messaging'
  | 'case-studies'
  | 'products'
  | 'activity-settings'

type KnowledgeSubsection =
  | 'all'
  | 'needs-review'
  | 'approved'
  | 'archived'
  | 'folders'
  | 'upload'

type FolderSubsection = 'tree' | 'move-items' | 'suggestions'
type TeamSubsection = 'workers' | 'invites' | 'roles' | 'departments'

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

const OWNER_MODULES: Array<{ id: OwnerSection; title: string; description: string }> = [
  {
    id: 'knowledge-library',
    title: 'Knowledge Library',
    description: 'Search, review, register, and curate company documents.',
  },
  {
    id: 'folder-organizer',
    title: 'Folder Organizer',
    description: 'Manage nested folder structure, moves, and staged organization suggestions.',
  },
  {
    id: 'team-roles',
    title: 'Team & Roles',
    description: 'Prepare worker invites and maintain role/department catalogs.',
  },
  {
    id: 'brand-kit',
    title: 'Brand Kit',
    description: 'Configure colors, typography, and logo defaults for generated decks.',
  },
  {
    id: 'messaging',
    title: 'Approved Messaging',
    description: 'Maintain reusable approved snippets for sales and onboarding narratives.',
  },
  {
    id: 'case-studies',
    title: 'Case Studies',
    description: 'Store approved customer outcomes and proof statements for reuse.',
  },
  {
    id: 'products',
    title: 'Products & Services',
    description: 'Capture offerings, benefits, proof points, and common objections.',
  },
  {
    id: 'activity-settings',
    title: 'Activity & Settings',
    description: 'Run cloud sync controls, review recent activity, and use demo tools.',
  },
]

export function OwnerDashboardPage() {
  const auth = useAuth()
  const workspaceApi = useWorkspace()
  const { showToast } = useToast()
  const { workspace } = workspaceApi
  const profile = workspaceUserProfileFromAuth(auth.user ?? null, auth.isLocalDevBypass)

  const orgId = workspace.companyBrain.activeOrganizationId
  const organization = workspace.companyBrain.organizations.find((o) => o.id === orgId)
  const membership = orgId ? getMembershipForOrgUser(workspace, orgId, profile.userId) : undefined
  const admin = Boolean(orgId && canManageCompanyBrain(workspace, orgId, profile.userId))

  const knowledgeItems = useMemo(
    () => workspace.companyBrain.knowledgeItems.filter((k) => k.organizationId === orgId),
    [orgId, workspace.companyBrain.knowledgeItems],
  )

  const folders = useMemo(
    () => workspace.companyBrain.knowledgeFolders.filter((f) => f.organizationId === orgId),
    [orgId, workspace.companyBrain.knowledgeFolders],
  )

  const departments = useMemo(
    () => workspace.companyBrain.companyDepartments.filter((d) => d.organizationId === orgId),
    [orgId, workspace.companyBrain.companyDepartments],
  )

  const catalogRoles = useMemo(
    () => workspace.companyBrain.companyRoles.filter((r) => r.organizationId === orgId),
    [orgId, workspace.companyBrain.companyRoles],
  )

  const suggestionPlan = useMemo(() => suggestCompanyKnowledgeOrganization(knowledgeItems), [knowledgeItems])

  const deckFileOptions = workspace.fileAssets.filter((a) => a.deckId === workspace.activeDeckId)

  const activity = workspace.companyBrain.activityLogs.filter((a) => a.organizationId === orgId).slice(0, 8)
  const needsReviewCount = knowledgeItems.filter((k) => k.approvalStatus === 'needs-review').length
  const workerCount = workspace.companyBrain.organizationMemberships.filter((m) => m.organizationId === orgId).length
  const messaging = workspace.companyBrain.approvedMessaging.filter((m) => m.organizationId === orgId)
  const caseStudies = workspace.companyBrain.caseStudies.filter((c) => c.organizationId === orgId)
  const products = workspace.companyBrain.productsServices.filter((p) => p.organizationId === orgId)
  const brandKit = workspace.companyBrain.brandKits.find((b) => b.organizationId === orgId) ?? null
  const syncStatus = workspaceApi.companyIdentitySyncStatus
  const knowledgeSyncStatus = workspaceApi.companyKnowledgeSyncStatus
  const librarySyncStatus = workspaceApi.companyLibrarySyncStatus

  const syncLabel =
    syncStatus.state === 'local-only'
      ? 'Local only'
      : syncStatus.state === 'saving'
        ? 'Saving...'
        : syncStatus.state === 'unsaved'
          ? 'Unsaved changes'
          : syncStatus.state === 'save-failed'
            ? 'Save failed'
            : 'Saved'

  const knowledgeSyncLabel =
    knowledgeSyncStatus.state === 'local-only'
      ? 'Local only'
      : knowledgeSyncStatus.state === 'saving'
        ? 'Saving...'
        : knowledgeSyncStatus.state === 'unsaved'
          ? 'Unsaved changes'
          : knowledgeSyncStatus.state === 'save-failed'
            ? 'Save failed'
            : 'Saved'

  const librarySyncLabel =
    librarySyncStatus.state === 'local-only'
      ? 'Local only'
      : librarySyncStatus.state === 'saving'
        ? 'Saving...'
        : librarySyncStatus.state === 'unsaved'
          ? 'Unsaved changes'
          : librarySyncStatus.state === 'save-failed'
            ? 'Save failed'
            : 'Saved'

  const [activeOwnerSection, setActiveOwnerSection] = useState<OwnerSection | null>(null)
  const [knowledgeSubsection, setKnowledgeSubsection] = useState<KnowledgeSubsection>('all')
  const [folderSubsection, setFolderSubsection] = useState<FolderSubsection>('tree')
  const [teamSubsection, setTeamSubsection] = useState<TeamSubsection>('workers')
  const [knowledgeSearch, setKnowledgeSearch] = useState('')
  const [knowledgeSourceFilter, setKnowledgeSourceFilter] = useState<CompanyKnowledgeSourceType | 'any'>('any')
  const [knowledgeStatusFilter, setKnowledgeStatusFilter] = useState<KnowledgeApprovalStatus | 'any'>('any')
  const [knowledgeFolderFilter, setKnowledgeFolderFilter] = useState<string>('any')
  const [messagingSearch, setMessagingSearch] = useState('')
  const [caseSearch, setCaseSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')

  if (!orgId || !organization) {
    return (
      <section className="page page--workspace owner-dashboard">
        <header className="owner-dashboard__hero">
          <p className="section-label">Owner console</p>
          <h1>Company administration</h1>
          <p className="muted-copy">
            Configure an organization from the dashboard onboarding flow first—your pitch decks stay untouched until you
            attach Company Brain data.
          </p>
          <Link className="primary-button" to="/dashboard">
            Back to workspace
          </Link>
        </header>
      </section>
    )
  }

  const filteredKnowledge = knowledgeItems.filter((item) => {
    const search = knowledgeSearch.trim().toLowerCase()
    if (search) {
      const target = `${item.title} ${item.description} ${item.tags.join(' ')}`.toLowerCase()
      if (!target.includes(search)) return false
    }
    if (knowledgeSourceFilter !== 'any' && item.sourceType !== knowledgeSourceFilter) return false
    if (knowledgeStatusFilter !== 'any' && item.approvalStatus !== knowledgeStatusFilter) return false
    if (knowledgeFolderFilter !== 'any' && (item.folderId ?? '') !== knowledgeFolderFilter) return false
    return true
  })

  return (
    <section className="page page--workspace owner-dashboard">
      <header className="owner-dashboard__hero owner-dashboard__hero--grid">
        <div>
          <p className="section-label">Owner Console</p>
          <h1>{organization.name}</h1>
          <p className="muted-copy">
            Company brain control center for knowledge, organization setup, and team readiness before reps ship decks.
          </p>
          <p className="muted-copy">
            Signed in as <strong>{membership?.displayName ?? auth.user?.email}</strong> · access{' '}
            <strong>{membership?.accessRole ?? '—'}</strong>
          </p>
        </div>
        <div className="owner-dashboard__status-chips">
          <span>Cloud sync: {syncLabel}</span>
          <span>Knowledge sync: {knowledgeSyncLabel}</span>
          <span>Documents: {knowledgeItems.length}</span>
          <span>Workers: {workerCount}</span>
          <span>Pending review: {needsReviewCount}</span>
        </div>
      </header>

      {!activeOwnerSection ? (
        <div className="owner-module-grid">
          {OWNER_MODULES.map((module) => (
            <button
              key={module.id}
              type="button"
              className="owner-module-card"
              onClick={() => setActiveOwnerSection(module.id)}
            >
              <strong>{module.title}</strong>
              <p className="muted-copy">{module.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="owner-module-layout">
          <div className="owner-module-layout__top">
            <p className="muted-copy">
              Owner Console / {OWNER_MODULES.find((m) => m.id === activeOwnerSection)?.title ?? 'Module'}
            </p>
            <button type="button" className="ghost-button" onClick={() => setActiveOwnerSection(null)}>
              Back to Owner Home
            </button>
          </div>

          {activeOwnerSection === 'knowledge-library' ? (
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
                    activeOrgId={orgId}
                    admin={admin}
                    workspaceApi={workspaceApi}
                    folders={folders}
                    deckFileOptions={deckFileOptions}
                  />
                ) : knowledgeSubsection === 'folders' ? (
                  <OwnerFolderStructureSection activeOrgId={orgId} admin={admin} workspaceApi={workspaceApi} folders={folders} />
                ) : (
                  <>
                    <div className="company-brain-filters">
                      <label><span>Search</span><input value={knowledgeSearch} onChange={(e) => setKnowledgeSearch(e.target.value)} placeholder="title, tags, description" /></label>
                      <label><span>Source</span><select value={knowledgeSourceFilter} onChange={(e) => setKnowledgeSourceFilter(e.target.value as CompanyKnowledgeSourceType | 'any')}><option value="any">Any</option>{SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                      <label><span>Status</span><select value={knowledgeStatusFilter} onChange={(e) => setKnowledgeStatusFilter(e.target.value as KnowledgeApprovalStatus | 'any')}><option value="any">Any</option><option value="needs-review">Needs review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="archived">Archived</option></select></label>
                      <label><span>Folder</span><select value={knowledgeFolderFilter} onChange={(e) => setKnowledgeFolderFilter(e.target.value)}><option value="any">Any</option><option value="">No folder</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
                    </div>
                    <OwnerKnowledgeTable activeOrgId={orgId} workspaceApi={workspaceApi} items={filteredKnowledge.filter((row) => {
                      if (knowledgeSubsection === 'needs-review') return row.approvalStatus === 'needs-review'
                      if (knowledgeSubsection === 'approved') return row.approvalStatus === 'approved'
                      if (knowledgeSubsection === 'archived') return row.approvalStatus === 'archived' || row.approvalStatus === 'rejected'
                      return true
                    })} folders={folders} />
                  </>
                )}
              </main>
            </div>
          ) : null}

          {activeOwnerSection === 'folder-organizer' ? (
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
                {folderSubsection === 'tree' ? <OwnerFolderStructureSection activeOrgId={orgId} admin={admin} workspaceApi={workspaceApi} folders={folders} /> : null}
                {folderSubsection === 'move-items' ? <OwnerKnowledgeMoveSection activeOrgId={orgId} admin={admin} workspaceApi={workspaceApi} knowledgeItems={knowledgeItems} folders={folders} /> : null}
                {folderSubsection === 'suggestions' ? <OwnerAiOrganizationSection activeOrgId={orgId} admin={admin} workspaceApi={workspaceApi} knowledgeItems={knowledgeItems} folders={folders} suggestionPlan={suggestionPlan} /> : null}
              </main>
            </div>
          ) : null}

          {activeOwnerSection === 'team-roles' ? (
            <div className="owner-module-layout__content">
              <aside className="owner-module-layout__sidebar">
                {(
                  [
                    ['workers', 'Workers'],
                    ['invites', 'Invites'],
                    ['roles', 'Roles'],
                    ['departments', 'Departments'],
                  ] as Array<[TeamSubsection, string]>
                ).map(([id, label]) => (
                  <button key={id} type="button" className={teamSubsection === id ? 'is-active' : ''} onClick={() => setTeamSubsection(id)}>
                    {label}
                  </button>
                ))}
              </aside>
              <main className="owner-module-layout__main">
                <h2>Team & Roles</h2>
                {teamSubsection === 'workers' || teamSubsection === 'invites' ? (
                  <OwnerWorkerPrepSection activeOrgId={orgId} admin={admin} workspaceApi={workspaceApi} departments={departments} roles={catalogRoles} />
                ) : (
                  <RolesDepartmentsCatalogTab activeOrgId={orgId} admin={admin} departments={departments} roles={catalogRoles} workspaceApi={workspaceApi} />
                )}
              </main>
            </div>
          ) : null}

          {activeOwnerSection === 'brand-kit' ? <BrandKitModule activeOrgId={orgId} organizationName={organization.name} brandKit={brandKit} deckFileOptions={deckFileOptions} workspaceApi={workspaceApi} /> : null}
          {activeOwnerSection === 'messaging' ? <MessagingModule activeOrgId={orgId} items={messaging} workspaceApi={workspaceApi} search={messagingSearch} setSearch={setMessagingSearch} /> : null}
          {activeOwnerSection === 'case-studies' ? <CaseStudiesModule activeOrgId={orgId} items={caseStudies} workspaceApi={workspaceApi} search={caseSearch} setSearch={setCaseSearch} /> : null}
          {activeOwnerSection === 'products' ? <ProductsModule activeOrgId={orgId} items={products} workspaceApi={workspaceApi} search={productSearch} setSearch={setProductSearch} /> : null}
          {activeOwnerSection === 'activity-settings' ? (
            <ActivitySettingsModule
              activity={activity}
              syncLabel={syncLabel}
              knowledgeSyncLabel={knowledgeSyncLabel}
              librarySyncLabel={librarySyncLabel}
              syncStatusMessage={syncStatus.message}
              knowledgeStatusMessage={knowledgeSyncStatus.message}
              libraryStatusMessage={librarySyncStatus.message}
              workspaceApi={workspaceApi}
              showToast={showToast}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}

function OwnerKnowledgeTable({
  activeOrgId,
  workspaceApi,
  items,
  folders,
}: {
  activeOrgId: string
  workspaceApi: ReturnType<typeof useWorkspace>
  items: CompanyKnowledgeItem[]
  folders: { id: string; name: string }[]
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
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                const next = window.prompt('Edit title', item.title)
                if (!next?.trim()) return
                workspaceApi.upsertCompanyKnowledgeItem(activeOrgId, { ...item, title: next.trim() })
              }}
            >
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

function BrandKitModule({
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

  return (
    <article className="owner-dashboard__card">
      <h2>Brand Kit</h2>
      <p className="muted-copy">Applies to future generated decks.</p>
      <p className="muted-copy">Organization: <strong>{organizationName}</strong></p>
      <div className="form-grid">
        <label className="field-group"><span className="field-label">Primary</span><input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} /></label>
        <label className="field-group"><span className="field-label">Secondary</span><input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} /></label>
        <label className="field-group"><span className="field-label">Accent</span><input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} /></label>
        <label className="field-group"><span className="field-label">Font family</span><input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Default deck tone</span><input value={tone} onChange={(e) => setTone(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Logo asset</span><select value={logoId} onChange={(e) => setLogoId(e.target.value)}><option value="">None</option>{deckFileOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <button type="button" className="primary-button" onClick={() => workspaceApi.upsertCompanyBrandKit(activeOrgId, { id: brandKit?.id, primaryColor: primary, secondaryColor: secondary, accentColor: accent, fontFamily, defaultDeckTone: tone, logoAssetId: logoId || undefined })}>Save brand kit</button>
      </div>
    </article>
  )
}

function MessagingModule({ activeOrgId, items, workspaceApi, search, setSearch }: { activeOrgId: string; items: ApprovedMessagingItem[]; workspaceApi: ReturnType<typeof useWorkspace>; search: string; setSearch: (v: string) => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('Playbook')
  const [tags, setTags] = useState('')
  const rows = items.filter((item) => `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
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

function CaseStudiesModule({ activeOrgId, items, workspaceApi, search, setSearch }: { activeOrgId: string; items: CaseStudyItem[]; workspaceApi: ReturnType<typeof useWorkspace>; search: string; setSearch: (v: string) => void }) {
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

function ProductsModule({ activeOrgId, items, workspaceApi, search, setSearch }: { activeOrgId: string; items: ProductServiceItem[]; workspaceApi: ReturnType<typeof useWorkspace>; search: string; setSearch: (v: string) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetBuyer, setTargetBuyer] = useState('')
  const [benefits, setBenefits] = useState('')
  const [proof, setProof] = useState('')
  const [objections, setObjections] = useState('')
  const rows = items.filter((item) => `${item.name} ${item.description} ${item.targetBuyer}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <article className="owner-dashboard__card">
      <h2>Products & Services</h2>
      <div className="company-brain-filters"><label><span>Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
      <div className="form-grid">
        <label className="field-group"><span className="field-label">Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field-group"><span className="field-label">Primary buyer</span><input value={targetBuyer} onChange={(e) => setTargetBuyer(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Description</span><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Key benefits (one per line)</span><textarea rows={3} value={benefits} onChange={(e) => setBenefits(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Proof points (one per line)</span><textarea rows={3} value={proof} onChange={(e) => setProof(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Common objections (one per line)</span><textarea rows={3} value={objections} onChange={(e) => setObjections(e.target.value)} /></label>
        <button type="button" className="primary-button" disabled={!name.trim()} onClick={() => { workspaceApi.upsertCompanyProductService(activeOrgId, { name, description, targetBuyer, keyBenefits: benefits.split('\n').map((v) => v.trim()).filter(Boolean), proofPoints: proof.split('\n').map((v) => v.trim()).filter(Boolean), commonObjections: objections.split('\n').map((v) => v.trim()).filter(Boolean) }); setName(''); setDescription(''); setTargetBuyer(''); setBenefits(''); setProof(''); setObjections('') }}>Save offering</button>
      </div>
      {!rows.length ? <p className="muted-copy">No offerings added yet. Capture at least one core product/service.</p> : (
        <ul className="company-brain-list">{rows.map((product) => <li key={product.id} className="company-brain-card"><strong>{product.name}</strong><p className="muted-copy">{product.description}</p><button type="button" className="ghost-button" onClick={() => workspaceApi.deleteCompanyProductService(activeOrgId, product.id)}>Delete</button></li>)}</ul>
      )}
    </article>
  )
}

function ActivitySettingsModule({
  activity,
  syncLabel,
  knowledgeSyncLabel,
  librarySyncLabel,
  syncStatusMessage,
  knowledgeStatusMessage,
  libraryStatusMessage,
  workspaceApi,
  showToast,
}: {
  activity: Array<{ id: string; kind: string; detail: string; createdAt: string }>
  syncLabel: string
  knowledgeSyncLabel: string
  librarySyncLabel: string
  syncStatusMessage?: string
  knowledgeStatusMessage?: string
  libraryStatusMessage?: string
  workspaceApi: ReturnType<typeof useWorkspace>
  showToast: (...args: any[]) => void
}) {
  return (
    <article className="owner-dashboard__card">
      <h2>Activity & Settings</h2>
      <p className="muted-copy">Run sync tools, review logs, and manage local demo workspace state.</p>
      <h3>Sync controls</h3>
      <p className="muted-copy">Identity: {syncLabel} · Knowledge: {knowledgeSyncLabel} · Libraries: {librarySyncLabel}</p>
      {syncStatusMessage ? <p className="muted-copy">{syncStatusMessage}</p> : null}
      {knowledgeStatusMessage ? <p className="muted-copy">{knowledgeStatusMessage}</p> : null}
      {libraryStatusMessage ? <p className="muted-copy">{libraryStatusMessage}</p> : null}
      <div className="owner-suggestion-list__actions">
        <button type="button" className="secondary-button" onClick={() => void workspaceApi.saveCompanyIdentityToCloud()}>Save identity</button>
        <button type="button" className="ghost-button" onClick={() => void workspaceApi.loadCompanyIdentityFromCloud()}>Load identity</button>
        <button type="button" className="secondary-button" onClick={() => void workspaceApi.saveCompanyKnowledgeToCloud()}>Save knowledge</button>
        <button type="button" className="ghost-button" onClick={() => void workspaceApi.loadCompanyKnowledgeFromCloud()}>Load knowledge</button>
        <button type="button" className="secondary-button" onClick={() => void workspaceApi.saveCompanyLibrariesToCloud()}>Save libraries</button>
        <button type="button" className="ghost-button" onClick={() => void workspaceApi.loadCompanyLibrariesFromCloud()}>Load libraries</button>
      </div>
      <h3>Recent activity</h3>
      {!activity.length ? <p className="muted-copy">No activity yet—uploads, staging, and approvals surface here.</p> : (
        <ul className="owner-activity-list">{activity.map((log) => <li key={log.id}><span className="owner-activity-list__kind">{log.kind}</span><span>{log.detail}</span><time dateTime={log.createdAt}>{formatShortDate(log.createdAt)}</time></li>)}</ul>
      )}
      <h3>Demo workspace tools</h3>
      <div className="owner-suggestion-list__actions">
        <button type="button" className="secondary-button" onClick={() => loadDemoWorkspaceLocally({ replaceWorkspace: workspaceApi.replaceWorkspace, showToast })}>Load demo workspace</button>
        <button type="button" className="ghost-button" onClick={() => resetDemoWorkspaceLocally({ replaceWorkspace: workspaceApi.replaceWorkspace, showToast, createResetWorkspace: seedWorkspaceState })}>Reset demo workspace</button>
      </div>
    </article>
  )
}
