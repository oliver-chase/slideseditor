import test from 'node:test'
import assert from 'node:assert/strict'

import {
  adaptComponentsToResponsiveCanvas,
  adaptComponentsToResponsiveCanvasWithWarnings,
  applyLayoutConstraintToComponents,
  appendSlideToDocument,
  createSlideDocument,
  deleteSlideFromDocument,
  duplicateSlideInDocument,
  ensureSlideDocument,
  reorderSlideInDocument,
  slideDocumentToImportResult,
  slideRecordToImportResult,
  syncSlideDocument,
} from '../../src/components/slides/document.ts'
import { convertSlideDocumentToHtml, convertSlideDocumentToRevealHtml } from '../../src/components/slides/html-export.ts'
import { convertSlideDocumentsToPptx } from '../../src/components/slides/pptx-export.ts'

test('slides document contract: createSlideDocument builds canonical deck and warnings', () => {
  const document = createSlideDocument({
    id: 'slide-1',
    canvas: { width: 1280, height: 720, background: '#ffffff' },
    components: [{
      id: 'cmp-1',
      type: 'heading',
      sourceLabel: '.heading',
      x: 100,
      y: 80,
      width: 640,
      height: 72,
      content: 'Hello',
      style: { fontSize: 56 },
      locked: false,
      visible: true,
    }],
    warnings: ['normalized'],
  })

  assert.equal(document.version, 1)
  assert.equal(document.deck.width, 1280)
  assert.equal(document.deck.height, 720)
  assert.equal(document.deck.slides.length, 1)
  assert.equal(document.deck.slides[0].background?.fill, '#ffffff')
  assert.equal(document.deck.slides[0].elements[0].content, 'Hello')
  assert.deepEqual(document.warnings, ['normalized'])
})

test('slides document contract: create and sync preserve theme metadata across deck updates', () => {
  const document = createSlideDocument({
    id: 'slide-theme-1',
    canvas: { width: 1280, height: 720, background: '#ffffff' },
    components: [{
      id: 'cmp-theme-1',
      type: 'heading',
      sourceLabel: '.heading',
      x: 100,
      y: 80,
      width: 640,
      height: 72,
      content: 'Hello Theme',
      style: { fontSize: 56 },
      themeRole: 'heading',
      themeLinked: true,
      locked: false,
      visible: true,
    }],
    theme: {
      fonts: { heading: 'Brand Display', body: 'Brand Sans' },
      colors: {
        primary: '#123456',
        secondary: '#234567',
        background: '#f8fafc',
        accent: '#345678',
      },
      spacingScale: { xs: 8, sm: 16, md: 24, lg: 32 },
    },
    warnings: ['normalized'],
  })

  assert.equal(document.theme?.fonts.heading, 'Brand Display')
  assert.equal(document.deck.slides[0].elements[0].themeLinked, true)

  const next = syncSlideDocument({
    document,
    canvas: { width: 1280, height: 720, background: '#f8fafc' },
    components: [{
      id: 'cmp-theme-1',
      type: 'heading',
      sourceLabel: '.heading',
      x: 120,
      y: 96,
      width: 640,
      height: 72,
      content: 'Hello Theme Updated',
      style: { fontSize: 56, color: '#123456', fontFamily: 'Brand Display' },
      themeRole: 'heading',
      themeLinked: true,
      locked: false,
      visible: true,
    }],
    warnings: ['theme-updated'],
    theme: {
      fonts: { heading: 'Brand Display', body: 'Brand Sans' },
      colors: {
        primary: '#123456',
        secondary: '#234567',
        background: '#f8fafc',
        accent: '#345678',
      },
      spacingScale: { xs: 8, sm: 16, md: 24, lg: 32 },
    },
  })

  assert.equal(next.theme?.colors.primary, '#123456')
  assert.equal(next.deck.slides[0].elements[0].themeRole, 'heading')
  assert.equal(next.deck.slides[0].elements[0].themeLinked, true)
  assert.deepEqual(next.warnings, ['theme-updated'])
})

