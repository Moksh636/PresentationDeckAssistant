## Demo-readiness blockers: design

### Scope

- **Signup/local-mode dead end**: Make `/signup` useful in local/demo mode instead of bouncing users back to `/auth` with no clear path.
- **Intel Brief strict-mode parity**: Ensure Intel Brief citations and bibliographies respect strict Source QA mode the same way Intel Review and deck generation do.
- **Demo honesty for deck generation**: Clearly label when deck generation is using the local mock pipeline instead of a real AI backend.
- **Short explanatory copy**: Add concise copy in a few panels to clarify how source QA, deck uploads, Intel Review, and owner onboarding relate to Company Brain and local/demo behavior.

Out of scope: changing Supabase/storage architecture, wiring any real AI calls, or adding new large features.

### 1) Signup/local-mode behavior

#### Current behavior

- `SignupPage` (`/signup`) uses `useAuth` and `supabase.auth.signUp` when Supabase is configured.
- When `auth.isSupabaseConfigured === false`, `SignupPage` renders a static message about owner signup requiring cloud auth and a CTA linking back to `/auth`.
- `AuthPage` (`/auth`) already has a **local workspace mode** experience when Supabase is not configured:
  - Shows copy about local-only mode.
  - Calls `auth.enterLocalDevMode()` and routes into the app using `resolveDefaultAuthenticatedPath`.

#### Design

- **Supabase configured (`auth.isSupabaseConfigured === true`)**
  - Keep existing `/signup` behavior:
    - Password-based signup via `auth.signUpWithPassword`.
    - Use `supabase.auth.getSession` to confirm and redirect to `/onboarding/company` on success.
  - No copy or behavior changes in this branch.

- **Supabase not configured (`auth.isSupabaseConfigured === false`)**
  - Replace the current “owner signup requires cloud authentication” + “Go to sign in” dead-end with an explicit **demo path**:
    - Hero copy: keep Deckspace logo; update tagline to clarify that cloud signup is disabled in this environment.
    - Body copy: short paragraph explaining that Supabase is not configured and that you can still spin up a local demo workspace.
    - Primary CTA: a single button that **directly enters local demo mode**:
      - Text: “Continue in local demo workspace”.
      - Behavior: call `auth.enterLocalDevMode()` and route to the same default path used by `/auth`’s local-mode (via `resolveDefaultAuthenticatedPath`), so the UX is consistent.
    - Secondary link: small text link back to `/auth` for users who want to see the local-mode sign-in screen instead.
  - Implementation approach:
    - In `SignupPage`, import `useWorkspace`, `resolveDefaultAuthenticatedPath`, and, optionally, `useLocation` if we want “from” redirect parity with `AuthPage`. For the MVP we can keep it simple and route to `/dashboard` or the default owner path derived from `workspace` and a local “owner” profile id.
    - Reuse the same `handleLocalDevContinue` pattern as in `AuthPage`:
      - `auth.enterLocalDevMode()`.
      - `navigate(destination, { replace: true })`, where `destination` is resolved the same way as in `AuthPage` when `auth.canAccessApp` would later be true.

#### Risks / constraints

- Must **not** break Supabase-cloud signup paths. All changes stay under the `!auth.isSupabaseConfigured` branch.
- Local dev mode is already wired; we only add another entry point and keep UX consistent with `/auth`.

### 2) Intel Brief strict-mode parity

#### Current behavior

- Intel Review and deck mock generation already route citation selection through the shared helpers in `sourceCitationReview.ts`:
  - `filterAssetSourceTraces(asset, mode)`
  - `filterAssetsForCitationUse(assets, mode)`
  - `resolveCitationReviewMode(setup)`
- `intelReviewBackendFallback.ts` wraps Intel Review generation so both edge backend and local fallback use these filters and the resolved `citationReviewMode`.
- `reportGenerator.generateDeckReport`:
  - Accepts `deck`, `slides`, `fileAssets`, `reportType`, `intelBriefBrandKit`, `companyBrainSources`.
  - Currently:
    - Collects `sourceReferences` from slides with `collectSourceReferences(slides)` and falls back to `fileAssets.flatMap((asset) => asset.sourceTrace)` when there are no slide traces.
    - Builds bibliography groupings with `buildBibliography(report)` using raw `report.sourceReferences` and `report.companyBrainSources`.
    - It **does not** pass these through `filterAssetSourceTraces` / `filterAssetsForCitationUse`, nor does it re-resolve citation review mode via `deck.setup.citationReviewMode`.
  - As a result, Intel Briefs can show citations/bibliography entries for:
    - Uploads that are excluded/pending in strict mode.
    - Company Brain rows that should be filtered out by strict-approved-only logic.

