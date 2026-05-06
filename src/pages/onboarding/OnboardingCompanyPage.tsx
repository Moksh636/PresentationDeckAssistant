import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  defaultOwnerOnboardingDraft,
  loadOwnerOnboardingDraft,
  saveOwnerOnboardingDraft,
} from '../../data/ownerOnboardingDraft'

export function OnboardingCompanyPage() {
  const navigate = useNavigate()
  const initial = loadOwnerOnboardingDraft()
  const [companyName, setCompanyName] = useState(initial.companyName || '')
  const [website, setWebsite] = useState(initial.website || '')
  const [ownerDisplayName, setOwnerDisplayName] = useState(initial.ownerDisplayName || '')

  const handleNext = () => {
    saveOwnerOnboardingDraft({
      ...defaultOwnerOnboardingDraft(),
      ...loadOwnerOnboardingDraft(),
      companyName: companyName.trim(),
      website: website.trim(),
      ownerDisplayName: ownerDisplayName.trim(),
    })
    navigate('/onboarding/company-info')
  }

  return (
    <div className="onboarding-page">
      <header className="onboarding-page__header">
        <p className="section-label">Owner onboarding · Step 1 of 4</p>
        <h1>Company basics</h1>
        <p className="muted-copy">Tell us how your organization should appear inside Deckspace.</p>
      </header>

      <div className="onboarding-page__card">
        <label className="field-group field-group--wide">
          <span className="field-label">Company name</span>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Northstar Logistics"
            autoComplete="organization"
          />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Website (optional)</span>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            autoComplete="url"
          />
        </label>
        <label className="field-group field-group--wide">
          <span className="field-label">Your name (optional)</span>
          <input
            value={ownerDisplayName}
            onChange={(e) => setOwnerDisplayName(e.target.value)}
            placeholder="Shown on your membership card"
            autoComplete="name"
          />
        </label>

        <footer className="onboarding-page__footer">
          <Link to="/dashboard" className="ghost-button">
            Cancel
          </Link>
          <button
            type="button"
            className="primary-button"
            disabled={!companyName.trim()}
            onClick={handleNext}
          >
            Continue
          </button>
        </footer>
      </div>
    </div>
  )
}
