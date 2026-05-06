import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  defaultOwnerOnboardingDraft,
  loadOwnerOnboardingDraft,
  saveOwnerOnboardingDraft,
} from '../../data/ownerOnboardingDraft'

export function OnboardingCompanyKnowledgePage() {
  const navigate = useNavigate()
  const base = loadOwnerOnboardingDraft()
  const [labels, setLabels] = useState<string[]>(
    base.mockDocumentLabels?.length ? base.mockDocumentLabels : ['Pricing FAQ.pdf', 'Security overview.docx'],
  )
  const [draftLabel, setDraftLabel] = useState('')

  const handleAdd = () => {
    const trimmed = draftLabel.trim()
    if (!trimmed) {
      return
    }
    setLabels((prev) => [...prev, trimmed])
    setDraftLabel('')
  }

  const handleRemove = (label: string) => {
    setLabels((prev) => prev.filter((item) => item !== label))
  }

  const handleNext = () => {
    const prev = loadOwnerOnboardingDraft()
    saveOwnerOnboardingDraft({
      ...defaultOwnerOnboardingDraft(),
      ...prev,
      mockDocumentLabels: labels,
    })
    navigate('/onboarding/review')
  }

  const handleBack = () => {
    navigate('/onboarding/company-info')
  }

  return (
    <div className="onboarding-page">
      <header className="onboarding-page__header">
        <p className="section-label">Owner onboarding · Step 3 of 4</p>
        <h1>Knowledge uploads (mock)</h1>
        <p className="muted-copy">
          We keep filenames locally for now—after onboarding you can upload real assets into Company Brain’s
          Knowledge Library or the owner console.
        </p>
      </header>

      <div className="onboarding-page__card">
        <ul className="onboarding-mock-list">
          {labels.map((label) => (
            <li key={label}>
              <span>{label}</span>
              <button type="button" className="ghost-button ghost-button--sm" onClick={() => handleRemove(label)}>
                Remove
              </button>
            </li>
          ))}
        </ul>

        <div className="onboarding-inline-add">
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="Add another placeholder filename"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
          />
          <button type="button" className="secondary-button" onClick={handleAdd}>
            Add label
          </button>
        </div>

        <footer className="onboarding-page__footer">
          <button type="button" className="ghost-button" onClick={handleBack}>
            Back
          </button>
          <Link to="/dashboard" className="ghost-button">
            Exit to app
          </Link>
          <button type="button" className="primary-button" onClick={handleNext}>
            Continue
          </button>
        </footer>
      </div>
    </div>
  )
}
