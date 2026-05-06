import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { KnowledgeOrgPreferenceMode } from '../../types/models'
import {
  defaultOwnerOnboardingDraft,
  loadOwnerOnboardingDraft,
  saveOwnerOnboardingDraft,
} from '../../data/ownerOnboardingDraft'

const PREFS: Array<{ value: KnowledgeOrgPreferenceMode; label: string; hint: string }> = [
  { value: 'auto', label: 'Auto', hint: 'Let Deckspace file new uploads using mock AI suggestions first.' },
  { value: 'manual', label: 'Manual', hint: 'Folders stay exactly where owners place them.' },
  { value: 'hybrid', label: 'Hybrid', hint: 'Review AI suggestions, approve moves in bulk.' },
  {
    value: 'drive-like',
    label: 'Drive-like',
    hint: 'Flat library with light grouping—good for fast drag-and-drop habits.',
  },
]

export function OnboardingCompanyInfoPage() {
  const navigate = useNavigate()
  const base = loadOwnerOnboardingDraft()
  const [tagline, setTagline] = useState(() => base.tagline ?? '')
  const [knowledgeOrgPreference, setKnowledgeOrgPreference] = useState<KnowledgeOrgPreferenceMode | ''>(
    base.knowledgeOrgPreference || 'hybrid',
  )

  const handleNext = () => {
    const prev = loadOwnerOnboardingDraft()
    saveOwnerOnboardingDraft({
      ...defaultOwnerOnboardingDraft(),
      ...prev,
      knowledgeOrgPreference,
      tagline: tagline.trim(),
    })
    navigate('/onboarding/company-knowledge')
  }

  const handleBack = () => {
    navigate('/onboarding/company')
  }

  return (
    <div className="onboarding-page">
      <header className="onboarding-page__header">
        <p className="section-label">Owner onboarding · Step 2 of 4</p>
        <h1>Company snapshot</h1>
        <p className="muted-copy">Optional context for your team later—kept in session until you finish.</p>
      </header>

      <div className="onboarding-page__card">
        <label className="field-group field-group--wide">
          <span className="field-label">What do you sell? (optional)</span>
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One or two sentences about your offer."
            rows={4}
          />
        </label>

        <fieldset className="onboarding-fieldset">
          <legend>Knowledge library preference</legend>
          <p className="muted-copy">Mock AI folder suggestions respect this mode—no external models.</p>
          <div className="onboarding-radio-grid">
            {PREFS.map((p) => (
              <label key={p.value} className="onboarding-radio-tile">
                <input
                  type="radio"
                  name="kpref"
                  value={p.value}
                  checked={knowledgeOrgPreference === p.value}
                  onChange={() => setKnowledgeOrgPreference(p.value)}
                />
                <span>
                  <strong>{p.label}</strong>
                  <small>{p.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
