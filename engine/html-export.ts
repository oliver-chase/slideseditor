import type { SlideCanvas, SlideComponent } from './types'
import { escapeAttribute, sanitizeMarkup } from './html-import-markup'

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
  if (component.style.letterSpacing) chunks.push(`letter-spacing:${component.style.letterSpacing}px`)
  if (component.style.textAlign) chunks.push(`text-align:${component.style.textAlign}`)

  return chunks.join(';')
}

// Imported content is already sanitized. In a browser the export runs it through the shared sanitizer
// again; without a DOM (the Node tests) the content is written as given.
function sanitizeContent(content: string): string {
  return typeof DOMParser === 'undefined' ? content : sanitizeMarkup(content)
}

function safeCanvasSize(canvas: SlideCanvas): { width: number; height: number } {
  return {
    width: Number.isFinite(canvas.width) && canvas.width > 0 ? Math.max(1, Math.round(canvas.width)) : 1920,
    height: Number.isFinite(canvas.height) && canvas.height > 0 ? Math.max(1, Math.round(canvas.height)) : 1080,
  }
}

function buildPrintSafeStyles(canvas: SlideCanvas): string {
  const { width: safeWidth, height: safeHeight } = safeCanvasSize(canvas)
  const safeBackground =
    typeof canvas.background === 'string' && canvas.background.trim()
      ? canvas.background.trim().replace(/[<>]/g, '')
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
    '<title>Slide Export</title>',
    `<style>${buildPrintSafeStyles(canvas)}</style>`,
    '</head>',
    '<body>',
  ].join('\n')
  const rootOpen =
    `<div class="slides-export-root"><div class="slide-canvas" data-slide-root="1" data-slides-export-version="1" data-slides-source="${escapeAttribute(source)}" data-slides-slide-id="${escapeAttribute(slideId)}" data-slides-revision="${escapeAttribute(revision)}" data-slides-exported-at="${escapeAttribute(exportedAt)}" style="position:relative;width:${safeCanvasSize(canvas).width}px;height:${safeCanvasSize(canvas).height}px;overflow:hidden;${canvas.background ? `background:${escapeAttribute(canvas.background)};` : ''}">`
  const body = components.filter((component) => component.visible !== false).map(componentToHtml).join('\n')
  const rootClose = '</div></div>'
  const footer = '</body></html>'

  return `${header}\n${rootOpen}\n${body}\n${rootClose}\n${footer}`
}
