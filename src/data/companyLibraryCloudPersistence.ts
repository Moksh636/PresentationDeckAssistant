import type {
  ApprovedMessagingItem,
  CaseStudyItem,
  CompanyBrandKit,
  KnowledgeApprovalStatus,
  ProductServiceItem,
} from '../types/models'

const BRAND_KIT_COLUMNS =
  'id,organization_id,logo_asset_id,primary_color,secondary_color,accent_color,font_family,default_deck_tone,created_at,updated_at'
const MESSAGING_COLUMNS =
  'id,organization_id,title,content,category,tags,approval_status,created_at,updated_at'
const CASE_COLUMNS =
  'id,organization_id,title,customer_name,industry,challenge,solution,outcome,approved_quote,source_knowledge_item_ids,created_at,updated_at'
const PRODUCT_COLUMNS =
  'id,organization_id,name,description,target_buyer,key_benefits,proof_points,common_objections,created_at,updated_at'

interface CloudQueryError {
  message?: string
}

interface CloudQueryResult<T> {
  data: T | null
  error: CloudQueryError | null
}

type CloudRow = Record<string, unknown>

interface CloudTableApi {
  select: (columns: string) => CloudSelectBuilder
  upsert: (payload: CloudRow | CloudRow[], options?: { onConflict?: string }) => CloudMutationBuilder
  update: (payload: CloudRow) => CloudMutationFilterBuilder
  delete: () => CloudMutationDeleteBuilder
}

interface CloudSelectBuilder {
  eq: (column: string, value: string) => CloudSelectBuilder
  in: (column: string, values: string[]) => CloudSelectBuilder
  order: (column: string, options?: { ascending?: boolean }) => CloudSelectBuilder
  maybeSingle: () => PromiseLike<CloudQueryResult<CloudRow>>
  single: () => PromiseLike<CloudQueryResult<CloudRow>>
  then: PromiseLike<CloudQueryResult<CloudRow[]>>['then']
}

interface CloudMutationBuilder {
  select: (columns: string) => {
    single: () => PromiseLike<CloudQueryResult<CloudRow>>
    then: PromiseLike<CloudQueryResult<CloudRow[]>>['then']
  }
}

interface CloudMutationFilterBuilder {
  eq: (column: string, value: string) => PromiseLike<CloudQueryResult<CloudRow[]>>
}

interface CloudMutationDeleteBuilder {
  eq: (column: string, value: string) => PromiseLike<CloudQueryResult<CloudRow[]>>
  in: (column: string, values: string[]) => PromiseLike<CloudQueryResult<CloudRow[]>>
}

export interface CompanyLibraryCloudClient {
  from: (tableName: string) => CloudTableApi
}