#### Design

- **Goal**: make Intel Briefs respect Source QA strict mode exactly like Intel Review and deck generation.

- **Citation review mode resolution**
  - In `generateDeckReport`, call `resolveCitationReviewMode(deck.setup)` (already imported) to determine `citationReviewMode` for this deck.

- **Slide/file citation collection**
  - When building `sourceReferences`:
    - For traces that originate from slide blocks/slide `sourceTrace`, rely on the fact that they were created by the deck generator under the correct mode. These traces will already only include eligible `SourceTrace` rows.
    - For the **fallback path** that reaches into `fileAssets` when no slide traces exist:
      - Replace `fileAssets.flatMap((asset) => asset.sourceTrace)` with:
        - First filter assets through `filterAssetsForCitationUse(fileAssets, citationReviewMode)`.
        - Then use `filterAssetSourceTraces(asset, citationReviewMode)` to collect traces.
      - This guarantees strict mode will only see traces from approved assets and enabled snippets.

- **Bibliography filtering**
  - Update `buildBibliography` and/or its call-site so that:
    - `citationBackedUploads` is derived **only** from traces whose underlying `FileAsset` passes `isSourceIncludedForCitations` in the current `citationReviewMode` and whose snippet is enabled.
    - Company Brain rows in `report.companyBrainSources` are already scoped upstream to the same QA mode used for Intel Review; we keep them as-is, but:
      - Where we render memory-only company knowledge (`memoryOnlyCompanyKnowledge`), we ensure that rows with unapproved or excluded statuses in strict mode are not added to the bibliography group.
  - Implementation detail:
    - Pass `citationReviewMode` and `fileAssets` into `buildBibliography` so it can look up and filter traces logically consistent with `collectSourceTracesFromAssets`.

- **Strict-approved-only behavior**
  - When `citationReviewMode === 'strict-approved-only'`:
    - Uploaded-file sources:
      - Only assets with `sourceReview.status === 'approved'` may appear in:
        - `report.sourceReferences`.
        - `report.bibliography.citationBackedUploads`.
      - Pending or excluded assets have **no traces** in the report.
    - Company Brain sources:
      - Only knowledge rows that are considered citation-eligible under strict mode (approval-backed and with real backing traces) may appear in:
        - `report.bibliography.companyKnowledge`.
      - Memory-only rows remain listed separately under `memoryOnlyCompanyKnowledge`, but **only** when their approval/visibility is compatible with strict mode or they come from Intel Review’s strict-filtered slices.

- **Testing**

- Extend or add tests around:
  - A deck setup with `citationReviewMode: 'strict-approved-only'`.
  - File assets:
    - `assetA`: `approved`, has traces.
    - `assetB`: `pending`, has traces.
    - `assetC`: `excluded`, has traces.
  - Company Brain rows with a mix of approval statuses and backing.
  - Assertions:
    - In strict mode, only `assetA`’s traces appear in `report.sourceReferences` and `report.bibliography.citationBackedUploads`.
    - `assetB` and `assetC` do not appear anywhere in the bibliography or citation lists.
    - Company Brain sections reflect only strict-eligible rows in `companyKnowledge` and keep any memory-only rows in the dedicated section when appropriate.

### 3) Demo honesty for deck generation

#### Current behavior

- `BuildPresentationPage`:
  - Uses `useWorkspace().generateSlides(activeDeck.id)` on the “Generate tailored pitch deck” CTA.
  - `generateSlides` in workspace context ultimately calls into the mock/local pipeline in `deckGenerator.ts`:
    - `runMockDeckGenerationPipeline` and helpers such as `createGeneratedSlides`.
  - `aiBackendFlags.ts` defines `isAiBackendEnabled()` and `isAiRestRoutesEnabled()` as feature flags, but `BuildPresentationPage` does **not** surface them in the UI.
- There is currently no visual distinction between:
  - A future state where a real AI backend is wired.
  - The current deterministic local mock generator.

#### Design

- **Goal**: subtle, honest messaging about the current generator while remaining non-alarming.

- **Flag check**
  - In `BuildPresentationPage`, import `isAiBackendEnabled` from `data/aiBackendFlags`.
  - Compute `const aiBackendEnabled = isAiBackendEnabled()` once at render-time.

- **UI copy placement**
  - Place a short line of “mode” copy adjacent to the primary “Generate tailored pitch deck” CTA in the top builder bar:
    - When `aiBackendEnabled === false`:
      - Show: “Local draft generator (no live AI yet).”
      - Style: small `muted-copy` text directly under or beside the button, same width alignment as the button.
    - When `aiBackendEnabled === true`:
      - Hide this disclaimer (no change to existing UI).

