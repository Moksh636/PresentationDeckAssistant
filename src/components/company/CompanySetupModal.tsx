import { useMemo, useState } from 'react'
import type { CompleteCompanyOnboardingInput } from '../../data/companyBrainMutations'

export interface CatalogPickerOption {
  id: string
  name: string
}

function findMatchingPickerOption(
  invitedLabel: string,
  options: CatalogPickerOption[],
): CatalogPickerOption | undefined {
  const trimmed = invitedLabel.trim()
  if (!trimmed) {
    return undefined
  }
  const lower = trimmed.toLowerCase()
  return options.find((opt) => opt.name.trim().toLowerCase() === lower)
}

interface CompanySetupModalProps {
  open: boolean
  onDismiss: () => void
  onComplete: (input: CompleteCompanyOnboardingInput) => void
  /** Non-archived catalog entries (template or org). */
  roleOptions: CatalogPickerOption[]
  departmentOptions: CatalogPickerOption[]
  invitedRoleTitle?: string
  invitedDepartment?: string
  roleLocked?: boolean
  departmentLocked?: boolean
}

export function CompanySetupModal({
  open,
  onDismiss,
  onComplete,
  roleOptions,
  departmentOptions,
  invitedRoleTitle,
  invitedDepartment,
  roleLocked,
  departmentLocked,
}: CompanySetupModalProps) {
  const [companyName, setCompanyName] = useState('')
  const [roleSelectId, setRoleSelectId] = useState(() => {
    const invited = invitedRoleTitle?.trim() ?? ''
    return findMatchingPickerOption(invited, roleOptions)?.id ?? ''
  })
  const [departmentSelectId, setDepartmentSelectId] = useState(() => {
    const invited = invitedDepartment?.trim() ?? ''
    return findMatchingPickerOption(invited, departmentOptions)?.id ?? ''
  })
  const [manualRoleTitle, setManualRoleTitle] = useState(() => {
    const invited = invitedRoleTitle?.trim() ?? ''
    const match = findMatchingPickerOption(invited, roleOptions)
    return invited.length > 0 && !match ? invited : ''
  })
  const [manualDepartment, setManualDepartment] = useState(() => {
    const invited = invitedDepartment?.trim() ?? ''
    const match = findMatchingPickerOption(invited, departmentOptions)
    return invited.length > 0 && !match ? invited : ''
  })

  const resolvedInvitedRole = invitedRoleTitle?.trim() ?? ''
  const resolvedInvitedDept = invitedDepartment?.trim() ?? ''

  const hasRoleCatalog = roleOptions.length > 0
  const hasDeptCatalog = departmentOptions.length > 0

  const chosenRoleTitle = useMemo(() => {
    if (roleLocked && resolvedInvitedRole) {
      return resolvedInvitedRole
    }
    if (hasRoleCatalog) {
      const name = roleOptions.find((opt) => opt.id === roleSelectId)?.name
      return name?.trim() ?? ''
    }
    return manualRoleTitle.trim()
  }, [
    hasRoleCatalog,
    manualRoleTitle,
    resolvedInvitedRole,
    roleLocked,
    roleOptions,
    roleSelectId,
  ])

  const chosenDepartment = useMemo(() => {
    if (departmentLocked && resolvedInvitedDept) {
      return resolvedInvitedDept
    }
    if (hasDeptCatalog) {
      const name = departmentOptions.find((opt) => opt.id === departmentSelectId)?.name
      return name?.trim() ?? ''
    }
    return manualDepartment.trim()
  }, [
    departmentLocked,
    departmentOptions,
    departmentSelectId,
    hasDeptCatalog,
    manualDepartment,
    resolvedInvitedDept,
  ])

  if (!open) {
    return null
  }

  const canSubmit =
    Boolean(companyName.trim()) &&
    Boolean(chosenRoleTitle.trim()) &&
    Boolean(chosenDepartment.trim())

  const handleSubmit = () => {
    if (!canSubmit) {
      return
    }

    onComplete({
      companyName: companyName.trim(),
      roleTitle: chosenRoleTitle.trim(),
      department: chosenDepartment.trim(),
    })

    setCompanyName('')
    setRoleSelectId('')
    setDepartmentSelectId('')
    setManualRoleTitle('')
    setManualDepartment('')
  }

  const roleControl = (
    <>
      {!hasRoleCatalog ? (
        <p className="muted-copy company-setup-catalog-hint">
          Your company has not configured roles yet. You can enter one manually for now.
        </p>
      ) : null}
      {!hasRoleCatalog || roleLocked ? null : (
        <label className="field-group field-group--wide">
          <span className="field-label">Your role</span>
          <select
            value={roleSelectId}
            onChange={(e) => setRoleSelectId(e.target.value)}
            aria-label="Choose your role"
          >
            <option value="">Choose a Company-managed role…</option>
            {roleOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!hasRoleCatalog && !roleLocked ? (
        <label className="field-group field-group--wide">
          <span className="field-label">Role / title (manual)</span>
          <input
            value={manualRoleTitle}
            onChange={(e) => setManualRoleTitle(e.target.value)}
            placeholder="Describe your role for now"
            autoComplete="organization-title"
          />
        </label>
      ) : null}
      {roleLocked ? (
        <label className="field-group field-group--wide">
          <span className="field-label">Your role (assigned)</span>
          <input readOnly value={chosenRoleTitle} aria-readonly />
        </label>
      ) : null}
    </>
  )

  const deptControl = (
    <>
      {!hasDeptCatalog ? (
        <p className="muted-copy company-setup-catalog-hint">
          Your company has not configured departments yet. You can enter one manually for now.
        </p>
      ) : null}
      {!hasDeptCatalog || departmentLocked ? null : (
        <label className="field-group field-group--wide">
          <span className="field-label">Company departments</span>
          <select
            value={departmentSelectId}
            onChange={(e) => setDepartmentSelectId(e.target.value)}
            aria-label="Choose your department"
          >
            <option value="">Choose your department…</option>
            {departmentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!hasDeptCatalog && !departmentLocked ? (
        <label className="field-group field-group--wide">
          <span className="field-label">Department (manual)</span>
          <input
            value={manualDepartment}
            onChange={(e) => setManualDepartment(e.target.value)}
            placeholder="e.g. Revenue, Product"
          />
        </label>
      ) : null}
      {departmentLocked ? (
        <label className="field-group field-group--wide">
          <span className="field-label">Department (assigned)</span>
          <input readOnly value={chosenDepartment} aria-readonly />
        </label>
      ) : null}
    </>
  )

  return (
    <div className="company-setup-modal-overlay" role="presentation">
      <div className="company-setup-modal" role="dialog" aria-labelledby="company-setup-heading">
        <header>
          <span className="section-label">Company Brain</span>
          <h2 id="company-setup-heading">Set up your workspace</h2>
          <p className="muted-copy">
            Capture your company name and how you show up in the org. Company-managed roles and Company
            departments keep everyone aligned—you can skip anytime; your decks and workspace keep working.
          </p>
        </header>

        <div className="form-grid">
          <label className="field-group field-group--wide">
            <span className="field-label">Company name</span>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Northstar Logistics"
              autoComplete="organization"
            />
          </label>

          <div className="field-group field-group--wide">
            <h3 className="company-setup-modal__subtitle">Roles / titles</h3>
            <p className="muted-copy">Company-managed roles</p>
            <p className="muted-copy">
              Your role helps Deckspace choose the right company knowledge for your work.
            </p>
            {roleControl}
          </div>

          <div className="field-group field-group--wide">
            <h3 className="company-setup-modal__subtitle">Department</h3>
            {deptControl}
          </div>
        </div>

        <footer className="company-setup-modal__actions">
          <button type="button" className="ghost-button" onClick={onDismiss}>
            Skip for now
          </button>
          <button type="button" className="primary-button" onClick={handleSubmit} disabled={!canSubmit}>
            Save &amp; continue
          </button>
        </footer>
      </div>
    </div>
  )
}