export interface CompanyLibraryCloudSnapshot {
  brandKits: CompanyBrandKit[]
  approvedMessaging: ApprovedMessagingItem[]
  caseStudies: CaseStudyItem[]
  productsServices: ProductServiceItem[]
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export function uuidArrayFromRow(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((entry) => (typeof entry === 'string' ? entry : String(entry)))
}

export function throwIfCloudError(error: CloudQueryError | null, action: string) {
  if (error) {
    throw new Error(error.message ?? `Cloud ${action} failed.`)
  }
}

async function fetchIdsForOrganization(
  supabase: CompanyLibraryCloudClient,
  tableName: string,
  organizationId: string,
): Promise<string[]> {
  const response = await supabase.from(tableName).select('id').eq('organization_id', organizationId)
  throwIfCloudError(response.error, `list ${tableName} ids`)

  const rows = (response.data ?? []) as Array<{ id?: string }>

  return rows.map((row) => row.id).filter((id): id is string => typeof id === 'string' && id.length > 0)
}

async function deleteOrphanRows(
  supabase: CompanyLibraryCloudClient,
  tableName: string,
  organizationId: string,
  keepIds: ReadonlySet<string>,
): Promise<void> {
  const cloudIds = await fetchIdsForOrganization(supabase, tableName, organizationId)
  const orphans = cloudIds.filter((id) => !keepIds.has(id))

  if (orphans.length === 0) {
    return
  }

  const { error } = await supabase.from(tableName).delete().in('id', orphans)
  throwIfCloudError(error, `delete orphan ${tableName} rows`)
}

export function mapBrandKitToRow(model: CompanyBrandKit): CloudRow {
  return {
    id: model.id,
    organization_id: model.organizationId,
    logo_asset_id: model.logoAssetId ?? null,
    primary_color: model.primaryColor,
    secondary_color: model.secondaryColor,
    accent_color: model.accentColor,
    font_family: model.fontFamily,
    default_deck_tone: model.defaultDeckTone,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
  }
}

export function mapBrandKitRowToModel(row: CloudRow): CompanyBrandKit {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    logoAssetId: asOptionalString(row.logo_asset_id),
    primaryColor: asString(row.primary_color, '#111827'),
    secondaryColor: asString(row.secondary_color, '#6b7280'),
    accentColor: asString(row.accent_color, '#2563eb'),
    fontFamily: asString(row.font_family, 'system-ui'),
    defaultDeckTone: asString(row.default_deck_tone),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export function mapApprovedMessagingToRow(model: ApprovedMessagingItem): CloudRow {
  return {
    id: model.id,
    organization_id: model.organizationId,
    title: model.title,
    content: model.content,
    category: model.category,
    tags: model.tags,
    approval_status: model.approvalStatus,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
  }
}

export function mapApprovedMessagingRowToModel(row: CloudRow): ApprovedMessagingItem {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    title: asString(row.title, 'Message'),
    content: asString(row.content),
    category: asString(row.category),
    tags: asStringArray(row.tags),
    approvalStatus: asString(row.approval_status, 'needs-review') as KnowledgeApprovalStatus,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export function mapCaseStudyToRow(model: CaseStudyItem): CloudRow {
  return {
    id: model.id,
    organization_id: model.organizationId,
    title: model.title,
    customer_name: model.customerName,
    industry: model.industry,
    challenge: model.challenge,
    solution: model.solution,
    outcome: model.outcome,
    approved_quote: model.approvedQuote ?? null,
    source_knowledge_item_ids: model.sourceKnowledgeItemIds,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
  }
}

export function mapCaseStudyRowToModel(row: CloudRow): CaseStudyItem {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    title: asString(row.title, 'Case study'),
    customerName: asString(row.customer_name),
    industry: asString(row.industry),
    challenge: asString(row.challenge),
    solution: asString(row.solution),
    outcome: asString(row.outcome),
    approvedQuote: asOptionalString(row.approved_quote),
    sourceKnowledgeItemIds: uuidArrayFromRow(row.source_knowledge_item_ids),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export function mapProductServiceToRow(model: ProductServiceItem): CloudRow {
  return {
    id: model.id,
    organization_id: model.organizationId,
    name: model.name,
    description: model.description,
    target_buyer: model.targetBuyer,
    key_benefits: model.keyBenefits,
    proof_points: model.proofPoints,
    common_objections: model.commonObjections,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
  }
}

export function mapProductServiceRowToModel(row: CloudRow): ProductServiceItem {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    name: asString(row.name, 'Product'),
    description: asString(row.description),
    targetBuyer: asString(row.target_buyer),
    keyBenefits: asStringArray(row.key_benefits),
    proofPoints: asStringArray(row.proof_points),
    commonObjections: asStringArray(row.common_objections),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export async function upsertBrandKit(
  supabase: CompanyLibraryCloudClient,
  kit: CompanyBrandKit,
): Promise<void> {
  const { error } = await supabase.from('company_brand_kits').upsert(mapBrandKitToRow(kit), {
    onConflict: 'id',
  })
    .select(BRAND_KIT_COLUMNS)
  throwIfCloudError(error, 'upsert brand kit')
}

export async function upsertApprovedMessagingItem(
  supabase: CompanyLibraryCloudClient,
  row: ApprovedMessagingItem,
): Promise<void> {
  const { error } = await supabase
    .from('approved_messaging_items')
    .upsert(mapApprovedMessagingToRow(row), {
      onConflict: 'id',
    })
    .select(MESSAGING_COLUMNS)
  throwIfCloudError(error, 'upsert approved messaging')
}

export async function upsertCaseStudyItem(
  supabase: CompanyLibraryCloudClient,
  row: CaseStudyItem,
): Promise<void> {
  const { error } = await supabase
    .from('case_study_items')
    .upsert(mapCaseStudyToRow(row), {
      onConflict: 'id',
    })
    .select(CASE_COLUMNS)
  throwIfCloudError(error, 'upsert case study')
}

export async function upsertProductServiceItem(
  supabase: CompanyLibraryCloudClient,
  row: ProductServiceItem,
): Promise<void> {
  const { error } = await supabase
    .from('product_service_items')
    .upsert(mapProductServiceToRow(row), {
      onConflict: 'id',
    })
    .select(PRODUCT_COLUMNS)
  throwIfCloudError(error, 'upsert product/service')
}

export async function archiveApprovedMessagingInCloud(
  supabase: CompanyLibraryCloudClient,
  messagingId: string,
): Promise<void> {
  const { error } = await supabase
    .from('approved_messaging_items')
    .update({
      approval_status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', messagingId)

  throwIfCloudError(error, 'archive approved messaging')
}

export async function deleteMessagingRowFromCloud(
  supabase: CompanyLibraryCloudClient,
  messagingId: string,
): Promise<void> {
  const { error } = await supabase.from('approved_messaging_items').delete().eq('id', messagingId)
  throwIfCloudError(error, 'delete approved messaging')
}

export async function deleteCaseStudyRowFromCloud(
  supabase: CompanyLibraryCloudClient,
  caseStudyId: string,
): Promise<void> {
  const { error } = await supabase.from('case_study_items').delete().eq('id', caseStudyId)
  throwIfCloudError(error, 'delete case study')
}

export async function deleteProductServiceRowFromCloud(
  supabase: CompanyLibraryCloudClient,
  productId: string,
): Promise<void> {
  const { error } = await supabase.from('product_service_items').delete().eq('id', productId)
  throwIfCloudError(error, 'delete product/service')
}

export async function deleteBrandKitRowFromCloud(
  supabase: CompanyLibraryCloudClient,
  brandKitId: string,
): Promise<void> {
  const { error } = await supabase.from('company_brand_kits').delete().eq('id', brandKitId)
  throwIfCloudError(error, 'delete brand kit')
}

export async function saveCompanyLibraries({
  supabase,
  organizationId,
  brandKits,
  approvedMessaging,
  caseStudies,
  productsServices,
}: {
  supabase: CompanyLibraryCloudClient
  organizationId: string
  brandKits: CompanyBrandKit[]
  approvedMessaging: ApprovedMessagingItem[]
  caseStudies: CaseStudyItem[]
  productsServices: ProductServiceItem[]
}): Promise<void> {
  const orgBrandKits = brandKits.filter((b) => b.organizationId === organizationId)
  const orgMessaging = approvedMessaging.filter((m) => m.organizationId === organizationId)
  const orgCases = caseStudies.filter((c) => c.organizationId === organizationId)
  const orgProducts = productsServices.filter((p) => p.organizationId === organizationId)

  for (const kit of orgBrandKits) {
    await upsertBrandKit(supabase, kit)
  }
  for (const row of orgMessaging) {
    await upsertApprovedMessagingItem(supabase, row)
  }
  for (const row of orgCases) {
    await upsertCaseStudyItem(supabase, row)
  }
  for (const row of orgProducts) {
    await upsertProductServiceItem(supabase, row)
  }

  await deleteOrphanRows(
    supabase,
    'company_brand_kits',
    organizationId,
    new Set(orgBrandKits.map((r) => r.id)),
  )
  await deleteOrphanRows(
    supabase,
    'approved_messaging_items',
    organizationId,
    new Set(orgMessaging.map((r) => r.id)),
  )
  await deleteOrphanRows(supabase, 'case_study_items', organizationId, new Set(orgCases.map((r) => r.id)))
  await deleteOrphanRows(
    supabase,
    'product_service_items',
    organizationId,
    new Set(orgProducts.map((r) => r.id)),
  )
}

export async function loadCompanyLibraries({
  supabase,
  organizationId,
}: {
  supabase: CompanyLibraryCloudClient
  organizationId: string
}): Promise<CompanyLibraryCloudSnapshot> {
  const [brandResp, messagingResp, caseResp, productResp] = await Promise.all([
    supabase
      .from('company_brand_kits')
      .select(BRAND_KIT_COLUMNS)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('approved_messaging_items')
      .select(MESSAGING_COLUMNS)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('case_study_items')
      .select(CASE_COLUMNS)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('product_service_items')
      .select(PRODUCT_COLUMNS)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
  ])

  throwIfCloudError(brandResp.error, 'load brand kits')
  throwIfCloudError(messagingResp.error, 'load approved messaging')
  throwIfCloudError(caseResp.error, 'load case studies')
  throwIfCloudError(productResp.error, 'load products/services')

  return {
    brandKits: ((brandResp.data ?? []) as CloudRow[]).map(mapBrandKitRowToModel),
    approvedMessaging: ((messagingResp.data ?? []) as CloudRow[]).map(mapApprovedMessagingRowToModel),
    caseStudies: ((caseResp.data ?? []) as CloudRow[]).map(mapCaseStudyRowToModel),
    productsServices: ((productResp.data ?? []) as CloudRow[]).map(mapProductServiceRowToModel),
  }
}
