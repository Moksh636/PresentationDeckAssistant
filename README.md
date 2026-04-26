# Deckspace MVP

Frontend MVP shell for an AI-native presentation workspace. The app provides three routed surfaces:

- `Dashboard`: browse projects and decks from a shared workspace shell
- `Build presentation`: fill in deck setup inputs, upload source files, and trigger mock slide generation
- `Edit presentation`: edit slide blocks directly from structured JSON with a formatting bar, AI chat panel, comments, Present Mode, and PPTX export

## Run

```bash
npm install
npm run dev
```

## Deployment Foundation

The app is still a Vite SPA with local/mock persistence enabled. The backend foundation is prepared, but real Supabase persistence and real AI calls are intentionally not connected yet.

### Environment Variables

Copy `.env.example` when setting up local or hosted environments.

Only variables prefixed with `VITE_` are exposed to frontend code by Vite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AI_BACKEND_ENABLED`

Backend-only secrets must stay in serverless functions, Supabase Edge Functions, or Vercel server environment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_PROVIDER_API_KEY`
- `AI_PROVIDER`

Do not import backend-only secrets from `src/` or expose them through Vite.

### GitHub

This workspace should be initialized as a Git repository before connecting to GitHub. `package-lock.json` is included because the project uses npm. `.env`, `.env.*`, `node_modules`, `dist`, `.vercel`, and cache output are ignored so secrets and generated files are not committed.

### Supabase

1. Create a Supabase project.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to local `.env` and to Vercel project environment variables.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` only in backend/serverless environments.
4. Review `supabase/migrations/0001_foundation.sql` before applying it. It is a schema draft for profiles, workspaces, projects, decks, slides, files, comments, deck versions, generated reports, and chart suggestions.
5. Add real RLS policies when auth and collaborator membership rules are ready. The current migration only enables RLS and includes policy planning comments.

The frontend Supabase setup lives in `src/data/supabaseClient.ts`. It does not force auth and returns `null` until Supabase env vars are configured.

### Vercel

1. Push the Git repo to GitHub.
2. Create a Vercel project from the GitHub repo.
3. Use the default Vite build command: `npm run build`.
4. Set the output directory to `dist` if Vercel does not infer it.
5. Add frontend env vars with the `VITE_` prefix.
6. Add backend-only secrets without the `VITE_` prefix only when serverless or Edge Functions are added.

No `vercel.json` is required for the current Vite SPA. Add one later only if rewrites, custom headers, or serverless routing need explicit configuration.

### Backend and AI Proxy Plan

Vite does not provide app server routes by itself. The placeholder backend route plan is documented in `api/README.md`.

Recommended first backend path: Supabase Edge Functions for AI proxy calls. They can hold provider keys server-side and return validated JSON to the frontend.

`src/data/aiClient.ts` is the frontend adapter seam for real AI integration. It exposes methods for deck generation, editor edits, setup autofill, file ingestion, chart suggestions, report generation, and alternate versions. With `VITE_AI_BACKEND_ENABLED=false`, it keeps calling the existing local mock functions so the app remains usable.

## Architecture

- `src/context/WorkspaceContext.tsx`
  Client-side workspace store with local persistence. This holds projects, decks, slides, file assets, comments, and deck versions.
- `src/data/mockWorkspace.ts`
  Seed data and deck creation helpers so the shell works without a backend.
- `src/data/deckGenerator.ts`
  Deterministic mock slide generation. This is the main future AI/backend seam and already returns the JSON shape consumed by the editor.
- `src/pages/*`
  Route-level pages for dashboard, builder, and editor.
- `src/components/editor/*`
  JSON-driven slide editing primitives: thumbnail rail, formatting toolbar, canvas renderer, Present Mode renderer, comments, and chat panel.
- `src/data/pptxExport.ts`
  Browser-side PowerPoint export foundation. It maps normalized `Slide.blocks[]` layout/style data into widescreen `.pptx` slides using `pptxgenjs`.
- `src/data/aiClient.ts`
  Frontend AI adapter seam. It defaults to existing mock/local logic and is ready to be wired to backend proxy routes without exposing provider keys.
- `src/data/supabaseClient.ts`
  Optional Supabase browser client using only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Slide JSON Model

Slides are rendered from `Slide.blocks[]`. Each block carries:

- `type`
- `content`
- `style.align`
- `style.fontSize`
- `style.bold`
- `style.italic`

This keeps the editor tied to structured data rather than hardcoded slide markup.

## Present Mode

The editor supports a basic Present Mode from the top toolbar. It uses the browser Fullscreen API to show only the active slide on a dark presentation stage with next, previous, and exit controls.

Keyboard support:

- `ArrowRight` or `Space`: next slide
- `ArrowLeft`: previous slide
- `Escape`: exit presentation

True OS-level taskbar hiding depends on the browser and operating system fullscreen behavior.

## PPTX Export

The editor toolbar includes `Export PPTX`. Export uses `pptxgenjs` in the browser and downloads a widescreen 16:9 `.pptx` named from the deck title.

Supported in the foundation: text, headings, rectangles, image/chart placeholder boxes, approximate position/size, text formatting, z-order, and speaker notes through PowerPoint notes.

## Editor UI/UX Fix Plan Notes

- Present Mode foundation is now supported through browser fullscreen.
- Remaining high-impact editor fixes include undo/redo, keyboard shortcuts, slide thumbnail previews, alignment guides, strict comment scoping, and drag/resize performance improvements.

## Next Steps

- Replace local mock generation with async backend jobs that return the same slide JSON contract
- Attach real file parsing, source summaries, and source trace metadata to `FileAsset`
- Add collaboration and comment threading to slide-level edits
- Add version restore flows and improve export fidelity for real images and native charts
