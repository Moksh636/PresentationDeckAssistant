export function isAiBackendEnabled() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  const viteFlag = env?.VITE_AI_BACKEND_ENABLED

  if (viteFlag !== undefined) {
    return viteFlag === 'true'
  }

  // Node-based unit tests don't have `import.meta.env` populated by Vite.
  const nodeFlag = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.VITE_AI_BACKEND_ENABLED
  return nodeFlag === 'true'
}

