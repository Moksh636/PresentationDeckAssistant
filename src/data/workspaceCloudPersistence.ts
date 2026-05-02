import type { WorkspaceState } from '../types/models'

const WORKSPACE_SNAPSHOT_COLUMNS = 'id,user_id,workspace_json,updated_at'

interface CloudQueryError {
  message?: string
}

interface WorkspaceSnapshotRow {
  id: string
  user_id: string
  workspace_json: unknown
  updated_at: string
}

interface CloudQueryResult<T> {
  data: T | null
  error: CloudQueryError | null
}

export interface WorkspaceSnapshotClient {
  from: (tableName: 'workspace_snapshots') => {
    upsert: (
      payload: Record<string, unknown>,
      options: { onConflict: 'user_id' },
    ) => {
      select: (columns: typeof WORKSPACE_SNAPSHOT_COLUMNS) => {
        single: () => PromiseLike<CloudQueryResult<WorkspaceSnapshotRow>>
      }
    }
    select: (columns: typeof WORKSPACE_SNAPSHOT_COLUMNS) => {
      eq: (column: 'user_id', value: string) => {
        maybeSingle: () => PromiseLike<CloudQueryResult<WorkspaceSnapshotRow>>
      }
    }
  }
}

export interface CloudPersistenceStatus {
  canUseCloud: boolean
  label: 'Local mode' | 'Sign in to sync' | 'Cloud ready'
  reason?: string
}

export interface WorkspaceCloudSnapshot {
  id: string
  userId: string
  workspace: WorkspaceState
  updatedAt: string
}

export function getCloudPersistenceStatus({
  isConfigured,
  userId,
}: {
  isConfigured: boolean
  userId?: string
}): CloudPersistenceStatus {
  if (!isConfigured) {
    return {
      canUseCloud: false,
      label: 'Local mode',
      reason: 'Supabase is not configured.',
    }
  }

  if (!userId) {
    return {
      canUseCloud: false,
      label: 'Sign in to sync',
      reason: 'Sign in before saving or loading cloud snapshots.',
    }
  }

  return {
    canUseCloud: true,
    label: 'Cloud ready',
  }
}

function throwIfCloudError(error: CloudQueryError | null, action: string) {
  if (error) {
    throw new Error(error.message ?? `Cloud ${action} failed.`)
  }
}

function normalizeSnapshotRow(row: WorkspaceSnapshotRow): WorkspaceCloudSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    workspace: row.workspace_json as WorkspaceState,
    updatedAt: row.updated_at,
  }
}

export async function saveWorkspaceSnapshot({
  supabase,
  userId,
  workspace,
}: {
  supabase: WorkspaceSnapshotClient
  userId: string
  workspace: WorkspaceState
}) {
  const updatedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('workspace_snapshots')
    .upsert(
      {
        user_id: userId,
        workspace_json: workspace,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id' },
    )
    .select(WORKSPACE_SNAPSHOT_COLUMNS)
    .single()

  throwIfCloudError(error, 'save')

  if (!data) {
    throw new Error('Cloud save did not return a workspace snapshot.')
  }

  return normalizeSnapshotRow(data)
}

export async function loadWorkspaceSnapshot({
  supabase,
  userId,
}: {
  supabase: WorkspaceSnapshotClient
  userId: string
}) {
  const { data, error } = await supabase
    .from('workspace_snapshots')
    .select(WORKSPACE_SNAPSHOT_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()

  throwIfCloudError(error, 'load')

  return data ? normalizeSnapshotRow(data) : null
}
