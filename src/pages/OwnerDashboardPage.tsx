import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useWorkspace } from '../context/useWorkspace'
import { canManageCompanyBrain, getMembershipForOrgUser } from '../data/companyBrainMutations'
import { suggestCompanyKnowledgeOrganization } from '../data/companyKnowledgeOrganization'
import { workspaceUserProfileFromAuth } from '../data/workspaceUserProfile'
import { useToast } from '../components/feedback/toastContext'
import {
  OwnerActivitySettingsModule,
  OwnerBrandKitModule,
  OwnerCaseStudiesModule,
  OwnerConsoleHome,
  OwnerFolderOrganizerModule,
  OwnerKnowledgeLibraryModule,
  OwnerMessagingModule,
  OwnerModuleShell,
  OwnerProductsServicesModule,
  OwnerTeamRolesModule,
} from '../components/owner'
import type { CompanyKnowledgeSourceType, KnowledgeApprovalStatus } from '../types/models'

type OwnerSection =
  | 'knowledge-library'
  | 'folder-organizer'
  | 'team-roles'
  | 'brand-kit'
  | 'messaging'
  | 'case-studies'
  | 'products'
  | 'activity-settings'

type KnowledgeSubsection = 'all' | 'needs-review' | 'approved' | 'archived' | 'folders' | 'upload'
type FolderSubsection = 'tree' | 'move-items' | 'suggestions'
type TeamSubsection = 'workers' | 'invites' | 'roles' | 'departments'

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
        <OwnerConsoleHome modules={OWNER_MODULES} onSelectModule={setActiveOwnerSection} />
      ) : (
        <OwnerModuleShell
          moduleTitle={OWNER_MODULES.find((m) => m.id === activeOwnerSection)?.title}
          onBack={() => setActiveOwnerSection(null)}
        >
          {activeOwnerSection === 'knowledge-library' ? (
            <OwnerKnowledgeLibraryModule
              activeOrgId={orgId}
              admin={admin}
              workspaceApi={workspaceApi}
              folders={folders}
              deckFileOptions={deckFileOptions}
              knowledgeSubsection={knowledgeSubsection}
              setKnowledgeSubsection={setKnowledgeSubsection}
              knowledgeSearch={knowledgeSearch}
              setKnowledgeSearch={setKnowledgeSearch}
              knowledgeSourceFilter={knowledgeSourceFilter}
              setKnowledgeSourceFilter={setKnowledgeSourceFilter}
              knowledgeStatusFilter={knowledgeStatusFilter}
              setKnowledgeStatusFilter={setKnowledgeStatusFilter}
              knowledgeFolderFilter={knowledgeFolderFilter}
              setKnowledgeFolderFilter={setKnowledgeFolderFilter}
              filteredKnowledge={filteredKnowledge}
            />
          ) : null}
          {activeOwnerSection === 'folder-organizer' ? (
            <OwnerFolderOrganizerModule
              activeOrgId={orgId}
              admin={admin}
              workspaceApi={workspaceApi}
              folders={folders}
              knowledgeItems={knowledgeItems}
              suggestionPlan={suggestionPlan}
              folderSubsection={folderSubsection}
              setFolderSubsection={setFolderSubsection}
            />
          ) : null}
          {activeOwnerSection === 'team-roles' ? (
            <OwnerTeamRolesModule
              activeOrgId={orgId}
              admin={admin}
              workspaceApi={workspaceApi}
              departments={departments}
              roles={catalogRoles}
              teamSubsection={teamSubsection}
              setTeamSubsection={setTeamSubsection}
            />
          ) : null}
          {activeOwnerSection === 'brand-kit' ? <OwnerBrandKitModule activeOrgId={orgId} organizationName={organization.name} brandKit={brandKit} deckFileOptions={deckFileOptions} workspaceApi={workspaceApi} /> : null}
          {activeOwnerSection === 'messaging' ? <OwnerMessagingModule activeOrgId={orgId} items={messaging} workspaceApi={workspaceApi} search={messagingSearch} setSearch={setMessagingSearch} /> : null}
          {activeOwnerSection === 'case-studies' ? <OwnerCaseStudiesModule activeOrgId={orgId} items={caseStudies} workspaceApi={workspaceApi} search={caseSearch} setSearch={setCaseSearch} /> : null}
          {activeOwnerSection === 'products' ? <OwnerProductsServicesModule activeOrgId={orgId} items={products} workspaceApi={workspaceApi} search={productSearch} setSearch={setProductSearch} /> : null}
          {activeOwnerSection === 'activity-settings' ? (
            <OwnerActivitySettingsModule
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
        </OwnerModuleShell>
      )}
    </section>
  )
}
