/**
 * Presentation-only helpers for translating raw parser warnings into
 * friendly Build-page copy. Pure functions: they NEVER mutate the input
 * array. Raw warnings remain stored on `FileAsset.parseWarnings` and are
 * still surfaced verbatim under "Advanced source details" folds and to
 * downstream generation paths.
 */

/** Technical fragments that map to a generic "limited preview" message. */
const LIMITED_PREVIEW_FRAGMENTS: RegExp[] = [
  /workerSrc/iu,
  /GlobalWorkerOptions/iu,
  /pdfjs/iu,
  /pdf extraction failed/iu,
  /docx extraction failed/iu,
  /no readable text was found/iu,
  /is not enabled in this build/iu,
  /filename-only placeholder/iu,
  /preview was capped/iu,
  /exceeds local preview limit/iu,
  /only the first chunk is read/iu,
  /resembles binary data/iu,
  /JSON parse failed/iu,
  /only first \d+ pages/iu,
]

export interface SanitizedParseWarnings {
  /** A single short user-friendly line, or null when there are no warnings. */
  friendlyMessage: string | null
  /** Raw warnings list (unchanged) for Advanced disclosure. */
  rawWarnings: string[]
  /** True when at least one known technical limitation fired. */
  hasLimitedPreview: boolean
  /** True when there are any warnings at all (limited or unmapped). */
  hasAnyWarning: boolean
}

/**
 * Build a user-friendly summary from raw `parseWarnings` for the Build UI.
 * Does NOT mutate the input array; stored warnings remain untouched.
 */
export function sanitizeParseWarningsForUserDisplay(
  warnings: string[] | undefined,
): SanitizedParseWarnings {
  const raw = Array.isArray(warnings) ? warnings.filter((w) => typeof w === 'string' && w.trim()) : []

  if (raw.length === 0) {
    return {
      friendlyMessage: null,
      rawWarnings: [],
      hasLimitedPreview: false,
      hasAnyWarning: false,
    }
  }

  const limited = raw.some((message) =>
    LIMITED_PREVIEW_FRAGMENTS.some((pattern) => pattern.test(message)),
  )

  const friendlyMessage = limited
    ? 'Limited preview — we parsed what we could from this file. Snippets and citations still work for any text we could read.'
    : 'Some parser notes were captured for this file. See Advanced source details for the technical messages.'

  return {
    friendlyMessage,
    rawWarnings: raw,
    hasLimitedPreview: limited,
    hasAnyWarning: true,
  }
}
