import assert from 'node:assert/strict'
import {
  getCloudPersistenceStatus,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
} from '../src/data/workspaceCloudPersistence.ts'
import type { WorkspaceState } from '../src/types/models.ts'

const workspace: WorkspaceState = {
  activeDeckId: 'deck-1',
  projects: [],
  decks: [],
  slides: [],
  fileAssets: [],
  chartSuggestions: [],
  comments: [],
  deckVersions: [],
}

assert.deepEqual(getCloudPersistenceStatus({ isConfigured: false, userId: 'user-1' }), {
  canUseCloud: false,
  label: 'Local mode',
  reason: 'Supabase is not configured.',
})

assert.deepEqual(getCloudPersistenceStatus({ isConfigured: true }), {
  canUseCloud: false,
  label: 'Sign in to sync',
  reason: 'Sign in before saving or loading cloud snapshots.',
})

assert.deepEqual(getCloudPersistenceStatus({ isConfigured: true, userId: 'user-1' }), {
  canUseCloud: true,
  label: 'Cloud ready',
})

let savedPayload: Record<string, unknown> | undefined

const saveClient = {
  from(tableName: string) {
    assert.equal(tableName, 'workspace_snapshots')

    return {
      upsert(payload: Record<string, unknown>, options: Record<string, unknown>) {
        savedPayload = payload
        assert.deepEqual(options, { onConflict: 'user_id' })

        return {
          select(columns: string) {
            assert.equal(columns, 'id,user_id,workspace_json,updated_at')

            return {
              async single() {
                return {
                  data: {
                    id: 'snapshot-1',
                    user_id: payload.user_id,
                    workspace_json: payload.workspace_json,
                    updated_at: payload.updated_at,
                  },
                  error: null,
                }
              },
            }
          },
        }
      },
    }
  },
}

const savedSnapshot = await saveWorkspaceSnapshot({
  supabase: saveClient,
  userId: 'user-1',
  workspace,
})

assert.equal(savedPayload?.user_id, 'user-1')
assert.deepEqual(savedPayload?.workspace_json, workspace)
assert.equal(savedSnapshot.userId, 'user-1')
assert.deepEqual(savedSnapshot.workspace, workspace)

const loadClient = {
  from(tableName: string) {
    assert.equal(tableName, 'workspace_snapshots')

    return {
      select(columns: string) {
        assert.equal(columns, 'id,user_id,workspace_json,updated_at')

        return {
          eq(column: string, userId: string) {
            assert.equal(column, 'user_id')
            assert.equal(userId, 'user-1')

            return {
              async maybeSingle() {
                return {
                  data: {
                    id: 'snapshot-1',
                    user_id: 'user-1',
                    workspace_json: workspace,
                    updated_at: '2026-05-01T12:00:00.000Z',
                  },
                  error: null,
                }
              },
            }
          },
        }
      },
    }
  },
}

const loadedSnapshot = await loadWorkspaceSnapshot({
  supabase: loadClient,
  userId: 'user-1',
})

assert.equal(loadedSnapshot?.id, 'snapshot-1')
assert.deepEqual(loadedSnapshot?.workspace, workspace)

const emptyLoadClient = {
  from() {
    return {
      select() {
        return {
          eq() {
            return {
              async maybeSingle() {
                return { data: null, error: null }
              },
            }
          },
        }
      },
    }
  },
}

assert.equal(
  await loadWorkspaceSnapshot({
    supabase: emptyLoadClient,
    userId: 'user-1',
  }),
  null,
)

console.log('workspaceCloudPersistence tests passed')