test('slides document contract: layout constraints reflow selected layers and preserve metadata', () => {
  const components = [
    {
      id: 'cmp-layout-1',
      type: 'heading',
      x: 120,
      y: 120,
      width: 300,
      height: 60,
      content: 'One',
      style: { fontSize: 42 },
      locked: false,
      visible: true,
    },
    {
      id: 'cmp-layout-2',
      type: 'text',
      x: 520,
      y: 240,
      width: 240,
      height: 50,
      content: 'Two',
      style: { fontSize: 24 },
      locked: false,
      visible: true,
    },
    {
      id: 'cmp-layout-3',
      type: 'card',
      x: 860,
      y: 310,
      width: 280,
      height: 180,
      content: 'Three',
      style: { backgroundColor: '#ffffff' },
      locked: false,
      visible: true,
    },
  ]

  const stacked = applyLayoutConstraintToComponents({
    canvas: { width: 1280, height: 720 },
    components,
    selectedIds: ['cmp-layout-1', 'cmp-layout-2', 'cmp-layout-3'],
    constraint: { type: 'stack', alignment: 'center', gap: 24 },
  })

  assert.equal(stacked[0].layoutConstraint?.type, 'stack')
  assert.equal(stacked[1].layoutConstraint?.gap, 24)
  assert.equal(stacked[1].y, stacked[0].y + stacked[0].height + 24)
  assert.equal(stacked[2].y, stacked[1].y + stacked[1].height + 24)

  const gridded = applyLayoutConstraintToComponents({
    canvas: { width: 1280, height: 720 },
    components,
    selectedIds: ['cmp-layout-1', 'cmp-layout-2', 'cmp-layout-3'],
    constraint: { type: 'grid', alignment: 'left', gap: 20, columns: 2 },
  })

  assert.equal(gridded[0].layoutConstraint?.type, 'grid')
  assert.equal(gridded[1].x, gridded[0].x + 320)
  assert.equal(gridded[2].y, gridded[0].y + 200)
})

test('slides document contract: pinned constraints keep anchor intent when canvas dimensions change', () => {
  const document = createSlideDocument({
    id: 'slide-pin-1',
    canvas: { width: 1280, height: 720, background: '#ffffff' },
    components: [{
      id: 'cmp-pin-1',
      type: 'logo',
      x: 1100,
      y: 620,
      width: 120,
      height: 40,
      content: 'Pinned',
      style: { fontSize: 18 },
      layoutConstraint: {
        type: 'pinned',
        anchorX: 'right',
        anchorY: 'bottom',
        offsetX: 60,
        offsetY: 60,
      },
      locked: false,
      visible: true,
    }],
    warnings: [],
  })

  const next = syncSlideDocument({
    document,
    canvas: { width: 1600, height: 900, background: '#ffffff' },
    components: document.deck.slides[0].elements,
    warnings: [],
    slideId: 'slide-pin-1',
  })

  const pinned = next.deck.slides[0].elements[0]
  assert.equal(pinned.x, 1420)
  assert.equal(pinned.y, 800)
  assert.equal(pinned.layoutConstraint?.type, 'pinned')
})

