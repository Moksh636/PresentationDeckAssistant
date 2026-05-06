/**
 * Prompt-injection and trust-boundary notes for future LLM-backed Intel Review / deck flows.
 * No model calls here — this module is documentation + tiny helpers for consistent treatment
 * of untrusted user and document text.
 */

/** Treat deck setup, uploads, and Company Brain descriptions as untrusted input. */
export type UntrustedUserText = string

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
