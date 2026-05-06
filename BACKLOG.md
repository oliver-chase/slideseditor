# BACKLOG — Slides Editor

Status date: 2026-07-16. Full audit of the imported module: every core file read line-by-line, export engine exercised live (real PPTX generated from the actual code, unzipped, inspected).

## Verdict

The repo never had a runnable app. There is no `package.json` anywhere — nothing to install, build, or start. All code sits in `imported/` exactly as copied from oliver-app; the standalone shell the README/ARCHITECTURE promised was never built. The 100+ "Done/Verified" story files describe work verified inside oliver-app, not here.

**Direction (owner decision 2026-07-16):** rebuild as a single local HTML tool around the salvageable pure-TS engine. No template library, no saved-slides workspace, no backend. Canvas presets 16:9 and 1:1 stay as-is; no per-platform size wiring needed.

## Why export "never worked" — root-cause chain (verified)

PPTX export ran three engines chained, all broken in this repo:

1. **Backend job** (`requestPptxExportJob` → POST `/api/slides`) — that API (`functions/api/slides.js`, Supabase) is not deployed here. Job failure throws before any download.
2. **`@halobiron/dom-to-pptx`** dynamic import — dependency never installed (no package.json), always throws, falls through to:
3. **Hand-rolled OOXML writer** (`pptx-export.ts`) — worked structurally (valid ZIP/XML) but had the killer bug below.

## Bugs found

### Fixed this session (verified live before/after)

| Bug | File | Evidence |
|---|---|---|
| **All exported text 1.2pt.** `sz` clamp applied AFTER ×100 (`Math.min(120, px*100)`), so every run capped at sz=120 = 1.2pt. Also treated CSS px as pt. Fixed: `clamp(px*0.75, 8, 120)*100`. Before: every component sz="120". After: 54px→sz="4050", 24px→sz="1800". | `imported/src/components/slides/pptx-export.ts` (`buildTextParagraphs`) | Live PPTX generated from real code, unzipped, grepped |
| **Gradient angle rotated 90°.** CSS angle (clockwise from north) written directly as PPTX `ang` (clockwise from east). Fixed: `(angle−90) mod 360`. Before: 135deg→ang=8100000. After: ang=2700000 (45°, correct). | same file (`buildGradientFillXml`) | same harness |

### Open — engine bugs (fix during rebuild)

- **P0 — Images never export.** No `<p:pic>` generation, no media parts in the ZIP. `type: 'logo'` components skipped with a warning; `<img>` in any other component stripped by `toPlainText`. Background imagery is silently lost. This is the core gap vs. the target capability (imagery must survive as movable components). Verified live: logo component → warning only, absent from slide XML.
- **P1 — 1:1 canvas distorts to 16:9.** `<p:sldSz>` hardcoded 9144000×5143500 (`type="screen16x9"`); scaleX/scaleY computed independently, so a 1080×1080 slide stretches. Fix: derive `sldSz` from deck aspect.
- **P1 — Text nested in positioned containers doesn't become text boxes.** In absolute-import mode only nodes with position info become components; a positioned card's plain text children stay as HTML blob inside the parent's `content`. Whole card exports as ONE text shape (all runs same size/color). Blocks the "text = individual editable text boxes with own font/size/hex" requirement. Fix: recurse into importable containers and emit child text components.
- **P2 — `styleMap.border` shorthand fed to `normalizeColor` as borderColor** (`html-import.ts` extractStyle) — borderColor can become `"1px solid red"`, which `parseCssColor` then rejects at export → border dropped. Parse color token out of shorthand.
- **P2 — Named CSS colors unsupported.** `parseCssColor` handles hex/rgb() only; `color: white` → fill/text color dropped. Computed styles usually return rgb() so this mostly bites inline-styled/pasted HTML.
- **P2 — `to right`/`to left`/`to top` gradient keywords not parsed** — keyword token fails color parse, silently skipped; gradient direction defaults to 180deg. Add keyword→angle map.
- **P2 — Multi-slide decks truncate to slide 1 on export.** `convertSlideDocumentsToPptx` and `convertSlideDocumentToHtml` both read `deck.slides[0]` only. Reveal export handles all slides; PPTX/HTML don't.
- **P3 — `measureNodeRect` clamps negative offsets to 0** — elements deliberately bleeding off-canvas (common in designed slides) snap to edge on import.
- **P3 — Pseudo-element `content: url(...)` builds `<img src>` without attribute-escaping the URL** (`html-import.ts` `buildPseudoContent`) — malformed/hostile CSS can inject markup into component content. Escape before interpolation.
- **P3 — line-height / letter-spacing captured on import but never written to PPTX** (`<a:spcPct>`/`spc` unimplemented).
- **P3 — `duplicateSlideInDocument` id scheme** — duplicating the same source slide twice yields two slides with identical element ids (`x-copy-1` both). Harmless per-slide today; trap for cross-slide element lookups.

