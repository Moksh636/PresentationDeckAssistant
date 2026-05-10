import assert from 'node:assert/strict'
import {
  archiveBrainProcess,
  deleteBrainProcess,
  upsertBrainProcess,
} from '../src/data/companyBrainMutations.ts'
import { createEmptyCompanyBrainWorkspaceSlice } from '../src/data/companyBrainNormalize.ts'
import type { WorkspaceState } from '../src/types/models.ts'

const ORG = 'org-test'
const iso = '2026-05-10T00:00:00.000Z'

function baseWorkspace(): WorkspaceState {
  return {
    activeDeckId: 'd1',
    projects: [],
    decks: [],
    slides: [],
    fileAssets: [],
    chartSuggestions: [],
    comments: [],
    deckVersions: [],
    companyBrain: {
      ...createEmptyCompanyBrainWorkspaceSlice(),
      activeOrganizationId: ORG,
      organizations: [
        {
          id: ORG,
          name: 'Test Org',
          slug: 'test-org',
          createdByUserId: 'u-owner',
          createdAt: iso,
          updatedAt: iso,
        },
      ],
      organizationMemberships: [
        {
          id: 'mem-1',
          organizationId: ORG,
          userId: 'u-owner',
          email: 'owner@test',
          displayName: 'Owner',
          roleTitle: 'Owner',
          department: 'Ops',
          accessRole: 'owner',
          createdAt: iso,
          updatedAt: iso,
        },
      ],
    },
  }
}

const actor = { userId: 'u-owner', email: 'owner@test', displayName: 'Owner' }

let ws = upsertBrainProcess(baseWorkspace(), ORG, actor, {
  title: 'Proc',
  description: '',
  category: 'Cat',
  steps: [],
  inputs: [],
  outputs: [],
  relatedKnowledgeItemIds: [],
  relatedRoleTitles: [],
  approvalStatus: 'draft',
})

assert.equal(ws.companyBrain.brainProcesses.length, 1)
const pid = ws.companyBrain.brainProcesses[0]!.id

ws = archiveBrainProcess(ws, ORG, actor, pid)
assert.equal(ws.companyBrain.brainProcesses.find((p) => p.id === pid)?.approvalStatus, 'archived')

ws = deleteBrainProcess(ws, ORG, actor, pid)
assert.equal(ws.companyBrain.brainProcesses.length, 0)

console.log('companyBrainMapMutations OK')
