import type { WorkspaceState } from '../types/models'
import { createDemoWorkspaceState } from './demoWorkspaceSeed.ts'

interface DemoWorkspaceActionInput {
  replaceWorkspace: (workspace: WorkspaceState) => void
  showToast: (message: string, variant: 'success' | 'info' | 'error') => void
}

/** Local-only helper: updates in-memory/local workspace, never cloud persistence. */
export function loadDemoWorkspaceLocally({ replaceWorkspace, showToast }: DemoWorkspaceActionInput) {
  replaceWorkspace(createDemoWorkspaceState())
  showToast('Loaded Northstar FieldOps demo workspace.', 'success')
}

/** Local-only helper: resets local workspace seed, cloud save stays manual. */
export function resetDemoWorkspaceLocally({
  replaceWorkspace,
  showToast,
  createResetWorkspace,
}: DemoWorkspaceActionInput & { createResetWorkspace: () => WorkspaceState }) {
  replaceWorkspace(createResetWorkspace())
  showToast('Reset workspace to default local seed.', 'info')
}