## Remove (validated dead weight for the target scope)

- `imported/functions/api/slides.js` (4,315 lines) — Supabase CRUD, RLS, template governance/approval/SLA/ownership, telemetry. No backend in target design.
- `imported/src/lib/slides.ts` (1,301 lines) — API client + local-store fallback + job orchestration. The only piece worth extracting is nothing — the export path it feeds is being replaced by direct calls to `pptx-export.ts`.
- `imported/src/app/slides/` (1,980-line page orchestrator + 20 hooks + 11 workspace components) — React/Next shell, template library, My Slides, audit/draft-recovery/governance hooks. Replaced by one local HTML file.
- `imported/story-artifacts/` (100+ story files), `imported/src/tech-debt/`, `imported/docs/` — oliver-app process history. Git history is the archive.
- `imported/tests/` — contract tests import from `@/` aliases and test the removed API/governance surface. Note: they never caught the 1.2pt bug. Write fresh harness tests against the real engine (the session harness in scratchpad proves the pattern: strip types, run in node, unzip, assert).
- Three-engine export chain (`use-slides-pptx-export.ts` backend-job + dom-to-pptx + legacy fallback) — keep only the hand-rolled writer.

## Keep (the engine — pure TS, zero framework deps)

- `types.ts` — component/document model
- `document.ts` — deck ops (multi-slide, duplicate, reorder, responsive reflow)
- `html-import.ts` — DOM→components (needs P1/P2 fixes above)
- `html-export.ts` — HTML round-trip (fix slides[0] truncation)
- `pptx-export.ts` — OOXML writer (fixed this session; needs image support)
- `import-validation.ts`, `import-file-bundle.ts` — file intake + companion-CSS inlining, both clean

## Rebuild spec — REBUILD-1 (single story, build next session)

One local HTML file (open in browser, no server, no install):

1. **Intake**: drag-drop / file picker / paste HTML (+ optional companion .css files — reuse `import-file-bundle.ts`).
2. **Size**: canvas presets 16:9 (1920×1080, default) and 1:1 (1080×1080). Import auto-detects source size; presets drive export `sldSz`.
3. **Decompose** via `html-import.ts`: background imagery/gradient layers stay separate movable/resizable components (never flattened into text); text becomes individual text boxes with font family/size/weight/style, line-height, alignment, hex color preserved.
4. **Preview canvas**: minimal — select, drag, resize, edit text inline. No layers panel v1.
5. **Export PPTX** via `pptx-export.ts` directly (single engine). Native editable shapes/text/gradients; images as `<p:pic>` once P0 lands.

Bundling: engine files are TS — strip types (esbuild one-shot or the node sed harness) into a `<script>` block. No runtime deps.

Prerequisites inside REBUILD-1: P0 images, P1 sldSz aspect, P1 nested-text extraction.

## Live session tracker

- 2026-07-16 — full audit: all engine files read, export exercised live, 2 P0-class export bugs fixed+verified (text size, gradient angle), 11 open bugs logged, removal list validated, rebuild spec written. — Claude
