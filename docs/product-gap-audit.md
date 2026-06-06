# Product gap audit (MVP shell)

**Date:** 2026-06-06  
**Scope:** Local/demo + Supabase-backed workspace; Gemini limited to Intel Review edge path only.

This document inventories gaps and weaknesses across **22 product areas**. Priority: **P0** (blocks credible demo or trust), **P1** (material friction), **P2** (polish). Effort: **S** / **M** / **L**. **Now** = reasonable for current MVP; **Backlog** = defer (see [`docs/product-backlog.md`](./product-backlog.md)).

---

## 1. Landing

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Value proof above fold varies by route | Visitors may miss the core loop | P2 | S | Backlog — copy pass |
| Social proof / logos absent | Low trust for enterprise narrative | P2 | M | Backlog |

## 2. Auth

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| No SSO / enterprise IdP | Expected by some buyers | P2 | L | Backlog |
| Session recovery UX minimal | Users may not know local vs cloud | P1 | M | Backlog |

## 3. Workspace dashboard

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Deck list lacks readiness hints | Users reopen stale drafts | P2 | S | Backlog |
| No cross-deck activity summary | Owners lose narrative thread | P2 | M | Backlog |

## 4. Owner onboarding

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Progress scattered across routes | Owners unsure what “done” means | P1 | M | **Now** — completeness hints on owner home |
| Wizard vs dashboard drift | Duplicate mental models | P2 | M | Backlog |

## 5. Owner console

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Sync status fragmented (identity / knowledge / libraries) | Looks noisy; easy to misread | P1 | S | **Now** — consolidated sync line |
| No single “what ships next” view | Owners stall | P1 | M | **Now** — setup completeness + AI-usable summary card |

## 6. Company brain

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Policies vs messaging boundaries fuzzy | Wrong expectations for reps | P1 | M | Backlog |
| Approval workflows shallow | Governance story weak | P2 | L | Backlog |

## 7. Brain map

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Completeness not surfaced | Owners don’t finish linking | P1 | S | **Now** — counts on overview |

## 8. Knowledge library

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Search/filter parity across modes | Demo friction | P2 | M | Backlog |
| Bulk operations limited | Curators slow down | P2 | L | Backlog |

## 9. Invites / roles

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Invite lifecycle opaque (draft → invited → joined) | Ops confusion | P1 | S | **Now** — clearer invite metadata |

## 10. Build (pitch workspace)

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Long vertical flow without progress mental model | Users get lost | P0 | M | **Now** — step progress + checklist |
| Empty states terse | Users don’t know the next action | P1 | M | **Now** |
| No preflight before generate | Bad decks feel “random” | P1 | M | **Now** |

## 11. Parsing / sources

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| PDF/DOCX limitations opaque | Users blame the product | P1 | S | **Now** — friendly copy + TXT/DOCX hint |
| QA row actions tedious at scale | Owners abandon QA | P1 | M | **Now** — bulk actions |

## 12. Source QA

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Strict/permissive without guided outcomes | Wrong citations | P1 | M | Partially addressed — quality summary row |
| Health labels inconsistent | Hard to scan upload list | P1 | S | **Now** — Ready / Limited preview / etc. |

## 13. Intel review

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Field completeness unclear | Users ship thin intel | P1 | S | **Now** — checklist |
| Backend failure easy to miss | Trust erosion | P1 | S | **Now** — fallback banner + toast |
| Apply-to-brief missing | Double data entry | P1 | M | **Now** |

## 14. Deck generation / design engine

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| No quality feedback after generate | Users don’t iterate | P1 | M | **Now** — quality report + summary card |
| Theme/direction opaque | Hard to explain “why this deck” | P2 | M | **Now** — surface metadata |

## 15. Edit / present

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Present mode missing speaker affordances | Live pitch friction | P1 | S | **Now** — notes toggle + nav controls |
| Design intent invisible while editing | Hard to tune story | P2 | M | **Now** — compact design report |
| Bibliography missing as slide | Enterprise expects citations slide | P2 | M | **Now** — optional slide action |

## 16. PPTX / export

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Export failures silent-ish | Users lose confidence | P1 | S | **Now** — preflight warnings |
| Transition fidelity limited (notes-only intent) | Expected parity gap | P2 | M | Backlog |

## 17. Collaboration & sharing

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Collaborator permissions coarse | Enterprise buyers ask for RBAC | P2 | L | Backlog |
| Comment threads lack notifications | Async review stalls | P2 | M | Backlog |

## 18. Charts & visuals

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Chart suggestions disconnected from editor insert | Missed proof moments | P2 | M | Backlog |
| Placeholder fidelity in PPTX | Export surprise | P2 | M | Backlog |

## 19. Persistence / sync

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Cloud/local conflict via `window.prompt` | Breaks trust + accessibility | P0 | M | **Now** — modal |
| Activity trail sparse | Owners can’t audit what happened | P2 | M | **Now** — lightweight events |

## 20. Demo mode

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Seed story inconsistent | Demo narrative weak | P2 | S | **Now** — MetroFlow demo brief button (local overlay) |

## 21. Security

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Secrets in client bundle | Critical risk | P0 | — | Not applicable — maintain discipline |
| Scoped AI surface | Scope creep risk | P1 | — | Enforced — Intel-only Gemini path |

## 22. Friction / polish

| Gap | Why it hurts | P | Effort | Now / Backlog |
|-----|----------------|----|--------|----------------|
| Too many micro-chips for sync | Cognitive load | P2 | S | **Now** — consolidated owner sync line |
| Autosave status scattered on Company Brain | Unclear save state | P2 | S | Partial — owner console consolidated |

---

## Summary

The largest consistent gaps are **orientation inside Build** (progress, checklist, empty states), **trust surfaces** (intel fallback, PDF honesty, post-gen quality), **owner readiness** (completeness, what AI can use), and **sync conflict UX**. Larger bets (Stripe, enterprise SSO, full relational deck persistence, real AI deck generation, RAG, analytics) belong in [`docs/product-backlog.md`](./product-backlog.md).

**Implemented in this pass (2026-06-06):** Build workflow helpers and UI wiring, source health labels, Intel fallback banner, post-generation quality summary with safe one-click jumps, owner overview widgets, conflict modal, activity logging for key events, present-mode controls, export preflight, bibliography slide generator.
