import type {
  CompanyBrainCatalogDepartment,
  CompanyBrainCatalogRole,
  Organization,
  OrganizationMembership,
  WorkerInvite,
} from '../types/models'

const ORG_COLUMNS = 'id,name,slug,created_by_user_id,created_at,updated_at'
const MEMBERSHIP_COLUMNS =
  'id,organization_id,user_id,email,display_name,role_title,department,access_role,created_at,updated_at,invited_role_title,invited_department,role_locked,department_locked'
const ROLE_COLUMNS =
  'id,organization_id,name,description,default_department_id,archived,created_at,updated_at'
const DEPARTMENT_COLUMNS = 'id,organization_id,name,description,archived,created_at,updated_at'
const INVITE_COLUMNS =
  'id,organization_id,email,display_name,invited_role_title,invited_department,access_role,role_locked,department_locked,status,created_by_user_id,created_at,updated_at,joined_user_id,joined_at'

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

export interface CompanyBrainCloudClient {
  from: (tableName: string) => CloudTableApi
}

export interface CompanyIdentityCloudSnapshot {
  organizations: Organization[]
  organizationMemberships: OrganizationMembership[]
  companyRoles: CompanyBrainCatalogRole[]
  companyDepartments: CompanyBrainCatalogDepartment[]
  workerInvites: WorkerInvite[]
}

