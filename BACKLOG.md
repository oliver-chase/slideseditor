# BACKLOG — Slides Converter

Status date: 2026-07-16. The product is a **local single-file HTML converter**: open `slideeditor.html` in a browser, import an HTML slide (or a PNG), and export a PowerPoint deck where text became real editable text boxes and images/gradients became separate movable/resizable picture and shape layers. Editing happens in PowerPoint — the page is just the converter, with a read-only preview and a converted-layers breakdown. No server, no deploy, no build for the user.

## Scope (owner-confirmed 2026-07-16)

- Input: HTML (primary, enables text/image separation) or PNG/JPG (single picture layer — a raster has no structure to split; text extraction would need OCR, out of scope).
- Output: PPTX (primary) + HTML.
- Canvas presets: 16:9 and 1:1 only. No per-platform size wiring.
- The page is a converter, not an editor. No on-page drag/resize/inline-edit/drag-drop (removed as overengineering).

## Build state

The engine is the salvaged pure-TS core from the old module (`imported/src/components/slides/*.ts`); the standalone app is `src/shell.html` + `scripts/build-bundle.mjs` producing `slideeditor.html`. Build: `node scripts/build-bundle.mjs` (zero dependencies; uses node's `stripTypeScriptTypes`).

### Done + verified this session (each QA-reviewed, exercised live in a real browser via playwright)

- **Zero-dep bundler** (`scripts/build-bundle.mjs`) — strips types, flattens the engine into one IIFE (`window.SlideEngine`), inlines into the HTML, escapes `</script` in engine string literals. Commit 73ef9fe.
- **PPTX text size** — was 1.2pt for everything (clamp applied after the ×100 conversion + px-treated-as-pt). Fixed px→pt. Commit 1f6a1f5-range / earlier.
- **Gradient angle** — was rotated 90° (CSS-from-north vs PPTX-from-east). Fixed. Earlier commit.
- **P0 images** — components with a data-URI image (`<img>` or `url(...)` background) now export as native `<p:pic>` with media parts, per-slide image rels, and content-type Defaults (png/jpeg/gif/webp). svg/unsupported warn+skip. Caption text over an image stays a transparent text shape. Commit 73ef9fe.
- **P1 sldSz aspect** — slide size derived from canvas aspect so 1:1/portrait no longer stretch to 16:9; 16:9 byte-identical. Commit dd60b60.
- **P2 batch** — full CSS named-color table in parseCssColor; gradient side/corner keywords (`to right`, `to top left`); `border` shorthand split into width/style/color (previously the shorthand leaked into the color slot and the border was dropped). Commit bce496c.
- **REBUILD-1 converter shell** (`src/shell.html`, `slideeditor.html`) — import (paste HTML / choose .html+.css or PNG/JPG), read-only preview, converted-layers panel (text-box vs picture/shape counts + per-layer list), 16:9/1:1 presets, export PPTX + HTML. PNG imports as one fit-centered picture layer. Verified live: HTML → 2 text boxes + 1 image classified correctly, exports 0-warning valid PPTX; PNG round-trips to a valid `<p:pic>`; zero console errors. **[committing this session]**

## Still open

- **Nested-text extraction (P1, engine)** — in absolute-import mode only positioned nodes become components; plain text nested inside a positioned container without its own position stays as one HTML blob in the parent, exporting as a single uniform text box. Flat positioned slides (the common designed-slide case) already split correctly — verified live. This bites only container-nested text. Fix: recurse into importable containers and emit child text as its own components. Browser-verify against real nested fixtures.
- **HSL colors** — `parseCssColor` supports hex/rgb/named, not `hsl()`. Computed styles resolve to rgb so this bites only raw pasted hsl. Low priority.
- **Multi-slide decks** — `convertSlideDocumentsToPptx`/`convertSlideDocumentToHtml` read `deck.slides[0]` only. The converter is single-slide-per-import today, so not yet reachable; revisit if multi-slide import is added.
- **line-height / letter-spacing** captured on import but not written to PPTX (`<a:spcPct>`/`spc` unimplemented).
- **Off-canvas negative offsets** clamped to 0 on import (`measureNodeRect`).

## Big cleanup still pending (separate session)

The old deployed-app carcass is still in `imported/` and unused by the converter: `functions/api/slides.js` (4,315 lines, Supabase/governance), `src/lib/slides.ts` (1,301 lines, API client), `src/app/slides/*` (React/Next shell + 20 hooks), 100+ story markdown files, old contract/e2e tests. Only the 7 engine files under `imported/src/components/slides/` are used (the bundler reads them there). Removing the carcass (and moving the engine to a clean `engine/` dir) is a validated-delete cleanup pass — do it once the converter is settled.

## Live session tracker

- 2026-07-16 — full audit + rebuild: fixed 2 export-killer bugs (text size, gradient angle), P0 images, P1 sldSz, P2 color/gradient/border batch; built zero-dep bundler + converter shell; added PNG import. Each item QA-reviewed by a single agent and exercised live in a real browser (import/preview/export/PNG all grounded). Reshaped from editor to converter per owner. — Claude
