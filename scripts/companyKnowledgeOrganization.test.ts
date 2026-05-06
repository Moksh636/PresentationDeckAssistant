import assert from 'node:assert/strict'
import { suggestCompanyKnowledgeOrganization } from '../src/data/companyKnowledgeOrganization.ts'
import type { CompanyKnowledgeItem } from '../src/types/models.ts'

const baseItem = {
  organizationId: 'org-1',
  uploadedByUserId: 'u1',
  description: '',
  approvalStatus: 'needs-review' as const,
  visibility: 'company' as const,
  tags: [] as string[],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const items: CompanyKnowledgeItem[] = [
  {
    ...baseItem,
    id: 'k1',
    title: 'SOC2 readiness checklist',
    sourceType: 'policy',
  },
  {
    ...baseItem,
    id: 'k2',
    title: 'Outbound deck template',
    sourceType: 'deck',
  },
  {
    ...baseItem,
    id: 'k3',
    title: 'Brand positioning refresher',
    sourceType: 'notes',
  },
]

const plan = suggestCompanyKnowledgeOrganization(items)

assert.ok(plan.folders.some((f) => f.key === 'policies'))
assert.ok(plan.folders.some((f) => f.key === 'sales-collateral'))
assert.equal(plan.items.find((row) => row.itemId === 'k1')?.suggestedFolderKey, 'policies')
assert.equal(plan.items.find((row) => row.itemId === 'k2')?.suggestedFolderKey, 'sales-collateral')

console.log('companyKnowledgeOrganization tests passed')
