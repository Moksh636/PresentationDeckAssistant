import { useState } from 'react'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type { ProductServiceItem } from '../../types/models'

export function OwnerProductsServicesModule({
  activeOrgId,
  items,
  workspaceApi,
  search,
  setSearch,
}: {
  activeOrgId: string
  items: ProductServiceItem[]
  workspaceApi: WorkspaceContextValue
  search: string
  setSearch: (value: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targetBuyer, setTargetBuyer] = useState('')
  const [benefits, setBenefits] = useState('')
  const [proof, setProof] = useState('')
  const [objections, setObjections] = useState('')
  const rows = items.filter((item) => `${item.name} ${item.description} ${item.targetBuyer}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <article className="owner-dashboard__card">
      <h2>Products & Services</h2>
      <div className="company-brain-filters"><label><span>Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
      <div className="form-grid">
        <label className="field-group"><span className="field-label">Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field-group"><span className="field-label">Primary buyer</span><input value={targetBuyer} onChange={(e) => setTargetBuyer(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Description</span><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Key benefits (one per line)</span><textarea rows={3} value={benefits} onChange={(e) => setBenefits(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Proof points (one per line)</span><textarea rows={3} value={proof} onChange={(e) => setProof(e.target.value)} /></label>
        <label className="field-group field-group--wide"><span className="field-label">Common objections (one per line)</span><textarea rows={3} value={objections} onChange={(e) => setObjections(e.target.value)} /></label>
        <button type="button" className="primary-button" disabled={!name.trim()} onClick={() => { workspaceApi.upsertCompanyProductService(activeOrgId, { name, description, targetBuyer, keyBenefits: benefits.split('\n').map((v) => v.trim()).filter(Boolean), proofPoints: proof.split('\n').map((v) => v.trim()).filter(Boolean), commonObjections: objections.split('\n').map((v) => v.trim()).filter(Boolean) }); setName(''); setDescription(''); setTargetBuyer(''); setBenefits(''); setProof(''); setObjections('') }}>Save offering</button>
      </div>
      {!rows.length ? <p className="muted-copy">No offerings added yet. Capture at least one core product/service.</p> : (
        <ul className="company-brain-list">{rows.map((product) => <li key={product.id} className="company-brain-card"><strong>{product.name}</strong><p className="muted-copy">{product.description}</p><button type="button" className="ghost-button" onClick={() => workspaceApi.deleteCompanyProductService(activeOrgId, product.id)}>Delete</button></li>)}</ul>
      )}
    </article>
  )
}
