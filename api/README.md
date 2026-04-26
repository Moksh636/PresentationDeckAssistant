# API Foundation

This project is currently a Vite SPA, so `npm run build` only builds the frontend. Vite does not provide application server routes by itself.

Recommended backend options for the first real AI integration:

1. Supabase Edge Functions
   - Best fit for this MVP because Supabase is already planned for persistence.
   - Store `SUPABASE_SERVICE_ROLE_KEY`, `AI_PROVIDER_API_KEY`, and `AI_PROVIDER` only in Supabase function secrets.
   - Frontend calls Edge Functions through the Supabase client or `fetch`.

2. Vercel Serverless Functions
   - Add real handlers under `api/` when ready.
   - Keep provider keys in Vercel environment variables without the `VITE_` prefix.
   - Do not import server handlers from `src/`.

3. Next.js migration later
   - Use this only if routing, auth, server rendering, and API routes need to become one framework.
   - This is not required for the current Vite MVP.

Planned AI route contracts:

- `POST /api/ai/files/ingest`
- `POST /api/ai/setup/autofill`
- `POST /api/ai/decks/generate`
- `POST /api/ai/editor/propose`
- `POST /api/ai/charts/suggest`
- `POST /api/ai/reports/generate`
- `POST /api/ai/decks/alternate-version`

Until these are implemented, `src/data/aiClient.ts` keeps local mock behavior as the default.
