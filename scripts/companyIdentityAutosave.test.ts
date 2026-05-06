import assert from 'node:assert/strict'
import {
  createCompanyIdentityAutosaveState,
  markCompanyIdentityDirty,
  markCompanyIdentityLoaded,
  markCompanyIdentitySaved,
  shouldAutosaveCompanyIdentity,
} from '../src/data/companyIdentityAutosave.ts'

let autosave = createCompanyIdentityAutosaveState()

// Mutation marks identity as dirty.
autosave = markCompanyIdentityDirty(autosave)
assert.equal(autosave.dirtyVersion, 1)
assert.equal(shouldAutosaveCompanyIdentity(autosave, true), true)

// Successful save clears dirty state.
autosave = markCompanyIdentitySaved(autosave)
assert.equal(autosave.savedVersion, autosave.dirtyVersion)
assert.equal(shouldAutosaveCompanyIdentity(autosave, true), false)

// Manual cloud load clears dirty and suppresses immediate loop.
autosave = markCompanyIdentityDirty(autosave)
assert.equal(shouldAutosaveCompanyIdentity(autosave, true), true)
autosave = markCompanyIdentityLoaded(autosave)
assert.equal(shouldAutosaveCompanyIdentity(autosave, true), false)
autosave = markCompanyIdentityDirty(autosave)
assert.equal(shouldAutosaveCompanyIdentity(autosave, true), true)

// Disabled when cloud is unavailable.
assert.equal(shouldAutosaveCompanyIdentity(autosave, false), false)

// Manual save still works after a failed autosave attempt path.
autosave = markCompanyIdentityDirty(autosave)
assert.equal(shouldAutosaveCompanyIdentity(autosave, true), true)
autosave = markCompanyIdentitySaved(autosave)
assert.equal(shouldAutosaveCompanyIdentity(autosave, true), false)

console.log('companyIdentityAutosave tests passed')
