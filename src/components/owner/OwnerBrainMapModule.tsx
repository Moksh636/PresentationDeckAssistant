import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { WorkspaceContextValue } from '../../context/workspaceStoreContext'
import type {
  CompanyBrainDecision,
  CompanyBrainMapApprovalStatus,
  CompanyBrainPolicy,
  CompanyBrainSkillFile,
  CompanyBrainSystem,
  CompanyKnowledgeItem,
  CompanyKnowledgeSourceType,
} from '../../types/models'

type BrainNav = 'overview' | 'processes' | 'policies' | 'decisions' | 'systems' | 'skills'

const BRAIN_APPROVAL_OPTIONS: CompanyBrainMapApprovalStatus[] = [
  'draft',
  'approved',
  'needs-review',
  'archived',
]

const SOURCE_OPTIONS: CompanyKnowledgeSourceType[] = [
  'contract',
  'deck',
  'proposal',
  'notes',
  'case-study',
  'product-doc',
  'policy',
  'transcript',
  'other',
]

function parseIds(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function OwnerBrainMapModule({
  activeOrgId,
  admin,
  workspaceApi,
  knowledgeItems,
  departments,
  roleNames,
}: {
  activeOrgId: string
  admin: boolean
  workspaceApi: WorkspaceContextValue
  knowledgeItems: CompanyKnowledgeItem[]
  departments: { id: string; name: string }[]
  roleNames: string[]
}) {
  const [nav, setNav] = useState<BrainNav>('overview')
  const [deptFilter, setDeptFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<CompanyBrainMapApprovalStatus | 'any'>('any')

  const slice = workspaceApi.workspace.companyBrain
  const processes = useMemo(
    () => slice.brainProcesses.filter((p) => p.organizationId === activeOrgId),
    [slice.brainProcesses, activeOrgId],
  )
  const policies = useMemo(
    () => slice.brainPolicies.filter((p) => p.organizationId === activeOrgId),
    [slice.brainPolicies, activeOrgId],
  )
  const decisions = useMemo(
    () => slice.brainDecisions.filter((p) => p.organizationId === activeOrgId),
    [slice.brainDecisions, activeOrgId],
  )
  const systems = useMemo(
    () => slice.brainSystems.filter((p) => p.organizationId === activeOrgId),
    [slice.brainSystems, activeOrgId],
  )
  const skillFiles = useMemo(
    () => slice.brainSkillFiles.filter((p) => p.organizationId === activeOrgId),
    [slice.brainSkillFiles, activeOrgId],
  )

  const matchesDeptRoleStatus = (
    dept?: string,
    role?: string,
    approval?: CompanyBrainMapApprovalStatus,
  ) => {
    const d = deptFilter.trim().toLowerCase()
    const r = roleFilter.trim().toLowerCase()
    if (d && !(dept ?? '').toLowerCase().includes(d)) return false
    if (r && !(role ?? '').toLowerCase().includes(r)) return false
    if (statusFilter !== 'any' && approval !== statusFilter) return false
    return true
  }

  const filteredProcesses = processes.filter((p) =>
    matchesDeptRoleStatus(p.department, p.ownerRoleTitle, p.approvalStatus),
  )
  const filteredPolicies = policies.filter((p) =>
    matchesDeptRoleStatus(
      p.appliesToDepartments.join(' '),
      p.appliesToRoleTitles.join(' '),
      p.approvalStatus,
    ),
  )
  const filteredSkillFiles = skillFiles.filter((s) =>
    matchesDeptRoleStatus(undefined, undefined, s.approvalStatus),
  )

  const [procDraft, setProcDraft] = useState({
    title: '',
    description: '',
    category: '',
    department: '',
    ownerRoleTitle: '',
    steps: '',
    inputs: '',
    outputs: '',
    relatedKnowledge: '',
    relatedRoles: '',
    approvalStatus: 'draft' as CompanyBrainMapApprovalStatus,
  })

  const [polDraft, setPolDraft] = useState({
    title: '',
    summary: '',
    policyType: 'pricing' as CompanyBrainPolicy['policyType'],
    rules: '',
    appliesToDepartments: '',
    appliesToRoleTitles: '',
    relatedKnowledge: '',
    approvalStatus: 'draft' as CompanyBrainMapApprovalStatus,
  })

  const [decDraft, setDecDraft] = useState({
    title: '',
    summary: '',
    decisionType: 'customer' as CompanyBrainDecision['decisionType'],
    context: '',
    outcome: '',
    ownerRoleTitle: '',
    relatedKnowledge: '',
  })

  const [sysDraft, setSysDraft] = useState({
    name: '',
    systemType: 'crm' as CompanyBrainSystem['systemType'],
    description: '',
    ownerRoleTitle: '',
    connectedStatus: 'planned' as CompanyBrainSystem['connectedStatus'],
    notes: '',
  })

  const [skillDraft, setSkillDraft] = useState({
    title: '',
    description: '',
    skillType: 'custom' as CompanyBrainSkillFile['skillType'],
    instructions: '',
    requiredInputs: '',
    outputFormat: '',
    allowedSources: [] as CompanyKnowledgeSourceType[],
    relatedKnowledge: '',
    relatedProcessIds: '',
    relatedPolicyIds: '',
    approvalStatus: 'draft' as CompanyBrainMapApprovalStatus,
  })

  const saveProcess = () => {
    if (!procDraft.title.trim()) return
    workspaceApi.upsertBrainProcess(activeOrgId, {
      title: procDraft.title.trim(),
      description: procDraft.description.trim(),
      category: procDraft.category.trim() || 'General',
      department: procDraft.department.trim() || undefined,
      ownerRoleTitle: procDraft.ownerRoleTitle.trim() || undefined,
      steps: parseLines(procDraft.steps),
      inputs: parseLines(procDraft.inputs),
      outputs: parseLines(procDraft.outputs),
      relatedKnowledgeItemIds: parseIds(procDraft.relatedKnowledge),
      relatedRoleTitles: parseIds(procDraft.relatedRoles.replace(/\n/g, ',')),
      approvalStatus: procDraft.approvalStatus,
    })
    setProcDraft({
      title: '',
      description: '',
      category: '',
      department: '',
      ownerRoleTitle: '',
      steps: '',
      inputs: '',
      outputs: '',
      relatedKnowledge: '',
      relatedRoles: '',
      approvalStatus: 'draft',
    })
  }

  const savePolicy = () => {
    if (!polDraft.title.trim()) return
    workspaceApi.upsertBrainPolicy(activeOrgId, {
      title: polDraft.title.trim(),
      summary: polDraft.summary.trim(),
      policyType: polDraft.policyType,
      rules: parseLines(polDraft.rules),
      appliesToDepartments: parseIds(polDraft.appliesToDepartments.replace(/\n/g, ',')),
      appliesToRoleTitles: parseIds(polDraft.appliesToRoleTitles.replace(/\n/g, ',')),
      relatedKnowledgeItemIds: parseIds(polDraft.relatedKnowledge),
      approvalStatus: polDraft.approvalStatus,
    })
    setPolDraft({
      title: '',
      summary: '',
      policyType: 'pricing',
      rules: '',
      appliesToDepartments: '',
      appliesToRoleTitles: '',
      relatedKnowledge: '',
      approvalStatus: 'draft',
    })
  }

  const saveDecision = () => {
    if (!decDraft.title.trim()) return
    workspaceApi.upsertBrainDecision(activeOrgId, {
      title: decDraft.title.trim(),
      summary: decDraft.summary.trim(),
      decisionType: decDraft.decisionType,
      context: decDraft.context.trim(),
      outcome: decDraft.outcome.trim(),
      ownerRoleTitle: decDraft.ownerRoleTitle.trim() || undefined,
      relatedKnowledgeItemIds: parseIds(decDraft.relatedKnowledge),
    })
    setDecDraft({
      title: '',
      summary: '',
      decisionType: 'customer',
      context: '',
      outcome: '',
      ownerRoleTitle: '',
      relatedKnowledge: '',
    })
  }

  const saveSystem = () => {
    if (!sysDraft.name.trim()) return
    workspaceApi.upsertBrainSystem(activeOrgId, {
      name: sysDraft.name.trim(),
      systemType: sysDraft.systemType,
      description: sysDraft.description.trim(),
      ownerRoleTitle: sysDraft.ownerRoleTitle.trim() || undefined,
      connectedStatus: sysDraft.connectedStatus,
      notes: sysDraft.notes.trim(),
    })
    setSysDraft({
      name: '',
      systemType: 'crm',
      description: '',
      ownerRoleTitle: '',
      connectedStatus: 'planned',
      notes: '',
    })
  }

  const saveSkill = () => {
    if (!skillDraft.title.trim()) return
    workspaceApi.upsertBrainSkillFile(activeOrgId, {
      title: skillDraft.title.trim(),
      description: skillDraft.description.trim(),
      skillType: skillDraft.skillType,
      instructions: parseLines(skillDraft.instructions),
      requiredInputs: parseLines(skillDraft.requiredInputs),
      outputFormat: skillDraft.outputFormat.trim(),
      allowedSourceTypes: skillDraft.allowedSources.length ? skillDraft.allowedSources : [...SOURCE_OPTIONS],
      relatedProcessIds: parseIds(skillDraft.relatedProcessIds),
      relatedPolicyIds: parseIds(skillDraft.relatedPolicyIds),
      relatedKnowledgeItemIds: parseIds(skillDraft.relatedKnowledge),
      approvalStatus: skillDraft.approvalStatus,
    })
    setSkillDraft({
      title: '',
      description: '',
      skillType: 'custom',
      instructions: '',
      requiredInputs: '',
      outputFormat: '',
      allowedSources: [],
      relatedKnowledge: '',
      relatedProcessIds: '',
      relatedPolicyIds: '',
      approvalStatus: 'draft',
    })
  }

  const knowledgePickHint =
    knowledgeItems.length === 0 ? (
      <p className="muted-copy">No knowledge items in this org yet — register some under Knowledge Library first.</p>
    ) : (
      <p className="muted-copy helper-inset">
        Knowledge IDs (comma or newline):{' '}
        {knowledgeItems
          .slice(0, 6)
          .map((k) => k.id)
          .join(', ')}
        {knowledgeItems.length > 6 ? '…' : ''}
      </p>
    )

  return (
    <div className="panel-card company-brain-panel">
      <div className="company-brain-panel__toolbar">
        <h3>Brain Map</h3>
      </div>
      <p className="muted-copy">
        Map processes, policies, decisions, systems, and skill files. Linked knowledge IDs power mock deck generation
        and Intel Review context (citations only when those knowledge rows have file traces).
      </p>

      <div className="company-brain-toggle" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {(
          [
            ['overview', 'Overview'],
            ['processes', 'Processes'],
            ['policies', 'Policies'],
            ['decisions', 'Decisions'],
            ['systems', 'Systems'],
            ['skills', 'Skills Files'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={nav === id ? 'secondary-button' : 'ghost-button'}
            onClick={() => setNav(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {nav !== 'overview' && nav !== 'decisions' && nav !== 'systems' ? (
        <div className="company-brain-filters" style={{ marginBottom: 14 }}>
          <label>
            <span>Dept contains</span>
            <input value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} placeholder="operations" />
          </label>
          <label>
            <span>Role contains</span>
            <input value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} placeholder="manager" />
          </label>
          <label>
            <span>Approval</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CompanyBrainMapApprovalStatus | 'any')}
            >
              <option value="any">Any</option>
              {BRAIN_APPROVAL_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {nav === 'overview' ? (
        <div className="company-brain-metrics">
          <div>
            <span className="muted-copy">Processes</span>
            <strong>{processes.length}</strong>
          </div>
          <div>
            <span className="muted-copy">Policies</span>
            <strong>{policies.length}</strong>
          </div>
          <div>
            <span className="muted-copy">Decisions</span>
            <strong>{decisions.length}</strong>
          </div>
          <div>
            <span className="muted-copy">Systems</span>
            <strong>{systems.length}</strong>
          </div>
          <div>
            <span className="muted-copy">Skill files</span>
            <strong>{skillFiles.length}</strong>
          </div>
        </div>
      ) : null}

      {nav === 'overview' ? (
        <>
          <button type="button" className="secondary-button" disabled title="AI extraction is not wired yet">
            Extract from selected documents
          </button>
          <p className="muted-copy" style={{ marginTop: 8 }}>
            AI extraction will be connected later. For now, add structured knowledge manually.
          </p>
          <p className="muted-copy">
            Workers can browse Company Brain; owners maintain Brain Map under this console.{' '}
            <Link to="/company">Open Company Brain</Link>.
          </p>
        </>
      ) : null}

      {nav === 'processes' && admin ? (
        <div className="form-grid">
          <label className="field-group">
            <span className="field-label">Title</span>
            <input value={procDraft.title} onChange={(e) => setProcDraft({ ...procDraft, title: e.target.value })} />
          </label>
          <label className="field-group">
            <span className="field-label">Category</span>
            <input
              value={procDraft.category}
              onChange={(e) => setProcDraft({ ...procDraft, category: e.target.value })}
            />
          </label>
          <label className="field-group">
            <span className="field-label">Department</span>
            <select
              value={procDraft.department}
              onChange={(e) => setProcDraft({ ...procDraft, department: e.target.value })}
            >
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">Owner role title</span>
            <input
              list="brain-owner-role-list"
              value={procDraft.ownerRoleTitle}
              onChange={(e) => setProcDraft({ ...procDraft, ownerRoleTitle: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Description</span>
            <textarea
              rows={2}
              value={procDraft.description}
              onChange={(e) => setProcDraft({ ...procDraft, description: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Steps (one per line)</span>
            <textarea
              rows={3}
              value={procDraft.steps}
              onChange={(e) => setProcDraft({ ...procDraft, steps: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Inputs / outputs (one per line each)</span>
            <textarea
              rows={2}
              placeholder="Inputs"
              value={procDraft.inputs}
              onChange={(e) => setProcDraft({ ...procDraft, inputs: e.target.value })}
            />
            <textarea
              rows={2}
              placeholder="Outputs"
              value={procDraft.outputs}
              onChange={(e) => setProcDraft({ ...procDraft, outputs: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Related knowledge IDs</span>
            <textarea
              rows={2}
              value={procDraft.relatedKnowledge}
              onChange={(e) => setProcDraft({ ...procDraft, relatedKnowledge: e.target.value })}
            />
            {knowledgePickHint}
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Related role titles (comma-separated)</span>
            <input
              value={procDraft.relatedRoles}
              onChange={(e) => setProcDraft({ ...procDraft, relatedRoles: e.target.value })}
            />
          </label>
          <label className="field-group">
            <span className="field-label">Approval</span>
            <select
              value={procDraft.approvalStatus}
              onChange={(e) =>
                setProcDraft({ ...procDraft, approvalStatus: e.target.value as CompanyBrainMapApprovalStatus })
              }
            >
              {BRAIN_APPROVAL_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="field-group field-group--wide">
            <button type="button" className="primary-button" disabled={!procDraft.title.trim()} onClick={saveProcess}>
              Save process
            </button>
          </div>
        </div>
      ) : null}

      {nav === 'processes' ? (
        <ul className="company-brain-list">
          {filteredProcesses.map((p) => (
            <li key={p.id} className="company-brain-card">
              <header>
                <strong>{p.title}</strong>
                <span className={`company-chip company-chip--${p.approvalStatus}`}>{p.approvalStatus}</span>
              </header>
              <p className="muted-copy">{p.description}</p>
              {admin ? (
                <footer className="company-brain-actions">
                  <button type="button" className="ghost-button" onClick={() => workspaceApi.archiveBrainProcess(activeOrgId, p.id)}>
                    Archive
                  </button>
                  <button type="button" className="ghost-button" onClick={() => workspaceApi.deleteBrainProcess(activeOrgId, p.id)}>
                    Delete
                  </button>
                </footer>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {nav === 'policies' && admin ? (
        <div className="form-grid">
          <label className="field-group">
            <span className="field-label">Title</span>
            <input value={polDraft.title} onChange={(e) => setPolDraft({ ...polDraft, title: e.target.value })} />
          </label>
          <label className="field-group">
            <span className="field-label">Policy type</span>
            <select
              value={polDraft.policyType}
              onChange={(e) => setPolDraft({ ...polDraft, policyType: e.target.value as CompanyBrainPolicy['policyType'] })}
            >
              <option value="pricing">pricing</option>
              <option value="legal">legal</option>
              <option value="sales">sales</option>
              <option value="support">support</option>
              <option value="operations">operations</option>
              <option value="product">product</option>
              <option value="security">security</option>
              <option value="other">other</option>
            </select>
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Summary</span>
            <textarea
              rows={2}
              value={polDraft.summary}
              onChange={(e) => setPolDraft({ ...polDraft, summary: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Rules (one per line)</span>
            <textarea
              rows={3}
              value={polDraft.rules}
              onChange={(e) => setPolDraft({ ...polDraft, rules: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Applies to departments (comma)</span>
            <input
              value={polDraft.appliesToDepartments}
              onChange={(e) => setPolDraft({ ...polDraft, appliesToDepartments: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Applies to role titles (comma)</span>
            <input
              value={polDraft.appliesToRoleTitles}
              onChange={(e) => setPolDraft({ ...polDraft, appliesToRoleTitles: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Related knowledge IDs</span>
            <textarea
              rows={2}
              value={polDraft.relatedKnowledge}
              onChange={(e) => setPolDraft({ ...polDraft, relatedKnowledge: e.target.value })}
            />
            {knowledgePickHint}
          </label>
          <label className="field-group">
            <span className="field-label">Approval</span>
            <select
              value={polDraft.approvalStatus}
              onChange={(e) =>
                setPolDraft({ ...polDraft, approvalStatus: e.target.value as CompanyBrainMapApprovalStatus })
              }
            >
              {BRAIN_APPROVAL_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="field-group field-group--wide">
            <button type="button" className="primary-button" disabled={!polDraft.title.trim()} onClick={savePolicy}>
              Save policy
            </button>
          </div>
        </div>
      ) : null}

      {nav === 'policies' ? (
        <ul className="company-brain-list">
          {filteredPolicies.map((p) => (
            <li key={p.id} className="company-brain-card">
              <header>
                <strong>{p.title}</strong>
                <span className={`company-chip company-chip--${p.approvalStatus}`}>{p.approvalStatus}</span>
              </header>
              <p className="muted-copy">
                {p.policyType} · {p.summary}
              </p>
              {admin ? (
                <footer className="company-brain-actions">
                  <button type="button" className="ghost-button" onClick={() => workspaceApi.archiveBrainPolicy(activeOrgId, p.id)}>
                    Archive
                  </button>
                  <button type="button" className="ghost-button" onClick={() => workspaceApi.deleteBrainPolicy(activeOrgId, p.id)}>
                    Delete
                  </button>
                </footer>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {nav === 'decisions' && admin ? (
        <div className="form-grid">
          <label className="field-group">
            <span className="field-label">Title</span>
            <input value={decDraft.title} onChange={(e) => setDecDraft({ ...decDraft, title: e.target.value })} />
          </label>
          <label className="field-group">
            <span className="field-label">Decision type</span>
            <select
              value={decDraft.decisionType}
              onChange={(e) =>
                setDecDraft({ ...decDraft, decisionType: e.target.value as CompanyBrainDecision['decisionType'] })
              }
            >
              <option value="customer">customer</option>
              <option value="pricing">pricing</option>
              <option value="product">product</option>
              <option value="legal">legal</option>
              <option value="operations">operations</option>
              <option value="sales">sales</option>
              <option value="other">other</option>
            </select>
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Summary</span>
            <textarea
              rows={2}
              value={decDraft.summary}
              onChange={(e) => setDecDraft({ ...decDraft, summary: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Context</span>
            <textarea
              rows={2}
              value={decDraft.context}
              onChange={(e) => setDecDraft({ ...decDraft, context: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Outcome</span>
            <textarea
              rows={2}
              value={decDraft.outcome}
              onChange={(e) => setDecDraft({ ...decDraft, outcome: e.target.value })}
            />
          </label>
          <label className="field-group">
            <span className="field-label">Owner role title</span>
            <input
              list="brain-owner-role-list"
              value={decDraft.ownerRoleTitle}
              onChange={(e) => setDecDraft({ ...decDraft, ownerRoleTitle: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Related knowledge IDs</span>
            <textarea
              rows={2}
              value={decDraft.relatedKnowledge}
              onChange={(e) => setDecDraft({ ...decDraft, relatedKnowledge: e.target.value })}
            />
            {knowledgePickHint}
          </label>
          <div className="field-group field-group--wide">
            <button type="button" className="primary-button" disabled={!decDraft.title.trim()} onClick={saveDecision}>
              Save decision
            </button>
          </div>
        </div>
      ) : null}

      {nav === 'decisions' ? (
        <ul className="company-brain-list">
          {decisions.map((d) => (
            <li key={d.id} className="company-brain-card">
              <header>
                <strong>{d.title}</strong>
                <span className="company-chip company-chip--approved">{d.decisionType}</span>
              </header>
              <p className="muted-copy">{d.summary}</p>
              {admin ? (
                <footer className="company-brain-actions">
                  <button type="button" className="ghost-button" onClick={() => workspaceApi.deleteBrainDecision(activeOrgId, d.id)}>
                    Delete
                  </button>
                </footer>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {nav === 'systems' && admin ? (
        <div className="form-grid">
          <label className="field-group">
            <span className="field-label">Name</span>
            <input value={sysDraft.name} onChange={(e) => setSysDraft({ ...sysDraft, name: e.target.value })} />
          </label>
          <label className="field-group">
            <span className="field-label">System type</span>
            <select
              value={sysDraft.systemType}
              onChange={(e) => setSysDraft({ ...sysDraft, systemType: e.target.value as CompanyBrainSystem['systemType'] })}
            >
              <option value="crm">crm</option>
              <option value="drive">drive</option>
              <option value="slack">slack</option>
              <option value="email">email</option>
              <option value="ticketing">ticketing</option>
              <option value="docs">docs</option>
              <option value="calendar">calendar</option>
              <option value="code">code</option>
              <option value="other">other</option>
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">Connected</span>
            <select
              value={sysDraft.connectedStatus}
              onChange={(e) =>
                setSysDraft({ ...sysDraft, connectedStatus: e.target.value as CompanyBrainSystem['connectedStatus'] })
              }
            >
              <option value="not-connected">not-connected</option>
              <option value="planned">planned</option>
              <option value="connected">connected</option>
            </select>
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Description</span>
            <textarea
              rows={2}
              value={sysDraft.description}
              onChange={(e) => setSysDraft({ ...sysDraft, description: e.target.value })}
            />
          </label>
          <label className="field-group">
            <span className="field-label">Owner role title</span>
            <input
              list="brain-owner-role-list"
              value={sysDraft.ownerRoleTitle}
              onChange={(e) => setSysDraft({ ...sysDraft, ownerRoleTitle: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Notes</span>
            <textarea
              rows={2}
              value={sysDraft.notes}
              onChange={(e) => setSysDraft({ ...sysDraft, notes: e.target.value })}
            />
          </label>
          <div className="field-group field-group--wide">
            <button type="button" className="primary-button" disabled={!sysDraft.name.trim()} onClick={saveSystem}>
              Save system
            </button>
          </div>
        </div>
      ) : null}

      {nav === 'systems' ? (
        <ul className="company-brain-list">
          {systems.map((s) => (
            <li key={s.id} className="company-brain-card">
              <header>
                <strong>{s.name}</strong>
                <span className="company-chip company-chip--approved">{s.connectedStatus}</span>
              </header>
              <p className="muted-copy">
                {s.systemType} · {s.description}
              </p>
              {admin ? (
                <footer className="company-brain-actions">
                  <button type="button" className="ghost-button" onClick={() => workspaceApi.deleteBrainSystem(activeOrgId, s.id)}>
                    Delete
                  </button>
                </footer>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {nav === 'skills' && admin ? (
        <div className="form-grid">
          <label className="field-group">
            <span className="field-label">Title</span>
            <input value={skillDraft.title} onChange={(e) => setSkillDraft({ ...skillDraft, title: e.target.value })} />
          </label>
          <label className="field-group">
            <span className="field-label">Skill type</span>
            <select
              value={skillDraft.skillType}
              onChange={(e) =>
                setSkillDraft({ ...skillDraft, skillType: e.target.value as CompanyBrainSkillFile['skillType'] })
              }
            >
              <option value="sales-deck">sales-deck</option>
              <option value="intel-brief">intel-brief</option>
              <option value="objection-handling">objection-handling</option>
              <option value="onboarding">onboarding</option>
              <option value="support">support</option>
              <option value="legal-review">legal-review</option>
              <option value="pricing">pricing</option>
              <option value="incident-response">incident-response</option>
              <option value="custom">custom</option>
            </select>
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Description</span>
            <textarea
              rows={2}
              value={skillDraft.description}
              onChange={(e) => setSkillDraft({ ...skillDraft, description: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Instructions (one per line)</span>
            <textarea
              rows={3}
              value={skillDraft.instructions}
              onChange={(e) => setSkillDraft({ ...skillDraft, instructions: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Required inputs / output format</span>
            <textarea
              rows={2}
              placeholder="Required inputs (one per line)"
              value={skillDraft.requiredInputs}
              onChange={(e) => setSkillDraft({ ...skillDraft, requiredInputs: e.target.value })}
            />
            <input
              placeholder="Output format"
              value={skillDraft.outputFormat}
              onChange={(e) => setSkillDraft({ ...skillDraft, outputFormat: e.target.value })}
            />
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Allowed source types</span>
            <select
              multiple
              value={skillDraft.allowedSources}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) => o.value as CompanyKnowledgeSourceType)
                setSkillDraft({ ...skillDraft, allowedSources: selected })
              }}
              style={{ minHeight: 120 }}
            >
              {SOURCE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Related knowledge IDs</span>
            <textarea
              rows={2}
              value={skillDraft.relatedKnowledge}
              onChange={(e) => setSkillDraft({ ...skillDraft, relatedKnowledge: e.target.value })}
            />
            {knowledgePickHint}
          </label>
          <label className="field-group field-group--wide">
            <span className="field-label">Related process / policy IDs</span>
            <input
              placeholder="Process IDs (comma)"
              value={skillDraft.relatedProcessIds}
              onChange={(e) => setSkillDraft({ ...skillDraft, relatedProcessIds: e.target.value })}
            />
            <input
              placeholder="Policy IDs (comma)"
              value={skillDraft.relatedPolicyIds}
              onChange={(e) => setSkillDraft({ ...skillDraft, relatedPolicyIds: e.target.value })}
            />
          </label>
          <label className="field-group">
            <span className="field-label">Approval</span>
            <select
              value={skillDraft.approvalStatus}
              onChange={(e) =>
                setSkillDraft({ ...skillDraft, approvalStatus: e.target.value as CompanyBrainMapApprovalStatus })
              }
            >
              {BRAIN_APPROVAL_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="field-group field-group--wide">
            <button type="button" className="primary-button" disabled={!skillDraft.title.trim()} onClick={saveSkill}>
              Save skill file
            </button>
          </div>
        </div>
      ) : null}

      {nav === 'skills' ? (
        <ul className="company-brain-list">
          {filteredSkillFiles.map((s) => (
            <li key={s.id} className="company-brain-card">
              <header>
                <strong>{s.title}</strong>
                <span className={`company-chip company-chip--${s.approvalStatus}`}>{s.approvalStatus}</span>
              </header>
              <p className="muted-copy">
                {s.skillType} · {s.description}
              </p>
              {admin ? (
                <footer className="company-brain-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => workspaceApi.archiveBrainSkillFile(activeOrgId, s.id)}
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => workspaceApi.deleteBrainSkillFile(activeOrgId, s.id)}
                  >
                    Delete
                  </button>
                </footer>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!admin ? <p className="muted-copy">Only owners and admins can edit Brain Map entries.</p> : null}

      <datalist id="brain-owner-role-list">
        {roleNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  )
}
