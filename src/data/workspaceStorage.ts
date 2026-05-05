import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspaceAssetStorageRef } from '../types/models'

/** Supabase Storage bucket ids used by this app (create these in the dashboard). */
export const WORKSPACE_STORAGE_BUCKETS = {
  sourceFiles: 'source-files',
  deckAssets: 'deck-assets',
} as const

export type WorkspaceStorageBucketId =
  (typeof WORKSPACE_STORAGE_BUCKETS)[keyof typeof WORKSPACE_STORAGE_BUCKETS]

export function sanitizeStorageFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? 'file'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 200)

  return cleaned || 'file'
}

export interface BuildWorkspaceStoragePathInput {
  userId: string
  deckId: string
  assetId: string
  fileName: string
}

export function buildWorkspaceStoragePath(input: BuildWorkspaceStoragePathInput): string {
  const safe = sanitizeStorageFileName(input.fileName)

  return `${input.userId}/${input.deckId}/${input.assetId}/${safe}`
}

export function normalizeWorkspaceAssetStorageRef(raw: unknown): WorkspaceAssetStorageRef | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined
  }

  const record = raw as Record<string, unknown>
  const bucket = record.bucket
  const objectPath = record.objectPath

  if (typeof bucket === 'string' && typeof objectPath === 'string' && bucket.length > 0 && objectPath.length > 0) {
    return { bucket, objectPath }
  }

  return undefined
}

export interface UploadWorkspaceAssetResult {
  bucket: string
  objectPath: string
  error: Error | null
}

export async function uploadWorkspaceAsset(params: {
  supabase: SupabaseClient
  bucket: WorkspaceStorageBucketId | string
  objectPath: string
  file: File | Blob
  contentType?: string
  upsert?: boolean
}): Promise<UploadWorkspaceAssetResult> {
  const { supabase, bucket, objectPath, file, contentType, upsert } = params
  const mime =
    contentType ??
    (typeof File !== 'undefined' && file instanceof File ? file.type : undefined) ??
    'application/octet-stream'

  const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
    contentType: mime || 'application/octet-stream',
    upsert: upsert ?? false,
  })

  return {
    bucket,
    objectPath,
    error: error ? new Error(error.message) : null,
  }
}

export interface GetWorkspaceAssetUrlResult {
  url: string | null
  error: Error | null
}

/** Use `signedExpiresIn` (seconds) for private buckets; omit for `getPublicUrl` (public buckets). */
export async function getWorkspaceAssetUrl(params: {
  supabase: SupabaseClient
  bucket: string
  objectPath: string
  signedExpiresIn?: number
}): Promise<GetWorkspaceAssetUrlResult> {
  const { supabase, bucket, objectPath, signedExpiresIn } = params

  if (signedExpiresIn !== undefined && signedExpiresIn > 0) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, signedExpiresIn)

    return {
      url: data?.signedUrl ?? null,
      error: error ? new Error(error.message) : null,
    }
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)

  return {
    url: data.publicUrl,
    error: null,
  }
}

export async function deleteWorkspaceAsset(params: {
  supabase: SupabaseClient
  bucket: string
  objectPath: string
}): Promise<{ error: Error | null }> {
  const { error } = await params.supabase.storage.from(params.bucket).remove([params.objectPath])

  return {
    error: error ? new Error(error.message) : null,
  }
}

export function shouldAttemptWorkspaceStorageUpload(options: {
  supabaseClient: SupabaseClient | null
  userId: string | undefined
  isLocalDevBypass: boolean
}): boolean {
  return Boolean(options.supabaseClient && options.userId && !options.isLocalDevBypass)
}

export interface TryPrepareWorkspaceFileForCloudResult {
  dataUrl: string
  storage?: WorkspaceAssetStorageRef
  usedCloud: boolean
  /** When `usedCloud` is false, why the client fell back to local preview. */
  failureStage?: 'upload' | 'public-url'
}

/**
 * Uploads a file to Storage and returns a display URL when possible.
 * On any failure, returns `fallbackDataUrl` so the UI keeps working offline/local-only.
 */
export async function tryPrepareWorkspaceFileForCloud(params: {
  supabase: SupabaseClient
  bucket: WorkspaceStorageBucketId
  objectPath: string
  file: File
  fallbackDataUrl: string
  signedExpiresIn?: number
}): Promise<TryPrepareWorkspaceFileForCloudResult> {
  const upload = await uploadWorkspaceAsset({
    supabase: params.supabase,
    bucket: params.bucket,
    objectPath: params.objectPath,
    file: params.file,
    contentType: params.file.type || undefined,
  })

  const storageRef: WorkspaceAssetStorageRef = {
    bucket: upload.bucket,
    objectPath: upload.objectPath,
  }

  if (upload.error) {
    return {
      dataUrl: params.fallbackDataUrl,
      usedCloud: false,
      failureStage: 'upload',
    }
  }

  const urlResult = await getWorkspaceAssetUrl({
    supabase: params.supabase,
    bucket: upload.bucket,
    objectPath: upload.objectPath,
    signedExpiresIn: params.signedExpiresIn,
  })

  if (urlResult.error || !urlResult.url) {
    return {
      dataUrl: params.fallbackDataUrl,
      storage: storageRef,
      usedCloud: false,
      failureStage: 'public-url',
    }
  }

  return {
    dataUrl: urlResult.url,
    storage: storageRef,
    usedCloud: true,
  }
}
