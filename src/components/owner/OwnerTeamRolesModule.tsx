import { RolesDepartmentsCatalogTab } from '../companyBrain/RolesDepartmentsCatalogTab'
import { OwnerWorkerPrepSection } from './OwnerConsolePanels'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type { CompanyBrainCatalogDepartment, CompanyBrainCatalogRole } from '../../types/models'

type TeamSubsection = 'workers' | 'invites' | 'roles' | 'departments'

export function OwnerTeamRolesModule({
  activeOrgId,
  admin,
  workspaceApi,
  departments,
  roles,
  teamSubsection,
  setTeamSubsection,
}: {
  activeOrgId: string
  admin: boolean
  workspaceApi: WorkspaceContextValue
  departments: CompanyBrainCatalogDepartment[]
  roles: CompanyBrainCatalogRole[]
  teamSubsection: TeamSubsection
  setTeamSubsection: (subsection: TeamSubsection) => void
}) {
  return (
    <div className="owner-module-layout__content">
      <aside className="owner-module-layout__sidebar">
        {(
          [
            ['workers', 'Workers'],
            ['invites', 'Invites'],
            ['roles', 'Roles'],
            ['departments', 'Departments'],
          ] as Array<[TeamSubsection, string]>
        ).map(([id, label]) => (
          <button key={id} type="button" className={teamSubsection === id ? 'is-active' : ''} onClick={() => setTeamSubsection(id)}>
            {label}
          </button>
        ))}
      </aside>
      <main className="owner-module-layout__main">
        <h2>Team & Roles</h2>
        {teamSubsection === 'workers' || teamSubsection === 'invites' ? (
          <OwnerWorkerPrepSection activeOrgId={activeOrgId} admin={admin} workspaceApi={workspaceApi} departments={departments} roles={roles} />
        ) : (
          <RolesDepartmentsCatalogTab activeOrgId={activeOrgId} admin={admin} departments={departments} roles={roles} workspaceApi={workspaceApi} />
        )}
      </main>
    </div>
  )
}
