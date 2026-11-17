import type { SlideComponentType } from './types'
import { CANVAS_TARGET_ASPECT_RATIO, FLOW_MEDIA_TAGS, FLOW_TEXT_TAGS, IMPORT_STYLE_PROPERTIES, MIN_FLOW_NODE_SIZE } from './html-import-shared'
import type { MeasuredNodeRect, RenderSnapshot } from './html-import-shared'
import { parseRuleDeclarations } from './html-import-css'
import { hasOwnTextNode, measureNodeRect, readComputedStyleSafe } from './html-import-render'
import { hasRenderedBorder, normalizeBackgroundImage, normalizeColor, parsePositivePx } from './html-import-values'

export function resolveSvgImageFallback(node: HTMLElement, nodeLabel: string, warnings: string[]): string {
  const rawMarkup = node.outerHTML || ''
  if (!rawMarkup.trim()) return ''
  const compactMarkup = rawMarkup
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/^<svg\b(?![^>]*\sxmlns=)/i, '<svg xmlns="http://www.w3.org/2000/svg"')
    .trim()
  const encodedMarkup = encodeURIComponent(compactMarkup)
  warnings.push('Node "' + nodeLabel + '" imported as inline SVG image fallback.')
  return `<img alt="${nodeLabel}" src="data:image/svg+xml;utf8,${encodedMarkup}" />`
}

function estimateNodeAreaFromDeclaredSize(node: HTMLElement): number {
  const styleMap = parseRuleDeclarations(node.getAttribute('style') || '')
  const width = parsePositivePx(styleMap.width ?? node.getAttribute('width'))
  const height = parsePositivePx(styleMap.height ?? node.getAttribute('height'))
  if (!width || !height) return 0
  return width * height
}

function sanitizeNodeInPlace(root: HTMLElement): void {
  root.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(el => el.remove())

  const allNodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
  for (const element of allNodes) {
    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase()
      const attrValue = attr.value.trim().toLowerCase()
      if (attrName.startsWith('on')) {
        element.removeAttribute(attr.name)
        continue
      }
      if ((attrName === 'href' || attrName === 'src') && attrValue.startsWith('javascript:')) {
        element.removeAttribute(attr.name)
      }
    }
  }
}

function serializeInlineImportStyle(computedStyle: CSSStyleDeclaration | null): string {
  if (!computedStyle) return ''
  const entries: string[] = []
  for (const property of IMPORT_STYLE_PROPERTIES) {
    const value = computedStyle.getPropertyValue(property).trim()
    if (!value) continue
    if (property === 'background-color' && !normalizeColor(value)) continue
    if (property === 'border-top' || property === 'border-right' || property === 'border-bottom' || property === 'border-left') {
      if (value === '0px none rgb(0, 0, 0)' || value === 'none') continue
    }
    entries.push(`${property}: ${value}`)
  }
  return entries.join('; ')
}

export function buildSanitizedContentNode(node: HTMLElement): HTMLElement {
  const clone = node.cloneNode(true) as HTMLElement
  const sourceNodes = [node, ...Array.from(node.querySelectorAll<HTMLElement>('*'))]
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]
  const count = Math.min(sourceNodes.length, cloneNodes.length)

  for (let index = 0; index < count; index += 1) {
    const inlineStyle = serializeInlineImportStyle(readComputedStyleSafe(sourceNodes[index]))
    if (inlineStyle) cloneNodes[index].setAttribute('style', inlineStyle)
  }

  sanitizeNodeInPlace(clone)
  return clone
}

export function inferType(node: HTMLElement): SlideComponentType {
  const className = (node.className || '').toString().toLowerCase()
  const text = (node.textContent || '').trim().toLowerCase()
  const tag = node.tagName.toLowerCase()
  const alt = (node.getAttribute('alt') || '').toLowerCase()

  if (tag === 'svg') return 'logo'
  if (tag === 'img' && (className.includes('logo') || alt.includes('logo'))) return 'logo'
  if (className.includes('subheading') || className.includes('subtitle')) return 'subheading'
  if (tag === 'h1' || tag === 'h2' || className.includes('heading') || className.includes('title')) return 'heading'
  if (tag === 'h3' || tag === 'h4') return 'subheading'
  if (className.includes('tagline') || className.includes('tag-line')) return 'tag-line'
  if (className.includes('stat') || className.includes('metric')) return 'stat'
  if (className.includes('card') || className.includes('artifact') || /\bart\b/.test(className)) return 'card'
  if (className.includes('row')) return 'row'
  if (className.includes('panel') || className.includes('container')) return 'panel'
  if (text.length <= 32 && /\d/.test(text) && className.includes('kpi')) return 'stat'
  return 'text'
}

