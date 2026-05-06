import type { CompanyKnowledgeItem, KnowledgeApprovalStatus, KnowledgeFolder } from '../types/models'

const FOLDER_COLUMNS = 'id,organization_id,name,parent_folder_id,created_at,updated_at'
const ITEM_COLUMNS =
  'id,organization_id,folder_id,uploaded_by_user_id,title,description,file_asset_id,source_type,tags,approval_status,visibility,allowed_departments,allowed_role_titles,created_at,updated_at,last_reviewed_at'

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
  delete: () => CloudMutationFilterBuilder
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

export interface CompanyKnowledgeCloudClient {
  from: (tableName: string) => CloudTableApi
}

export interface CompanyKnowledgeCloudSnapshot {
  knowledgeFolders: KnowledgeFolder[]
  knowledgeItems: CompanyKnowledgeItem[]
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

function throwIfCloudError(error: CloudQueryError | null, action: string) {
  if (error) {
    throw new Error(error.message ?? `Cloud ${action} failed.`)
  }
}

export function mapKnowledgeFolderToRow(folder: KnowledgeFolder): CloudRow {
  return {
    id: folder.id,
    organization_id: folder.organizationId,
    name: folder.name,
    parent_folder_id: folder.parentFolderId ?? null,
    created_at: folder.createdAt,
    updated_at: folder.updatedAt,
  }
}

export function mapKnowledgeFolderRowToModel(row: CloudRow): KnowledgeFolder {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    name: asString(row.name, 'Folder'),
    parentFolderId: asOptionalString(row.parent_folder_id),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export function mapKnowledgeItemToRow(item: CompanyKnowledgeItem): CloudRow {
  return {
    id: item.id,
    organization_id: item.organizationId,
    folder_id: item.folderId ?? null,
    uploaded_by_user_id: item.uploadedByUserId,
    title: item.title,
    description: item.description,
    file_asset_id: item.fileAssetId ?? null,
    source_type: item.sourceType,
    tags: item.tags,
    approval_status: item.approvalStatus,
    visibility: item.visibility,
    allowed_departments: item.allowedDepartments ?? null,
    allowed_role_titles: item.allowedRoleTitles ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    last_reviewed_at: item.lastReviewedAt ?? null,
  }
}

export function mapKnowledgeItemRowToModel(row: CloudRow): CompanyKnowledgeItem {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    folderId: asOptionalString(row.folder_id),
    uploadedByUserId: asString(row.uploaded_by_user_id),
    title: asString(row.title, 'Knowledge item'),
    description: asString(row.description),
    fileAssetId: asOptionalString(row.file_asset_id),
    sourceType: asString(row.source_type, 'notes') as CompanyKnowledgeItem['sourceType'],
    tags: asStringArray(row.tags),
    approvalStatus: asString(row.approval_status, 'needs-review') as KnowledgeApprovalStatus,
    visibility: asString(row.visibility, 'company') as CompanyKnowledgeItem['visibility'],
    allowedDepartments: asStringArray(row.allowed_departments),
    allowedRoleTitles: asStringArray(row.allowed_role_titles),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    lastReviewedAt: asOptionalString(row.last_reviewed_at),
  }
}

export async function upsertKnowledgeFolder(
  supabase: CompanyKnowledgeCloudClient,
  folder: KnowledgeFolder,
): Promise<void> {
  const { error } = await supabase
    .from('knowledge_folders')
    .upsert(mapKnowledgeFolderToRow(folder), { onConflict: 'id' })
    .select(FOLDER_COLUMNS)
  throwIfCloudError(error, 'upsert knowledge folder')
}

export async function upsertKnowledgeItem(
  supabase: CompanyKnowledgeCloudClient,
  item: CompanyKnowledgeItem,
): Promise<void> {
  const { error } = await supabase
    .from('company_knowledge_items')
    .upsert(mapKnowledgeItemToRow(item), { onConflict: 'id' })
    .select(ITEM_COLUMNS)
  throwIfCloudError(error, 'upsert knowledge item')
}

export async function archiveKnowledgeFolder(
  supabase: CompanyKnowledgeCloudClient,
  _organizationId: string,
  folderId: string,
): Promise<void> {
  const { error } = await supabase
    .from('company_knowledge_items')
    .update({ folder_id: null, updated_at: new Date().toISOString() })
    .eq('folder_id', folderId)
  throwIfCloudError(error, 'clear folder on knowledge items')

  const { error: deleteError } = await supabase.from('knowledge_folders').delete().eq('id', folderId)
  throwIfCloudError(deleteError, 'archive knowledge folder')
}

export async function deleteKnowledgeFolder(
  supabase: CompanyKnowledgeCloudClient,
  organizationId: string,
  folderId: string,
): Promise<void> {
  await archiveKnowledgeFolder(supabase, organizationId, folderId)
}

export async function approveKnowledgeItem(
  supabase: CompanyKnowledgeCloudClient,
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from('company_knowledge_items')
    .update({ approval_status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', itemId)
  throwIfCloudError(error, 'approve knowledge item')
}

export async function rejectKnowledgeItem(
  supabase: CompanyKnowledgeCloudClient,
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from('company_knowledge_items')
    .update({ approval_status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', itemId)
  throwIfCloudError(error, 'reject knowledge item')
}

export async function moveKnowledgeItemToFolder(
  supabase: CompanyKnowledgeCloudClient,
  itemId: string,
  folderId?: string,
): Promise<void> {
  const { error } = await supabase
    .from('company_knowledge_items')
    .update({ folder_id: folderId ?? null, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  throwIfCloudError(error, 'move knowledge item to folder')
}

export async function saveCompanyKnowledge({
  supabase,
  organizationId,
  knowledgeFolders,
  knowledgeItems,
}: {
  supabase: CompanyKnowledgeCloudClient
  organizationId: string
  knowledgeFolders: KnowledgeFolder[]
  knowledgeItems: CompanyKnowledgeItem[]
}): Promise<void> {
  for (const folder of knowledgeFolders.filter((row) => row.organizationId === organizationId)) {
    await upsertKnowledgeFolder(supabase, folder)
  }
  for (const item of knowledgeItems.filter((row) => row.organizationId === organizationId)) {
    await upsertKnowledgeItem(supabase, item)
  }
}

export async function loadCompanyKnowledge({
  supabase,
  organizationId,
}: {
  supabase: CompanyKnowledgeCloudClient
  organizationId: string
}): Promise<CompanyKnowledgeCloudSnapshot> {
  const [folderResponse, itemResponse] = await Promise.all([
    supabase
      .from('knowledge_folders')
      .select(FOLDER_COLUMNS)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('company_knowledge_items')
      .select(ITEM_COLUMNS)
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false }),
  ])
  throwIfCloudError(folderResponse.error, 'load knowledge folders')
  throwIfCloudError(itemResponse.error, 'load knowledge items')

  return {
    knowledgeFolders: ((folderResponse.data ?? []) as CloudRow[]).map(mapKnowledgeFolderRowToModel),
    knowledgeItems: ((itemResponse.data ?? []) as CloudRow[]).map(mapKnowledgeItemRowToModel),
  }
}
