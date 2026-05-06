import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useWorkspace } from '../context/useWorkspace'
import {
  findPendingInvitesForEmail,
  normalizeWorkerInviteEmail,
} from '../data/companyBrainMutations'
import { userHasAnyOrganizationMembership } from '../data/postAuthRedirect'

/** Invite acceptance shell for authenticated users without an organization membership yet. */
export function JoinCompanyScreen() {
  const auth = useAuth()
  const navigate = useNavigate()
  const workspaceApi = useWorkspace()
  const { workspace, acceptWorkerInvite } = workspaceApi

  const userId = auth.user?.id ?? ''
  if (userId && userHasAnyOrganizationMembership(workspace, userId)) {
    return <Navigate to="/dashboard" replace />
  }

  const emailRaw = auth.user?.email ?? ''
  const normalized = normalizeWorkerInviteEmail(emailRaw)
  const pending = findPendingInvitesForEmail(normalized, workspace.companyBrain.workerInvites)

  const readyToJoin = pending.filter((p) => p.status === 'invited')
  const waitingDraft = pending.filter((p) => p.status === 'draft')

  return (
    <section className="page page--workspace owner-dashboard">
      <header className="owner-dashboard__hero">
        <p className="section-label">Company workspace</p>
        <h1>Join your team</h1>
        <p className="muted-copy">
          Signed in as <strong>{emailRaw || 'your account'}</strong>. This screen appears when you are not yet a member
          of any organization in this workspace.
        </p>
      </header>

      {readyToJoin.length === 0 && waitingDraft.length === 0 ? (
        <article className="owner-dashboard__card">
          <h2>No matching invite</h2>
          <p>No pending invite matches this email yet.</p>
          <p className="muted-copy">
            Ask your admin to prepare an invite for this address (email sending is not wired in this MVP), or start a
            new company workspace if you are onboarding the business.
          </p>
          <p>
            <Link className="primary-button" to="/onboarding/company">
              Create a company workspace
            </Link>
          </p>
          <p className="muted-copy">
            <Link to="/auth">Use a different account</Link>
          </p>
        </article>
      ) : (
        <div className="owner-dashboard__sections">
          {waitingDraft.length ? (
            <article className="owner-dashboard__card">
              <h2>Drafts waiting on admin</h2>
              <p className="muted-copy">
                These rows match your email but an owner still needs to mark them as invited before you can join.
              </p>
              <ul className="owner-suggestion-list">
                {waitingDraft.map((inv) => {
                  const org = workspace.companyBrain.organizations.find((o) => o.id === inv.organizationId)
                  return (
                    <li key={inv.id} className="owner-suggestion-list__row">
                      <div>
                        <strong>{org?.name ?? 'Company'}</strong>
                        <div className="muted-copy">Status: draft</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </article>
          ) : null}

          {readyToJoin.length ? (
            <article className="owner-dashboard__card">
              <h2>Open invitations</h2>
              <ul className="owner-suggestion-list">
                {readyToJoin.map((inv) => {
                  const org = workspace.companyBrain.organizations.find((o) => o.id === inv.organizationId)
                  return (
                    <li key={inv.id} className="owner-suggestion-list__row">
                      <div>
                        <strong>{org?.name ?? 'Company'}</strong>
                        <div className="muted-copy">
                          Access: {inv.accessRole}
                          {inv.invitedRoleTitle ? (
                            <>
                              {' '}
                              · Role: {inv.invitedRoleTitle}
                            </>
                          ) : null}
                          {inv.invitedDepartment ? (
                            <>
                              {' '}
                              · Dept: {inv.invitedDepartment}
                            </>
                          ) : null}
                        </div>
                        <div className="muted-copy">
                          {inv.roleLocked ? <span>Role locked · </span> : null}
                          {inv.departmentLocked ? <span>Department locked · </span> : null}
                          {!inv.roleLocked && !inv.departmentLocked ? <span>No locks · </span> : null}
                          Assignments are read-only here.
                        </div>
                      </div>
                      <div className="owner-suggestion-list__actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => {
                            acceptWorkerInvite(inv)
                            navigate('/dashboard', { replace: true })
                          }}
                        >
                          Join workspace
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </article>
          ) : null}
        </div>
      )}
    </section>
  )
}
