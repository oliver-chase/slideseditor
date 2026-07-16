# BACKLOG — Slides Converter

Status date: 2026-07-16. The product is a **local single-file HTML converter**: open `slideeditor.html` in a browser, import an HTML slide (or a PNG), and export a PowerPoint deck where text became real editable text boxes and images/gradients became separate movable/resizable picture and shape layers. Editing happens in PowerPoint — the page is just the converter, with a read-only preview and a converted-layers breakdown. No server, no deploy, no build for the user.

## Scope (owner-confirmed 2026-07-16)

- Input: HTML (primary, enables text/image separation) or PNG/JPG (single picture layer — a raster has no structure to split; text extraction would need OCR, out of scope).
- Output: PPTX (primary) + HTML.
- Canvas presets: 16:9 and 1:1 only. No per-platform size wiring.
- The page is a converter, not an editor. No on-page drag/resize/inline-edit/drag-drop (removed as overengineering).

## Build state

The engine is the salvaged pure-TS core (`engine/*.ts`, 8 files); the app is `src/shell.html` + `scripts/build-bundle.mjs` producing `slideeditor.html`. Build: `node scripts/build-bundle.mjs` (zero dependencies; uses node's `stripTypeScriptTypes`).

### Done + verified this session (each QA-reviewed, exercised live in a real browser via playwright)

- **Zero-dep bundler** (`scripts/build-bundle.mjs`) — strips types, flattens the engine into one IIFE (`window.SlideEngine`), inlines into the HTML, escapes `</script` in engine string literals. Commit 73ef9fe.
- **PPTX text size** — was 1.2pt for everything (clamp applied after the ×100 conversion + px-treated-as-pt). Fixed px→pt. Commit 1f6a1f5-range / earlier.
- **Gradient angle** — was rotated 90° (CSS-from-north vs PPTX-from-east). Fixed. Earlier commit.
- **P0 images** — components with a data-URI image (`<img>` or `url(...)` background) now export as native `<p:pic>` with media parts, per-slide image rels, and content-type Defaults (png/jpeg/gif/webp). svg/unsupported warn+skip. Caption text over an image stays a transparent text shape. Commit 73ef9fe.
- **P1 sldSz aspect** — slide size derived from canvas aspect so 1:1/portrait no longer stretch to 16:9; 16:9 byte-identical. Commit dd60b60.
- **P2 batch** — full CSS named-color table in parseCssColor; gradient side/corner keywords (`to right`, `to top left`); `border` shorthand split into width/style/color (previously the shorthand leaked into the color slot and the border was dropped). Commit bce496c.
- **REBUILD-1 converter shell** (`src/shell.html`, `slideeditor.html`) — import (paste HTML / choose .html+.css or PNG/JPG), read-only preview, converted-layers panel (text-box vs picture/shape counts + per-layer list), 16:9/1:1 presets, export PPTX + HTML. PNG imports as one fit-centered picture layer. Verified live: HTML → 2 text boxes + 1 image classified correctly, exports 0-warning valid PPTX; PNG round-trips to a valid `<p:pic>`; zero console errors. **[committing this session]**

## Still open

- **SVG input (P1, deferred)** — SVG neither embeds in PPTX nor decomposes today. Plan (built once, reverted to land HTML first): rasterize whole-SVG layers to PNG in-browser (canvas, force explicit width/height on viewBox-only roots or they clip), and — mirroring HTML — decompose SVGs that contain `<text>` into a graphics PNG layer plus one text-box layer per `<text>` (positions/fonts from a live render to handle viewBox scaling + group transforms). Reverted code is in git history (this session's WIP) if resurrecting.
- **Mixed-content container not split (P2, engine)** — a positioned container with BOTH its own stray text AND structured children collapses to one uniform text blob (the ancestor walk skips all leaves once `hasOwnTextNode(container)` is true). Graceful degradation, no dup/loss, but the split silently won't apply. E.g. `<section pos:abs> Intro <h1>Title</h1><p>Body</p></section>`. Realistic in hand-authored hero sections. Fix: extract only the container's own text into its own box, then split the structured children.
- **HSL colors** — `parseCssColor` supports hex/rgb/named, not `hsl()`. Computed styles resolve to rgb so this bites only raw pasted hsl. Low priority.
- **Multi-slide decks** — `convertSlideDocumentsToPptx`/`convertSlideDocumentToHtml` read `deck.slides[0]` only. The converter is single-slide-per-import today, so not yet reachable; revisit if multi-slide import is added.
- **line-height / letter-spacing** captured on import but not written to PPTX (`<a:spcPct>`/`spc` unimplemented).
- **Off-canvas negative offsets** clamped to 0 on import (`measureNodeRect`).

## Live session tracker

- 2026-07-16 — CLEANUP-1 + DECOUPLE-1 DONE: (1) deleted the old deployed-app carcass (`imported/`, 226 files / ~33k lines — Supabase job API, Next/React shell, story markdown, contract/e2e tests, tech-debt); moved the 8 used engine files to a clean top-level `engine/`, rewrote their `@/components/slides/*` alias imports to relative, repointed the bundler. (2) Stripped ALL OliverCode coupling for a reusable public repo: deleted `CLAUDE.md`, `QUALITY_BASELINE.md`, `docs/` (setup-mode/runtime), `.secrets/`, `.env.example`, the profile scripts (`validate.sh`/`bootstrap-profile.sh`/`run-profile-checks.sh`), and `.githooks/` (OliverCode universal hook). Genericized the baked-in `oliver-app` metadata default to `slides-converter` and minimized `.gitignore`. Rewrote README + ARCHITECTURE from the stale "editor / Next.js / Supabase extraction" framing to the converter reality. Final tree = engine/ + src/shell.html + scripts/build-bundle.mjs + slideeditor.html + 3 docs + .gitignore. Rebuilt byte-identical; all nested + standard-export browser tests pass; zero legacy/OliverCode refs in tracked files. Open decision: LICENSE (repo will be public — needs a license + copyright holder, owner's call). — Claude
- 2026-07-16 — nested-text decomposition (NESTED-1) DONE: text nested inside a positioned container (no own position) now splits into its own editable text boxes; inline `<span>`/`<strong>`/`<em>` inside a positioned heading stays one box (no fragmentation); double-nested positioned containers no longer duplicate text (parent strips nested positioned descendants from its content). Exporter no longer prints a background shape's type name ("card"/"stat") as literal text. Shell panel is now 3-way (text / picture / shape). QA GO (P2-only: mixed own-text+children container → backlogged). Verified live in chromium: inline-emphasis / container-split / double-nested / flat-regression / standard-export all pass, 0 warnings, 0 console errors. SVG deferred to backlog per owner ("html first"). — Claude
- 2026-07-16 — full audit + rebuild: fixed 2 export-killer bugs (text size, gradient angle), P0 images, P1 sldSz, P2 color/gradient/border batch; built zero-dep bundler + converter shell; added PNG import. Each item QA-reviewed by a single agent and exercised live in a real browser (import/preview/export/PNG all grounded). Reshaped from editor to converter per owner. — Claude
