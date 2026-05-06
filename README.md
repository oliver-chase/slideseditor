# Slides Editor

**Slides Editor is a tool for importing HTML content, editing it into polished slide decks, and exporting them as HTML, PDF, or PPTX.** Think of it as a lightweight presentation builder — you bring your content (or paste it in), arrange it into slides, and export when you're ready.

It was extracted from the oliver-app project to live as its own standalone tool.

**Who this is for:** anyone who needs to turn existing HTML content into presentation-ready slides without starting from scratch in PowerPoint or Google Slides.

## What You Can Do

| Feature | Description |
|---|---|
| **Import** | Paste HTML or import files into an editable slide workspace |
| **Edit** | Modify slide content directly on the canvas |
| **Save/Load** | Save your slides to "My Slides" and reload them later |
| **Templates** | Publish simple templates from saved slides; preview and duplicate |
| **Export** | Export to HTML, PDF, or PPTX (including backend PPTX job orchestration) |

## What's NOT In Scope (removed during extraction)

- Slide audit UI and telemetry
- Template approval queues, SLAs, escalation, collaborator management, ownership transfer, archive/restore
- Governance backend remnants in the frontend data client

## Import Structure

The first commit preserved the original module under `imported/` so the extraction is complete before simplification. Current scope code is being moved out of `imported/` into a clean standalone app shell.

**Next steps:** create standalone app shell → move scope code → delete stale governance/audit/chatbot dependencies → rebuild around the import/edit/save/export architecture.

## Public / Private Setup

This repo follows the OliverCode public/private boundary standard.

- Setup modes: `docs/SETUP_MODES.md`
- Manual setup: `docs/MANUAL_SETUP.md`
- Local runtime values: `.env.local`
- Private operator files: `.secrets/*`

