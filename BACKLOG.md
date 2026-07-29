# BACKLOG — Slides Converter

Status date: 2026-07-16. The product is a **local single-file HTML converter**: open `slideeditor.html` in a browser, import an HTML slide (or a PNG), and export a PowerPoint deck where text became real editable text boxes and images/gradients became separate movable/resizable picture and shape layers. Editing happens in PowerPoint — the page is just the converter, with a read-only preview and a converted-layers breakdown. No server, no deploy, no build for the user.

## Scope (owner-confirmed 2026-07-16)

- Input: HTML (primary, enables text/image separation) or PNG/JPG (single picture layer — a raster has no structure to split; text extraction would need OCR, out of scope).
- Output: PPTX (primary) + HTML.
- Canvas presets: 16:9 and 1:1 only. No per-platform size wiring. **Superseded:** a
  third preset, Native, was added as the default — it keeps the source's own
  dimensions on import so a design never distorts, and the two fixed sizes stay
  opt-in. This line undercounted the shipped UI; `src/shell.html`'s preset
  buttons are the source of truth.
- The page is a converter, not an editor. No on-page drag/resize/inline-edit/drag-drop (removed as overengineering).

## Build state

The engine is the salvaged pure-TS core (`engine/*.ts`, 8 files); the app is `src/shell.html` + `scripts/build-bundle.mjs` producing `slideeditor.html`. Build: `node scripts/build-bundle.mjs` (zero dependencies; uses node's `stripTypeScriptTypes`).

## Still open

- **Rasterized fonts use fallback type (P1, follow-up)** — the artwork + gradient-text PNGs render with whatever fonts are available at import; a pasted/uploaded `.html` doesn't bring its `@font-face` files (e.g. Aptos), so the rasterized layers fall back to Arial. Exact brand type needs font embedding: accept font uploads alongside the HTML, or inline `@font-face` as base64 `data:` URIs into the sandbox before rasterizing. Warned about on every rich import.
- **External `<img>` in a rich graphic is flattened blank (P2)** — the art layer renders via SVG `foreignObject`+`Image()`, which cannot load network subresources, so an `<img src="https://…">` inside a rasterized slide renders blank. Data-URI images are fine. (Image-only slides are unaffected — they stay on the native path and import as a real picture layer.) Fix: pre-inline external images as data URIs before rasterizing.

- **SVG input (P1, deferred)** — SVG neither embeds in PPTX nor decomposes today. Plan (built once, reverted to land HTML first): rasterize whole-SVG layers to PNG in-browser (canvas, force explicit width/height on viewBox-only roots or they clip), and — mirroring HTML — decompose SVGs that contain `<text>` into a graphics PNG layer plus one text-box layer per `<text>` (positions/fonts from a live render to handle viewBox scaling + group transforms). Reverted code is in git history (this session's WIP) if resurrecting.
- **Inline `<svg>` content is silently dropped, not just whole-SVG-file import (P1, found 2026-07-17)** — the deferred item above was scoped to importing a standalone `.svg` file; this is worse and more common: an `<svg>` embedded inline inside an otherwise normal HTML page also loses its vector content. Repro: a whole-slide HTML (1920×1080, dark body background, native header text, a body `<svg>` diagram with `<line>`/`<circle>` elements and `<text>` labels) imports every `<text>` node correctly as an editable text box, but every `<line>`/`<circle>`/`<path>` in the SVG vanishes with **zero warning and no rasterized fallback** — `shouldImportNode`'s candidate walk (`html-import.ts`) never treats raw SVG shape children as import-worthy content, unlike the existing rasterization path that DOES flatten bordered/gradient HTML divs into an artwork PNG. Consequence observed beyond "diagram missing": when the SVG shapes were the *only* backgrounded/bordered content on the slide, there was nothing left to trigger the rasterization path at all, so the slide's own dark page background (`body{background:...}`) never got captured as a `<p:bg>` fill either — the exported PPTX slide is plain white with white-on-white text, unreadable. Fix direction: extend the existing rasterization trigger (`RASTER-1`) to also fire when a positioned node contains an `<svg>` with shape children (not just `<text>`), flattening the SVG's visual content into the same whole-slide artwork PNG layer already used for gradient/card graphics — same mechanism, just widen the detection. Real-world source: `Diagrams-Graphics.md`'s entire geometric-pattern library (deck diagrams) is built as inline SVG, so none of it converts through this tool today without this fix.
- **Mixed-content container not split (P2, engine)** — a positioned container with BOTH its own stray text AND structured children collapses to one uniform text blob (the ancestor walk skips all leaves once `hasOwnTextNode(container)` is true). Graceful degradation, no dup/loss, but the split silently won't apply. E.g. `<section pos:abs> Intro <h1>Title</h1><p>Body</p></section>`. Realistic in hand-authored hero sections. Fix: extract only the container's own text into its own box, then split the structured children.
- **HSL colors** — `parseCssColor` supports hex/rgb/named, not `hsl()`. Computed styles resolve to rgb so this bites only raw pasted hsl. Low priority.
- **Multi-slide decks** — `convertSlideDocumentsToPptx`/`convertSlideDocumentToHtml` read `deck.slides[0]` only. The converter is single-slide-per-import today, so not yet reachable; revisit if multi-slide import is added.
- **line-height / letter-spacing** captured on import but not written to PPTX (`<a:spcPct>`/`spc` unimplemented).
- **Off-canvas negative offsets** clamped to 0 on import (`measureNodeRect`).
- **LICENSE undecided** — the repo is public with none declared yet; needs a license and copyright holder, owner's call.
