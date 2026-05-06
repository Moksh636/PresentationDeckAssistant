import assert from 'node:assert/strict'
import {
  acceptWorkerInviteForUser,
  findPendingInviteForEmail,
  findPendingInvitesForEmail,
  markWorkerInviteInvited,
  normalizeWorkerInviteEmail,
  revokeWorkerInvite,
  upsertWorkerInviteDraft,
} from '../src/data/companyBrainMutations.ts'
import {
  createEmptyCompanyBrainWorkspaceSlice,
  normalizeCompanyBrainWorkspaceSlice,
} from '../src/data/companyBrainNormalize.ts'
import { getRelevantCompanyKnowledgeForUser } from '../src/data/companyKnowledgeRetrieval.ts'
import type { CompanyKnowledgeItem, Organization, WorkerInvite, WorkspaceState } from '../src/types/models.ts'

const iso = '2026-05-01T12:00:00.000Z'
const orgId = 'org-inv-test'
const ownerProfile = { userId: 'owner-1', email: 'owner@example.com', displayName: 'Owner' }

function workspaceWithOrg(extraInvites: WorkerInvite[] = []): WorkspaceState {
  const org: Organization = {
    id: orgId,
    name: 'InviteCo',
    slug: 'inviteco',
    createdByUserId: ownerProfile.userId,
    createdAt: iso,
    updatedAt: iso,
  }
  return {
    activeDeckId: '',
    projects: [],
    decks: [],
    slides: [],
    fileAssets: [],
    chartSuggestions: [],
    comments: [],
    deckVersions: [],
    companyBrain: {
      ...createEmptyCompanyBrainWorkspaceSlice(),
      activeOrganizationId: orgId,
      organizations: [org],
      organizationMemberships: [
        {
          id: 'mem-owner',
          organizationId: orgId,
          userId: ownerProfile.userId,
          email: ownerProfile.email,
          displayName: ownerProfile.displayName,
          roleTitle: 'Owner',
          department: '',
          accessRole: 'owner',
          createdAt: iso,
          updatedAt: iso,
        },
      ],
      workerInvites: extraInvites,
    },
  } as WorkspaceState
}

/* Normalization: legacy / empty payloads default workerInvites safely */
{
  const raw = normalizeCompanyBrainWorkspaceSlice({})
  assert.ok(Array.isArray(raw.workerInvites))
  assert.equal(raw.workerInvites.length, 0)
}

/* Pending email match is case-insensitive; joined/revoked excluded */
{
  const invites: WorkerInvite[] = [
    {
      id: 'i1',
      organizationId: orgId,
      email: 'Worker@Example.COM',
      status: 'invited',
      accessRole: 'member',
      createdByUserId: ownerProfile.userId,
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: 'i2',
      organizationId: orgId,
      email: 'worker@example.com',
      status: 'joined',
      accessRole: 'member',
      createdByUserId: ownerProfile.userId,
      createdAt: iso,
      updatedAt: iso,
    },
    {
      id: 'i3',
      organizationId: orgId,
      email: 'gone@example.com',
      status: 'revoked',
      accessRole: 'viewer',
      createdByUserId: ownerProfile.userId,
      createdAt: iso,
      updatedAt: iso,
    },
  ]
  const pending = findPendingInvitesForEmail('WORKER@example.com', invites)
  assert.equal(pending.length, 1)
  assert.equal(pending[0]?.id, 'i1')
  const first = findPendingInviteForEmail(normalizeWorkerInviteEmail('worker@example.com'), invites)
  assert.equal(first?.id, 'i1')
}

