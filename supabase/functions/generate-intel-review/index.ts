/**
 * Intel Review Edge function.
 *
 * Secrets (Supabase dashboard → Edge Functions → Secrets): `GEMINI_API_KEY` when using Gemini;
 * optional `AI_PROVIDER=gemini` to enable; optional `AI_MODEL` (defaults to gemini-2.5-flash).
 * Optional guards: `SUPABASE_TEST`, `INTEL_REVIEW_FORCE_MOCK` — skip live AI (deterministic mock).
 * Never expose these keys to the frontend / VITE_*.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { generateIntelReviewWithOptionalGemini } from '../_shared/geminiIntelReview.ts'
import { sanitizeIntelReviewRequest } from '../_shared/intelReviewShared.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

const denoRuntime = globalThis as {
  Deno?: {
    env: { get: (key: string) => string | undefined }
    serve: (handler: (request: Request) => Response | Promise<Response>) => void
  }
}

const supabaseUrl = denoRuntime.Deno?.env.get('SUPABASE_URL')
const supabaseAnonKey = denoRuntime.Deno?.env.get('SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseAnonKey || !denoRuntime.Deno?.serve) {
  throw new Error('Missing Deno runtime or required Supabase function environment.')
}

denoRuntime.Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.' })
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return json(401, { error: 'Missing Authorization header.' })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  })

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized.' })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'Invalid JSON body.' })
  }

  try {
    const sanitized = sanitizeIntelReviewRequest(body)

    const envGet = (key: string) => denoRuntime.Deno?.env.get(key)
    const result = await generateIntelReviewWithOptionalGemini(sanitized, { envGet })

    return json(200, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request input.'
    return json(400, { error: message })
  }
})
