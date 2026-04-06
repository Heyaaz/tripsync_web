# TripSync Server Codex Guide

Follow the repository root `AGENTS.md`, then apply the rules below for work inside `tmti_web/`.

## Local PM Routing

- For backend planning, API design, task breakdown, prioritization, or backend doc work, read `.codex/agents/pm.md` first.
- Treat that PM file as the default planning role for this subtree.
- In PM mode, do not edit backend source code unless the user explicitly asks to move into implementation.

## Git Commit Rules

- When backend work requires a commit, follow the `git-commit-convention` skill.
- Use the commit subject format `type: summary` with skill-aligned prefixes such as `feat:`, `fix:`, `chore:`, `docs:`, `ref:`, `style:`, or `test:`.
- Keep the commit message to a simple single-line subject unless the user explicitly asks for more detail.
- Avoid `git add .`; stage only the intended backend files explicitly.
- Write commit messages in Korean.

## Shared Docs

- Consult the relevant shared docs in `../docs/` before backend planning, implementation, or documentation updates.
- `../docs/PRD.md` - Product requirements, MVP scope, priorities, and core user/problem framing.
- `../docs/TECH_SPEC.md` - Technical design covering frontend, backend, data, infra, and algorithm decisions for the MVP.
- `../docs/API_SPEC.md` - REST API request/response contracts, validation rules, and error handling details.
- `../docs/DB_SCHEMA.md` - MySQL schema, constraints, indexes, lifecycle, and deletion policy definitions.
- `../docs/CONSENSUS_ENGINE.md` - Consensus engine rules for conflict analysis, slot allocation, place selection, satisfaction scoring, and LLM boundaries.
- `../docs/TEST_PLAN.md` - Quality strategy, test scope, acceptance criteria, and verification targets.
- `../docs/proposal_draft.md` - Service proposal narrative covering background, necessity, and contest-facing positioning.
- `docs/design/TRIPSYNC_DESIGN_GUIDE.md` - Frontend visual system, typography, surface treatment, proposal-vs-confirmed UI distinction, and legibility rules for this app.

## Design Rules

- Follow `docs/design/TRIPSYNC_DESIGN_GUIDE.md` for all frontend-facing changes in this subtree.
- Keep TripSync in a bright, high-legibility light theme. Do not drift into dark-mode-first, neon, or heavy glassmorphism styling.
- Prioritize readability over visual effects. If blur, transparency, gradients, or decorative blobs reduce text clarity, reduce the effect rather than preserving the effect.
- Small supporting copy must remain legible on mobile. Prefer `text-sm font-normal text-zinc-700 leading-relaxed` for secondary descriptive text unless a stronger reason exists.
- Avoid very small gray text. Do not casually introduce `text-xs` or `text-zinc-500/600` for core descriptive copy.
- Treat proposal UI and confirmed UI as separate states:
  - Proposal screens should look editable, suggestive, and revisable.
  - Confirmed screens may use stronger timeline, ordering, and final-state cues.
- Do not present AI proposals as fixed schedules before confirmation.
- When a screen mixes AI recommendations with user-editable inputs, preserve a visible user-editing path instead of forcing an AI-only flow.
- Prefer nearly opaque white surfaces for app screens when content density is medium or high. Use glass/blur sparingly and only when readability remains strong.
- If a visual issue is reported by the user, treat it as a real UX defect first. Do not dismiss readability complaints as subjective unless verified against the UI.

## Scope

- This subtree covers the TripSync web app frontend and frontend-adjacent docs under `tmti_web/`.
- The main in-scope areas are:
  - landing and marketing screens
  - TPTI test and result flows
  - room creation and join flows
  - conflict map and AI schedule proposal flows
  - share pages and related frontend utility code
  - local design and frontend guidance docs for this subtree
- Backend planning guidance may still apply through shared docs and local PM routing, but this subtree guide should primarily steer UI behavior, user flow presentation, and frontend consistency.
- When a task affects both UI and data contracts, keep the frontend experience consistent with the documented design rules while preserving backward compatibility where practical.
