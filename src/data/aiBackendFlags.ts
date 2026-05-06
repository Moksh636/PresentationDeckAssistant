function readViteEnv(key: string): string | undefined {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  if (env?.[key] !== undefined) {
    return env[key]
  }

  return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    key
  ]
}

/** Master switch: Supabase Edge functions (e.g. generate-intel-review) and related backend hooks. */
export function isAiBackendEnabled() {
  return readViteEnv('VITE_AI_BACKEND_ENABLED') === 'true'
}

/**
 * When true, the app may POST to placeholder `/api/ai/*` REST routes (not wired in this MVP deploy).
 * Intel Review ignores this flag and always uses `supabase.functions.invoke` when the backend is enabled.
 */
export function isAiRestRoutesEnabled() {
  return readViteEnv('VITE_AI_REST_ROUTES_ENABLED') === 'true'
}