test('slides document contract: responsive adaptation reapplies layout constraints across aspect-ratio changes', () => {
  const components = [
    {
      id: 'cmp-responsive-1',
      type: 'heading',
      x: 120,
      y: 120,
      width: 240,
      height: 60,
      content: 'Responsive A',
      style: { fontSize: 42 },
      groupId: 'group-responsive',
      groupName: 'Responsive Group',
      layoutConstraint: { type: 'stack', alignment: 'center', gap: 24 },
      locked: false,
      visible: true,
    },
    {
      id: 'cmp-responsive-2',
      type: 'text',
      x: 160,
      y: 240,
      width: 220,
      height: 48,
      content: 'Responsive B',
      style: { fontSize: 28 },
      groupId: 'group-responsive',
      groupName: 'Responsive Group',
      layoutConstraint: { type: 'stack', alignment: 'center', gap: 24 },
      locked: false,
      visible: true,
    },
    {
      id: 'cmp-responsive-pin',
      type: 'logo',
      x: 1080,
      y: 620,
      width: 120,
      height: 40,
      content: 'Pinned',
      style: { fontSize: 18 },
      layoutConstraint: { type: 'pinned', anchorX: 'right', anchorY: 'bottom', offsetX: 80, offsetY: 60 },
      locked: false,
      visible: true,
    },
  ]

  const adapted = adaptComponentsToResponsiveCanvas({
    previousCanvas: { width: 1280, height: 720 },
    nextCanvas: { width: 1080, height: 1080 },
    components,
  })

  const first = adapted.find((entry) => entry.id === 'cmp-responsive-1')
  const second = adapted.find((entry) => entry.id === 'cmp-responsive-2')
  const pinned = adapted.find((entry) => entry.id === 'cmp-responsive-pin')

  assert.equal(first?.layoutConstraint?.type, 'stack')
  assert.equal(second?.y, (first?.y || 0) + (first?.height || 0) + 24)
  assert.equal(pinned?.x, 880)
  assert.equal(pinned?.y, 980)
})

test('slides document contract: responsive adaptation emits manual-intervention warnings for unconstrained clamped layers', () => {
  const { components, warnings } = adaptComponentsToResponsiveCanvasWithWarnings({
    previousCanvas: { width: 1280, height: 720 },
    nextCanvas: { width: 640, height: 360 },
    components: [
      {
        id: 'cmp-unconstrained-1',
        type: 'card',
        x: 1180,
        y: 660,
        width: 220,
        height: 120,
        content: 'Needs clamp',
        style: { fontSize: 22 },
        locked: false,
        visible: true,
      },
    ],
  })

  assert.equal(components.length, 1)
  assert.equal(components[0].x, 530)
  assert.equal(components[0].y, 300)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /manual intervention may be required/i)
  assert.match(warnings[0], /cmp-unconstrained-1/)
})

test('slides document contract: ensureSlideDocument reuses existing canonical document', () => {
  const existing = createSlideDocument({
    canvas: { width: 1920, height: 1080 },
    components: [],
    warnings: [],
  })

  const ensured = ensureSlideDocument({
    document: existing,
    canvas: { width: 10, height: 10 },
    components: [],
    warnings: ['ignored'],
  })

  assert.equal(ensured, existing)
})

test('slides document contract: slideRecordToImportResult prefers persisted canonical snapshot', () => {
  const persisted = createSlideDocument({
    id: 'slide-99',
    canvas: { width: 1600, height: 900, background: '#f8fafc' },
    components: [{
      id: 'cmp-persisted',
      type: 'text',
      sourceLabel: '.text',
      x: 55,
      y: 44,
      width: 400,
      height: 50,
      content: 'Persisted',
      style: { fontSize: 28 },
      locked: false,
      visible: true,
    }],
    warnings: ['persisted-warning'],
  })

  const result = slideRecordToImportResult({
    id: 'slide-99',
    owner_user_id: 'user-1',
    title: 'Persisted Slide',
    canvas: { width: 1920, height: 1080 },
    components: [],
    metadata: {
      slide_document: persisted,
      warnings: ['legacy-warning'],
    },
    revision: 3,
    source: 'import',
    source_template_id: null,
    created_at: '2026-04-26T00:00:00.000Z',
    updated_at: '2026-04-26T00:00:00.000Z',
    last_edited_at: '2026-04-26T00:00:00.000Z',
  })

  assert.equal(result.document.deck.width, 1600)
  assert.equal(result.components[0].id, 'cmp-persisted')
  assert.deepEqual(result.warnings, ['persisted-warning'])
})

