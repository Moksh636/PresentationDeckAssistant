import assert from 'node:assert/strict'
import { createEmptyCompanyBrainWorkspaceSlice } from '../src/data/companyBrainNormalize.ts'
import {
  isOwnerOrAdmin,
  resolveDefaultAuthenticatedPath,
  resolvePostSignupPath,
} from '../src/data/postAuthRedirect.ts'
import type { WorkspaceState } from '../src/types/models.ts'

const skeleton = {
  activeDeckId: '',
  projects: [],
  decks: [],
  slides: [],
  fileAssets: [],
  chartSuggestions: [],
  comments: [],
  deckVersions: [],
  companyBrain: createEmptyCompanyBrainWorkspaceSlice(),
} as unknown as WorkspaceState

assert.equal(resolveDefaultAuthenticatedPath(skeleton, 'any'), '/join-company')

const ownerWorkspace = JSON.parse(
  JSON.stringify({
    ...skeleton,
    companyBrain: {
      activeOrganizationId: 'org-1',
      organizations: [{ id: 'org-1', name: 'Acme', slug: 'acme', createdByUserId: 'u1', createdAt: '', updatedAt: '' }],
      organizationMemberships: [
        {
          id: 'm1',
          organizationId: 'org-1',
          userId: 'u1',
          email: 'a@example.com',
          displayName: 'Alex',
          roleTitle: 'Owner',
          department: '',
          accessRole: 'owner',
          createdAt: '',
          updatedAt: '',
        },
      ],
      companyRoles: [],
      companyDepartments: [],
      knowledgeFolders: [],
      knowledgeItems: [],
      brandKits: [],
      approvedMessaging: [],
      caseStudies: [],
      productsServices: [],
      activityLogs: [],
      onboarding: { dismissed: false },
      workerInvites: [],
    },
  }),
) as WorkspaceState

assert.equal(resolveDefaultAuthenticatedPath(ownerWorkspace, 'u1'), '/owner')
assert.equal(isOwnerOrAdmin(ownerWorkspace, 'u1'), true)

assert.equal(resolvePostSignupPath(skeleton, 'u1'), '/join-company')
assert.equal(resolvePostSignupPath(ownerWorkspace, 'u1'), '/owner')

console.log('postAuthRedirect tests passed')
