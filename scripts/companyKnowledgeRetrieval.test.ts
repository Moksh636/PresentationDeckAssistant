import assert from 'node:assert/strict'
import {
  COMPANY_KNOWLEDGE_SCORE_BAND_THRESHOLDS,
  getRelevantCompanyKnowledgeForUserWithExplanations,
} from '../src/data/companyKnowledgeRetrieval.ts'
import type { CompanyKnowledgeItem } from '../src/types/models.ts'

const organizationId = 'org-retrieval'

function baseItem(
  overrides: Partial<CompanyKnowledgeItem> & Pick<CompanyKnowledgeItem, 'id' | 'title' | 'sourceType'>,
): CompanyKnowledgeItem {
  return {
    organizationId,
    uploadedByUserId: 'uploader',
    description: '',
    tags: [],
    approvalStatus: 'approved',
    visibility: 'company',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

const genericDeckSetup = {
  targetCompany: 'Contoso Foods',
  buyerPersona: 'VP Operations',
  audience: 'Commercial leadership',
  offeringSummary: 'cold chain telemetry',
  goal: 'Book a pilot workshop',
  meetingGoal: '',
  knownPainPoints: ['spoilage', 'routing'],
  presentationType: 'Sales proposal deck',
  deckType: '',
}

/* Case study should rank above a generic policy when deck hints emphasize customer proof. */
{
  const knowledgeItems = [
    baseItem({
      id: 'pol',
      title: 'Procurement policy',
      sourceType: 'policy',
      description: 'Vendor onboarding guardrails',
      tags: ['vendor'],
    }),
    baseItem({
      id: 'cs',
      title: 'Retail cold chain win',
      sourceType: 'case-study',
      description: 'Operations rollout with spoilage reduction metrics',
      tags: ['cold', 'chain', 'routing'],
    }),
  ]

  const ranked = getRelevantCompanyKnowledgeForUserWithExplanations({
    organizationId,
    userRoleTitle: 'AE',
    department: 'Revenue',
    accessRole: 'member',
    currentUserId: 'user-1',
    deckSetup: {
      ...genericDeckSetup,
      presentationType: 'Account pitch deck with case study wins',
    },
    knowledgeItems,
  })

  assert.equal(ranked[0]?.item.id, 'cs')
  assert.ok(ranked[0] && ranked[0].score >= ranked[1]!.score)
  assert.ok(ranked[0]?.explanation.sourceTypeRelevance?.includes('case-study'))
}

/* Role + department scoped rows set explanation flags; visibility excludes wrong dept. */
{
  const knowledgeItems = [
    baseItem({
      id: 'role-scoped',
      title: 'AE competitive traps',
      sourceType: 'deck',
      visibility: 'role',
      allowedRoleTitles: ['AE'],
      allowedDepartments: [],
    }),
    baseItem({
      id: 'dept-scoped',
      title: 'Revenue pricing guardrails',
      sourceType: 'policy',
      visibility: 'department',
      allowedDepartments: ['Revenue'],
      tags: ['pricing'],
    }),
    baseItem({
      id: 'eng-only',
      title: 'Engineering launch checklist',
      sourceType: 'product-doc',
      visibility: 'department',
      allowedDepartments: ['Engineering'],
    }),
  ]

  const ranked = getRelevantCompanyKnowledgeForUserWithExplanations({
    organizationId,
    userRoleTitle: 'AE',
    department: 'Revenue',
    accessRole: 'member',
    currentUserId: 'user-1',
    deckSetup: genericDeckSetup,
    knowledgeItems,
    companyCatalogRoleNames: ['AE'],
    companyCatalogDepartmentNames: ['Revenue'],
  })

  const ids = ranked.map((r) => r.item.id)
  assert.ok(ids.includes('role-scoped'))
  assert.ok(ids.includes('dept-scoped'))
  assert.ok(!ids.includes('eng-only'))

  const roleRow = ranked.find((r) => r.item.id === 'role-scoped')
  assert.ok(roleRow?.explanation.matchedRole)
  assert.ok(roleRow?.explanation.catalogRoleBonus)

  const deptRow = ranked.find((r) => r.item.id === 'dept-scoped')
  assert.ok(deptRow?.explanation.matchedDepartment)
  assert.ok(deptRow?.explanation.catalogDepartmentBonus)
}

/* Brief-field explanations: target company + goal tokens surface on matching haystack. */
{
  const knowledgeItems = [
    baseItem({
      id: 'tgt',
      title: 'Contoso competitive footprint',
      sourceType: 'notes',
      description: '',
      tags: [],
    }),
    baseItem({
      id: 'goal',
      title: 'Pilot workshop playbook',
      sourceType: 'deck',
      description: 'Steps to book pilot workshop',
      tags: [],
    }),
  ]

  const ranked = getRelevantCompanyKnowledgeForUserWithExplanations({
    organizationId,
    userRoleTitle: '',
    department: '',
    accessRole: 'viewer',
    currentUserId: 'user-1',
    deckSetup: genericDeckSetup,
    knowledgeItems,
  })

  const tgt = ranked.find((r) => r.item.id === 'tgt')
  assert.ok(tgt?.explanation.matchedTargetCompany)

  const goalRow = ranked.find((r) => r.item.id === 'goal')
  assert.ok(goalRow?.explanation.matchedDeckGoalTokens)
}

/* Bands respect exported thresholds on the same fixture. */
{
  const knowledgeItems = [
    baseItem({
      id: 'thin',
      title: 'ZZZ unrelated doc',
      sourceType: 'other',
      description: 'No overlap tokens here',
      tags: [],
    }),
  ]

  const ranked = getRelevantCompanyKnowledgeForUserWithExplanations({
    organizationId,
    userRoleTitle: '',
    department: '',
    accessRole: 'viewer',
    currentUserId: 'user-1',
    deckSetup: genericDeckSetup,
    knowledgeItems,
  })

  assert.equal(ranked.length, 1)
  assert.ok(ranked[0]!.score < COMPANY_KNOWLEDGE_SCORE_BAND_THRESHOLDS.high)
  assert.equal(ranked[0]!.band, 'medium')
}

console.log('companyKnowledgeRetrieval tests passed')
