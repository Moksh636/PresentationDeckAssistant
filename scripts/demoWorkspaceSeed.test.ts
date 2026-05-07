import assert from 'node:assert/strict'
import { createDemoWorkspaceState } from '../src/data/demoWorkspaceSeed.ts'

const workspace = createDemoWorkspaceState()
const org = workspace.companyBrain.organizations.find((candidate) => candidate.name === 'Northstar FieldOps')

assert.ok(org, 'Expected demo organization to exist')
assert.equal(org?.website, 'https://northstarfieldops.demo')

const roleNames = new Set(
  workspace.companyBrain.companyRoles
    .filter((role) => role.organizationId === org?.id && !role.archived)
    .map((role) => role.name),
)
const departmentNames = new Set(
  workspace.companyBrain.companyDepartments
    .filter((department) => department.organizationId === org?.id && !department.archived)
    .map((department) => department.name),
)

for (const role of [
  'Owner',
  'Account Executive',
  'Sales Manager',
  'Operations Manager',
  'Customer Success Manager',
  'Product Manager',
  'Finance Analyst',
  'Legal Reviewer',
]) {
  assert.ok(roleNames.has(role), `Expected role ${role}`)
}

for (const department of ['Sales', 'Operations', 'Customer Success', 'Product', 'Finance', 'Legal']) {
  assert.ok(departmentNames.has(department), `Expected department ${department}`)
}

assert.ok(
  workspace.companyBrain.brandKits.some((brand) => brand.organizationId === org?.id),
  'Expected a demo brand kit',
)

const folderIds = new Set(
  workspace.companyBrain.knowledgeFolders
    .filter((folder) => folder.organizationId === org?.id)
    .map((folder) => folder.id),
)
const expectedKnowledgeTitles = [
  'AI Call Handling Product Overview',
  'HVAC Missed Call ROI Case Study',
  'Plumbing Dispatcher Workflow Notes',
  'Pricing and Pilot Proposal Terms',
  'Service Company Objection Handling Guide',
  'Customer Success Implementation Checklist',
  'Standard Contract Terms Summary',
  'Approved Sales Messaging',
  'Competitor Comparison Notes',
]

for (const title of expectedKnowledgeTitles) {
  const item = workspace.companyBrain.knowledgeItems.find((candidate) => candidate.title === title)
  assert.ok(item, `Expected knowledge item ${title}`)
  assert.ok(item?.folderId, `Expected folder assignment for ${title}`)
  assert.ok(item?.folderId && folderIds.has(item.folderId), `Expected valid folder for ${title}`)
}

const deck = workspace.decks.find((candidate) => candidate.id === workspace.activeDeckId)
assert.ok(deck, 'Expected active deck')
assert.equal(deck?.setup.targetCompany, 'MetroFlow Plumbing')
assert.equal(deck?.setup.buyerPersona, 'Owner / Operations Manager')
assert.equal(deck?.setup.offeringSummary, 'AI missed-call handling and workflow automation')
assert.equal(deck?.setup.meetingGoal, 'Secure a pilot program')
assert.equal(deck?.setup.desiredCta, 'Approve a 30-day pilot')

const assetsById = new Map(workspace.fileAssets.map((asset) => [asset.id, asset]))
for (const item of workspace.companyBrain.knowledgeItems) {
  if (!item.fileAssetId) {
    continue
  }
  const backingAsset = assetsById.get(item.fileAssetId)
  assert.ok(backingAsset, `Expected backing file asset for ${item.title}`)
  assert.ok(
    backingAsset?.sourceTrace.some((trace) => trace.fileId === backingAsset.id),
    `Expected source trace for ${item.title}`,
  )
}

console.log('demoWorkspaceSeed tests passed')
