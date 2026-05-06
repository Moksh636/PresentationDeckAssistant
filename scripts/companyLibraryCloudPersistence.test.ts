import assert from 'node:assert/strict'
import {
  loadCompanyLibraries,
  mapApprovedMessagingRowToModel,
  mapApprovedMessagingToRow,
  mapBrandKitRowToModel,
  mapBrandKitToRow,
  mapCaseStudyRowToModel,
  mapCaseStudyToRow,
  mapProductServiceRowToModel,
  mapProductServiceToRow,
  saveCompanyLibraries,
  uuidArrayFromRow,
  type CompanyLibraryCloudClient,
} from '../src/data/companyLibraryCloudPersistence.ts'

const brandKit = {
  id: 'brand-1',
  organizationId: 'org-1',
  logoAssetId: 'logo-asset',
  primaryColor: '#111111',
  secondaryColor: '#222222',
  accentColor: '#333333',
  fontFamily: 'Inter',
  defaultDeckTone: 'confident',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T01:00:00.000Z',
}

const messaging = {
  id: 'msg-1',
  organizationId: 'org-1',
  title: 'Pitch line',
  content: 'We help teams ship faster.',
  category: 'value-prop',
  tags: ['b2b', 'velocity'],
  approvalStatus: 'approved' as const,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T02:00:00.000Z',
}

const caseStudy = {
  id: 'cs-1',
  organizationId: 'org-1',
  title: 'Acme rollout',
  customerName: 'Acme',
  industry: 'Manufacturing',
  challenge: 'Fragmented tooling',
  solution: 'Unified workspace',
  outcome: '40% faster reviews',
  approvedQuote: 'Game changer.',
  sourceKnowledgeItemIds: ['know-1', 'know-2'],
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T03:00:00.000Z',
}

const product = {
  id: 'prod-1',
  organizationId: 'org-1',
  name: 'Platform tier',
  description: 'Core offering',
  targetBuyer: 'Ops leaders',
  keyBenefits: ['Speed', 'Clarity'],
  proofPoints: ['99.9% uptime'],
  commonObjections: ['Too complex'],
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T04:00:00.000Z',
}

assert.deepEqual(mapBrandKitRowToModel(mapBrandKitToRow(brandKit)), brandKit)
assert.deepEqual(mapApprovedMessagingRowToModel(mapApprovedMessagingToRow(messaging)), messaging)

const csRound = mapCaseStudyRowToModel(mapCaseStudyToRow(caseStudy))
assert.deepEqual(csRound.sourceKnowledgeItemIds, caseStudy.sourceKnowledgeItemIds)

const prodRound = mapProductServiceRowToModel(mapProductServiceToRow(product))
assert.deepEqual(prodRound.keyBenefits, product.keyBenefits)

assert.deepEqual(uuidArrayFromRow(['a', 'b']), ['a', 'b'])
assert.deepEqual(uuidArrayFromRow(undefined), [])
assert.deepEqual(
  uuidArrayFromRow([
    '11111111-1111-4111-a111-111111111111',
    '22222222-2222-4222-a222-222222222222',
  ]),
  ['11111111-1111-4111-a111-111111111111', '22222222-2222-4222-a222-222222222222'],
)

let deletedInCalls: Array<{ table: string; ids: string[] }> = []
let upsertTables: string[] = []

function fullRowMaps(tableName: string) {
  if (tableName === 'company_brand_kits') {
    return [mapBrandKitToRow(brandKit)]
  }
  if (tableName === 'approved_messaging_items') {
    return [mapApprovedMessagingToRow(messaging)]
  }
  if (tableName === 'case_study_items') {
    return [mapCaseStudyToRow(caseStudy)]
  }
  if (tableName === 'product_service_items') {
    return [mapProductServiceToRow(product)]
  }
  return []
}

function idRowsFor(tableName: string, includeOrphanBrand: boolean) {
  if (tableName === 'company_brand_kits') {
    return includeOrphanBrand
      ? [{ id: brandKit.id }, { id: 'orphan-brand' }]
      : [{ id: brandKit.id }]
  }
  if (tableName === 'approved_messaging_items') {
    return [{ id: messaging.id }]
  }
  if (tableName === 'case_study_items') {
    return [{ id: caseStudy.id }]
  }
  if (tableName === 'product_service_items') {
    return [{ id: product.id }]
  }
  return []
}

