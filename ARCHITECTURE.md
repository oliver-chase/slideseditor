# Architecture — Slides Converter

Status: Stable
Last updated: 2026-07-16 (REPAIR-1, SCALE-1, RASTER-1, drag-and-drop, Native preset)
Owner: Engineering

## Overview

The Slides Converter is a **local, zero-dependency, single-file browser tool**. It converts an HTML slide (or a PNG) into an editable PowerPoint deck: text becomes real editable text boxes, and images and gradients become separate movable picture and shape layers. There is no server, no deploy, no runtime, and no build step for the user — they open one HTML file.

## Structure

```
slideseditor/
├── slideeditor.html         Built deliverable (engine inlined into the shell)
├── src/
│   └── shell.html           Converter UI: preview, layer panel, presets, import/export
├── engine/                  Pure-TypeScript conversion engine
│   ├── types.ts             Shared component/canvas/document types
│   ├── persistence-types.ts Slide record shapes
│   ├── document.ts          createSlideDocument + document helpers
│   ├── import-validation.ts Input guards, file-size limits, error classification
│   ├── html-import.ts       HTML -> positioned components (measure + decompose)
│   ├── html-export.ts       Components -> standalone HTML
│   ├── pptx-export.ts       Components -> OOXML/PPTX (hand-rolled ZIP + XML)
│   └── import-file-bundle.ts File/stylesheet selection and inlining
├── scripts/
│   └── build-bundle.mjs      Zero-dep bundler (strip types, flatten, inline)
├── BACKLOG.md                Open work and deferred features
├── README.md
└── ARCHITECTURE.md
```

## Build pipeline

`scripts/build-bundle.mjs`:

1. Reads the eight `engine/*.ts` files in dependency order.
2. Strips TypeScript types with node's built-in `stripTypeScriptTypes` (node >= 22.13) and drops every ES `import`/`export` line — all cross-module dependencies resolve in one flat scope.
3. Concatenates them into a single IIFE that exposes the public API on `window.SlideEngine`.
4. Injects that bundle into `src/shell.html` at the `/* __SLIDE_ENGINE_BUNDLE__ */` marker (escaping any literal `</script>` in engine strings) and writes `slideeditor.html`.

No npm install, no bundler dependency, no deploy.

## Conversion flow

1. **Import** (`html-import.ts`) — parse the HTML, render it in a hidden sandboxed iframe, and read `getComputedStyle` / `getBoundingClientRect` to place each positioned element as its own component. Text nested inside a positioned container (without its own position) is split into separate editable text boxes; inline emphasis (`<span>`/`<strong>`/`<em>`) stays atomic. For visually-rich designed graphics (gradient fills, gradient-clipped text, stacked cards/bars), use a rasterization path: flatten all non-text visuals into one artwork PNG, rasterize each gradient-text run to its own PNG, and keep plain text as editable boxes. Simple text-on-solid slides stay on the native text/shape path. PNG/JPG imports as one fit-centered picture layer.
2. **Preview** (`shell.html`) — read-only render at the chosen preset (**Native** to preserve source dimensions, or **16:9**/**1:1** to reshape) plus a converted-layers panel classifying each layer as text, picture, or shape.
3. **Export** (`pptx-export.ts` / `html-export.ts`) — emit a native PPTX (text runs as `<a:t>`, images as `<p:pic>` with media parts and rels, gradients/borders as shape fills; slide sized at true 96dpi so font and geometry scale agree) or a standalone HTML file.

## Scope

- **Input:** HTML (primary — enables text/image separation) or PNG/JPG (single picture layer).
- **Output:** PPTX (primary) or HTML.
- **Canvas presets:** Native (preserve source dimensions), 16:9, and 1:1 (reshape options).
- Converter, not editor: no on-page drag/resize/inline-edit. Import via file picker or drag-and-drop.

## Key constraints

- Zero runtime dependencies; the output must stay a single self-contained HTML file.
- Rebuild `slideeditor.html` after any change to `engine/*.ts` or `src/shell.html`.
- Engine PPTX/HTML paths are node-headless testable (strip types, run, unzip, assert). `html-import.ts` and the shell need a real browser (DOMParser/iframe/getComputedStyle) — verify with Playwright against `file://slideeditor.html` via the `window.__slidesTest` hook.
