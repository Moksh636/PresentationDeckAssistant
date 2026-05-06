import assert from 'node:assert/strict'
import {
  loadOrganizationIdentity,
  mapDepartmentRowToModel,
  mapDepartmentToRow,
  mapMembershipRowToModel,
  mapMembershipToRow,
  mapOrganizationRowToModel,
  mapOrganizationToRow,
  mapRoleRowToModel,
  mapRoleToRow,
  mapWorkerInviteRowToModel,
  mapWorkerInviteToRow,
  saveOrganizationIdentity,
  updateWorkerInviteStatus,
  type CompanyBrainCloudClient,
} from '../src/data/companyBrainCloudPersistence.ts'

const org = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  createdByUserId: 'user-1',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

const membership = {
  id: 'mem-1',
  organizationId: 'org-1',
  userId: 'user-1',
  email: 'owner@acme.com',
  displayName: 'Owner',
  roleTitle: 'Owner',
  department: 'Leadership',
  accessRole: 'owner' as const,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  invitedRoleTitle: 'Owner',
  invitedDepartment: 'Leadership',
  roleLocked: true,
  departmentLocked: true,
}

const role = {
  id: 'role-1',
  organizationId: 'org-1',
  name: 'AE',
  description: 'Account executive',
  defaultDepartmentId: 'dept-1',
  archived: false,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

const department = {
  id: 'dept-1',
  organizationId: 'org-1',
  name: 'Revenue',
  description: 'Sales and success',
  archived: false,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

const invite = {
  id: 'inv-1',
  organizationId: 'org-1',
  email: 'rep@acme.com',
  displayName: 'Rep',
  invitedRoleTitle: 'AE',
  invitedDepartment: 'Revenue',
  accessRole: 'member' as const,
  roleLocked: true,
  departmentLocked: false,
  status: 'invited' as const,
  createdByUserId: 'user-1',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

assert.equal(mapOrganizationRowToModel(mapOrganizationToRow(org)).id, org.id)
assert.equal(mapMembershipRowToModel(mapMembershipToRow(membership)).roleLocked, true)
assert.equal(mapRoleRowToModel(mapRoleToRow(role)).defaultDepartmentId, role.defaultDepartmentId)
assert.equal(mapDepartmentRowToModel(mapDepartmentToRow(department)).name, department.name)
assert.equal(mapWorkerInviteRowToModel(mapWorkerInviteToRow(invite)).status, invite.status)

const calls: string[] = []
let updatedInviteStatus: string | undefined

const successClient: CompanyBrainCloudClient = {
  from(tableName: string) {
    return {
      select() {
        const builder = {
          eq(column: string, value: string) {
            calls.push(`select:${tableName}:${column}=${value}`)
            if (tableName === 'organization_memberships' && column === 'user_id') {
              return Promise.resolve({
                data: [mapMembershipToRow(membership)],
                error: null,
              })
            }
            return builder
          },
          in() {
            if (tableName === 'organizations') {
              return Promise.resolve({ data: [mapOrganizationToRow(org)], error: null })
            }
            if (tableName === 'organization_roles') {
              return builder
            }
            if (tableName === 'organization_departments') {
              return builder
            }
            if (tableName === 'organization_worker_invites') {
              return builder
            }
            if (tableName === 'organization_memberships') {
              return Promise.resolve({ data: [mapMembershipToRow(membership)], error: null })
            }
            return builder
          },
          order() {
            if (tableName === 'organization_roles') {
              return Promise.resolve({ data: [mapRoleToRow(role)], error: null })
            }
            if (tableName === 'organization_departments') {
              return Promise.resolve({ data: [mapDepartmentToRow(department)], error: null })
            }
            if (tableName === 'organization_worker_invites') {
              return Promise.resolve({ data: [mapWorkerInviteToRow(invite)], error: null })
            }
            return builder
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null })
          },
          single() {
            return Promise.resolve({ data: null, error: null })
          },
          then(onfulfilled: (value: unknown) => unknown) {
            return Promise.resolve({ data: [], error: null }).then(onfulfilled)
          },
        }
        return builder
      },
      upsert(payload: unknown) {
        calls.push(`upsert:${tableName}:${Array.isArray(payload) ? payload.length : 1}`)
        return {
          select() {
            return Promise.resolve({ data: [], error: null })
          },
        }
      },
      update(payload: Record<string, unknown>) {
        if (tableName === 'organization_worker_invites') {
          updatedInviteStatus = payload.status
        }
        return {
          eq() {
            return Promise.resolve({ data: [], error: null })
          },
        }
      },
      delete() {
        return {
          eq() {
            return Promise.resolve({ data: [], error: null })
          },
        }
      },
    }
  },
}

await saveOrganizationIdentity({
  supabase: successClient,
  userId: 'user-1',
  organizations: [org],
  organizationMemberships: [membership],
  companyRoles: [role],
  companyDepartments: [department],
  workerInvites: [invite],
})

assert.ok(calls.some((c) => c.startsWith('upsert:organizations')))
assert.ok(calls.some((c) => c.startsWith('upsert:organization_worker_invites')))

const loaded = await loadOrganizationIdentity({
  supabase: successClient,
  userId: 'user-1',
})

assert.equal(loaded.organizations[0]?.id, 'org-1')
assert.equal(loaded.organizationMemberships[0]?.accessRole, 'owner')
assert.equal(loaded.companyRoles[0]?.name, 'AE')
assert.equal(loaded.companyDepartments[0]?.name, 'Revenue')
assert.equal(loaded.workerInvites[0]?.status, 'invited')

await updateWorkerInviteStatus(successClient, 'inv-1', 'joined')
assert.equal(updatedInviteStatus, 'joined')

const failingClient: CompanyBrainCloudClient = {
  from() {
    return {
      select() {
        return {
          eq() {
            return Promise.resolve({ data: null, error: { message: 'network down' } })
          },
          in() {
            return Promise.resolve({ data: null, error: { message: 'network down' } })
          },
          order() {
            return Promise.resolve({ data: null, error: { message: 'network down' } })
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null })
          },
          single() {
            return Promise.resolve({ data: null, error: null })
          },
          then(onfulfilled: (value: unknown) => unknown) {
            return Promise.resolve({ data: null, error: { message: 'network down' } }).then(onfulfilled)
          },
        }
      },
      upsert() {
        return {
          select() {
            return Promise.resolve({ data: null, error: { message: 'network down' } })
          },
        }
      },
      update() {
        return {
          eq() {
            return Promise.resolve({ data: null, error: { message: 'network down' } })
          },
        }
      },
      delete() {
        return {
          eq() {
            return Promise.resolve({ data: null, error: { message: 'network down' } })
          },
        }
      },
    }
  },
}

await assert.rejects(
  () => loadOrganizationIdentity({ supabase: failingClient, userId: 'user-1' }),
  /network down/,
)

console.log('companyBrainCloudPersistence tests passed')