test('slides document contract: slideDocumentToImportResult mirrors primary slide onto editor result shape', () => {
  const document = createSlideDocument({
    canvas: { width: 1920, height: 1080, background: '#111827' },
    components: [{
      id: 'cmp-1',
      type: 'panel',
      sourceLabel: '.panel',
      x: 120,
      y: 100,
      width: 600,
      height: 320,
      content: '<p>Panel</p>',
      style: { backgroundColor: '#111827' },
      locked: false,
      visible: true,
    }],
    warnings: ['warning-a'],
  })

  const result = slideDocumentToImportResult(document)

  assert.equal(result.canvas.background, '#111827')
  assert.equal(result.components.length, 1)
  assert.equal(result.components[0].type, 'panel')
  assert.equal(result.document, document)
})

test('slides export contract: convertSlideDocumentToHtml uses canonical SlideDocument geometry and metadata', () => {
  const document = createSlideDocument({
    id: 'slide-export-1',
    canvas: { width: 1440, height: 810, background: '#0f172a' },
    components: [{
      id: 'cmp-export-1',
      type: 'heading',
      sourceLabel: '.headline',
      x: 96,
      y: 88,
      width: 720,
      height: 72,
      content: 'Canonical Export',
      style: { fontSize: 54, color: '#ffffff' },
      locked: false,
      visible: true,
    }],
    warnings: [],
  })

  const html = convertSlideDocumentToHtml({
    document,
    metadata: {
      source: 'contract-suite',
      revision: 7,
      exportedAt: '2026-04-26T12:00:00.000Z',
    },
  })

  assert.match(html, /data-oliver-source="contract-suite"/)
  assert.match(html, /data-oliver-revision="7"/)
  assert.match(html, /data-oliver-slide-id="slide-export-1"/)
  assert.match(html, /width:1440px/)
  assert.match(html, /height:810px/)
  assert.match(html, /background:#0f172a/)
  assert.match(html, /Canonical Export/)
})

test('slides export contract: convertSlideDocumentToRevealHtml preserves deck order as reveal.js sections', () => {
  const document = {
    version: 1,
    deck: {
      id: 'deck-reveal-1',
      width: 1280,
      height: 720,
      slides: [
        {
          id: 'deck-slide-1',
          background: { fill: '#ffffff' },
          elements: [{
            id: 'cmp-reveal-1',
            type: 'heading',
            sourceLabel: '.hero',
            x: 100,
            y: 80,
            width: 640,
            height: 72,
            content: 'Reveal One',
            style: { fontSize: 54, color: '#111827' },
            locked: false,
            visible: true,
          }],
        },
        {
          id: 'deck-slide-2',
          background: { fill: '#e2e8f0' },
          elements: [{
            id: 'cmp-reveal-2',
            type: 'text',
            sourceLabel: '.body',
            x: 120,
            y: 140,
            width: 520,
            height: 48,
            content: 'Reveal Two',
            style: { fontSize: 28, color: '#334155' },
            locked: false,
            visible: true,
          }],
        },
      ],
    },
    warnings: [],
  }

  const html = convertSlideDocumentToRevealHtml({
    document,
    metadata: {
      title: 'Reveal Contract Deck',
      source: 'oliver-app',
      exportedAt: '2026-04-27T12:00:00.000Z',
    },
  })

  assert.match(html, /cdn\.jsdelivr\.net\/npm\/reveal\.js@5/)
  assert.match(html, /Reveal\.initialize\(\{hash:true,controls:true,progress:true,center:false,transition:"slide"\}\)/)
  assert.match(html, /<section[^>]+data-oliver-slide-id="deck-slide-1"/)
  assert.match(html, /<section[^>]+data-oliver-slide-id="deck-slide-2"/)
  assert.ok(html.indexOf('Reveal One') < html.indexOf('Reveal Two'))
})

test('slides export contract: convertSlideDocumentsToPptx maps canonical slide documents into pptx payloads', async () => {
  const document = createSlideDocument({
    id: 'slide-pptx-doc-1',
    canvas: { width: 1280, height: 720 },
    components: [
      {
        id: 'cmp-text-1',
        type: 'heading',
        sourceLabel: '.heading',
        x: 80,
        y: 100,
        width: 640,
        height: 60,
        content: 'Editable text',
        style: { fontSize: 42, color: '#111827' },
        locked: false,
        visible: true,
      },
      {
        id: 'cmp-logo-1',
        type: 'logo',
        sourceLabel: '.brand-logo',
        x: 40,
        y: 32,
        width: 160,
        height: 60,
        content: '<img alt="Brand" src="https://example.com/logo.png" />',
        style: {},
        locked: false,
        visible: true,
      },
    ],
    warnings: [],
  })

  const { blob, warnings, slideCount } = convertSlideDocumentsToPptx([{
    id: 'slide-pptx-doc-1',
    title: 'Deck Export',
    document,
  }])

  assert.equal(slideCount, 1)
  assert.ok(blob instanceof Blob)
  assert.ok(blob.size > 0)
  assert.ok(warnings.some((warning) => /logo\/image mapping/i.test(warning)))
})

test('slides document contract: syncSlideDocument updates the addressed slide without collapsing sibling slides', () => {
  const base = appendSlideToDocument({
    document: createSlideDocument({
      id: 'slide-1',
      canvas: { width: 1920, height: 1080 },
      components: [{
        id: 'cmp-1',
        type: 'heading',
        sourceLabel: '.heading',
        x: 120,
        y: 120,
        width: 800,
        height: 60,
        content: 'Slide One',
        style: {},
        locked: false,
        visible: true,
      }],
      warnings: [],
    }),
    slideId: 'slide-2',
    canvas: { width: 1920, height: 1080, background: '#0f172a' },
    components: [{
      id: 'cmp-2',
      type: 'text',
      sourceLabel: '.copy',
      x: 90,
      y: 90,
      width: 600,
      height: 40,
      content: 'Slide Two',
      style: {},
      locked: false,
      visible: true,
    }],
  })

  const next = syncSlideDocument({
    document: base,
    canvas: { width: 1920, height: 1080, background: '#111827' },
    components: [{
      id: 'cmp-2b',
      type: 'text',
      sourceLabel: '.copy',
      x: 100,
      y: 100,
      width: 620,
      height: 50,
      content: 'Slide Two Updated',
      style: { color: '#fff' },
      locked: false,
      visible: true,
    }],
    warnings: ['updated'],
    slideId: 'slide-2',
  })

  assert.equal(next.deck.slides.length, 2)
  assert.equal(next.deck.slides[0].elements[0].content, 'Slide One')
  assert.equal(next.deck.slides[1].elements[0].content, 'Slide Two Updated')
  assert.deepEqual(next.warnings, ['updated'])
})

test('slides document contract: append, duplicate, delete, reorder, and active-slide projection preserve deck operations', () => {
  const base = createSlideDocument({
    id: 'slide-1',
    canvas: { width: 1600, height: 900 },
    components: [{
      id: 'cmp-1',
      type: 'heading',
      sourceLabel: '.heading',
      x: 100,
      y: 80,
      width: 500,
      height: 60,
      content: 'First',
      style: {},
      locked: false,
      visible: true,
    }],
    warnings: [],
  })

  const appended = appendSlideToDocument({
    document: base,
    slideId: 'slide-2',
    canvas: { width: 1600, height: 900 },
    components: [{
      id: 'cmp-2',
      type: 'text',
      sourceLabel: '.copy',
      x: 120,
      y: 120,
      width: 440,
      height: 40,
      content: 'Second',
      style: {},
      locked: false,
      visible: true,
    }],
  })
  const duplicated = duplicateSlideInDocument(appended, 'slide-2', 'slide-3')
  const reordered = reorderSlideInDocument(duplicated, 'slide-3', 'up')
  const deleted = deleteSlideFromDocument(reordered, 'slide-1')
  const projected = slideDocumentToImportResult(deleted, 'slide-3')

  assert.deepEqual(deleted.deck.slides.map((slide) => slide.id), ['slide-3', 'slide-2'])
  assert.equal(projected.components[0].content, 'Second')
  assert.equal(projected.document.deck.slides.length, 2)
})
