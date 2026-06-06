# Product backlog

## Executive summary

This MVP shell prioritizes a **credible Build → Intel Review → Generate → Edit** loop with **local/demo and Supabase** parity. The full **22-area** gap analysis lives in **[`docs/product-gap-audit.md`](./product-gap-audit.md)**. Near-term UX fixes focus on **orientation** (progress, checklist, empty states), **trust** (intel fallback copy, PDF/source honesty, post-generation quality), **owner readiness** (setup completeness, “what AI can use”), and **safe persistence UX** (replacing blocking prompts with accessible conflict resolution). Larger commercial and platform bets remain deferred below.

---

## Deferred large items

### Stripe / billing

- **Why:** Monetization and seat limits.
- **Suggested impl:** Stripe Checkout + Customer Portal; map Supabase `user`/`org` to Stripe customer; feature gates by subscription status.
- **Dependencies:** Stable org identity, auth, audit logging.
- **Priority:** P1 (when charging).

### Full relational deck persistence

- **Why:** Multi-device editing, version history, collaboration scale.
- **Suggested impl:** Normalize decks/slides/blocks in Postgres; optimistic UI; CRDT or revision tokens optional.
- **Dependencies:** Auth, storage for assets, conflict strategy.
- **Priority:** P2.

### Real AI deck generation (beyond mock/local pipeline)

- **Why:** Differentiated output quality.
- **Suggested impl:** Server-side orchestration; retain citation traces; keep Gemini usage scoped per policy (Intel Review only unless flag).
- **Dependencies:** Backend infra, cost controls, eval harness.
- **Priority:** P1.

### Web research source collection

- **Why:** Richer account intel.
- **Suggested impl:** Approved domains + caching + citation normalization.
- **Dependencies:** Compliance review, API keys (server-side only).
- **Priority:** P2.

### Integrations (CRM, calendar, Slack)

- **Why:** Workflow fit.
- **Suggested impl:** OAuth apps + webhook workers.
- **Dependencies:** Enterprise auth, audit.
- **Priority:** P2.

### Fine-grained permissions

- **Why:** Enterprise governance.
- **Suggested impl:** RBAC on org resources; deck-level ACL.
- **Dependencies:** Identity model stabilization.
- **Priority:** P2.

### Analytics / funnel instrumentation

- **Why:** Product iteration.
- **Suggested impl:** Privacy-preserving event pipeline; opt-in.
- **Dependencies:** Consent policy.
- **Priority:** P2.

### Enterprise audit exports

- **Why:** Procurement.
- **Suggested impl:** Immutable audit log service + CSV/PDF export.
- **Dependencies:** Activity model completeness.
- **Priority:** P2.

### Real outbound email for invites

- **Why:** Invite friction today is manual/out-of-band.
- **Suggested impl:** Transactional email provider + templates + suppression lists.
- **Dependencies:** Domain auth (SPF/DKIM), privacy policy.
- **Priority:** P1.

### RAG over knowledge library

- **Why:** Better grounding vs keyword selection alone.
- **Suggested impl:** Chunking + embeddings + retrieval fused with existing selection UX.
- **Dependencies:** Infra cost, evaluation, permission boundaries.
- **Priority:** P2.

### PPTX import

- **Why:** Migration from legacy decks.
- **Suggested impl:** Import to editable blocks with fidelity tiers.
- **Dependencies:** Parser maintenance, layout mapping.
- **Priority:** P2.

### Slide masters / theme packs

- **Why:** Visual consistency at scale.
- **Suggested impl:** Master definitions mapped to generator + editor constraints.
- **Dependencies:** Design engine stability.
- **Priority:** P2.
