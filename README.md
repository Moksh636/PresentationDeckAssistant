# Deckspace MVP

Frontend MVP shell for an AI-native sales deck workspace. The app provides routed surfaces for dashboard, pitch deck build (account brief + intel review), and slide editing.

## Authentication

The deployed app is **private-login-first**: visitors land on a **sign-in / sign-up** screen and cannot open dashboard, build, editor, or workspace features until authenticated.

- **Production / hosted (Supabase configured)**  
  Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Users must sign in (email + password, optional magic link and password reset) before using the app. Sessions persist across refreshes via the Supabase client.

- **Local development (env vars missing)**  
  If those variables are not set, the app shows a **local development** path: an explicit **Continue in local development mode** action stores a session flag and opens the app **without** cloud login. Data remains in the browser only.

- A **public marketing site** is not part of this repo and can be added separately later.
- **Billing / subscriptions** are not implemented.

### Required Vercel (or host) environment variables

| Variable | Required for |
|----------|----------------|
| `VITE_SUPABASE_URL` | Supabase project URL (public) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public, RLS-protected) |

Optional:

- `VITE_AI_BACKEND_ENABLED` — see AI adapter section below.

**Never** expose `SUPABASE_SERVICE_ROLE_KEY` or other backend secrets in Vite / client code. Keep them in serverless or Edge Functions only.

## Run

```bash
npm install
npm run dev
```

## Deployment Foundation

The app is a Vite SPA. Workspace data defaults to **browser localStorage**; **manual** Save to Cloud / Load from Cloud is available when Supabase is configured and the user is signed in. There is no auto-sync; existing confirmation behavior for load/merge is preserved.

### Environment variables

Copy `.env.example` when setting up.

Only variables prefixed with `VITE_` are exposed to frontend code by Vite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AI_BACKEND_ENABLED`

For testing Supabase Edge Function AI scaffolding from the frontend:

- set `VITE_AI_BACKEND_ENABLED=true`
- keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured
- no AI provider key is required yet

Backend-only secrets must stay in serverless functions, Supabase Edge Functions, or the host’s non-`VITE_` environment:

- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_PROVIDER_API_KEY`
- `AI_PROVIDER`

Do not import backend-only secrets from `src/` or expose them through Vite.

### GitHub

This workspace should be initialized as a Git repository before connecting to GitHub. `package-lock.json` is included because the project uses npm. `.env`, `.env.*`, `node_modules`, `dist`, `.vercel`, and cache output are ignored so secrets and generated files are not committed.

### Supabase