- **No behavior changes**
  - Keep `generateSlides` implementation and pipeline untouched.
  - This is display-only, keyed entirely off `isAiBackendEnabled()` so it will naturally disappear or be replaced once a real backend is wired.

### 4) Short explanatory copy additions

#### 4a) Source Citation QA panel

- **Current**: `SourceCitationQAPanel` already:
  - Describes permissive vs strict-approved-only.
  - Shows active mode.
  - Lets users approve/exclude sources and toggle individual snippets.
- **Design**:
  - Add one additional sentence to the existing muted copy block near the top:
    - “These decisions control which sources can appear in Intel Review, deck citations, and Intel Briefs.”
  - Keep it in the same `muted-copy` paragraph to avoid extra visual noise.

#### 4b) Build Pitch Deck page: deck-scoped vs org-wide knowledge

- **Current**:
  - `BuildPresentationPage` explains Company Brain brand/messaging, but does not clearly distinguish:
    - Deck-scoped uploads in the Source Materials panel.
    - Org-wide knowledge in Company Brain’s Knowledge Library.
- **Design**:
  - In the “Source materials” section on `BuildPresentationPage`, extend the existing description paragraph with one sentence:
    - “Uploads here stay scoped to this deck; reusable, org-wide knowledge lives under Company Brain → Knowledge Library.”
  - Ensure this is a single extra sentence at the end of the existing `muted-copy` paragraph to keep layout unchanged.

#### 4c) Intel Review execution-path indicator

- **Current**:
  - `IntelReviewPanel` calls into `aiClient.generateIntelReview`, which is backed by `intelReviewBackendFallback.ts` that chooses between:
    - Edge backend + fallback when `isAiBackendEnabled()` is true.
    - Local Intel review generation when backend is disabled/unavailable.
  - The panel doesn’t show which path is live.
- **Design**:
  - Import `isAiBackendEnabled` into `IntelReviewPanel`.
  - Compute `const aiBackendEnabled = isAiBackendEnabled()` and a display label:
    - `aiBackendEnabled ? 'Edge backend enabled' : 'Running in local mode'`.
  - Place a small, subtle indicator near the Intel Review summary text:
    - Append a short line of muted copy under the lede paragraph:
      - “Mode: Running in local mode.” or “Mode: Edge backend enabled.”
    - Use the same `muted-copy` style, no extra Chrome.

#### 4d) Owner onboarding: mock/demo clarification

- **Current**:
  - `OnboardingCompanyKnowledgePage`:
    - Already has “Knowledge uploads (mock)” and explains filenames are kept locally and that real assets can be uploaded later from Company Brain or owner console.
  - `OnboardingReviewPage`:
    - Summarizes onboarding choices and mock uploads but does not explicitly say that real Company Brain documents live in the Company Brain areas.
  - `OwnerDashboardPage`:
    - Frames the console as a control center for Company Brain, but does not explicitly connect it back to the onboarding mock uploads.

- **Design**:

- **OnboardingCompanyKnowledgePage**
  - Slightly tighten the header copy to emphasize demo-only behavior:
    - Keep title “Knowledge uploads (mock)”.
    - Keep current text but add one short clause:
      - “We keep filenames locally for now—after onboarding you can upload real assets into Company Brain’s Knowledge Library or the owner console.”
    - This is mostly already present; adjust wording to mention “Knowledge Library” explicitly.

- **OnboardingReviewPage**
  - Add a short explanatory sentence under the header, after the existing muted-copy line:
    - “Onboarding samples are demo-only; real Company Brain documents live under Company Brain → Knowledge Library and Source Materials.”

- **OwnerDashboardPage**
  - In the hero subtitle or in the Overview section body, add a single clarifying sentence tying it all together:
    - Example in hero description:
      - Append: “Onboarding uploads are mock/demo; your authoritative documents live under Company Brain’s Knowledge Library and Source Materials.”
  - This keeps the console anchored as the real admin surface while honestly labeling the earlier onboarding flow as demo scaffolding.

### 5) Testing and verification

- After implementation, run the existing workspace and cloud test suites plus lint/build:
  - `npm run test:workspace`
  - `npm run test:workspace-cloud`
  - `npm run lint`
  - `npm run build`
- Add or update tests for Intel Brief strict-mode parity:
  - Prefer placing tests near existing `reportGeneratorBibliography.test.ts` or adding a new spec that:
    - Asserts strict-approved-only mode excludes non-approved assets and knowledge rows from Intel Brief citations and bibliography.

