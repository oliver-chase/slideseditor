# Architecture — Slides Editor

Status: Active (module extraction phase)
Last updated: 2026-05-23
Owner: Engineering

## Overview

Slides Editor is the standalone extraction of the Slides module from `oliver-app`. The current architecture is transitional — code lives in `imported/` and is being systematically moved into a clean standalone app shell.

## Current Structure

```
slideseditor/
├── imported/          ← Original module code (to be migrated out)
│   └── ...              (preserved for extraction completeness)
├── AGENTS.md           Agent configuration
├── README.md           Scope and setup
└── docs/               (emerging documentation)
```

## Intended Architecture (Post-Extraction)

```
slideseditor/
├── app/                Next.js app router pages and API routes
├── components/         Reusable UI components
├── lib/                Business logic, types, and utilities
├── public/             Static assets
├── tests/              Test suite
├── docs/               Documentation
├── AGENTS.md
├── ARCHITECTURE.md
├── QUALITY_BASELINE.md
└── README.md
```

## Scope

The editor is scoped to the **import/edit/save/export** workflow:

1. **Import** — paste HTML or import files into an editable slide/deck workspace
2. **Edit** — modify slide/deck canvas content
3. **Save** — save/load slides through "My Slides"
4. **Export** — export HTML/PDF/PPTX (with existing warning/report behavior preserved)
5. **Templates** — publish simple templates from saved slides; preview and duplicate

### Excluded (unless explicitly reactivated)

- Slides audit UI/actions/state hooks
- Template approval queue, SLA/escalation, collaborator management
- Template archive/restore/permanent delete
- Template governance backend remnants
- Unsaved-change telemetry

## Extraction Plan

1. Create a clean standalone app shell (Next.js app router)
2. Move only current-scope code out of `imported/`
3. Delete stale governance/audit/chatbot/module-web dependencies
4. Rebuild the editor around a smaller import/edit/save/export architecture
5. Delete `imported/` entirely when extraction is complete

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Export:** HTML/PDF/PPTX via backend job orchestration (preserved from oliver-app)

## Key Constraints

- Preserve PPTX export warning/report behavior during extraction
- Preserve backend PPTX job orchestration where needed
- Keep validation gates minimal (`npm run typecheck`) until full standalone architecture stabilizes
