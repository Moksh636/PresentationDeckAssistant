import assert from 'node:assert/strict'
import { loadDemoWorkspaceLocally, resetDemoWorkspaceLocally } from '../src/data/demoWorkspaceActions.ts'

let replacedWorkspaceName = ''
const toasts: Array<{ message: string; variant: 'success' | 'info' | 'error' }> = []

const replaceWorkspace = (workspace: { projects: Array<{ name: string }> }) => {
  replacedWorkspaceName = workspace.projects[0]?.name ?? ''
}

const showToast = (message: string, variant: 'success' | 'info' | 'error') => {
  toasts.push({ message, variant })
}

loadDemoWorkspaceLocally({ replaceWorkspace, showToast })
assert.equal(replacedWorkspaceName, 'Northstar Demo Workspace')
assert.equal(toasts.at(-1)?.variant, 'success')

resetDemoWorkspaceLocally({
  replaceWorkspace,
  showToast,
  createResetWorkspace: () => ({
    projects: [{ name: 'Seed Workspace' }],
  }) as never,
})
assert.equal(replacedWorkspaceName, 'Seed Workspace')
assert.equal(toasts.at(-1)?.variant, 'info')

console.log('demoWorkspaceActions tests passed')
