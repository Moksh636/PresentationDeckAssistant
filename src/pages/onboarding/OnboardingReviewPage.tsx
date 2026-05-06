import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWorkspace } from '../../context/useWorkspace'
import { clearOwnerOnboardingDraft, loadOwnerOnboardingDraft } from '../../data/ownerOnboardingDraft'
import type { KnowledgeOrgPreferenceMode } from '../../types/models'

function normalizePreference(value: string | undefined): KnowledgeOrgPreferenceMode {
  if (value === 'auto' || value === 'manual' || value === 'hybrid' || value === 'drive-like') {
    return value
  }
  return 'hybrid'
}

export function OnboardingReviewPage() {
  const navigate = useNavigate()
  const { completeCompanyBrainOnboarding } = useWorkspace()
  const draft = loadOwnerOnboardingDraft()

  const summary = useMemo(
    () => ({
      companyName: draft.companyName.trim(),
      website: draft.website.trim(),
      ownerDisplayName: draft.ownerDisplayName.trim(),
      tagline: draft.tagline?.trim() ?? '',
      preference: normalizePreference(draft.knowledgeOrgPreference || undefined),
      samples: draft.mockDocumentLabels ?? [],
    }),
    [draft],
  )

  const handleConfirm = () => {
    if (!summary.companyName) {
      navigate('/onboarding/company')
      return
    }

    completeCompanyBrainOnboarding({
      variant: 'owner-create',
      companyName: summary.companyName,
      website: summary.website,
      ownerDisplayName: summary.ownerDisplayName,
      knowledgeOrgPreference: summary.preference,
    })
    clearOwnerOnboardingDraft()
    navigate('/owner', { replace: true })
  }

  const handleBack = () => {
    navigate('/onboarding/company-knowledge')
  }

  return (
    <div className="onboarding-page">
      <header className="onboarding-page__header">
        <p className="section-label">Owner onboarding · Step 4 of 4</p>
        <h1>Review &amp; confirm</h1>
        <p className="muted-copy">
          We will create your organization workspace and drop you into the owner console.
        </p>
        <p className="muted-copy">
          Onboarding samples are demo-only; real Company Brain documents live under Company Brain → Knowledge
          Library and Source Materials.
        </p>
      </header>

      <div className="onboarding-page__card">
        <dl className="onboarding-summary">
          <div>
            <dt>Company</dt>
            <dd>{summary.companyName || '—'}</dd>
          </div>
          <div>
            <dt>Website</dt>
            <dd>{summary.website || '—'}</dd>
          </div>
          <div>
            <dt>Owner display name</dt>
            <dd>{summary.ownerDisplayName || '—'}</dd>
          </div>
          <div>
            <dt>Positioning note</dt>
            <dd>{summary.tagline || '—'}</dd>
          </div>
          <div>
            <dt>Knowledge preference</dt>
            <dd>{summary.preference}</dd>
          </div>
          <div>
            <dt>Mock uploads</dt>
            <dd>{summary.samples.length ? summary.samples.join(', ') : '—'}</dd>
          </div>
        </dl>

        <footer className="onboarding-page__footer">
          <button type="button" className="ghost-button" onClick={handleBack}>
            Back
          </button>
          <Link to="/dashboard" className="ghost-button">
            Exit to app
          </Link>
          <button type="button" className="primary-button" onClick={handleConfirm}>
            Finish setup
          </button>
        </footer>
      </div>
    </div>
  )
}
