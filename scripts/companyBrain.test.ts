import assert from 'node:assert/strict'
import { completeCompanyOnboarding } from '../src/data/companyBrainMutations.ts'
import {
  createEmptyCompanyBrainWorkspaceSlice,
  normalizeCompanyBrainWorkspaceSlice,
  slugifyOrganizationName,
} from '../src/data/companyBrainNormalize.ts'
import { getRelevantCompanyKnowledgeForUser } from '../src/data/companyKnowledgeRetrieval.ts'
import type { CompanyKnowledgeItem, WorkspaceState } from '../src/types/models.ts'

assert.equal(slugifyOrganizationName('  Acme & Co '), 'acme-co')

const normalizedEmpty = normalizeCompanyBrainWorkspaceSlice({})
assert.equal(normalizedEmpty.organizations.length, 0)

const legacyWorkspaceSkeleton = {
  activeDeckId: 'd1',
  projects: [],
  decks: [],
  slides: [],
  fileAssets: [],
  chartSuggestions: [],
  comments: [],
  deckVersions: [],
} as unknown as WorkspaceState

assert.equal(
  normalizeCompanyBrainWorkspaceSlice(
    Reflect.get(legacyWorkspaceSkeleton as Record<string, unknown>, 'companyBrain'),
  ).knowledgeItems.length,
  0,
)

const migrated = {
  ...legacyWorkspaceSkeleton,
  companyBrain: createEmptyCompanyBrainWorkspaceSlice(),
} satisfies WorkspaceState

const orgWorkspace = completeCompanyOnboarding(
  migrated,
  { companyName: 'Acme Logistics', department: 'Revenue', roleTitle: 'AE' },
  { userId: 'user-1', email: 'a@example.com', displayName: 'Alex' },
)

const organizationId =
  orgWorkspace.companyBrain.organizations.find((organization) => organization.name === 'Acme Logistics')
    ?.id ?? ''

assert.ok(organizationId)

function item(seed: Partial<CompanyKnowledgeItem> & Pick<CompanyKnowledgeItem, 'id'>): CompanyKnowledgeItem {
  return {
    organizationId,
    uploadedByUserId: 'peer',
    folderId: undefined,
    fileAssetId: undefined,
    title: 'Pricing guardrails',
    description: '',
    sourceType: 'policy',
    tags: ['pricing'],
    allowedDepartments: undefined,
    allowedRoleTitles: undefined,
    approvalStatus: 'approved',
    visibility: 'company',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...seed,
  }
}

const knowledgeItems = [
  item({ id: 'k-private', visibility: 'private', uploadedByUserId: 'user-2' }),
  item({ id: 'k-role', visibility: 'role', allowedRoleTitles: ['AE'], title: 'AE talk track' }),
  item({ id: 'k-approved', visibility: 'company', title: 'Logistics playbook' }),
  item({
    id: 'k-dept-blocked',
    visibility: 'department',
    allowedDepartments: ['engineering'],
    title: 'Eng launch notes',
  }),
]

const relevant = getRelevantCompanyKnowledgeForUser({
  organizationId,
  department: 'Revenue',
  userRoleTitle: 'AE',
  accessRole: 'member',
  currentUserId: 'user-1',
  deckSetup: {
    goal: '',
    buyerPersona: 'CFO logistics',
    targetCompany: 'Acme Logistics',
    offeringSummary: 'pricing playbook',
    knownPainPoints: ['pricing'],
  },
  knowledgeItems,
})

const ids = relevant.map((know) => know.id)
assert.ok(ids.includes('k-approved'))
assert.ok(ids.includes('k-role'))
assert.ok(!ids.includes('k-private'))
assert.ok(!ids.includes('k-dept-blocked'))
assert.ok(ids.indexOf('k-approved') <= ids.indexOf('k-role'))

console.log('companyBrain tests passed')