1. Create a Supabase project and enable **Email** auth (password; optional magic link / OTP as configured in the project).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to local `.env` and to Vercel (or your host) project environment variables.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` only in backend/serverless environments.
4. Review `supabase/migrations/0001_foundation.sql` before applying it.
5. Apply `supabase/migrations/0002_workspace_snapshots.sql` for the `workspace_snapshots` table and RLS tied to `auth.uid()`.
6. Apply `supabase/migrations/0003_company_brain.sql` for the **Company Brain** relational scaffold (organizations, memberships, knowledge folders/items, brand kit, messaging snippets, case studies, product/service bullets, activity logs).
7. Add real row-level policies for normalized tables when collaboration rules are ready.

The browser client is `src/data/supabaseClient.ts` and uses only the public anon key.

### Supabase Storage (uploaded sources & deck images)

The app uses two buckets (create them in **Supabase Dashboard → Storage**):

| Bucket id | Purpose |
|-----------|---------|
| `source-files` | Raw files uploaded on the **build** flow (account research sources). Objects use paths `{auth_user_id}/{deck_id}/{file_asset_id}/{filename}`. |
| `deck-assets` | Slide images inserted or replaced in the **editor** (`visual-placeholder` blocks). Same path pattern with a unique asset key per upload. |

**Recommended setup**

1. Create both buckets. For the simplest client behavior (stable image URLs in slides), mark them **public** and rely on long random paths for obscurity, **or** keep them private and plan to resolve signed URLs when loading slides (the editor currently uses `getPublicUrl` after upload; private buckets may require follow-up work to use `createSignedUrl` or edge helpers).
2. Add **Storage policies** so authenticated users can read/write only under their own prefix. Example policy shape (adjust names as needed; run in SQL editor against `storage.objects`):

```sql
-- Example: allow authenticated users full access to objects under their user id folder in source-files
create policy "source_files_own_prefix"
on storage.objects for all
to authenticated
using (bucket_id = 'source-files' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'source-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "deck_assets_own_prefix"
on storage.objects for all
to authenticated
using (bucket_id = 'deck-assets' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'deck-assets' and (storage.foldername(name))[1] = auth.uid()::text);
```

Public buckets still require **insert/update** policies for authenticated users; use the Supabase policy UI or SQL to match your security model.

**App behavior**

- **No Supabase env vars / local dev mode:** uploads stay local (existing mock ingestion and data URLs). Nothing is sent to Storage.
- **Signed in with Supabase:** the build flow uploads each selected file to `source-files` when possible and stores a `storage` reference on the `FileAsset`. The editor uploads slide images to `deck-assets` and prefers the cloud URL for `SlideImageAsset.dataUrl`. If Storage is missing, misconfigured, or the upload fails, the app **falls back** to the previous local-only behavior and shows an informational toast.

Helpers live in `src/data/workspaceStorage.ts` (`uploadWorkspaceAsset`, `getWorkspaceAssetUrl`, `deleteWorkspaceAsset`). Existing workspace JSON and localStorage data are **not** auto-migrated to buckets.

### Company Brain (org memory scaffold)

Deckspace ships a lightweight **company workspace / knowledge library** scaffold so reps can accumulate shared narratives, proofs, approvals, brand defaults, offerings, and case studies locally while Supabase relational tables mature.

- **Frontend route**: `/company` (**Company Brain** in the sidebar) hosts tabs for overview, knowledge, review queue, brand kit, messaging, casework, catalogs, membership, and an activity timeline.
- **Local/mock behavior**: all Company Brain payloads live inside the existing `workspace` JSON persisted to `localStorage` (same as decks). Older snapshots **auto-normalize**: missing `workspace.companyBrain` backfills empty arrays/objects so nothing breaks offline.
- **Role-aware retrieval (mock heuristic)**: `getRelevantCompanyKnowledgeForUser` ranks knowledge items during the **Build Pitch Deck** flow using approval flags, visibility, department/title matchers, deck brief keywords (target company / buyer persona / offerings), tags, and source types. No embeddings / no vector search yet.
- **Intel Review integration**: when you toggle knowledge selections in Build, `/generate-intel-review` mocks include those excerpts in local intel drafts via `generateIntelDraftFromSources`, and citations only hydrate when linked `FileAsset` traces exist.
- **Supabase rollout**: migrations `supabase/migrations/0003_company_brain.sql` define the Postgres tables plus RLS aligned to owners/admins/members. Wired cloud sync UI + policies can land later without changing the UX contract modeled here.

> **Important:** there are still **no paid AI APIs**, **no Stripe billing**, **no embeddings / vector search**, and **no OCR / parsing pipelines** bundled with this scaffold—purposefully safe for prototyping.

### Auth and workspace snapshots

- **Supabase configured:** sign-in is **required** to use the app; cloud save/load uses the signed-in user id.
- **Supabase not configured:** use **local development mode** from the sign-in screen; work is not cloud-saved.
- Cloud save/load uses `workspace_snapshots.workspace_json` and does not replace localStorage automatically. Loading a snapshot still flows through the existing workspace store.

### Vercel

1. Push the Git repo to GitHub.
2. Create a Vercel project from the GitHub repo.
3. Build: `npm run build`, output directory `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for production auth.

No `vercel.json` is required for the current Vite SPA unless you add rewrites or serverless routes.

### Backend and AI proxy plan

Vite does not provide app server routes by itself. The placeholder backend route plan is documented in `api/README.md`.

Recommended first backend path: Supabase Edge Functions for AI proxy calls.

`src/data/aiClient.ts` is the frontend adapter seam. With `VITE_AI_BACKEND_ENABLED=false`, it keeps calling local mock functions.

### Supabase Edge Functions (AI scaffold)

Mock AI backend function scaffold (no paid provider calls yet):

- `supabase/functions/generate-intel-review/index.ts`
- shared sanitization + response builder: `supabase/functions/_shared/intelReviewShared.ts`

Deploy function:

```bash
supabase functions deploy generate-intel-review
```

Serve locally while developing:

```bash
supabase functions serve generate-intel-review
```

Current behavior:

- verifies Supabase JWT and rejects unauthenticated requests (`401`)
- validates/sanitizes request payloads (`400` on malformed input)
- returns structured mock intel JSON and warnings
- never fabricates citations (returns only sanitized `sourceTraces` from request)
- if `webResearchEnabled=true`, returns a warning that web research is not connected yet

Future AI provider integration should use **Supabase Function Secrets** (server-side only), not frontend `VITE_` variables.

## Architecture

- `src/context/AuthContext.tsx`  
  Supabase session, sign-in / sign-up / sign-out, password reset, and local dev bypass (session flag when env vars are missing).
- `src/pages/AuthPage.tsx`  
  Sign-in and sign-up UI; local development entry when Supabase is not configured.
- `src/components/auth/ProtectedLayout.tsx`  
  Gate for all in-app routes.
- `src/context/WorkspaceContext.tsx`  
  Client-side workspace store with local persistence.
- `src/data/mockWorkspace.ts`  
  Seed data and deck creation helpers.
- `src/data/deckGenerator.ts`  
  Deterministic mock slide generation.
- `src/pages/*`  
  Dashboard, build, editor, auth, `/company`.
- `src/pages/CompanyBrainPage.tsx`  
  Company Brain workspace scaffold (tabs, mock CRUD, activity log).
- `src/components/editor/*`  
  Slide editing, comments, Present Mode, export.
- `src/data/pptxExport.ts`  
  Browser PPTX export via `pptxgenjs`.
- `src/data/aiClient.ts`  
  AI adapter seam.
- `src/data/supabaseClient.ts`  
  Optional Supabase browser client.
- `src/data/workspaceCloudPersistence.ts`  
  Manual cloud snapshot save/load.
- `src/data/workspaceStorage.ts`  
  Supabase Storage uploads and URLs for `source-files` and `deck-assets`.

## Slide JSON Model

Slides render from `Slide.blocks[]` with `type`, `content`, and `style` (align, fontSize, bold, italic).

## Present Mode

Fullscreen slide stage with next/previous/exit. Keyboard: ArrowRight, Space, ArrowLeft, Escape.

## PPTX Export

Editor toolbar `Export PPTX` downloads a widescreen `.pptx` from the deck title.

## Next Steps

- Replace local mock generation with async backend jobs returning the same slide JSON contract
- Real file parsing and source trace metadata on `FileAsset`
- Collaboration and version restore flows
- Public marketing site (separate from this private app)
