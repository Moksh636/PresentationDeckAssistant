import type { Slide } from '../types/models.ts'

export interface DeckGenerationThemeDirectionSummary {
  themeSummary?: string
  directionSummary?: string
}

/**
 * Summarize deck theme/direction from slide metadata for post-gen UX.
 */
export function summarizeThemeAndDirectionFromSlides(slides: Slide[]): DeckGenerationThemeDirectionSummary {
  const firstWithIntent = slides.find((s) => s.designIntent)
  const intent = firstWithIntent?.designIntent
  if (!intent) {
    return {}
  }

  const themeSummary = [`Role: ${intent.role}`, `Layout: ${intent.layoutIntent}`, `Visual: ${intent.visualPriority}`]
    .filter(Boolean)
    .join(' · ')

  const dirParts = [
    intent.layoutIntent && `Layout: ${intent.layoutIntent}`,
    intent.visualPriority && `Visual focus: ${intent.visualPriority}`,
    intent.transitionIn?.reason && `Motion: ${intent.transitionIn.reason}`,
  ].filter(Boolean)

  return {
    themeSummary: themeSummary || undefined,
    directionSummary: dirParts.length ? dirParts.join(' · ') : undefined,
  }
}
