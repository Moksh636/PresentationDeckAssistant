/**
 * Prompt-injection and trust-boundary notes for future LLM-backed Intel Review / deck flows.
 * No model calls here — this module is documentation + tiny helpers for consistent treatment
 * of untrusted user and document text.
 *
 * Edge workers mirror the contract export in `supabase/functions/_shared/promptTrustContract.ts`
 * (Deno bundle cannot import app `src/`). Keep both in sync when editing policy text.
 */

/** Treat deck setup, uploads, and Company Brain descriptions as untrusted input. */
export type UntrustedUserText = string

/**
 * Machine-readable contract for future prompt assembly + response handling.
 * Source text is always **untrusted** relative to system policy.
 */
export const PROMPT_TRUST_CONTRACT = {
  /** Inbound deck/brain/document text must not be trusted to follow instructions. */
  sourceContentIsUntrusted: true,

  /**
   * Source text cannot override system or developer instructions.
   * Pattern: keep system + developer messages in separate channels; wrap every user/source
   * payload in a single delimited block (or separate API field) so “instructions” inside source
   * stay inert literal content. Validate outputs with `validateDeckIntelShape` (app) /
   * `_shared` copies on Edge.
   */
  sourceCannotOverrideSystemOrDeveloperInstructions: true,

  /** Models may cite only SourceTrace ids/snippets supplied for this request — no fabricated traces. */
  citeOnlyProvidedSourceTraceIds: true,

  /**
   * Claims without a backing provided trace must be labeled as inference or
   * company-knowledge (memory-only), not as file-backed citations.
   */
  labelUnsourcedClaimsAsInferenceOrCompanyKnowledge: true,

  /** Never invent uploads, snippets, or trace ids that were not supplied server-side. */
  noFabricatedSources: true,

  /** Structured outputs must conform to the agreed schema (reject/clamp drift in validation). */
  outputMustMatchSchema: true,
} as const

export type PromptTrustContract = typeof PROMPT_TRUST_CONTRACT

/**
 * When constructing prompts for an LLM:
 * - Separate system/developer instructions from user content with delimiters; never let user text
 *   contain unclosed “system” sections.
 * - Disallow instruction override: do not phrase user blocks as “ignore previous rules”.
 * - Citations / facts must come only from provided SourceTrace ids and structured fields — no
 *   inventing file-backed traces for memory-only knowledge rows.
 * - Require JSON or a fixed schema for machine-readable outputs so validation can reject drift.
 */

/** Strip common jailbreak markers from heuristic pre-checks (optional; not a security boundary). */
export function containsInstructionOverrideAttempt(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('ignore previous') ||
    lower.includes('disregard the') ||
    lower.includes('system:') ||
    /\boverride\b.*\binstruction/.test(lower)
  )
}

/**
 * Embed untrusted text as a JSON string literal — safe to splice into a larger JSON user
 * message without letting quotes/newlines terminate the string early.
 */
export function embedUntrustedAsJsonString(text: string): string {
  return JSON.stringify(text ?? '')
}

/**
 * Markdown fence whose length exceeds any run of backticks in `content`, so the body stays
 * literal even when the source tries to close the fence early.
 */
export function fenceUntrustedMarkdownBlock(content: string): string {
  const body = content ?? ''
  let fence = '```'
  while (body.includes(fence)) {
    fence += '`'
  }
  return `${fence}untrusted\n${body}\n${fence}`
}

/**
 * Prefix each line so inline “instruction” mimicking is clearly data, not directives
 * (lightweight heuristic for future plain-text prompt assembly).
 */
export function prefixUntrustedLines(text: string, prefix = '| '): string {
  return (text ?? '')
    .split(/\r?\n/)
    .map((line) => `${prefix}${line}`)
    .join('\n')
}
