import { formatShortDate } from '../../utils/formatters'
import { loadDemoWorkspaceLocally, resetDemoWorkspaceLocally } from '../../data/demoWorkspaceActions'
import { seedWorkspaceState } from '../../data/mockWorkspace'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type { ToastContextValue } from '../feedback/toastContext'

export function OwnerActivitySettingsModule({
  activity,
  syncLabel,
  knowledgeSyncLabel,
  librarySyncLabel,
  syncStatusMessage,
  knowledgeStatusMessage,
  libraryStatusMessage,
  cloudSyncEnabled,
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
  cloudSyncEnabled: boolean
  workspaceApi: WorkspaceContextValue
  showToast: ToastContextValue['showToast']
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
      {cloudSyncEnabled ? (
        <div className="owner-suggestion-list__actions">
          <button type="button" className="secondary-button" onClick={() => void workspaceApi.saveCompanyIdentityToCloud()}>
            Save identity
          </button>
          <button type="button" className="ghost-button" onClick={() => void workspaceApi.loadCompanyIdentityFromCloud()}>
            Load identity
          </button>
          <button type="button" className="secondary-button" onClick={() => void workspaceApi.saveCompanyKnowledgeToCloud()}>
            Save knowledge
          </button>
          <button type="button" className="ghost-button" onClick={() => void workspaceApi.loadCompanyKnowledgeFromCloud()}>
            Load knowledge
          </button>
          <button type="button" className="secondary-button" onClick={() => void workspaceApi.saveCompanyLibrariesToCloud()}>
            Save libraries
          </button>
          <button type="button" className="ghost-button" onClick={() => void workspaceApi.loadCompanyLibrariesFromCloud()}>
            Load libraries
          </button>
        </div>
      ) : (
        <p className="muted-copy">
          Demo mode stores changes locally in this browser. Sign in with Supabase to save or load identity, knowledge,
          and libraries.
        </p>
      )}
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
