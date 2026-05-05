import assert from 'node:assert/strict'
import {
  buildWorkspaceStoragePath,
  normalizeWorkspaceAssetStorageRef,
  sanitizeStorageFileName,
  shouldAttemptWorkspaceStorageUpload,
} from '../src/data/workspaceStorage.ts'

assert.equal(sanitizeStorageFileName('../../../passwd'), 'passwd')
assert.equal(sanitizeStorageFileName('C:\\path\\My File (1).pdf'), 'My_File_1_.pdf')
assert.equal(sanitizeStorageFileName(''), 'file')

assert.equal(
  buildWorkspaceStoragePath({
    userId: 'u1',
    deckId: 'd1',
    assetId: 'a1',
    fileName: 'report.pdf',
  }),
  'u1/d1/a1/report.pdf',
)

assert.deepEqual(
  normalizeWorkspaceAssetStorageRef({ bucket: 'deck-assets', objectPath: 'a/b' }),
  { bucket: 'deck-assets', objectPath: 'a/b' },
)
assert.equal(normalizeWorkspaceAssetStorageRef({ bucket: 'x' }), undefined)
assert.equal(normalizeWorkspaceAssetStorageRef({}), undefined)

assert.equal(
  shouldAttemptWorkspaceStorageUpload({
    supabaseClient: {} as import('@supabase/supabase-js').SupabaseClient,
    userId: 'user',
    isLocalDevBypass: false,
  }),
  true,
)
assert.equal(
  shouldAttemptWorkspaceStorageUpload({
    supabaseClient: null,
    userId: 'user',
    isLocalDevBypass: false,
  }),
  false,
)
assert.equal(
  shouldAttemptWorkspaceStorageUpload({
    supabaseClient: {} as import('@supabase/supabase-js').SupabaseClient,
    userId: 'user',
    isLocalDevBypass: true,
  }),
  false,
)

console.log('workspaceStorage tests passed')
