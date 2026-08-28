# Slides Converter

A local, single-file tool that converts HTML slides into editable PowerPoint decks.

HTML is often the fastest way to build a precise slide design. The problem comes when that design needs to become a PowerPoint deck: exporting the slide as an image preserves the look but loses the structure. Text can no longer be edited, and individual visual elements can no longer be moved or resized.

Slides Converter preserves that structure. Text becomes real, editable PowerPoint text boxes. Images, gradients, and other visual elements become their own movable, resizable layers.

The browser is only the conversion step. The actual editing happens in PowerPoint, where the converted deck can be changed like any other native presentation.

It is built for anyone who designs slides in HTML and needs the result as a native, editable PowerPoint deck instead of a flat screenshot.

## Convert a slide

Open `slideeditor.html` in any modern browser.

It runs entirely locally:

* No installation
* No server
* No build step
* No network connection

Import a slide in any of three ways:

* Paste the HTML directly into the tool.
* Choose an `.html` file and its `.css`.
* Drag a file onto the page.

Then choose the canvas:

* Native — the default; keeps the source's original dimensions so the slide does not distort.
* 16:9 — standard widescreen presentation.
* 1:1 — square canvas.

Export the result as:

* PPTX — the primary output, with editable PowerPoint layers.
* HTML — useful for sharing or inspecting the converted result.

## Why HTML works

The converter can preserve editability because HTML already describes a slide as separate elements.

A positioned HTML element becomes its own PowerPoint layer. Text inside that element becomes its own editable text box. Images, gradients, and shapes are converted into their corresponding PowerPoint layers.

A PNG or JPG has no underlying structure to preserve. It therefore imports as one picture layer.

The converter does not attempt to extract text from images with OCR. Reliable OCR would be a separate problem and is outside the scope of this tool.

## How it is built

The deliverable is one HTML file that runs entirely offline.

The source is kept separate for development:

```text
src/shell.html
```

contains the converter interface, while:

```text
engine/
```

contains the pure-TypeScript conversion engine for HTML/PNG import and PPTX/HTML export.

The engine is eight files. At build time, `scripts/build-bundle.mjs` strips the TypeScript types, combines the engine into one `window.SlideEngine` IIFE, and inlines it into the shell.

The result is:

```text
slideeditor.html
```

There are zero runtime dependencies and no `npm install` required to use the deliverable.

After changing the engine or shell, rebuild it with:

```bash
node scripts/build-bundle.mjs
```

## What it supports

* HTML input — converted into editable PowerPoint text boxes, images, and shapes.
* PNG/JPG input — imported as a single image layer.
* PPTX export — the primary output.
* HTML export — for sharing or inspection.
* Native canvas — preserves the source dimensions.
* 16:9 canvas — standard widescreen format.
* 1:1 canvas — square format.

## What it does not do

Slides Converter is a converter, not an editor.

There is deliberately no on-page drag, resize, or inline editing. The browser converts the source; PowerPoint is where the resulting slide is edited and presented.

Open work and deferred features are tracked in [`BACKLOG.md`](BACKLOG.md), including:

* SVG input
* HSL colors
* Multi-slide conversion
* Line-height in PPTX
* Letter-spacing in PPTX

## Repo layout

The repository is intentionally small:

```text
slideeditor.html          The deliverable — open this in a browser
src/shell.html            Converter UI source
engine/                   Pure-TypeScript conversion engine
scripts/build-bundle.mjs  Zero-dependency bundler
BACKLOG.md                Open work and deferred features
ARCHITECTURE.md           How the pieces fit
```

## About

A local, single-file tool that converts HTML slides into editable PowerPoint decks.

Open `slideeditor.html`, import your slide, and export a `.pptx`. Text becomes real editable text boxes, while images, gradients, and other visual elements become separate movable and resizable PowerPoint layers.
