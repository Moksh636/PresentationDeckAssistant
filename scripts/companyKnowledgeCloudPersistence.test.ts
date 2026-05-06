import assert from 'node:assert/strict'
import {
  approveKnowledgeItem,
  loadCompanyKnowledge,
  mapKnowledgeFolderRowToModel,
  mapKnowledgeFolderToRow,
  mapKnowledgeItemRowToModel,
  mapKnowledgeItemToRow,
  moveKnowledgeItemToFolder,
  rejectKnowledgeItem,
  saveCompanyKnowledge,
  type CompanyKnowledgeCloudClient,
} from '../src/data/companyKnowledgeCloudPersistence.ts'

const folder = {
  id: 'folder-1',
  organizationId: 'org-1',
  name: 'Playbooks',
  parentFolderId: 'root-folder',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

const item = {
  id: 'item-1',
  organizationId: 'org-1',
  folderId: 'folder-1',
  uploadedByUserId: 'user-1',
  title: 'QBR Narrative',
  description: 'Approved narrative',
  fileAssetId: 'file-1',
  sourceType: 'notes' as const,
  tags: ['qbr', 'narrative'],
  approvalStatus: 'needs-review' as const,
  visibility: 'company' as const,
  allowedDepartments: ['sales'],
  allowedRoleTitles: ['AE'],
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

assert.equal(mapKnowledgeFolderRowToModel(mapKnowledgeFolderToRow(folder)).parentFolderId, 'root-folder')
assert.equal(mapKnowledgeItemRowToModel(mapKnowledgeItemToRow(item)).approvalStatus, 'needs-review')
assert.equal(mapKnowledgeItemRowToModel(mapKnowledgeItemToRow(item)).folderId, 'folder-1')

let movedFolderId: string | null | undefined
let approvalStatus: string | undefined

const successClient: CompanyKnowledgeCloudClient = {
  from(tableName: string) {
    return {
      select() {
        const builder = {
          eq(column: string, value: string) {
            assert.equal(column, 'organization_id')
            assert.equal(value, 'org-1')
            return builder
          },
          in() {
            return builder
          },
          order() {
            if (tableName === 'knowledge_folders') {
              return Promise.resolve({ data: [mapKnowledgeFolderToRow(folder)], error: null })
            }
            return Promise.resolve({ data: [mapKnowledgeItemToRow(item)], error: null })
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
      upsert() {
        return {
          select() {
            return Promise.resolve({ data: [], error: null })
          },
        }
      },
      update(payload: Record<string, unknown>) {
        if (tableName === 'company_knowledge_items') {
          if (payload.folder_id !== undefined) {
            movedFolderId = (payload.folder_id as string | null | undefined) ?? null
          }
          if (payload.approval_status !== undefined) {
            approvalStatus = String(payload.approval_status)
          }
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

await saveCompanyKnowledge({
  supabase: successClient,
  organizationId: 'org-1',
  knowledgeFolders: [folder],
  knowledgeItems: [item],
})

const loaded = await loadCompanyKnowledge({
  supabase: successClient,
  organizationId: 'org-1',
})

assert.equal(loaded.knowledgeFolders[0]?.parentFolderId, 'root-folder')
assert.equal(loaded.knowledgeItems[0]?.approvalStatus, 'needs-review')

await approveKnowledgeItem(successClient, 'item-1')
assert.equal(approvalStatus, 'approved')
await rejectKnowledgeItem(successClient, 'item-1')
assert.equal(approvalStatus, 'rejected')
await moveKnowledgeItemToFolder(successClient, 'item-1', 'folder-2')
assert.equal(movedFolderId, 'folder-2')
await moveKnowledgeItemToFolder(successClient, 'item-1')
assert.equal(movedFolderId, null)

const failingClient: CompanyKnowledgeCloudClient = {
  from() {
    return {
      select() {
        const builder = {
          eq() {
            return builder
          },
          in() {
            return builder
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
        return builder
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
  () => loadCompanyKnowledge({ supabase: failingClient, organizationId: 'org-1' }),
  /network down/,
)

console.log('companyKnowledgeCloudPersistence tests passed')
