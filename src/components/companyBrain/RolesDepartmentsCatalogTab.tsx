import { useState } from 'react'
import { useRenameModal } from '../workspace/useRenameModal'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type { CompanyBrainCatalogDepartment, CompanyBrainCatalogRole } from '../../types/models'

export function RolesDepartmentsCatalogTab({
  activeOrgId,
  admin,
  roles,
  departments,
  workspaceApi,
}: {
  activeOrgId: string
  admin: boolean
  roles: CompanyBrainCatalogRole[]
  departments: CompanyBrainCatalogDepartment[]
  workspaceApi: WorkspaceContextValue
}) {
  const [departmentNameDraft, setDepartmentNameDraft] = useState('')
  const [departmentDescDraft, setDepartmentDescDraft] = useState('')
  const [roleNameDraft, setRoleNameDraft] = useState('')
  const [roleDescDraft, setRoleDescDraft] = useState('')
  const [defaultDepartmentIdDraft, setDefaultDepartmentIdDraft] = useState('')
  const { openRename, renameModal } = useRenameModal()

  const activeDepartments = departments.filter((row) => !row.archived)
  const archivedDepartments = departments.filter((row) => row.archived)
  const activeRoles = roles.filter((row) => !row.archived)
  const archivedRoles = roles.filter((row) => row.archived)

  return (
    <div className="panel-card company-brain-panel company-brain-org-catalog">
      <h3>Company structure</h3>
      <p className="muted-copy">
        Company-managed roles and Company departments control what coworkers pick during workspace setup—local/mock
        for now.
      </p>

      <div className="company-brain-org-catalog__sections">
        <section className="company-brain-org-catalog__block">
          <h4>Company departments</h4>
          {!admin ? (
            <p className="muted-copy">Owners and admins can add, edit, and archive departments.</p>
          ) : (
            <>
              <div className="form-grid company-brain-mini-form">
                <label className="field-group">
                  <span className="field-label">Department name</span>
                  <input
                    value={departmentNameDraft}
                    onChange={(e) => setDepartmentNameDraft(e.target.value)}
                    placeholder="Engineering"
                  />
                </label>
                <label className="field-group field-group--wide">
                  <span className="field-label">Description (optional)</span>
                  <input
                    value={departmentDescDraft}
                    onChange={(e) => setDepartmentDescDraft(e.target.value)}
                    placeholder="Technical product development"
                  />
                </label>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!departmentNameDraft.trim()}
                  onClick={() => {
                    workspaceApi.upsertCompanyCatalogDepartment(activeOrgId, {
                      name: departmentNameDraft.trim(),
                      description: departmentDescDraft.trim() || undefined,
                    })
                    setDepartmentNameDraft('')
                    setDepartmentDescDraft('')
                  }}
                >
                  Add department
                </button>
              </div>
            </>
          )}
          <ul className="company-brain-inline-list">
            {activeDepartments.map((row) => (
              <li key={row.id}>
                <span>
                  <strong>{row.name}</strong>
                  {row.description ? <span className="muted-copy"> — {row.description}</span> : null}
                </span>
                {!admin ? null : (
                  <span className="company-brain-inline-list__actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        openRename({
                          title: 'Edit department',
                          initialValue: row.name,
                          inputLabel: 'Department name',
                          onSave: (name) =>
                            workspaceApi.upsertCompanyCatalogDepartment(activeOrgId, {
                              id: row.id,
                              name,
                              description: row.description,
                            }),
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => workspaceApi.archiveCompanyCatalogDepartment(activeOrgId, row.id)}
                    >
                      Archive
                    </button>
                  </span>
                )}
              </li>
            ))}
            {activeDepartments.length === 0 ? (
              <li className="muted-copy">No active departments configured.</li>
            ) : null}
          </ul>

          {!archivedDepartments.length ? null : (
            <details className="company-brain-collapsed-detail">
              <summary>Archived departments ({archivedDepartments.length})</summary>
              <ul className="company-brain-inline-list">
                {archivedDepartments.map((row) => (
                  <li key={row.id} className="muted-copy">
                    {row.name}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="company-brain-org-catalog__block">
          <h4>Company-managed roles</h4>
          {!admin ? (
            <p className="muted-copy">Owners and admins can add, edit, and archive roles.</p>
          ) : (
            <>
              <div className="form-grid company-brain-mini-form">
                <label className="field-group">
                  <span className="field-label">Role title</span>
                  <input
                    value={roleNameDraft}
                    onChange={(e) => setRoleNameDraft(e.target.value)}
                    placeholder="Account Executive"
                  />
                </label>
                <label className="field-group field-group--wide">
                  <span className="field-label">Description (optional)</span>
                  <input value={roleDescDraft} onChange={(e) => setRoleDescDraft(e.target.value)} />
                </label>
                <label className="field-group">
                  <span className="field-label">Default department (optional)</span>
                  <select
                    value={defaultDepartmentIdDraft}
                    onChange={(e) => setDefaultDepartmentIdDraft(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {activeDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!roleNameDraft.trim()}
                  onClick={() => {
                    workspaceApi.upsertCompanyCatalogRole(activeOrgId, {
                      name: roleNameDraft.trim(),
                      description: roleDescDraft.trim() || undefined,
                      defaultDepartmentId: defaultDepartmentIdDraft || undefined,
                    })
                    setRoleNameDraft('')
                    setRoleDescDraft('')
                    setDefaultDepartmentIdDraft('')
                  }}
                >
                  Add role
                </button>
              </div>
            </>
          )}
          <ul className="company-brain-inline-list">
            {activeRoles.map((row) => (
              <li key={row.id}>
                <span>
                  <strong>{row.name}</strong>
                  {row.description ? <span className="muted-copy"> — {row.description}</span> : null}
                </span>
                {!admin ? null : (
                  <span className="company-brain-inline-list__actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        openRename({
                          title: 'Edit role',
                          initialValue: row.name,
                          inputLabel: 'Role title',
                          onSave: (name) =>
                            workspaceApi.upsertCompanyCatalogRole(activeOrgId, {
                              id: row.id,
                              name,
                              description: row.description,
                              defaultDepartmentId: row.defaultDepartmentId,
                            }),
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => workspaceApi.archiveCompanyCatalogRole(activeOrgId, row.id)}
                    >
                      Archive
                    </button>
                  </span>
                )}
              </li>
            ))}
            {activeRoles.length === 0 ? (
              <li className="muted-copy">No active roles configured.</li>
            ) : null}
          </ul>

          {!archivedRoles.length ? null : (
            <details className="company-brain-collapsed-detail">
              <summary>Archived roles ({archivedRoles.length})</summary>
              <ul className="company-brain-inline-list">
                {archivedRoles.map((row) => (
                  <li key={row.id} className="muted-copy">
                    {row.name}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
      {renameModal}
    </div>
  )
}
