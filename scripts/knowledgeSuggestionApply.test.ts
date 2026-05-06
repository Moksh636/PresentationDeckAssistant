import assert from 'node:assert/strict'
import {
  reduceApproveKnowledgeFolderSuggestion,
  reduceRejectKnowledgeFolderSuggestion,
} from '../src/data/knowledgeSuggestionApply.ts'
import {
  stablePlanFolderId,
  stageKnowledgeOrganizationPlan,
  upsertCompanyKnowledgeItem,
} from '../src/data/companyBrainMutations.ts'
import { suggestCompanyKnowledgeOrganization } from '../src/data/companyKnowledgeOrganization.ts'
import { createEmptyCompanyBrainWorkspaceSlice } from '../src/data/companyBrainNormalize.ts'
import type { CompanyKnowledgeItem, WorkspaceState } from '../src/types/models.ts'

const organizationId = 'org-test'
const profile = { userId: 'owner', email: 'o@example.com', displayName: 'Owner' }

function baseWorkspace(): WorkspaceState {
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
      activeOrganizationId: organizationId,
      organizations: [
        {
          id: organizationId,
          name: 'Acme',
          slug: 'acme',
          createdByUserId: profile.userId,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
    },
  } as WorkspaceState
}

const sampleItem: CompanyKnowledgeItem = {
  id: 'k1',
  organizationId,
  uploadedByUserId: profile.userId,
  title: 'Security brief',
  description: '',
  sourceType: 'policy',
  tags: [],
  approvalStatus: 'approved',
  visibility: 'company',
  suggestedFolderId: stablePlanFolderId(organizationId, 'trust-security'),
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const approvePatch = reduceApproveKnowledgeFolderSuggestion(sampleItem)
assert.ok(approvePatch)
assert.equal(approvePatch!.folderId, sampleItem.suggestedFolderId)
assert.equal(approvePatch!.suggestedFolderId, null)
assert.equal(approvePatch!.ownerApprovedFolder, true)

const rejectPatch = reduceRejectKnowledgeFolderSuggestion(sampleItem)
assert.ok(rejectPatch)
assert.equal(rejectPatch!.suggestedFolderId, null)
assert.equal(rejectPatch!.ownerApprovedFolder, null)

let ws = upsertCompanyKnowledgeItem(baseWorkspace(), organizationId, profile, {
  title: sampleItem.title,
  description: sampleItem.description,
  sourceType: sampleItem.sourceType,
  id: sampleItem.id,
})
const plan = suggestCompanyKnowledgeOrganization(ws.companyBrain.knowledgeItems)
ws = stageKnowledgeOrganizationPlan(ws, organizationId, profile, plan)
const staged = ws.companyBrain.knowledgeItems.find((k) => k.id === sampleItem.id)
assert.ok(staged?.suggestedFolderId)

ws = upsertCompanyKnowledgeItem(ws, organizationId, profile, reduceApproveKnowledgeFolderSuggestion(staged!)!)
const approved = ws.companyBrain.knowledgeItems.find((k) => k.id === sampleItem.id)
assert.ok(approved?.folderId)
assert.equal(approved?.suggestedFolderId, undefined)
assert.equal(approved?.ownerApprovedFolder, true)