/* Accept invite writes membership + marks invite joined */
{
  let ws = workspaceWithOrg([])
  ws = upsertWorkerInviteDraft(ws, orgId, ownerProfile, {
    email: 'newhire@example.com',
    invitedRoleTitle: 'AE',
    invitedDepartment: 'Revenue',
    accessRole: 'member',
    roleLocked: true,
  })
  const draftId = ws.companyBrain.workerInvites[0]?.id
  assert.ok(draftId)
  ws = markWorkerInviteInvited(ws, orgId, ownerProfile, draftId)
  const invitedRow = ws.companyBrain.workerInvites.find((w) => w.id === draftId)
  assert.equal(invitedRow?.status, 'invited')

  ws = acceptWorkerInviteForUser(ws, {
    invite: invitedRow!,
    userId: 'user-worker',
    email: 'NewHire@example.com',
    displayName: 'New Hire',
  })

  const membership = ws.companyBrain.organizationMemberships.find(
    (m) => m.organizationId === orgId && m.userId === 'user-worker',
  )
  assert.ok(membership)
  assert.equal(membership?.roleTitle, 'AE')
  assert.equal(membership?.department, 'Revenue')
  assert.equal(membership?.accessRole, 'member')
  assert.equal(membership?.invitedRoleTitle, 'AE')
  assert.equal(membership?.departmentLocked, undefined)
  assert.equal(membership?.roleLocked, true)

  const joinedInvite = ws.companyBrain.workerInvites.find((w) => w.id === draftId)
  assert.equal(joinedInvite?.status, 'joined')
  assert.equal(joinedInvite?.joinedUserId, 'user-worker')
  assert.ok(joinedInvite?.joinedAt)

  const blocked = acceptWorkerInviteForUser(ws, {
    invite: joinedInvite!,
    userId: 'user-worker',
    email: 'newhire@example.com',
  })
  assert.strictEqual(blocked, ws)
  assert.equal(blocked.companyBrain.workerInvites.find((w) => w.id === draftId)?.status, 'joined')
}

/* Revoked invite ignored for pending lookup */
{
  const invites: WorkerInvite[] = [
    {
      id: 'r1',
      organizationId: orgId,
      email: 'rev@example.com',
      status: 'invited',
      accessRole: 'viewer',
      createdByUserId: ownerProfile.userId,
      createdAt: iso,
      updatedAt: iso,
    },
  ]
  const revoked = revokeWorkerInvite(workspaceWithOrg(invites), orgId, ownerProfile, 'r1')
  assert.equal(findPendingInvitesForEmail('rev@example.com', revoked.companyBrain.workerInvites).length, 0)
}

/* Retrieval uses worker membership role/dept after invite acceptance */
{
  let ws = workspaceWithOrg([])
  ws = upsertWorkerInviteDraft(ws, orgId, ownerProfile, {
    email: 'sales@example.com',
    invitedRoleTitle: 'Solutions AE',
    invitedDepartment: 'Revenue',
    accessRole: 'member',
  })
  const id = ws.companyBrain.workerInvites[0]?.id
  ws = markWorkerInviteInvited(ws, orgId, ownerProfile, id!)
  const inv = ws.companyBrain.workerInvites.find((w) => w.id === id)!
  ws = acceptWorkerInviteForUser(ws, {
    invite: inv,
    userId: 'sales-u',
    email: 'sales@example.com',
    displayName: 'Sam Sales',
  })
  assert.ok(ws.companyBrain.organizationMemberships.some((m) => m.userId === 'sales-u'))

  const item: CompanyKnowledgeItem = {
    id: 'k-role',
    organizationId: orgId,
    uploadedByUserId: 'peer',
    title: 'AE competitive traps',
    description: '',
    sourceType: 'deck',
    tags: [],
    approvalStatus: 'approved',
    visibility: 'role',
    allowedRoleTitles: ['Solutions AE'],
    allowedDepartments: [],
    createdAt: iso,
    updatedAt: iso,
  }

  const relevant = getRelevantCompanyKnowledgeForUser({
    organizationId: orgId,
    userRoleTitle: 'Solutions AE',
    department: 'Revenue',
    accessRole: 'member',
    currentUserId: 'sales-u',
    deckSetup: { goal: '', buyerPersona: '', offeringSummary: '' },
    knowledgeItems: [item],
  })

  assert.ok(relevant.some((row) => row.id === 'k-role'))
}

console.log('workerInvite tests passed')