export interface SaveOrganizationIdentityInput extends CompanyIdentityCloudSnapshot {
  userId: string
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function throwIfCloudError(error: CloudQueryError | null, action: string) {
  if (error) {
    throw new Error(error.message ?? `Cloud ${action} failed.`)
  }
}

export function mapOrganizationToRow(model: Organization): CloudRow {
  return {
    id: model.id,
    name: model.name,
    slug: model.slug,
    created_by_user_id: model.createdByUserId,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
  }
}

export function mapOrganizationRowToModel(row: CloudRow): Organization {
  return {
    id: asString(row.id),
    name: asString(row.name, 'Organization'),
    slug: asString(row.slug, 'organization'),
    createdByUserId: asString(row.created_by_user_id),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export function mapMembershipToRow(model: OrganizationMembership): CloudRow {
  return {
    id: model.id,
    organization_id: model.organizationId,
    user_id: model.userId,
    email: model.email,
    display_name: model.displayName,
    role_title: model.roleTitle,
    department: model.department,
    access_role: model.accessRole,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
    invited_role_title: model.invitedRoleTitle ?? null,
    invited_department: model.invitedDepartment ?? null,
    role_locked: model.roleLocked === true,
    department_locked: model.departmentLocked === true,
  }
}

export function mapMembershipRowToModel(row: CloudRow): OrganizationMembership {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    userId: asString(row.user_id),
    email: asString(row.email),
    displayName: asString(row.display_name),
    roleTitle: asString(row.role_title),
    department: asString(row.department),
    accessRole: asString(row.access_role, 'member') as OrganizationMembership['accessRole'],
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    invitedRoleTitle: asOptionalString(row.invited_role_title),
    invitedDepartment: asOptionalString(row.invited_department),
    roleLocked: asBoolean(row.role_locked) ? true : undefined,
    departmentLocked: asBoolean(row.department_locked) ? true : undefined,
  }
}

export function mapRoleToRow(model: CompanyBrainCatalogRole): CloudRow {
  return {
    id: model.id,
    organization_id: model.organizationId,
    name: model.name,
    description: model.description ?? null,
    default_department_id: model.defaultDepartmentId ?? null,
    archived: model.archived === true,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
  }
}

export function mapRoleRowToModel(row: CloudRow): CompanyBrainCatalogRole {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    name: asString(row.name, 'Role'),
    description: asOptionalString(row.description),
    defaultDepartmentId: asOptionalString(row.default_department_id),
    archived: asBoolean(row.archived) ? true : undefined,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export function mapDepartmentToRow(model: CompanyBrainCatalogDepartment): CloudRow {
  return {
    id: model.id,
    organization_id: model.organizationId,
    name: model.name,
    description: model.description ?? null,
    archived: model.archived === true,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
  }
}

export function mapDepartmentRowToModel(row: CloudRow): CompanyBrainCatalogDepartment {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    name: asString(row.name, 'Department'),
    description: asOptionalString(row.description),
    archived: asBoolean(row.archived) ? true : undefined,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export function mapWorkerInviteToRow(model: WorkerInvite): CloudRow {
  return {
    id: model.id,
    organization_id: model.organizationId,
    email: model.email,
    display_name: model.displayName ?? null,
    invited_role_title: model.invitedRoleTitle ?? null,
    invited_department: model.invitedDepartment ?? null,
    access_role: model.accessRole,
    role_locked: model.roleLocked === true,
    department_locked: model.departmentLocked === true,
    status: model.status,
    created_by_user_id: model.createdByUserId,
    created_at: model.createdAt,
    updated_at: model.updatedAt,
    joined_user_id: model.joinedUserId ?? null,
    joined_at: model.joinedAt ?? null,
  }
}

export function mapWorkerInviteRowToModel(row: CloudRow): WorkerInvite {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    email: asString(row.email),
    displayName: asOptionalString(row.display_name),
    invitedRoleTitle: asOptionalString(row.invited_role_title),
    invitedDepartment: asOptionalString(row.invited_department),
    accessRole: asString(row.access_role, 'member') as WorkerInvite['accessRole'],
    roleLocked: asBoolean(row.role_locked) ? true : undefined,
    departmentLocked: asBoolean(row.department_locked) ? true : undefined,
    status: asString(row.status, 'draft') as WorkerInvite['status'],
    createdByUserId: asString(row.created_by_user_id),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    joinedUserId: asOptionalString(row.joined_user_id),
    joinedAt: asOptionalString(row.joined_at),
  }
}

export async function upsertOrganization(supabase: CompanyBrainCloudClient, organization: Organization) {
  const { error } = await supabase
    .from('organizations')
    .upsert(mapOrganizationToRow(organization), { onConflict: 'id' })
    .select(ORG_COLUMNS)
  throwIfCloudError(error, 'upsert organization')
}

export async function upsertMembership(supabase: CompanyBrainCloudClient, membership: OrganizationMembership) {
  const { error } = await supabase
    .from('organization_memberships')
    .upsert(mapMembershipToRow(membership), { onConflict: 'id' })
    .select(MEMBERSHIP_COLUMNS)
  throwIfCloudError(error, 'upsert membership')
}

export async function upsertRole(supabase: CompanyBrainCloudClient, role: CompanyBrainCatalogRole) {
  const { error } = await supabase
    .from('organization_roles')
    .upsert(mapRoleToRow(role), { onConflict: 'id' })
    .select(ROLE_COLUMNS)
  throwIfCloudError(error, 'upsert role')
}

export async function upsertDepartment(supabase: CompanyBrainCloudClient, department: CompanyBrainCatalogDepartment) {
  const { error } = await supabase
    .from('organization_departments')
    .upsert(mapDepartmentToRow(department), { onConflict: 'id' })
    .select(DEPARTMENT_COLUMNS)
  throwIfCloudError(error, 'upsert department')
}

export async function upsertWorkerInvite(supabase: CompanyBrainCloudClient, invite: WorkerInvite) {
  const { error } = await supabase
    .from('organization_worker_invites')
    .upsert(mapWorkerInviteToRow(invite), { onConflict: 'id' })
    .select(INVITE_COLUMNS)
  throwIfCloudError(error, 'upsert worker invite')
}

export async function archiveRole(supabase: CompanyBrainCloudClient, roleId: string) {
  const { error } = await supabase.from('organization_roles').update({ archived: true }).eq('id', roleId)
  throwIfCloudError(error, 'archive role')
}

export async function deleteRole(supabase: CompanyBrainCloudClient, roleId: string) {
  const { error } = await supabase.from('organization_roles').delete().eq('id', roleId)
  throwIfCloudError(error, 'delete role')
}

export async function archiveDepartment(supabase: CompanyBrainCloudClient, departmentId: string) {
  const { error } = await supabase
    .from('organization_departments')
    .update({ archived: true })
    .eq('id', departmentId)
  throwIfCloudError(error, 'archive department')
}

export async function deleteDepartment(supabase: CompanyBrainCloudClient, departmentId: string) {
  const { error } = await supabase.from('organization_departments').delete().eq('id', departmentId)
  throwIfCloudError(error, 'delete department')
}

export async function updateWorkerInviteStatus(
  supabase: CompanyBrainCloudClient,
  inviteId: string,
  status: WorkerInvite['status'],
) {
  const { error } = await supabase
    .from('organization_worker_invites')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', inviteId)
  throwIfCloudError(error, 'update worker invite status')
}

export async function saveOrganizationIdentity({
  supabase,
  userId,
  organizations,
  organizationMemberships,
  companyRoles,
  companyDepartments,
  workerInvites,
}: {
  supabase: CompanyBrainCloudClient
} & SaveOrganizationIdentityInput): Promise<void> {
  for (const organization of organizations) {
    await upsertOrganization(supabase, organization)
  }

  for (const membership of organizationMemberships) {
    await upsertMembership(supabase, membership)
  }

  for (const role of companyRoles) {
    await upsertRole(supabase, role)
  }

  for (const department of companyDepartments) {
    await upsertDepartment(supabase, department)
  }

  for (const invite of workerInvites) {
    await upsertWorkerInvite(supabase, invite)
  }

  const ownerMembershipExists = organizationMemberships.some((row) => row.userId === userId)
  if (!ownerMembershipExists) {
    throw new Error('Cloud save blocked: no membership row found for current user.')
  }
}

export async function loadOrganizationIdentity({
  supabase,
  userId,
}: {
  supabase: CompanyBrainCloudClient
  userId: string
}): Promise<CompanyIdentityCloudSnapshot> {
  const membershipsResponse = await supabase
    .from('organization_memberships')
    .select(MEMBERSHIP_COLUMNS)
    .eq('user_id', userId)
  throwIfCloudError(membershipsResponse.error, 'load memberships for user')
  const myMembershipRows = (membershipsResponse.data ?? []) as CloudRow[]
  const orgIds = Array.from(new Set(myMembershipRows.map((row) => asString(row.organization_id)).filter(Boolean)))

  if (orgIds.length === 0) {
    return {
      organizations: [],
      organizationMemberships: [],
      companyRoles: [],
      companyDepartments: [],
      workerInvites: [],
    }
  }

  const [orgResponse, roleResponse, deptResponse, inviteResponse, orgMembershipResponse] = await Promise.all([
    supabase.from('organizations').select(ORG_COLUMNS).in('id', orgIds),
    supabase
      .from('organization_roles')
      .select(ROLE_COLUMNS)
      .in('organization_id', orgIds)
      .order('updated_at', { ascending: false }),
    supabase
      .from('organization_departments')
      .select(DEPARTMENT_COLUMNS)
      .in('organization_id', orgIds)
      .order('updated_at', { ascending: false }),
    supabase
      .from('organization_worker_invites')
      .select(INVITE_COLUMNS)
      .in('organization_id', orgIds)
      .order('updated_at', { ascending: false }),
    supabase.from('organization_memberships').select(MEMBERSHIP_COLUMNS).in('organization_id', orgIds),
  ])

  throwIfCloudError(orgResponse.error, 'load organizations')
  throwIfCloudError(roleResponse.error, 'load roles')
  throwIfCloudError(deptResponse.error, 'load departments')
  throwIfCloudError(inviteResponse.error, 'load worker invites')
  throwIfCloudError(orgMembershipResponse.error, 'load org memberships')

  return {
    organizations: ((orgResponse.data ?? []) as CloudRow[]).map(mapOrganizationRowToModel),
    organizationMemberships: ((orgMembershipResponse.data ?? []) as CloudRow[]).map(mapMembershipRowToModel),
    companyRoles: ((roleResponse.data ?? []) as CloudRow[]).map(mapRoleRowToModel),
    companyDepartments: ((deptResponse.data ?? []) as CloudRow[]).map(mapDepartmentRowToModel),
    workerInvites: ((inviteResponse.data ?? []) as CloudRow[]).map(mapWorkerInviteRowToModel),
  }
}
