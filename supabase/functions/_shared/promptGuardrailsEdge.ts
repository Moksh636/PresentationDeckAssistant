/**
 * Mirrors `src/data/promptGuardrails.ts` for Deno Edge — keep helpers aligned.
 */

export function embedUntrustedAsJsonString(text: string): string {
  return JSON.stringify(text ?? '')
}

export function fenceUntrustedMarkdownBlock(content: string): string {
  const body = content ?? ''
  let fence = '```'
  while (body.includes(fence)) {
    fence += '`'
  }
  return `${fence}untrusted\n${body}\n${fence}`
}
