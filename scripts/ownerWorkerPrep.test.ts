import assert from 'node:assert/strict'
import { buildDraftOrganizationMemberRow } from '../src/data/ownerWorkerPrep.ts'

const row = buildDraftOrganizationMemberRow(
  {
    email: ' ' + 'sam@example.com' + ' ',
    displayName: '',
    roleTitle: 'AE',
    department: 'Sales',
    invitedRoleTitle: 'Account Executive',
    invitedDepartment: 'Sales',
    accessRole: 'member',
    roleLocked: true,
    departmentLocked: false,
  },
  { userId: 'placeholder-fixed' },
)

assert.equal(row.userId, 'placeholder-fixed')
assert.equal(row.email, 'sam@example.com')
assert.equal(row.displayName, 'sam')
assert.equal(row.roleTitle, 'AE')
assert.equal(row.invitedRoleTitle, 'Account Executive')
assert.equal(row.departmentLocked, undefined)
