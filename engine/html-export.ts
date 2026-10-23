import type { SlideCanvas, SlideComponent, SlideDocument } from './types'

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function serializeStyle(component: SlideComponent): string {
  const chunks: string[] = [
    'position:absolute',
    `left:${component.x}px`,
    `top:${component.y}px`,
    `width:${component.width}px`,
  ]

  if (typeof component.height === 'number') chunks.push(`height:${component.height}px`)
  if (component.style.fontSize) chunks.push(`font-size:${component.style.fontSize}px`)
  if (component.style.fontWeight) chunks.push(`font-weight:${component.style.fontWeight}`)
  if (component.style.fontFamily) chunks.push(`font-family:${component.style.fontFamily}`)
  if (component.style.color) chunks.push(`color:${component.style.color}`)
  if (component.style.backgroundFill) chunks.push(`background:${component.style.backgroundFill}`)
  if (component.style.backgroundColor) chunks.push(`background-color:${component.style.backgroundColor}`)
  if (component.style.borderColor) chunks.push(`border-color:${component.style.borderColor}`)
  if (component.style.borderWidth) chunks.push(`border-width:${component.style.borderWidth}px`)
  if (component.style.borderStyle) chunks.push(`border-style:${component.style.borderStyle}`)
  if (component.style.borderRadius) chunks.push(`border-radius:${component.style.borderRadius}px`)
  if (component.style.boxShadow) chunks.push(`box-shadow:${component.style.boxShadow}`)
  if (component.style.fontStyle) chunks.push(`font-style:${component.style.fontStyle}`)
  if (component.style.lineHeight) chunks.push(`line-height:${component.style.lineHeight}px`)
  if (component.style.textAlign) chunks.push(`text-align:${component.style.textAlign}`)

  return chunks.join(';')
}

function sanitizeContent(content: string): string {
  return content
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, '')
    .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, '')
}

function buildPrintSafeStyles(canvas: SlideCanvas): string {
  const safeWidth = Number.isFinite(canvas.width) && canvas.width > 0 ? Math.max(1, Math.round(canvas.width)) : 1920
  const safeHeight = Number.isFinite(canvas.height) && canvas.height > 0 ? Math.max(1, Math.round(canvas.height)) : 1080
  const safeBackground =
    typeof canvas.background === 'string' && canvas.background.trim()
      ? canvas.background.trim()
      : 'var(--color-bg-card)'

  return [
    '@media print{',
    '@page{',
    `size:${safeWidth}px ${safeHeight}px;`,
    'margin:0;',
    '}',
    'html,body{',
    'width:100%;',
    'height:100%;',
    'margin:0;',
    'padding:0;',
    `background:${safeBackground};`,
    '}',
    '*{',
    'print-color-adjust:exact;',
    '-webkit-print-color-adjust:exact;',
    '}',
    '.slide-canvas{',
    'position:relative !important;',
    'width:100% !important;',
    'height:100% !important;',
    'overflow:visible !important;',
    '}',
    '}',
    'html,body{',
    'width:100%;',
    'height:100%;',
    'margin:0;',
    'padding:0;',
    `background:${safeBackground};`,
    'display:flex;',
    'align-items:flex-start;',
    'justify-content:flex-start;',
    '}',
    '.slides-export-root{',
    'display:flex;',
    'align-items:flex-start;',
    'justify-content:flex-start;',
    'width:100%;',
    'height:100%;',
    'overflow:hidden;',
    `background:${safeBackground};`,
    '}',
    '.slide-canvas{',
    'position:relative;',
    `width:${safeWidth}px;`,
    `height:${safeHeight}px;`,
    'overflow:hidden;',
    `background:${safeBackground};`,
    '}',
  ].join('')
}

function componentToHtml(component: SlideComponent): string {
  const attrs = [
    `data-component-id="${escapeAttribute(component.id)}"`,
    `data-component-type="${escapeAttribute(component.type)}"`,
    `data-source-label="${escapeAttribute(component.sourceLabel || component.type)}"`,
    `style="${escapeAttribute(serializeStyle(component))}"`,
  ]

  const body = sanitizeContent(component.content || '')
  return `<div ${attrs.join(' ')}>${body}</div>`
}

export function convertSlideComponentsToHtml(input: {
  canvas: SlideCanvas
  components: SlideComponent[]
  metadata?: {
    slideId?: string
    revision?: number
    source?: string
    exportedAt?: string
  }
}): string {
  const { canvas, components, metadata } = input
  const slideId = metadata?.slideId || 'unsaved-slide'
  const revision = Number.isFinite(metadata?.revision) ? String(metadata?.revision) : '0'
  const source = metadata?.source || 'slides-converter'
  const exportedAt = metadata?.exportedAt || new Date().toISOString()

  const header = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>Oliver Slide Export</title>',
    `<style>${buildPrintSafeStyles(canvas)}</style>`,
    '</head>',
    '<body>',
  ].join('\n')
  const rootOpen =
    `<div class="slides-export-root"><div class="slide-canvas" data-slide-root="1" data-oliver-export-version="1" data-oliver-source="${escapeAttribute(source)}" data-oliver-slide-id="${escapeAttribute(slideId)}" data-oliver-revision="${escapeAttribute(revision)}" data-oliver-exported-at="${escapeAttribute(exportedAt)}" style="position:relative;width:${canvas.width}px;height:${canvas.height}px;overflow:hidden;${canvas.background ? `background:${escapeAttribute(canvas.background)};` : ''}">`
  const body = components.map(componentToHtml).join('\n')
  const rootClose = '</div></div>'
  const footer = '</body></html>'

  return `${header}\n${rootOpen}\n${body}\n${rootClose}\n${footer}`
}

export function convertSlideDocumentToHtml(input: {
  document: SlideDocument
  metadata?: {
    slideId?: string
    revision?: number
    source?: string
    exportedAt?: string
  }
}): string {
  const primarySlide = input.document.deck.slides[0]
  const canvas: SlideCanvas = {
    width: input.document.deck.width,
    height: input.document.deck.height,
    ...(primarySlide?.background?.fill ? { background: primarySlide.background.fill } : {}),
  }

  return convertSlideComponentsToHtml({
    canvas,
    components: Array.isArray(primarySlide?.elements) ? primarySlide.elements : [],
    metadata: {
      ...input.metadata,
      slideId: input.metadata?.slideId || primarySlide?.id || input.document.deck.id,
    },
  })
}