export function getCanvasRoot(doc: Document): HTMLElement | null {
  if (!doc.body) return null

  const prioritizedSelectors = ['.page', '[data-slide-root]', '.slide-canvas', '.slide']
  for (const selector of prioritizedSelectors) {
    const matches = Array.from(doc.querySelectorAll<HTMLElement>(selector))
    if (matches.length === 0) continue

    const best = matches
      .map((candidate) => ({
        candidate,
        score: estimateNodeAreaFromDeclaredSize(candidate),
      }))
      .sort((a, b) => b.score - a.score)[0]

    if (best?.candidate) return best.candidate
  }

  // Only a div/section/article/main explicitly marked as a slide/deck/canvas/frame/artboard
  // may stand in for the real page root — an unmarked sized box (a card, a tag, a tile) is
  // slide CONTENT, never the slide itself. Without this guard, any inner element with an
  // explicit width+height whose aspect ratio happens to sit near 16:9 could outscore the
  // real page canvas on ratio alone and get treated as the whole slide, silently clipping
  // everything outside it — reproduced with a real deck body containing multiple sized cards.
  const scoredCandidates = Array.from(doc.body.querySelectorAll<HTMLElement>('div,section,article,main'))
    .map((candidate) => {
      const styleMap = parseRuleDeclarations(candidate.getAttribute('style') || '')
      const width = parsePositivePx(styleMap.width ?? candidate.getAttribute('width'))
      const height = parsePositivePx(styleMap.height ?? candidate.getAttribute('height'))
      if (!width || !height) return { candidate, score: 0 }

      const className = (candidate.className || '').toString().toLowerCase()
      const isSemanticSlideMarker = /slide|deck|canvas|presentation|frame|artboard/.test(className)
      if (!isSemanticSlideMarker) return { candidate, score: 0 }

      const ratio = width / height
      const ratioDelta = Math.abs(ratio - CANVAS_TARGET_ASPECT_RATIO)
      const ratioScore = Math.max(0, 1 - Math.min(1, ratioDelta / 0.9))
      const areaScore = width * height
      return {
        candidate,
        score: areaScore * ratioScore + 1_000_000,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scoredCandidates.length > 0) return scoredCandidates[0].candidate

  return doc.body
}

export function shouldImportNode(node: HTMLElement, computedStyle: CSSStyleDeclaration | null): boolean {
  const style = parseRuleDeclarations(node.getAttribute('style') || '')
  const computedPosition = (computedStyle?.position || '').trim().toLowerCase()
  const computedLeft = (computedStyle?.left || '').trim().toLowerCase()
  const computedTop = (computedStyle?.top || '').trim().toLowerCase()
  const hasComputedPlacement = (computedLeft && computedLeft !== 'auto') || (computedTop && computedTop !== 'auto')
  const hasPositionInfo =
    style.position === 'absolute' ||
    style.position === 'fixed' ||
    computedPosition === 'absolute' ||
    computedPosition === 'fixed' ||
    style.left !== undefined ||
    style.top !== undefined ||
    hasComputedPlacement

  if (!hasPositionInfo) return false
  const tag = node.tagName.toLowerCase()
  if (FLOW_MEDIA_TAGS.has(tag)) return true

  const ownText = hasOwnTextNode(node)
  if (ownText) return true

  const hasBackground = Boolean(
    normalizeColor(computedStyle?.backgroundColor) ||
    normalizeBackgroundImage(computedStyle?.backgroundImage),
  )
  const hasBorder = computedStyle ? hasRenderedBorder(computedStyle) : false
  return hasBackground || hasBorder
}

export function getNodeLabel(node: HTMLElement): string {
  const id = node.getAttribute('id')
  if (id) return '#' + id

  const rawClassName = node.className
  const className = typeof rawClassName === 'string'
    ? rawClassName
    : typeof (rawClassName as { baseVal?: string }).baseVal === 'string'
      ? (rawClassName as { baseVal?: string }).baseVal || ''
      : ''
  const classes = (className || '').trim()
  if (classes) {
    const firstClass = classes.split(/\s+/).filter(Boolean)[0]
    if (firstClass) return '.' + firstClass
  }

  return node.tagName.toLowerCase()
}

export function shouldImportFlowNode(
  node: HTMLElement,
  computedStyle: CSSStyleDeclaration | null,
  measuredRect: MeasuredNodeRect,
): boolean {
  if (!computedStyle) return false

  const display = (computedStyle.display || '').trim().toLowerCase()
  const visibility = (computedStyle.visibility || '').trim().toLowerCase()
  const opacity = Number.parseFloat(computedStyle.opacity || '1')
  if (display === 'none' || visibility === 'hidden') return false
  if (Number.isFinite(opacity) && opacity <= 0.01) return false

  const width = measuredRect.width || 0
  const height = measuredRect.height || 0
  if (width < MIN_FLOW_NODE_SIZE || height < MIN_FLOW_NODE_SIZE) return false

  const tag = node.tagName.toLowerCase()
  if (FLOW_MEDIA_TAGS.has(tag)) return true

  const text = (node.textContent || '').trim()
  const ownText = hasOwnTextNode(node)
  const hasBackground = Boolean(
    normalizeColor(computedStyle.backgroundColor) ||
    normalizeBackgroundImage(computedStyle.backgroundImage),
  )
  const hasBorder = hasRenderedBorder(computedStyle)

  if (hasBackground || hasBorder) return true
  if (FLOW_TEXT_TAGS.has(tag) && text.length > 0) return true
  if (ownText && display !== 'inline') return true

  return false
}

// Find the outermost text-bearing (or media) descendants of a positioned container
// so each can become its own text-box/picture layer. Elements nested inside another
// text block are skipped, so a paragraph with an inline span stays one text box while
// a card holding a separate heading and body yields two. Positioned descendants are
// excluded because they are already imported as their own absolute layers.
export function collectNestedTextLeaves(
  container: HTMLElement,
  absoluteIdSet: Set<string>,
  renderSnapshot: RenderSnapshot,
  root: HTMLElement,
): HTMLElement[] {
  const leaves: HTMLElement[] = []
  for (const node of Array.from(container.querySelectorAll<HTMLElement>('*'))) {
    const id = node.getAttribute('data-import-node-id') || ''
    if (!id || absoluteIdSet.has(id)) continue
    const tag = node.tagName.toLowerCase()
    const isMedia = FLOW_MEDIA_TAGS.has(tag)
    if (!isMedia && !hasOwnTextNode(node)) continue

    let ancestor = node.parentElement
    let skip = false
    while (ancestor) {
      const ancestorId = ancestor.getAttribute('data-import-node-id') || ''
      // A nested positioned container owns its own subtree in its own pass; don't
      // pull its descendants up into this container (which would duplicate them).
      if (ancestor !== container && ancestorId && absoluteIdSet.has(ancestorId)) { skip = true; break }
      // Keep text atomic: skip anything inside a text-bearing element, INCLUDING the
      // container itself (so inline <span>/<strong>/<em> in a positioned heading or
      // paragraph is not split out and left overlapping the remaining text).
      if (hasOwnTextNode(ancestor)) { skip = true; break }
      if (ancestor === container) break
      ancestor = ancestor.parentElement
    }
    if (skip) continue

    const renderNode = renderSnapshot.nodesById.get(id) || node
    const renderRoot = renderSnapshot.root || root
    const rect = measureNodeRect(renderNode, renderRoot)
    if ((rect.width || 0) < MIN_FLOW_NODE_SIZE || (rect.height || 0) < MIN_FLOW_NODE_SIZE) continue

    const cs = readComputedStyleSafe(renderNode)
    if (cs) {
      const disp = (cs.display || '').toLowerCase()
      const vis = (cs.visibility || '').toLowerCase()
      const op = Number.parseFloat(cs.opacity || '1')
      if (disp === 'none' || vis === 'hidden' || (Number.isFinite(op) && op <= 0.01)) continue
    }
    leaves.push(node)
  }
  return leaves
}

// ---- Rasterization pipeline for designed graphics --------------------------------
// Designed graphics (gradient bursts, gradient-clipped text, stacked cards/meters)
// cannot be reproduced faithfully as native PPTX shapes/text — they overlap and break.
// For a visually-rich slide we instead: (1) flatten ALL non-text visuals (background,
// boxes, lines, meters, images) into ONE picture layer; (2) rasterize each gradient
// text run to its own picture layer (native PPTX has no gradient-clipped text); and
// (3) keep every plain-text run as an editable text box on top. Simple text-on-solid
// slides skip this entirely and use the native path.
