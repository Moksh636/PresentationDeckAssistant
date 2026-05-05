import type { CompanyBrainCatalogDepartment, CompanyBrainCatalogRole } from '../types/models'
import { createId } from '../utils/ids.ts'

/** Default departments for newly created local/mock org workspaces. */
export const DEFAULT_COMPANY_DEPARTMENTS: readonly string[] = [
  'Sales',
  'Marketing',
  'Product',
  'Engineering',
  'Operations',
  'Customer Success',
  'Finance',
  'Legal',
] as const

/** Default job roles for newly created local/mock org workspaces. */
export const DEFAULT_COMPANY_ROLES: readonly string[] = [
  'Account Executive',
  'Sales Manager',
  'Marketing Manager',
  'Product Manager',
  'Software Engineer',
  'Operations Manager',
  'Customer Success Manager',
  'Finance Analyst',
  'Legal Reviewer',
] as const

/** Stable template pickers shown before any org exists (same labels as seeded catalogs). */
export function buildTemplateDepartmentPickerOptions(): { id: string; name: string }[] {
  return DEFAULT_COMPANY_DEPARTMENTS.map((name, i) => ({ id: `template-dept-${i}`, name }))
}

export function buildTemplateRolePickerOptions(): { id: string; name: string }[] {
  return DEFAULT_COMPANY_ROLES.map((name, i) => ({ id: `template-role-${i}`, name }))
}

export function seedCompanyCatalogForOrganization(params: {
  organizationId: string
  iso: string
}): {
  companyDepartments: CompanyBrainCatalogDepartment[]
  companyRoles: CompanyBrainCatalogRole[]
} {
  const { organizationId, iso } = params
  const companyDepartments: CompanyBrainCatalogDepartment[] = DEFAULT_COMPANY_DEPARTMENTS.map((name) => ({
    id: createId('cdept'),
    organizationId,
    name,
    createdAt: iso,
    updatedAt: iso,
  }))
  const companyRoles: CompanyBrainCatalogRole[] = DEFAULT_COMPANY_ROLES.map((name) => ({
    id: createId('crole'),
    organizationId,
    name,
    createdAt: iso,
    updatedAt: iso,
  }))
  return { companyDepartments, companyRoles }
}
