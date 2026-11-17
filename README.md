# Slides Converter

A local, single-file tool that converts HTML slides into editable PowerPoint decks.

HTML is often the fastest way to build a precise slide design. The problem comes when that design needs to become a PowerPoint deck: exporting the slide as an image preserves the look but loses the structure. Text can no longer be edited, and individual visual elements can no longer be moved or resized.

Slides Converter preserves that structure where it can. Text becomes real, editable PowerPoint text boxes. On a simple slide, solid-color boxes and images become their own movable, resizable layers. A rich slide with gradients or stacked styled boxes becomes one locked picture of the artwork with the text boxes on top, so the text stays editable and the artwork moves as one piece.

The browser is only the conversion step. The actual editing happens in PowerPoint, where the converted deck can be changed like any other native presentation.

It is built for anyone who designs slides in HTML and needs the result as a native, editable PowerPoint deck.

## Convert a slide

Open `slideeditor.html` in any modern browser.

Opening the file needs no installation, no server and no build step. Conversion runs in the browser on your computer, and nothing is uploaded. The one network request is a fetch of a remote stylesheet when the imported HTML links to one that is not supplied as a file. Pasting self-contained HTML or choosing the `.css` file keeps the conversion fully offline.

Import a slide in any of three ways:

* Paste the HTML directly into the tool
* Choose an `.html` file and its `.css`
* Drag a file onto the page

Then choose the canvas:

* Native — the default; keeps the source's original dimensions so the slide does not distort
* 16:9 — standard widescreen presentation
* 1:1 — square canvas

Export the result as:

* PPTX — the primary output, with editable PowerPoint layers
* HTML — useful for sharing or inspecting the converted result

## Why HTML works

The converter can preserve editability because HTML already describes a slide as separate elements.

A positioned HTML element becomes its own PowerPoint layer. Text inside that element becomes its own editable text box. Images and solid shapes convert to their own layers. Gradients and stacked styled boxes are flattened into one locked artwork picture behind the text.

A PNG or JPG has no underlying structure to preserve. It therefore imports as one picture layer.

The converter does not attempt to extract text from images with OCR. Reliable OCR would be a separate problem and is outside the scope of this tool.

## How it is built

The deliverable is one HTML file that runs on your computer with no server.

The source is kept separate for development:

```text
src/shell.html
```

contains the converter interface, while:

```text
engine/
```

contains the pure-TypeScript conversion engine for HTML/PNG import and PPTX/HTML export.

The engine is seven files. At build time, `scripts/build-bundle.mjs` strips the TypeScript types, combines the engine into one `window.SlideEngine` IIFE, and inlines it into the shell.

The result is:

```text
slideeditor.html
```

There are zero runtime dependencies and no `npm install` required to use the deliverable.

Rebuilding needs Node 22.13 or later, because the bundler uses Node's built-in type stripping. After changing the engine or shell, rebuild it with:

```bash
node scripts/build-bundle.mjs
```

Then run the tests, which need only Node and bundle the engine from source:

```bash
for t in tests/*.test.mjs; do node "$t"; done
```

## What it supports

* HTML input — converted into editable PowerPoint text boxes, images, and shapes
* PNG/JPG input — imported as a single image layer
* PPTX export — the primary output
* HTML export — for sharing or inspection
* Native canvas — preserves the source dimensions
* 16:9 canvas — standard widescreen format
* 1:1 canvas — square format

## What it does not do

Slides Converter converts slides and leaves editing to PowerPoint.

There is deliberately no on-page drag, resize, or inline editing. The browser converts the source; PowerPoint is where the resulting slide is edited and presented.

Open work and deferred features are tracked in the `slideseditor` GitHub Project (see `CLAUDE.md`), including:

* SVG input
* HSL colors
* Multi-slide conversion

## Repo layout

The repository is intentionally small:

```text
slideeditor.html          The deliverable — open this in a browser
src/shell.html            Converter UI source
engine/                   Pure-TypeScript conversion engine
scripts/build-bundle.mjs  Zero-dependency bundler
ARCHITECTURE.md           How the pieces fit
```

## About

A local, single-file tool that converts HTML slides into editable PowerPoint decks.

Open `slideeditor.html`, import your slide, and export a `.pptx`. Text becomes real editable text boxes, while images, gradients, and other visual elements become separate movable and resizable PowerPoint layers.
