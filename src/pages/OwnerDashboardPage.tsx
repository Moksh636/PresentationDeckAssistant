import { useMemo, type ReactNode } from 'react'
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
import { workspaceUserProfileFromAuth } from '../data/workspaceUserProfile'
import { formatShortDate } from '../utils/formatters'

export function OwnerDashboardPage() {
  const auth = useAuth()
  const workspaceApi = useWorkspace()
  const { workspace } = workspaceApi
  const profile = workspaceUserProfileFromAuth(auth.user ?? null, auth.isLocalDevBypass)

  const orgId = workspace.companyBrain.activeOrganizationId
  const organization = workspace.companyBrain.organizations.find((o) => o.id === orgId)
  const membership = orgId
    ? getMembershipForOrgUser(workspace, orgId, profile.userId)
    : undefined
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

  const sections: Array<{ id: string; title: string; body: ReactNode }> = [
    {
      id: 'overview',
      title: 'Overview',
      body: (
        <>
          <p className="muted-copy">
            Signed in as <strong>{membership?.displayName ?? auth.user?.email}</strong> · role{' '}
            <strong>{membership?.roleTitle ?? '—'}</strong> · access{' '}
            <strong>{membership?.accessRole ?? '—'}</strong>
          </p>
          <p>
            Active organization: <strong>{organization.name}</strong>
            {organization.website ? (
              <>
                {' '}
                ·{' '}
                <a href={organization.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              </>
            ) : null}
          </p>
          <p className="muted-copy">
            Knowledge preference:{' '}
            <strong>{workspace.companyBrain.onboarding.knowledgeOrgPreference ?? 'hybrid'}</strong>
          </p>
          <p className="muted-copy">
            Deep taxonomy editing also lives in <Link to="/company">Company Brain</Link>—this console focuses on owner
            controls.
          </p>
        </>
      ),
    },
    {
      id: 'identity-sync',
      title: 'Identity cloud sync',
      body: (
        <>
          <p className="muted-copy">
            Sync status: <strong>{syncLabel}</strong>
            {syncStatus.lastSyncedAt && syncStatus.state === 'saved' ? (
              <> · last saved {formatShortDate(syncStatus.lastSyncedAt)}</>
            ) : null}
          </p>
          {syncStatus.message ? <p className="muted-copy">{syncStatus.message}</p> : null}
          <div className="owner-suggestion-list__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void workspaceApi.saveCompanyIdentityToCloud()
              }}
            >
              Save company identity to Cloud
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                void workspaceApi.loadCompanyIdentityFromCloud()
              }}
            >
              Load company identity from Cloud
            </button>
          </div>
        </>
      ),
    },
    {
      id: 'knowledge-sync',
      title: 'Knowledge library cloud sync',
      body: (
        <>
          <p className="muted-copy">
            Folders and knowledge items autosave to cloud when signed in (~4s after edits). Sync status:{' '}
            <strong>{knowledgeSyncLabel}</strong>
            {knowledgeSyncStatus.lastSyncedAt && knowledgeSyncStatus.state === 'saved' ? (
              <> · last saved {formatShortDate(knowledgeSyncStatus.lastSyncedAt)}</>
            ) : null}
          </p>
          {knowledgeSyncStatus.message ? <p className="muted-copy">{knowledgeSyncStatus.message}</p> : null}
          <div className="owner-suggestion-list__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void workspaceApi.saveCompanyKnowledgeToCloud()
              }}
            >
              Save knowledge library to Cloud
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                void workspaceApi.loadCompanyKnowledgeFromCloud()
              }}
            >
              Load knowledge library from Cloud
            </button>
          </div>
        </>
      ),
    },
    {
      id: 'library-sync',
      title: 'Brand & catalog cloud sync',
      body: (
        <>
          <p className="muted-copy">
            Brand kit, approved messaging, case studies, and products/services autosave to cloud when signed in (~4s
            after edits). Sync status: <strong>{librarySyncLabel}</strong>
            {librarySyncStatus.lastSyncedAt && librarySyncStatus.state === 'saved' ? (
              <> · last saved {formatShortDate(librarySyncStatus.lastSyncedAt)}</>
            ) : null}
          </p>
          {librarySyncStatus.message ? <p className="muted-copy">{librarySyncStatus.message}</p> : null}
          <div className="owner-suggestion-list__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void workspaceApi.saveCompanyLibrariesToCloud()
              }}
            >
              Save company libraries to Cloud
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                void workspaceApi.loadCompanyLibrariesFromCloud()
              }}
            >
              Load company libraries from Cloud
            </button>
          </div>
        </>
      ),
    },
    {
      id: 'upload',
      title: 'Documents & deck links',
      body: (
        <OwnerKnowledgeUploadSection
          activeOrgId={orgId}
          admin={admin}
          workspaceApi={workspaceApi}
          folders={folders}
          deckFileOptions={deckFileOptions}
        />
      ),
    },
    {
      id: 'folder-structure',
      title: 'Folder tree',
      body: (
        <OwnerFolderStructureSection
          activeOrgId={orgId}
          admin={admin}
          workspaceApi={workspaceApi}
          folders={folders}
        />
      ),
    },
    {
      id: 'assign-folders',
      title: 'Move items into folders',
      body: (
        <OwnerKnowledgeMoveSection
          activeOrgId={orgId}
          admin={admin}
          workspaceApi={workspaceApi}
          knowledgeItems={knowledgeItems}
          folders={folders}
        />
      ),
    },
    {
      id: 'suggested-organization',
      title: 'Offline organization suggestions',
      body: (
        <OwnerAiOrganizationSection
          activeOrgId={orgId}
          admin={admin}
          workspaceApi={workspaceApi}
          knowledgeItems={knowledgeItems}
          folders={folders}
          suggestionPlan={suggestionPlan}
        />
      ),
    },
    {
      id: 'catalog',
      title: 'Departments & roles catalog',
      body: (
        <RolesDepartmentsCatalogTab
          activeOrgId={orgId}
          admin={admin}
          departments={departments}
          roles={catalogRoles}
          workspaceApi={workspaceApi}
        />
      ),
    },
    {
      id: 'worker-prep',
      title: 'Worker invites (scaffold)',
      body: (
        <OwnerWorkerPrepSection
          activeOrgId={orgId}
          admin={admin}
          workspaceApi={workspaceApi}
          departments={departments}
          roles={catalogRoles}
        />
      ),
    },
    {
      id: 'brand-kit',
      title: 'Brand Kit',
      body: (
        <p>
          Authoritative colors + typography for generated decks—edit inside{' '}
          <Link to="/company">Company Brain → Brand</Link>.
        </p>
      ),
    },
    {
      id: 'messaging',
      title: 'Messaging',
      body: (
        <p>
          Approved snippets for AE consistency live alongside knowledge items; open the messaging tab in{' '}
          <Link to="/company">Company Brain</Link>.
        </p>
      ),
    },
    {
      id: 'case-studies',
      title: 'Case Studies',
      body: <p>Centralize proof points once, reuse across decks—Company Brain → Case studies.</p>,
    },
    {
      id: 'products',
      title: 'Products',
      body: <p>Offering bullets feed pitch intel—maintained under Company Brain → Products &amp; services.</p>,
    },
    {
      id: 'activity',
      title: 'Activity',
      body:
        activity.length === 0 ? (
          <p className="muted-copy">No activity yet—uploads, staging, and approvals surface here.</p>
        ) : (
          <ul className="owner-activity-list">
            {activity.map((log) => (
              <li key={log.id}>
                <span className="owner-activity-list__kind">{log.kind}</span>
                <span>{log.detail}</span>
                <time dateTime={log.createdAt}>{formatShortDate(log.createdAt)}</time>
              </li>
            ))}
          </ul>
        ),
    },
    {
      id: 'settings',
      title: 'Settings',
      body: (
        <p>
          Org metadata still lives in local workspace JSON for this MVP—pair with Supabase tables when you promote the
          scaffold.
        </p>
      ),
    },
  ]

  return (
    <section className="page page--workspace owner-dashboard">
      <header className="owner-dashboard__hero">
        <p className="section-label">Owner console</p>
        <h1>Company brain control center</h1>
        <p className="muted-copy">
          Configure knowledge, folders, catalog structure, and mock worker invites before reps ship decks.
        </p>
      </header>

      <nav className="owner-dashboard__toc" aria-label="Owner sections">
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.title}
          </a>
        ))}
      </nav>

      <div className="owner-dashboard__sections">
        {sections.map((section) => (
          <article key={section.id} id={section.id} className="owner-dashboard__card">
            <h2>{section.title}</h2>
            {section.body}
          </article>
        ))}
      </div>
    </section>
  )
}
