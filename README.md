# Slides Converter

**A local, single-file tool that converts an HTML slide (or a PNG) into an editable PowerPoint deck.** Open `slideeditor.html` in a browser, import your slide, and export a `.pptx` where **text became real editable text boxes** (font, weight, size, spacing, and color preserved) and **images and gradients became separate movable, resizable picture and shape layers**.

The point is the conversion. You do the moving, resizing, and editing **in PowerPoint** — the page itself is just the converter: a read-only preview plus a breakdown of the converted layers.

**Who this is for:** anyone who designs a slide in HTML (or exports one as a PNG) and wants it as a native, editable PowerPoint deck instead of a flat screenshot.

## Use it

1. Open `slideeditor.html` in any modern browser. No install, no server, no build, no network.
2. Import: paste HTML, choose an `.html` file (plus its `.css`), or choose a PNG/JPG.
3. Pick a canvas preset — **16:9** or **1:1**.
4. Export **PPTX** (primary) or **HTML**.

- **HTML input** is the path that separates text from images: each positioned element becomes its own layer, and text nested inside a positioned container is split into its own editable text boxes.
- **PNG/JPG input** becomes a single fit-centered picture layer. A raster has no structure to split into text (that would need OCR — out of scope).

## How it's built

The tool is one HTML file with the conversion engine inlined. There are two sources:

- `src/shell.html` — the converter UI (preview, layer panel, presets, import/export).
- `engine/*.ts` — the pure-TypeScript conversion engine (HTML/PNG import, PPTX/HTML export).

`scripts/build-bundle.mjs` strips the TypeScript types with node's built-in `stripTypeScriptTypes`, flattens the engine into one IIFE (`window.SlideEngine`), and inlines it into `src/shell.html` to produce `slideeditor.html`. **Zero dependencies** — no npm install.

```
node scripts/build-bundle.mjs      # rebuild slideeditor.html after any engine or shell change
```

## Scope

- **Input:** HTML (primary) or PNG/JPG (single picture layer).
- **Output:** PPTX (primary) or HTML.
- **Canvas presets:** 16:9 and 1:1 only.
- It is a **converter, not an editor** — no on-page drag, resize, or inline editing.

Open work and deferred features (SVG input, HSL colors, multi-slide, line-height/letter-spacing in PPTX) are tracked in `BACKLOG.md`.

## Repo layout

```
slideeditor.html          The deliverable — open this in a browser
src/shell.html            Converter UI (source)
engine/                   Pure-TS conversion engine (8 files)
scripts/build-bundle.mjs  Zero-dep bundler
BACKLOG.md                Open work and deferred features
ARCHITECTURE.md           How the pieces fit
```
