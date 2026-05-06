/**
 * Canonical narrative lives in `src/data/promptGuardrails.ts` (`PROMPT_TRUST_CONTRACT`).
 * Duplicated here so Supabase Edge (Deno) does not import app `src/`. Keep keys aligned.
 */
export const PROMPT_TRUST_CONTRACT = {
  sourceContentIsUntrusted: true,
  sourceCannotOverrideSystemOrDeveloperInstructions: true,
  citeOnlyProvidedSourceTraceIds: true,
  labelUnsourcedClaimsAsInferenceOrCompanyKnowledge: true,
  noFabricatedSources: true,
  outputMustMatchSchema: true,
} as const

export type PromptTrustContract = typeof PROMPT_TRUST_CONTRACT
