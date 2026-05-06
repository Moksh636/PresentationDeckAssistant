import assert from 'node:assert/strict'
import { normalizeCompanyBrainWorkspaceSlice } from '../src/data/companyBrainNormalize.ts'

const raw = {
  organizations: [
    {
      id: 'org-x',
      name: 'Test Org',
      slug: 'test-org',
      website: 'https://example.com',
      createdByUserId: 'u',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ],
  knowledgeFolders: [
    {
      id: 'f1',
      organizationId: 'org-x',
      name: 'Legal',
      parentFolderId: undefined,
      description: 'Contracts',
      suggestedByAi: true,
      ownerApproved: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ],
  knowledgeItems: [
    {
      id: 'k1',
      organizationId: 'org-x',
      folderId: undefined,
      suggestedFolderId: 'f1',
      ownerApprovedFolder: false,
      uploadedByUserId: 'u',
      title: 'NDA',
      description: '',
      sourceType: 'contract',
      tags: [],
      approvalStatus: 'needs-review',
      visibility: 'company',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ],
  onboarding: {
    dismissed: false,
    knowledgeOrgPreference: 'hybrid',
  },
}

const normalized = normalizeCompanyBrainWorkspaceSlice(raw)
assert.equal(normalized.organizations[0]?.website, 'https://example.com')
assert.equal(normalized.knowledgeFolders[0]?.suggestedByAi, true)
assert.equal(normalized.knowledgeItems[0]?.suggestedFolderId, 'f1')
assert.equal(normalized.onboarding.knowledgeOrgPreference, 'hybrid')

console.log('normalizeKnowledgeFields tests passed')
