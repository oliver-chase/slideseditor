# Architecture of the slides converter

Status: Stable
Last updated: 2026-11-17
Owner: Engineering

## Overview

The Slides Converter is a **local, zero-dependency, single-file browser tool**. It converts an HTML slide (or a PNG) into an editable PowerPoint deck: text becomes real editable text boxes, and images and gradients become separate movable picture and shape layers. There is no server, no deploy, no runtime, and no build step for the user — they open one HTML file.

## Structure

```
slideseditor/
├── slideeditor.html         Built deliverable (engine inlined into the shell)
├── src/
│   └── shell.html           Converter UI: preview, layer panel, presets, import/export
├── engine/                  Pure-TypeScript conversion engine, every file under 400 lines
│   ├── types.ts             Shared component, canvas and document types
│   ├── document.ts          createSlideDocument and the canvas-resize helper
│   ├── import-validation.ts Input guards, file-size limit, error classification
│   ├── html-import-*.ts     HTML -> positioned components, one file per boundary:
│   │                        shared constants and types, CSS resolution, render snapshot,
│   │                        value parsing, position and canvas math, markup and node
│   │                        selection, pseudo-elements, rasterization, node building
│   ├── html-import.ts       The import entry point, convertHtmlToSlideComponents
│   ├── html-export.ts       Components -> standalone HTML
│   ├── pptx-*.ts            Components -> OOXML/PPTX: shared units, ZIP writer, CSS paint,
│   │                        shapes and text, package parts, and the entry point (pptx-export.ts)
│   └── import-file-bundle.ts File/stylesheet selection and inlining
├── scripts/
│   ├── build-bundle.mjs     Zero-dep bundler (strip types, flatten, inline)
│   ├── validate.sh          The repo's validation: the commit gates, the structure check and every test
│   ├── check-structure-contract.mjs  The structure check that validate.sh runs
│   ├── duplication_check.py Duplicate-text gate used by the pre-commit hook
│   └── size.sh              Line counts for the size gate
├── tests/                   Node tests that bundle the engine from source
│   ├── load-engine.mjs      Shared loader
│   ├── pptx-export.test.mjs PPTX parts, spacing, borders, captions, neutral names
│   ├── html-export.test.mjs HTML export
│   └── bundle-fresh.test.mjs slideeditor.html matches the source
├── README.md
└── ARCHITECTURE.md
```

## Build pipeline

`scripts/build-bundle.mjs`:

1. Reads the `engine/*.ts` files named in `ENGINE_FILES` in dependency order.
2. Strips TypeScript types with node's built-in `stripTypeScriptTypes` (node >= 22.13) drops every ES `import` line and strips the `export` keyword — all cross-module dependencies resolve in one flat scope.
3. Concatenates them into a single IIFE that exposes the public API on `window.SlideEngine`.
4. Injects that bundle into `src/shell.html` at the `/* __SLIDE_ENGINE_BUNDLE__ */` marker (escaping any literal `</script>` in engine strings) and writes `slideeditor.html`.

No npm install, no bundler dependency, no deploy.

## Conversion flow

1. **Import** (`html-import.ts`) — parse the HTML, render it in a hidden sandboxed iframe, and read `getComputedStyle` / `getBoundingClientRect` to place each positioned element as its own component. Text nested inside a positioned container (without its own position) is split into separate editable text boxes; inline emphasis (`<span>`/`<strong>`/`<em>`) stays atomic. For visually-rich designed graphics (gradient fills, gradient-clipped text, stacked cards/bars), use a rasterization path: flatten all non-text visuals into one artwork PNG, rasterize each gradient-text run to its own PNG, and keep plain text as editable boxes. Simple text-on-solid slides stay on the native text/shape path. A PNG, JPG, GIF, WebP or SVG imports as one fit-centered picture layer; an SVG is drawn to a PNG first.
2. **Preview** (`shell.html`) — read-only render at the chosen preset (**Native** to preserve source dimensions, or **16:9**/**1:1** to reshape) plus a converted-layers panel classifying each layer as text, picture, or shape.
3. **Export** (`pptx-export.ts` / `html-export.ts`) — emit a native PPTX (text runs as `<a:t>`, images as `<p:pic>` with media parts and rels, gradients/borders as shape fills; slide sized at true 96dpi so font and geometry scale agree) or a standalone HTML file.

## Scope

- **Input:** HTML (primary — enables text/image separation) or a PNG, JPG, GIF, WebP or SVG image (single picture layer)
- **Output:** PPTX (primary) or HTML
- **Canvas presets:** Native (preserve source dimensions), 16:9, and 1:1 (reshape options)
- Converter, not editor: no on-page drag/resize/inline-edit. Import via file picker or drag-and-drop

## Key constraints

- Zero runtime dependencies; the output must stay a single self-contained HTML file
- Rebuild `slideeditor.html` after any change to `engine/*.ts` or `src/shell.html`
- Engine PPTX/HTML paths are node-headless testable (strip types, run, unzip, assert). The `html-import-*.ts` files and the shell need a real browser (DOMParser, iframe, getComputedStyle). Verify them in a browser against `file://slideeditor.html` through the `window.__slidesTest` hook, which exposes `importFromHtml`, `importImageFile`, `getState` and `applyPreset`