function createHappyClient(includeOrphanBrand: boolean): CompanyLibraryCloudClient {
  deletedInCalls = []
  upsertTables = []

  return {
    from(tableName: string) {
      return {
        select(columns: string) {
          if (columns === 'id') {
            return {
              eq(column: string, value: string) {
                assert.equal(column, 'organization_id')
                assert.equal(value, 'org-1')
                return Promise.resolve({
                  data: idRowsFor(tableName, includeOrphanBrand && tableName === 'company_brand_kits'),
                  error: null,
                })
              },
            }
          }

          return {
            eq(column: string, value: string) {
              assert.equal(column, 'organization_id')
              assert.equal(value, 'org-1')
              return {
                order(columnName: string, _opts?: { ascending?: boolean }) {
                  void columnName
                  void _opts
                  return Promise.resolve({
                    data: fullRowMaps(tableName),
                    error: null,
                  })
                },
              }
            },
          }
        },
        upsert() {
          upsertTables.push(tableName)
          return {
            select() {
              return Promise.resolve({ data: [], error: null })
            },
          }
        },
        update() {
          return {
            eq() {
              return Promise.resolve({ data: [], error: null })
            },
          }
        },
        delete() {
          return {
            eq(column: string, id: string) {
              deletedInCalls.push({ table: tableName, ids: [id] })
              return Promise.resolve({ data: [], error: null })
            },
            in(column: string, ids: string[]) {
              deletedInCalls.push({ table: tableName, ids: [...ids] })
              return Promise.resolve({ data: [], error: null })
            },
          }
        },
      }
    },
  }
}

await saveCompanyLibraries({
  supabase: createHappyClient(true),
  organizationId: 'org-1',
  brandKits: [brandKit],
  approvedMessaging: [messaging],
  caseStudies: [caseStudy],
  productsServices: [product],
})

assert.ok(upsertTables.includes('company_brand_kits'))
const orphanDelete = deletedInCalls.find(
  (c) => c.table === 'company_brand_kits' && c.ids.includes('orphan-brand'),
)
assert.ok(orphanDelete, 'Expected orphan brand kit deletion during save')

const patched = createHappyClient(false)
await saveCompanyLibraries({
  supabase: patched,
  organizationId: 'org-1',
  brandKits: [brandKit],
  approvedMessaging: [messaging],
  caseStudies: [caseStudy],
  productsServices: [product],
})

const loaded = await loadCompanyLibraries({ supabase: patched, organizationId: 'org-1' })
assert.deepEqual(loaded.brandKits[0], brandKit)
assert.deepEqual(loaded.approvedMessaging[0], messaging)
assert.deepEqual(loaded.caseStudies[0]?.sourceKnowledgeItemIds, caseStudy.sourceKnowledgeItemIds)
assert.deepEqual(loaded.productsServices[0]?.name, product.name)

const failingClient: CompanyLibraryCloudClient = {
  from(tableName: string) {
    return {
      select(columns: string) {
        if (columns === 'id') {
          return {
            eq() {
              return Promise.resolve({
                data: null,
                error: { message: `network:${tableName}:id-list` },
              })
            },
          }
        }

        return {
          eq() {
            return {
              order() {
                return Promise.resolve({
                  data: null,
                  error: { message: `network:${tableName}` },
                })
              },
            }
          },
        }
      },
      upsert() {
        return {
          select() {
            return Promise.resolve({ data: [], error: { message: 'network:upsert' } })
          },
        }
      },
      update() {
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
          in() {
            return Promise.resolve({ data: [], error: null })
          },
        }
      },
    }
  },
}

await assert.rejects(() => loadCompanyLibraries({ supabase: failingClient, organizationId: 'org-1' }), /network:/)

await assert.rejects(
  () =>
    saveCompanyLibraries({
      supabase: failingClient,
      organizationId: 'org-1',
      brandKits: [],
      approvedMessaging: [],
      caseStudies: [],
      productsServices: [],
    }),
  /network:/,
)

console.log('companyLibraryCloudPersistence tests passed')
