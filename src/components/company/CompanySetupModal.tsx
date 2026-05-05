import { useState } from 'react'

interface CompanySetupModalProps {
  open: boolean
  onDismiss: () => void
  onComplete: (input: { companyName: string; roleTitle: string; department: string }) => void
}

export function CompanySetupModal({ open, onDismiss, onComplete }: CompanySetupModalProps) {
  const [companyName, setCompanyName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [department, setDepartment] = useState('')

  if (!open) {
    return null
  }

  const handleSubmit = () => {
    const trimmedCompany = companyName.trim()
    if (!trimmedCompany || !roleTitle.trim() || !department.trim()) {
      return
    }

    onComplete({
      companyName: trimmedCompany,
      roleTitle: roleTitle.trim(),
      department: department.trim(),
    })
    setCompanyName('')
    setRoleTitle('')
    setDepartment('')
  }

  return (
    <div className="company-setup-modal-overlay" role="presentation">
      <div className="company-setup-modal" role="dialog" aria-labelledby="company-setup-heading">
        <header>
          <span className="section-label">Company Brain</span>
          <h2 id="company-setup-heading">Set up your workspace</h2>
          <p className="muted-copy">
            Capture your company name and how you show up in the org. You can skip anytime—your decks and
            workspace keep working.
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

          <label className="field-group">
            <span className="field-label">Your role / title</span>
            <input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. AE, Enterprise"
              autoComplete="organization-title"
            />
          </label>

          <label className="field-group">
            <span className="field-label">Department</span>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Revenue, Product"
            />
          </label>
        </div>

        <footer className="company-setup-modal__actions">
          <button type="button" className="ghost-button" onClick={onDismiss}>
            Skip for now
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSubmit}
            disabled={!companyName.trim() || !roleTitle.trim() || !department.trim()}
          >
            Save &amp; continue
          </button>
        </footer>
      </div>
    </div>
  )
}
