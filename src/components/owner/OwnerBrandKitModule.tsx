import { useState } from 'react'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'

export function OwnerBrandKitModule({
  activeOrgId,
  organizationName,
  brandKit,
  deckFileOptions,
  workspaceApi,
}: {
  activeOrgId: string
  organizationName: string
  brandKit: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    fontFamily: string
    defaultDeckTone: string
    logoAssetId?: string
    id?: string
  } | null
  deckFileOptions: { id: string; name: string }[]
  workspaceApi: WorkspaceContextValue
}) {
  const [primary, setPrimary] = useState(brandKit?.primaryColor ?? '#111827')
  const [secondary, setSecondary] = useState(brandKit?.secondaryColor ?? '#6b7280')
  const [accent, setAccent] = useState(brandKit?.accentColor ?? '#2563eb')
  const [fontFamily, setFontFamily] = useState(brandKit?.fontFamily ?? 'system-ui')
  const [tone, setTone] = useState(brandKit?.defaultDeckTone ?? '')
  const [logoId, setLogoId] = useState(brandKit?.logoAssetId ?? '')

  return (
    <article className="owner-dashboard__card">
      <h2>Brand Kit</h2>
      <p className="muted-copy">Applies to future generated decks.</p>
      <p className="muted-copy">Organization: <strong>{organizationName}</strong></p>
      <div className="form-grid">
        <label className="field-group"><span className="field-label">Primary</span><input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} /></label>
        <label className="field-group"><span className="field-label">Secondary</span><input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} /></label>
        <label className="field-group"><span className="field-label">Accent</span><input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} /></label>
        <label className="field-group"><span className="field-label">Font family</span><input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Default deck tone</span><input value={tone} onChange={(e) => setTone(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Logo asset</span><select value={logoId} onChange={(e) => setLogoId(e.target.value)}><option value="">None</option>{deckFileOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <button type="button" className="primary-button" onClick={() => workspaceApi.upsertCompanyBrandKit(activeOrgId, { id: brandKit?.id, primaryColor: primary, secondaryColor: secondary, accentColor: accent, fontFamily, defaultDeckTone: tone, logoAssetId: logoId || undefined })}>Save brand kit</button>
      </div>
    </article>
  )
}
