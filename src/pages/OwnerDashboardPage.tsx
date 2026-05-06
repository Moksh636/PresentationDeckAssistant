import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useWorkspace } from '../context/useWorkspace'
import { suggestCompanyKnowledgeOrganization } from '../data/companyKnowledgeOrganization'
import { formatShortDate } from '../utils/formatters'

export function OwnerDashboardPage() {
  const auth = useAuth()
  const { workspace } = useWorkspace()
  const orgId = workspace.companyBrain.activeOrganizationId
  const organization = workspace.companyBrain.organizations.find((o) => o.id === orgId)
  const membership = workspace.companyBrain.organizationMemberships.find(
    (m) => m.organizationId === orgId && m.userId === auth.user?.id,
  )

  const knowledgeItems = useMemo(
    () => workspace.companyBrain.knowledgeItems.filter((k) => k.organizationId === orgId),
    [orgId, workspace.companyBrain.knowledgeItems],
  )

  const folders = useMemo(
    () => workspace.companyBrain.knowledgeFolders.filter((f) => f.organizationId === orgId),
    [orgId, workspace.companyBrain.knowledgeFolders],
  )

  const suggestionPlan = useMemo(() => suggestCompanyKnowledgeOrganization(knowledgeItems), [knowledgeItems])

  const activity = workspace.companyBrain.activityLogs.filter((a) => a.organizationId === orgId).slice(0, 6)

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
            Active organization: <strong>{organization?.name ?? 'Not configured'}</strong>
            {organization?.website ? (
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
        </>
      ),
    },
    {
      id: 'knowledge-library',
      title: 'Knowledge Library',
      body: (
        <p>
          Curate approved sources inside{' '}
          <Link to="/company">
            Company Brain → Knowledge Library
          </Link>
          . {knowledgeItems.length} items tracked locally for this org preview.
        </p>
      ),
    },
    {
      id: 'folder-organizer',
      title: 'Folder Organizer',
      body: (
        <>
          <p>
            {folders.length} folders · nested IDs supported via <code>parentFolderId</code> in data.
          </p>
          <p className="muted-copy">
            Drag-and-drop UI lands later—today folders hydrate from normalized workspace JSON just like production.
          </p>
        </>
      ),
    },
    {
      id: 'upload',
      title: 'Upload',
      body: (
        <p>
          Upload flows reuse Company Brain registration + Storage adapters when configured. Jump to{' '}
          <Link to="/company">Company Brain</Link> to add mock items immediately.
        </p>
      ),
    },
    {
      id: 'suggested-organization',
      title: 'Suggested Organization (mock AI)',
      body: (
        <>
          <p className="muted-copy">
            Deterministic, offline heuristics—no paid AI APIs. Suggested folder names for your current items:
          </p>
          <ul className="owner-dash-list">
            {suggestionPlan.folders.map((f) => (
              <li key={f.key}>
                <strong>{f.name}</strong>
                {f.description ? <span className="muted-copy"> — {f.description}</span> : null}
              </li>
            ))}
          </ul>
          {suggestionPlan.items.length === 0 ? (
            <p className="muted-copy">Add knowledge items to see suggested mappings.</p>
          ) : (
            <ul className="owner-dash-list owner-dash-list--compact">
              {suggestionPlan.items.slice(0, 8).map((row) => (
                <li key={row.itemId}>
                  Item <code>{row.itemId}</code> → {row.suggestedFolderKey}
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    },
    {
      id: 'departments',
      title: 'Departments',
      body: (
        <p>
          Manage catalog departments under{' '}
          <Link to="/company">Company Brain → Departments &amp; roles</Link>.
        </p>
      ),
    },
    {
      id: 'roles',
      title: 'Roles',
      body: (
        <p>
          Configure job-title catalogs so invites lock to the right responsibilities—same surface as departments.
        </p>
      ),
    },
    {
      id: 'workers',
      title: 'Workers',
      body: (
        <p>
          Invite operators from the membership tab. Workers route to the pitch <Link to="/dashboard">dashboard</Link>{' '}
          by default.
        </p>
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
          Approved snippets for AE consistency live alongside knowledge items; open the messaging tab in Company Brain.
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
          <p className="muted-copy">No activity yet—actions like uploads and approvals show up here.</p>
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
        <h1>Company administration</h1>
        <p className="muted-copy">
          Distinct from the pitch deck dashboard: configure knowledge, governance, and org primitives before reps ship
          decks.
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
