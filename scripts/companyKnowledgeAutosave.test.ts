import assert from 'node:assert/strict'
import {
  createCompanyKnowledgeAutosaveState,
  markCompanyKnowledgeDirty,
  markCompanyKnowledgeLoaded,
  markCompanyKnowledgeSaved,
  shouldAutosaveCompanyKnowledge,
} from '../src/data/companyKnowledgeAutosave.ts'

let autosave = createCompanyKnowledgeAutosaveState()

autosave = markCompanyKnowledgeDirty(autosave)
assert.equal(autosave.dirtyVersion, 1)
assert.equal(shouldAutosaveCompanyKnowledge(autosave, true), true)

autosave = markCompanyKnowledgeSaved(autosave)
assert.equal(autosave.savedVersion, autosave.dirtyVersion)
assert.equal(shouldAutosaveCompanyKnowledge(autosave, true), false)

autosave = markCompanyKnowledgeDirty(autosave)
assert.equal(shouldAutosaveCompanyKnowledge(autosave, true), true)
autosave = markCompanyKnowledgeLoaded(autosave)
assert.equal(shouldAutosaveCompanyKnowledge(autosave, true), false)
autosave = markCompanyKnowledgeDirty(autosave)
assert.equal(shouldAutosaveCompanyKnowledge(autosave, true), true)

assert.equal(shouldAutosaveCompanyKnowledge(autosave, false), false)

autosave = markCompanyKnowledgeDirty(autosave)
assert.equal(shouldAutosaveCompanyKnowledge(autosave, true), true)
autosave = markCompanyKnowledgeSaved(autosave)
assert.equal(shouldAutosaveCompanyKnowledge(autosave, true), false)

console.log('companyKnowledgeAutosave tests passed')
