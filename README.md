# Slides Converter

A local, single-file tool that converts HTML slides into editable PowerPoint decks.

HTML is often the fastest way to build a precise slide design, but moving that design into PowerPoint usually means exporting it as a flat image and losing the ability to edit anything inside it. Slides Converter preserves the structure instead: text becomes real, editable PowerPoint text boxes, and images, gradients, and other visual elements become their own movable, resizable layers.

The browser is only the conversion step. The editing happens where it belongs, in PowerPoint — the page itself is a read-only preview and a breakdown of the converted layers.

It is for anyone who designs a slide in HTML and wants it as a native, editable PowerPoint deck instead of a flat screenshot.

## Convert a slide

Open `slideeditor.html` in any modern browser. It runs entirely locally: no install, no server, no build step, no network connection.

Import a slide by pasting HTML directly, choosing an `.html` file and its `.css`, or dragging a file onto the page. Pick a canvas: **Native** (the default, keeps the source's own dimensions so nothing distorts) or a fixed **16:9** / **1:1**. Export as **PPTX** (the primary output) or **HTML**.

HTML input is what makes the conversion possible: a positioned element becomes its own layer, and text inside one is split into its own editable text box. A PNG or JPG has no such structure to read, so it imports as a single picture layer rather than attempting unreliable text extraction — that would need OCR, which is out of scope.

## How it's built

The deliverable is one HTML file that runs entirely offline. The source is split in two and bundled together at build time: `src/shell.html` is the converter UI, and `engine/` is the pure-TypeScript conversion logic — HTML/PNG import, PPTX/HTML export, eight files. `scripts/build-bundle.mjs` strips the TypeScript types, flattens the engine into one `window.SlideEngine` IIFE, and inlines it into the shell to produce `slideeditor.html`. Zero dependencies; no npm install.

```
node scripts/build-bundle.mjs      # rebuild slideeditor.html after any engine or shell change
```

## What it supports

- HTML input, converted into editable PowerPoint text boxes, images, and shapes.
- PNG/JPG input, imported as a single image layer.
- PPTX export as the primary output, plus HTML export for sharing or inspection.
- Native, 16:9, and 1:1 canvas presets.

It is a converter, not an editor. There is no on-page drag, resize, or inline editing by design — layout and presentation work happen in PowerPoint, not here.

Open work and deferred features (SVG input, HSL colors, multi-slide, line-height/letter-spacing in PPTX) are tracked in `BACKLOG.md`.

## Repo layout

The repository is intentionally small.

```
slideeditor.html          The deliverable — open this in a browser
src/shell.html            Converter UI (source)
engine/                   Pure-TS conversion engine
scripts/build-bundle.mjs  Zero-dep bundler
BACKLOG.md                Open work and deferred features
ARCHITECTURE.md           How the pieces fit
```
