import { createSlideDocument } from './document'
import type { SlideComponent, SlideComponentStyle, SlideComponentType, SlideImportResult } from './types'

const DEFAULT_CANVAS_WIDTH = 1920
const DEFAULT_CANVAS_HEIGHT = 1080
const CANVAS_TARGET_ASPECT_RATIO = DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT
const CANVAS_AUTO_SCALE_RATIO_THRESHOLD = 1.4
const MIN_FLOW_NODE_SIZE = 12
const IMPORT_AUTO_CANVAS_SCALE_MAX = 2.5
const IMPORT_ROOT_MARKER_ATTR = 'data-import-root-id'
const IMPORT_ROOT_MARKER_VALUE = 'import-root'
const IMPORT_ROOT_NODE_ID = 'import-node-root'
const FLOW_TEXT_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'blockquote',
  'figcaption',
  'button',
  'label',
  'a',
  'dt',
  'dd',
])
const FLOW_MEDIA_TAGS = new Set(['img', 'picture', 'svg', 'canvas', 'video'])
const CSS_IMPORT_MAX_RECURSION_DEPTH = 3
const IMPORT_STYLE_PROPERTIES = [
  'color',
  'background-color',
  'background-image',
  'background',
  'font-size',
  'font-weight',
  'font-style',
  'font-family',
  'line-height',
  'text-align',
  'letter-spacing',
  'text-transform',
  'display',
  'align-items',
  'justify-content',
  'gap',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'box-shadow',
  'margin-left',
  'margin-top',
] as const

interface ParsedLength {
  raw: string
  value: number
  unit: string
}

interface MeasuredNodeRect {
  x?: number
  y?: number
  width?: number
  height?: number
}

interface ContentBounds {
  minX: number
  minY: number
  maxRight: number
  maxBottom: number
  width: number
  height: number
}

interface RenderSnapshot {
  root: HTMLElement | null
  nodesById: Map<string, HTMLElement>
  dispose: () => void
}

function normalizeImportedHtmlMarkup(html: string, warnings: string[]): string {
  const source = html.trim()
  if (!source) return html

  const htmlOpenRegex = /<html\b[^>]*>/gi
  const htmlOpenMatches = Array.from(source.matchAll(htmlOpenRegex))
  if (htmlOpenMatches.length <= 1) return source

  const firstHtmlIndex = htmlOpenMatches[0].index ?? 0
  const closeRegex = /<\/html>/gi
  closeRegex.lastIndex = firstHtmlIndex
  const firstCloseMatch = closeRegex.exec(source)

  const doctypeMatch = source.match(/<!doctype[^>]*>/i)
  const hasLeadingDoctype = !!doctypeMatch && (doctypeMatch.index ?? -1) < firstHtmlIndex
  const prefix = hasLeadingDoctype ? `${doctypeMatch?.[0] || ''}\n` : ''
  const sliced = firstCloseMatch
    ? source.slice(firstHtmlIndex, closeRegex.lastIndex)
    : source.slice(firstHtmlIndex)

  warnings.push(`Detected ${htmlOpenMatches.length} HTML root tags; imported the first document block only.`)
  return `${prefix}${sliced}`.trim()
}

function createSettlingTimeout(timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    window.setTimeout(() => {
      reject(new Error(`Timeout waiting for import render settle after ${timeoutMs}ms.`))
    }, timeoutMs)
  })
}

async function waitForImageLoad(image: HTMLImageElement): Promise<void> {
  if (image.complete) return
  await new Promise((resolve) => {
    const done = () => {
      image.removeEventListener('load', done)
      image.removeEventListener('error', done)
      resolve(undefined)
    }
    image.addEventListener('load', done, { once: true })
    image.addEventListener('error', done, { once: true })
  })
}

async function settleRenderSnapshot(doc: Document): Promise<void> {
  if (!doc) return
  const settleWait = new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  const pending: Array<Promise<unknown>> = [settleWait]
  const documentFonts = (doc as Document & { fonts?: FontFaceSet }).fonts
  if (documentFonts?.ready) {
    pending.push(documentFonts.ready)
  }

  const images = Array.from(doc.querySelectorAll('img'))
  for (const image of images) {
    pending.push(waitForImageLoad(image))
  }

  try {
    await Promise.race([
      Promise.all(pending),
      createSettlingTimeout(1500),
    ])
  } catch {
    // Best-effort render settling for import fidelity.
  }
}

function makeSafeResolvedUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    return new URL(rawUrl, baseUrl).toString()
  } catch {
    return null
  }
}

function parseStylesheetHref(styleSheet: HTMLLinkElement, baseUrl: string): string | null {
  const href = styleSheet.getAttribute('href')
  if (!href) return null
  const resolved = makeSafeResolvedUrl(href, baseUrl)
  if (!resolved) return null
  if (resolved.startsWith('data:')) return null
  return resolved
}

interface InlinedStyleChunk {
  cssText: string
  source: 'inline' | 'external'
  order: number
  linkHref?: string
}

interface CssImportResult {
  cssText: string
  importedCount: number
  unresolvedCount: number
}

async function fetchWithTimeout(url: string, timeoutMs = 1500): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-cache',
    })

    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function stripCssComments(cssText: string): string {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '')
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function getCssImportUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  const urlMatch = trimmed.match(/^url\((.*)\)$/i)
  if (urlMatch) {
    return stripWrappingQuotes(urlMatch[1] || '')
  }
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    return stripWrappingQuotes(trimmed)
  }
  return null
}

function parseInlineStyleImport(rawImportStatement: string): string | null {
  const raw = rawImportStatement.trim().replace(/^@import\s+/i, '')
  const statement = raw.endsWith(';') ? raw.slice(0, -1).trim() : raw
  const tokens = statement.split(/\s+/)
  if (tokens.length === 0) return null

  const candidateUrl = getCssImportUrl(tokens[0] || '')
  if (!candidateUrl) return null
  return candidateUrl
}

async function parseCssImportUrls(
  cssText: string,
  baseUrl: string,
  warnings: string[],
  recursionDepth = 0,
): Promise<CssImportResult> {
  if (recursionDepth > CSS_IMPORT_MAX_RECURSION_DEPTH) {
    return { cssText, importedCount: 0, unresolvedCount: 0 }
  }

  const stripped = stripCssComments(cssText)
  const importRegex = /@import[^;]+;/gi
  let match: RegExpExecArray | null
  const chunks: string[] = []
  let lastIndex = 0
  let importedCount = 0
  let unresolvedCount = 0

  while ((match = importRegex.exec(stripped)) !== null) {
    const fullMatch = match[0]
    const matchStart = match.index
    const matchEnd = importRegex.lastIndex

    chunks.push(cssText.slice(lastIndex, matchStart))

    const importUrl = parseInlineStyleImport(fullMatch)
    if (!importUrl) {
      warnings.push('Ignored unsupported CSS @import syntax; unsupported import form was skipped.')
      unresolvedCount += 1
      chunks.push('\n')
      lastIndex = matchEnd
      continue
    }

    const resolvedImportUrl = makeSafeResolvedUrl(importUrl, baseUrl)
    if (!resolvedImportUrl || resolvedImportUrl.startsWith('data:')) {
      warnings.push('Could not resolve CSS @import URL "' + importUrl + '"; import skipped.')
      unresolvedCount += 1
      chunks.push('\n')
      lastIndex = matchEnd
      continue
    }

    const nestedCssText = await fetchWithTimeout(resolvedImportUrl)
    if (!nestedCssText) {
      warnings.push('Could not fetch CSS @import "' + resolvedImportUrl + '".')
      unresolvedCount += 1
      chunks.push('\n')
      lastIndex = matchEnd
      continue
    }

    const nested = await parseCssImportUrls(nestedCssText, resolvedImportUrl, warnings, recursionDepth + 1)
    importedCount += 1 + nested.importedCount
    unresolvedCount += nested.unresolvedCount
    chunks.push('\n')
    chunks.push(nested.cssText)
    chunks.push('\n')
    lastIndex = matchEnd
  }

  chunks.push(cssText.slice(lastIndex))

  return {
    cssText: chunks.join(''),
    importedCount,
    unresolvedCount,
  }
}

async function inlineExternalStylesheets(doc: Document, warnings: string[]): Promise<InlinedStyleChunk[]> {
  const styleNodes = Array.from(
    doc.querySelectorAll('style,link[rel~="stylesheet"][href]'),
  ) as Array<HTMLStyleElement | HTMLLinkElement>
  if (styleNodes.length === 0) return []

  warnings.push(
    'Detected ' +
    styleNodes.length +
    ' style definition block' +
    (styleNodes.length === 1 ? '' : 's') +
    '; attempting to inline stylesheet resources for fidelity.',
  )

  const baseUrl = doc.baseURI && !doc.baseURI.startsWith('about:') ? doc.baseURI : window.location.href
  const stylesheetNodes = styleNodes.filter(
    (styleNode): styleNode is HTMLLinkElement => styleNode.tagName.toLowerCase() === 'link',
  )
  const linkByNode = new Map<HTMLLinkElement, Promise<string | null>>()
  for (const stylesheet of stylesheetNodes) {
    const href = parseStylesheetHref(stylesheet, baseUrl)
    linkByNode.set(stylesheet, href ? fetchWithTimeout(href).then((cssText) => cssText) : Promise.resolve(null))
  }
  const fetched = await Promise.allSettled(Array.from(linkByNode.values()))

  const inlinedStyles: InlinedStyleChunk[] = []
  let linkResultCursor = 0
  let unresolvedCount = 0

  for (let index = 0; index < styleNodes.length; index += 1) {
    const node = styleNodes[index]
    if (node.tagName.toLowerCase() === 'style') {
      const cssText = node.textContent || ''
      const { cssText: inlinedText, importedCount, unresolvedCount: inlinedUnresolved } = await parseCssImportUrls(
        cssText,
        doc.baseURI && !doc.baseURI.startsWith('about:') ? doc.baseURI : window.location.href,
        warnings,
      )
      if (inlinedText.trim()) {
        inlinedStyles.push({
          cssText: inlinedText,
          source: 'inline',
          order: index,
        })
      }
      if (importedCount > 0) {
        warnings.push(
          'Inlined ' +
            importedCount +
            ' @import stylesheet' +
            (importedCount === 1 ? '' : 's') +
            ' from inline style.',
        )
      }
      if (inlinedUnresolved > 0) {
        warnings.push(
          'Could not inline ' +
            inlinedUnresolved +
            ' inline @import stylesheet' +
            (inlinedUnresolved === 1 ? '' : 's') +
            '; source fallback may differ from original.',
        )
        unresolvedCount += inlinedUnresolved
      }
      continue
    }

    const result = fetched[linkResultCursor]
    linkResultCursor += 1
    if (result?.status === 'fulfilled' && result.value) {
      const linkedBase = node.getAttribute('href')
        ? makeSafeResolvedUrl(node.getAttribute('href') || '', doc.baseURI && !doc.baseURI.startsWith('about:') ? doc.baseURI : window.location.href)
        || doc.baseURI
        || window.location.href
        : doc.baseURI || window.location.href
      const { cssText: inlinedText, importedCount, unresolvedCount: inlinedUnresolved } = await parseCssImportUrls(
        result.value,
        linkedBase,
        warnings,
      )
      if (importedCount > 0) {
        warnings.push(
          'Inlined ' +
            importedCount +
            ' nested @import stylesheet' +
            (importedCount === 1 ? '' : 's') +
            ' from linked stylesheet.',
        )
      }
      inlinedStyles.push({
        cssText: inlinedText,
        source: 'external',
        order: index,
        linkHref: node.getAttribute('href') || undefined,
      })
      if (inlinedUnresolved > 0) {
        warnings.push(
          'Could not inline ' +
            inlinedUnresolved +
            ' nested @import stylesheet' +
            (inlinedUnresolved === 1 ? '' : 's') +
            '; nested fallback may differ from source.',
        )
        unresolvedCount += inlinedUnresolved
      }
      continue
    }

    unresolvedCount += 1
  }

  if (unresolvedCount > 0) {
    warnings.push(
      'Could not inline ' +
      unresolvedCount +
      ' linked stylesheet' +
      (unresolvedCount === 1 ? '' : 's') +
      '; remaining fallback styles may differ from source.',
    )
  }

  return inlinedStyles.sort((a, b) => a.order - b.order)
}

function parseInlineStyle(styleValue: string): Record<string, string> {
  const styleMap: Record<string, string> = {}
  for (const segment of styleValue.split(';')) {
    const idx = segment.indexOf(':')
    if (idx <= 0) continue
    const key = segment.slice(0, idx).trim().toLowerCase()
    const value = segment.slice(idx + 1).trim()
    if (key) styleMap[key] = value
  }
  return styleMap
}

function parseRuleDeclarations(rawDeclarations: string): Record<string, string> {
  const declarations: Record<string, string> = {}
  const declarationList = rawDeclarations.split(';')
  for (const declaration of declarationList) {
    const segment = declaration.trim()
    if (!segment) continue
    const index = segment.indexOf(':')
    if (index <= 0) continue
    const key = segment.slice(0, index).trim().toLowerCase()
    const value = segment.slice(index + 1).trim()
    if (key) declarations[key] = value
  }
  return declarations
}

interface PseudoLayerDescriptor {
  hostId: string
  pseudo: 'before' | 'after'
  styleMap: Record<string, string>
  hostLabel: string
  order: number
}

function parsePseudoLayerDescriptors(styleText: string, root: HTMLElement): PseudoLayerDescriptor[] {
  const descriptors: PseudoLayerDescriptor[] = []
  const ruleRegex = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  let order = 0

  while ((match = ruleRegex.exec(styleText)) !== null) {
    const selectorList = match[1]?.trim() || ''
    const declarationText = match[2] || ''
    const styleMap = parseRuleDeclarations(declarationText)
    if (Object.keys(styleMap).length === 0) {
      order += 1
      continue
    }

    const selectors = selectorList.split(',').map((selector) => selector.trim()).filter(Boolean)
    for (const selector of selectors) {
      const pseudoMatch = selector.match(/^(.+?)(::before|::after|:before|:after)\s*$/i)
      if (!pseudoMatch) continue

      const pseudo = pseudoMatch[2]?.toLowerCase().includes('before') ? 'before' : 'after'
      const hostSelector = pseudoMatch[1]?.trim()
      if (!hostSelector) continue

      let hostNodes: HTMLElement[] = []
      try {
        hostNodes = Array.from(root.querySelectorAll(hostSelector) as NodeListOf<HTMLElement>)
        if (root.matches(hostSelector)) {
          hostNodes = [root, ...hostNodes]
        }
      } catch {
        continue
      }

      for (const hostNode of Array.from(hostNodes)) {
        const hostId = hostNode.getAttribute('data-import-node-id')
        if (!hostId) continue
        descriptors.push({
          hostId,
          pseudo,
          hostLabel: getNodeLabel(hostNode),
          styleMap,
          order,
        })
      }
    }

    order += 1
  }

  return descriptors
}

function buildPseudoContent(styleMap: Record<string, string>, pseudoNodeLabel: string, warnings: string[]): string {
  const rawContent = styleMap.content || ''
  if (!rawContent || rawContent.toLowerCase() === 'none') return ''

  const isUrlImage = rawContent.startsWith('url(') && rawContent.endsWith(')')
  if (isUrlImage) {
    const parsedUrl = getCssImportUrl(rawContent)
    if (!parsedUrl) {
      warnings.push('Pseudo-element "' + pseudoNodeLabel + '" content URL "' + rawContent + '" could not be parsed; ignored.')
      return ''
    }
    warnings.push('Pseudo-element "' + pseudoNodeLabel + '" content URL converted to image fallback.')
    return `<img alt="${pseudoNodeLabel}" src="${parsedUrl}" />`
  }

  return stripWrappingQuotes(rawContent)
}

function parsePseudoDimension(styleMap: Record<string, string>, key: 'width' | 'height', nodeLabel: string, warnings: string[]): number | undefined {
  return parseStylePx(styleMap, key, nodeLabel, warnings)
}

function computePseudoOffset(
  styleMap: Record<string, string>,
  axis: 'x' | 'y',
  hostRect: MeasuredNodeRect,
  nodeLabel: string,
  warnings: string[],
): number {
  const key = axis === 'x' ? 'left' : 'top'
  const axisSize = axis === 'x' ? (hostRect.width || 0) : (hostRect.height || 0)
  const parsed = parseStylePositionPx(styleMap, key, nodeLabel, warnings, axisSize)
  if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed
  return 0
}

function shouldImportPseudoLayer(styleMap: Record<string, string>, width: number | undefined, height: number | undefined): boolean {
  if (styleMap.content && styleMap.content.toLowerCase() !== 'none') return true
  if (parseRuleValueExists(styleMap, 'background') || parseRuleValueExists(styleMap, 'background-color') || parseRuleValueExists(styleMap, 'background-image')) return true
  if (parseRuleValueExists(styleMap, 'border') || parseRuleValueExists(styleMap, 'border-color') || parseRuleValueExists(styleMap, 'box-shadow')) return true
  return typeof width === 'number' || typeof height === 'number'
}

function parseRuleValueExists(styleMap: Record<string, string>, key: string): boolean {
  return typeof styleMap[key] === 'string' && styleMap[key].trim().length > 0
}

function resolveFontFamily(rawFamily: string, warnings: string[], nodeLabel: string): string | undefined {
  if (!rawFamily) return undefined
  const hasGeneric = rawFamily
    .split(',')
    .map((family) => stripWrappingQuotes(family.trim()))
    .filter(Boolean)
    .map((family) => family.toLowerCase())
    .some((family) => ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'].includes(family))
  if (hasGeneric) return rawFamily

  const fallback = /\b(serif|arial|times|georgia|garamond|didot|cambria|cochin|palatino|lucida)\b/i.test(rawFamily)
    ? 'serif'
    : 'sans-serif'
  const sanitized = rawFamily.trim() ? `${rawFamily}, ${fallback}` : fallback
  warnings.push('Node "' + nodeLabel + '" font-family "' + rawFamily + '" normalized with fallback "' + fallback + '".')
  return sanitized
}

function resolveSvgImageFallback(node: HTMLElement, nodeLabel: string, warnings: string[]): string {
  const rawMarkup = node.outerHTML || ''
  if (!rawMarkup.trim()) return ''
  const compactMarkup = rawMarkup
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim()
  const encodedMarkup = encodeURIComponent(compactMarkup)
  warnings.push('Node "' + nodeLabel + '" imported as inline SVG image fallback.')
  return `<img alt="${nodeLabel}" src="data:image/svg+xml;utf8,${encodedMarkup}" />`
}

function parseLength(value: string | null | undefined): ParsedLength | undefined {
  if (!value) return undefined
  const raw = value.trim().toLowerCase()
  if (!raw) return undefined

  const match = raw.match(/^(-?\d*\.?\d+)([a-z%]*)$/)
  if (!match) return undefined

  const parsed = Number.parseFloat(match[1])
  if (!Number.isFinite(parsed)) return undefined

  return {
    raw,
    value: parsed,
    unit: match[2] || '',
  }
}

function isPxLike(length: ParsedLength): boolean {
  return length.value === 0 || length.unit === '' || length.unit === 'px'
}

function parsePositivePx(rawValue: string | null | undefined): number | undefined {
  const parsed = parseLength(rawValue)
  if (!parsed) return undefined
  if (!isPxLike(parsed)) return undefined
  if (parsed.value <= 0) return undefined
  return parsed.value
}

function estimateNodeAreaFromDeclaredSize(node: HTMLElement): number {
  const styleMap = parseInlineStyle(node.getAttribute('style') || '')
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

function readComputedStyleSafe(node: HTMLElement): CSSStyleDeclaration | null {
  const styleWindow = node.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null)
  if (!styleWindow || typeof styleWindow.getComputedStyle !== 'function') return null
  try {
    return styleWindow.getComputedStyle(node)
  } catch {
    return null
  }
}

function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  if (!normalized) return undefined
  if (normalized === 'transparent') return undefined
  if (normalized === 'rgba(0, 0, 0, 0)' || normalized === 'rgba(0,0,0,0)') return undefined
  return normalized
}

function normalizeBackgroundFill(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  if (!normalized) return undefined
  const lowered = normalized.toLowerCase()
  if (
    lowered === 'none' ||
    lowered === 'transparent' ||
    lowered === 'rgba(0, 0, 0, 0)' ||
    lowered === 'rgba(0,0,0,0)' ||
    /^rgba?\(0,\s*0,\s*0(?:,\s*0)?\)\s+none\b/.test(lowered)
  ) {
    return undefined
  }
  if (/url\(\s*javascript:/i.test(lowered)) return undefined
  return normalized
}

function normalizeBackgroundImage(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  if (!normalized || normalized.toLowerCase() === 'none') return undefined
  if (/url\(\s*javascript:/i.test(normalized)) return undefined
  return normalized
}

function resolveComputedBackground(
  computedStyle: CSSStyleDeclaration | null,
  styleMap: Record<string, string>,
): { backgroundFill?: string; backgroundColor?: string } {
  const backgroundImage = normalizeBackgroundImage(computedStyle?.backgroundImage || styleMap['background-image'])
  const backgroundColor = normalizeColor(computedStyle?.backgroundColor || styleMap['background-color'])
  const backgroundFill = normalizeBackgroundFill(computedStyle?.background || styleMap.background)

  if (backgroundImage) {
    const fill = backgroundColor ? `${backgroundImage}, ${backgroundColor}` : backgroundImage
    return { backgroundFill: fill, backgroundColor }
  }

  return {
    backgroundFill,
    backgroundColor,
  }
}

function hasRenderedBorder(style: CSSStyleDeclaration): boolean {
  const widths = [
    style.borderTopWidth,
    style.borderRightWidth,
    style.borderBottomWidth,
    style.borderLeftWidth,
  ]
  const styles = [
    style.borderTopStyle,
    style.borderRightStyle,
    style.borderBottomStyle,
    style.borderLeftStyle,
  ]

  for (let index = 0; index < widths.length; index += 1) {
    const width = parseLength(widths[index])
    const hasWidth = !!width && isPxLike(width) && width.value > 0
    const borderStyle = (styles[index] || '').trim().toLowerCase()
    if (hasWidth && borderStyle && borderStyle !== 'none' && borderStyle !== 'hidden') return true
  }

  return false
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

function buildSanitizedContentNode(node: HTMLElement): HTMLElement {
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

function inferType(node: HTMLElement): SlideComponentType {
  const className = (node.className || '').toString().toLowerCase()
  const text = (node.textContent || '').trim().toLowerCase()
  const tag = node.tagName.toLowerCase()
  const alt = (node.getAttribute('alt') || '').toLowerCase()

  if (tag === 'svg') return 'logo'
  if (tag === 'img' && (className.includes('logo') || alt.includes('logo'))) return 'logo'
  if (tag === 'h1' || tag === 'h2' || className.includes('heading') || className.includes('title')) return 'heading'
  if (tag === 'h3' || tag === 'h4' || className.includes('subheading') || className.includes('subtitle')) return 'subheading'
  if (className.includes('tagline') || className.includes('tag-line')) return 'tag-line'
  if (className.includes('stat') || className.includes('metric')) return 'stat'
  if (className.includes('card') || className.includes('artifact') || /\bart\b/.test(className)) return 'card'
  if (className.includes('row')) return 'row'
  if (className.includes('panel') || className.includes('container')) return 'panel'
  if (text.length <= 32 && /\d/.test(text) && className.includes('kpi')) return 'stat'
  return 'text'
}

function parseStylePx(
  styleMap: Record<string, string>,
  key: string,
  nodeLabel: string,
  warnings: string[],
): number | undefined {
  const raw = styleMap[key]
  if (raw === undefined) return undefined
  if (!raw.trim() || raw.trim().toLowerCase() === 'auto') return undefined

  const parsed = parseLength(raw)
  if (!parsed) {
    warnings.push('Node "' + nodeLabel + '" has non-numeric ' + key + ' value "' + raw + '"; ignored.')
    return undefined
  }

  if (!isPxLike(parsed)) {
    warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "' + parsed.unit + '"; ignored.')
    return undefined
  }

  return parsed.value
}

function parseStylePositionPx(
  styleMap: Record<string, string>,
  key: 'left' | 'top',
  nodeLabel: string,
  warnings: string[],
  axisSize: number,
): number | undefined {
  const raw = styleMap[key]
  if (raw === undefined) return undefined
  if (!raw.trim() || raw.trim().toLowerCase() === 'auto') return undefined

  const parsed = parseLength(raw)
  if (!parsed) {
    warnings.push('Node "' + nodeLabel + '" has non-numeric ' + key + ' value "' + raw + '"; ignored.')
    return undefined
  }

  if (isPxLike(parsed)) return parsed.value

  if (parsed.unit === '%') {
    warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "%"; ignored.')
    return axisSize > 0 ? (axisSize * parsed.value) / 100 : undefined
  }

  warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "' + parsed.unit + '"; ignored.')
  return undefined
}

function parseStyleOffsetPx(
  styleMap: Record<string, string>,
  key: 'left' | 'top' | 'margin-left' | 'margin-top',
  nodeLabel: string,
  warnings: string[],
  axisSize: number,
): number | undefined {
  if (key === 'left' || key === 'top') {
    return parseStylePositionPx(styleMap, key, nodeLabel, warnings, axisSize)
  }

  const raw = styleMap[key]
  if (raw === undefined) return undefined
  if (!raw.trim() || raw.trim().toLowerCase() === 'auto') return undefined

  const parsed = parseLength(raw)
  if (!parsed) {
    warnings.push('Node "' + nodeLabel + '" has non-numeric ' + key + ' value "' + raw + '"; ignored.')
    return undefined
  }

  if (isPxLike(parsed)) return parsed.value

  if (parsed.unit === '%') {
    warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "%"; approximated from canvas axis.')
    return axisSize > 0 ? (axisSize * parsed.value) / 100 : undefined
  }

  warnings.push('Node "' + nodeLabel + '" uses unsupported ' + key + ' unit "' + parsed.unit + '"; ignored.')
  return undefined
}

function parseComputedPositionPx(
  rawValue: string | undefined,
  key: 'left' | 'top',
  nodeLabel: string,
  warnings: string[],
  axisSize: number,
): number | undefined {
  if (!rawValue) return undefined
  const normalized = rawValue.trim().toLowerCase()
  if (!normalized || normalized === 'auto') return undefined

  const parsed = parseLength(normalized)
  if (!parsed) {
    warnings.push('Node "' + nodeLabel + '" has non-numeric computed ' + key + ' value "' + rawValue + '"; ignored.')
    return undefined
  }

  if (isPxLike(parsed)) return parsed.value

  if (parsed.unit === '%') {
    warnings.push('Node "' + nodeLabel + '" uses unsupported computed ' + key + ' unit "%"; ignored.')
    return axisSize > 0 ? (axisSize * parsed.value) / 100 : undefined
  }

  warnings.push('Node "' + nodeLabel + '" uses unsupported computed ' + key + ' unit "' + parsed.unit + '"; ignored.')
  return undefined
}

function parseAttrPx(
  rawValue: string | null,
  attrName: string,
  nodeLabel: string,
  warnings: string[],
): number | undefined {
  const parsed = parseLength(rawValue)
  if (!parsed) return undefined

  if (!isPxLike(parsed)) {
    warnings.push('Node "' + nodeLabel + '" uses unsupported ' + attrName + ' unit "' + parsed.unit + '"; ignored.')
    return undefined
  }

  return parsed.value
}

function parseCanvasPx(
  rawValue: string | undefined,
  axisLabel: 'width' | 'height',
  warnings: string[],
): number | undefined {
  const parsed = parseLength(rawValue)
  if (!parsed) return undefined

  if (!isPxLike(parsed)) {
    warnings.push('Slide root uses unsupported canvas ' + axisLabel + ' unit "' + parsed.unit + '"; defaulted to ' + (axisLabel === 'width' ? DEFAULT_CANVAS_WIDTH : DEFAULT_CANVAS_HEIGHT) + '.')
    return undefined
  }

  if (parsed.value <= 0) {
    warnings.push('Slide root has non-positive canvas ' + axisLabel + '; defaulted to ' + (axisLabel === 'width' ? DEFAULT_CANVAS_WIDTH : DEFAULT_CANVAS_HEIGHT) + '.')
    return undefined
  }

  return parsed.value
}

function canonicalCanvasValue(rectValue: number | undefined, fallback: number, warnings: string[], axis: 'width' | 'height', fileLabel: string): number {
  if (typeof rectValue !== 'number' || !Number.isFinite(rectValue) || rectValue <= 0) {
    warnings.push('Could not resolve ' + fileLabel + ' canvas ' + axis + '; defaulted to ' + fallback + '.')
    return fallback
  }
  return rectValue
}

function parseTransformOffsets(
  transformRaw: string | undefined,
  nodeLabel: string,
  warnings: string[],
): { x: number; y: number } {
  if (!transformRaw || transformRaw === 'none') return { x: 0, y: 0 }

  const normalized = transformRaw.trim().toLowerCase()

  const unsupportedTransformTokens = ['matrix(', 'scale(', 'rotate(', 'skew(', 'perspective(']
  if (unsupportedTransformTokens.some(token => normalized.includes(token))) {
    warnings.push('Node "' + nodeLabel + '" uses unsupported transform "' + transformRaw + '"; ignored.')
    return { x: 0, y: 0 }
  }

  const translateMatch = normalized.match(/^translate\(([^,]+),\s*([^)]+)\)$/)
  if (translateMatch) {
    const xLength = parseLength(translateMatch[1])
    const yLength = parseLength(translateMatch[2])
    if (!xLength || !yLength || !isPxLike(xLength) || !isPxLike(yLength)) {
      warnings.push('Node "' + nodeLabel + '" uses unsupported translate values in transform "' + transformRaw + '"; ignored.')
      return { x: 0, y: 0 }
    }
    return { x: xLength.value, y: yLength.value }
  }

  const translateXMatch = normalized.match(/translatex\(([^)]+)\)/)
  const translateYMatch = normalized.match(/translatey\(([^)]+)\)/)
  if (translateXMatch || translateYMatch) {
    const xLength = parseLength(translateXMatch?.[1])
    const yLength = parseLength(translateYMatch?.[1])

    if ((xLength && !isPxLike(xLength)) || (yLength && !isPxLike(yLength))) {
      warnings.push('Node "' + nodeLabel + '" uses unsupported translate unit in transform "' + transformRaw + '"; ignored.')
      return { x: 0, y: 0 }
    }

    return {
      x: xLength?.value ?? 0,
      y: yLength?.value ?? 0,
    }
  }

  warnings.push('Node "' + nodeLabel + '" uses unsupported transform "' + transformRaw + '"; ignored.')
  return { x: 0, y: 0 }
}

function parseFontWeight(value: string | undefined): number | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  if (normalized === 'normal') return 400
  if (normalized === 'bold') return 700
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeTextAlign(value: string | undefined): SlideComponentStyle['textAlign'] | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'start') return 'left'
  if (normalized === 'end') return 'right'
  if (normalized === 'left' || normalized === 'center' || normalized === 'right' || normalized === 'justify') {
    return normalized
  }
  return undefined
}

function parsePxLength(value: string | undefined): number | undefined {
  const parsed = parseLength(value)
  if (!parsed || !isPxLike(parsed)) return undefined
  return parsed.value
}

function normalizeBorderStyle(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === 'none' || normalized === 'hidden') return undefined
  return normalized
}

// Split a `border` shorthand (e.g. "1px solid #ccc" or "2px dashed red") into its
// width / style / color parts. Only used when the specific longhand property is
// absent; otherwise the shorthand color leaks into the color slot and is later
// rejected by the exporter, dropping the border entirely.
function parseBorderShorthand(value: string | undefined): { width?: string; style?: string; color?: string } {
  if (!value) return {}
  const raw = value.trim()
  if (!raw) return {}

  const colorFuncOrHex = raw.match(/#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^)]*\)/)
  let color = colorFuncOrHex ? colorFuncOrHex[0] : undefined
  let rest = color ? raw.replace(color, ' ') : raw

  const styleMatch = rest.match(/\b(solid|dashed|dotted|double|groove|ridge|inset|outset|none|hidden)\b/i)
  const style = styleMatch ? styleMatch[0] : undefined
  if (styleMatch) rest = rest.replace(styleMatch[0], ' ')

  const widthMatch = rest.match(/-?\d*\.?\d+(?:px|em|rem|pt|%)?/)
  const width = widthMatch ? widthMatch[0] : undefined
  if (widthMatch) rest = rest.replace(widthMatch[0], ' ')

  if (!color) {
    const remaining = rest.trim().split(/\s+/).filter(Boolean)
    if (remaining.length > 0) color = remaining[remaining.length - 1]
  }

  return { width, style, color }
}

function extractStyle(
  styleMap: Record<string, string>,
  computedStyle: CSSStyleDeclaration | null,
  warnings: string[] = [],
  nodeLabel = 'element',
): SlideComponentStyle {
  const fontSizeLength = parseLength(computedStyle?.fontSize || styleMap['font-size'])
  const lineHeightLength = parseLength(computedStyle?.lineHeight || styleMap['line-height'])
  const fontWeight = parseFontWeight(computedStyle?.fontWeight || styleMap['font-weight'])
  const color = normalizeColor(computedStyle?.color || styleMap.color)
  const { backgroundFill, backgroundColor } = resolveComputedBackground(computedStyle, styleMap)
  const borderShorthand = parseBorderShorthand(styleMap.border)
  const borderColor = normalizeColor(computedStyle?.borderColor || styleMap['border-color'] || borderShorthand.color)
  const borderWidth = parsePxLength(computedStyle?.borderWidth || styleMap['border-width'] || borderShorthand.width)
  const borderStyle = normalizeBorderStyle(computedStyle?.borderStyle || styleMap['border-style'] || borderShorthand.style)
  const borderRadius = parsePxLength(computedStyle?.borderRadius || styleMap['border-radius'])
  const shadowRaw = (computedStyle?.boxShadow || styleMap['box-shadow'] || '').trim()
  const boxShadow = shadowRaw && shadowRaw.toLowerCase() !== 'none' ? shadowRaw : undefined
  const fontStyleRaw = (computedStyle?.fontStyle || styleMap['font-style'] || '').trim().toLowerCase()
  const fontStyle = fontStyleRaw === 'italic' ? 'italic' : undefined
  const textAlign = normalizeTextAlign(computedStyle?.textAlign || styleMap['text-align'])
  const fontFamilyRaw = (computedStyle?.fontFamily || styleMap['font-family'] || '').trim()
  const fontFamily = resolveFontFamily(fontFamilyRaw, warnings, nodeLabel)

  return {
    fontSize: fontSizeLength && isPxLike(fontSizeLength) ? fontSizeLength.value : undefined,
    fontWeight,
    fontFamily,
    color,
    backgroundColor,
    backgroundFill,
    borderColor,
    borderWidth: typeof borderWidth === 'number' && borderWidth > 0 ? borderWidth : undefined,
    borderStyle,
    borderRadius: typeof borderRadius === 'number' && borderRadius > 0 ? borderRadius : undefined,
    boxShadow,
    fontStyle,
    lineHeight: lineHeightLength && isPxLike(lineHeightLength) ? lineHeightLength.value : undefined,
    textAlign,
  }
}

function getCanvasRoot(doc: Document): HTMLElement | null {
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

  const scoredCandidates = Array.from(doc.body.querySelectorAll<HTMLElement>('div,section,article,main'))
    .map((candidate) => {
      const styleMap = parseInlineStyle(candidate.getAttribute('style') || '')
      const width = parsePositivePx(styleMap.width ?? candidate.getAttribute('width'))
      const height = parsePositivePx(styleMap.height ?? candidate.getAttribute('height'))
      if (!width || !height) return { candidate, score: 0 }

      const ratio = width / height
      const ratioDelta = Math.abs(ratio - CANVAS_TARGET_ASPECT_RATIO)
      const ratioScore = Math.max(0, 1 - Math.min(1, ratioDelta / 0.9))
      const areaScore = width * height
      const className = (candidate.className || '').toString().toLowerCase()
      const semanticBoost = /slide|deck|canvas|presentation|frame|artboard/.test(className) ? 1_000_000 : 0
      return {
        candidate,
        score: areaScore * ratioScore + semanticBoost,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scoredCandidates.length > 0) return scoredCandidates[0].candidate

  return doc.body
}

function shouldImportNode(node: HTMLElement, computedStyle: CSSStyleDeclaration | null): boolean {
  const style = parseInlineStyle(node.getAttribute('style') || '')
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

function getNodeLabel(node: HTMLElement): string {
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

function asCanonicalDimension(value: number | undefined, fallback = 0): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  const rounded = Number(value.toFixed(3))
  const nearestInteger = Math.round(rounded)
  if (Math.abs(rounded - nearestInteger) <= 0.5) return nearestInteger
  return rounded
}

function asCanonicalDimensionOptional(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isFinite(value)) return undefined
  const rounded = Number(value.toFixed(3))
  const nearestInteger = Math.round(rounded)
  if (Math.abs(rounded - nearestInteger) <= 0.5) return nearestInteger
  return rounded
}

function getComponentContentBounds(components: SlideComponent[]): ContentBounds | null {
  if (components.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxRight = 0
  let maxBottom = 0

  for (const component of components) {
    const width = Number.isFinite(component.width) ? component.width : 0
    const height = Number.isFinite(component.height || 0) ? (component.height || 0) : 0
    minX = Math.min(minX, component.x)
    minY = Math.min(minY, component.y)
    maxRight = Math.max(maxRight, component.x + Math.max(0, width))
    maxBottom = Math.max(maxBottom, component.y + Math.max(0, height))
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null
  const width = Math.max(1, maxRight - minX)
  const height = Math.max(1, maxBottom - minY)
  return { minX, minY, maxRight, maxBottom, width, height }
}

function normalizeCanvasToContentBounds(
  components: SlideComponent[],
  canvas: { width: number; height: number; background?: string },
  warnings: string[],
): { components: SlideComponent[]; canvas: { width: number; height: number; background?: string } } {
  const bounds = getComponentContentBounds(components)
  if (!bounds) return { components, canvas }

  const oversizedCanvas = canvas.width > 4096 || canvas.height > 4096
  if (!oversizedCanvas) return { components, canvas }

  const shifted = components.map((component) => ({
    ...component,
    x: asCanonicalDimension(component.x - bounds.minX),
    y: asCanonicalDimension(component.y - bounds.minY),
  }))
  const normalizedCanvas = {
    ...canvas,
    width: asCanonicalDimension(Math.max(1, bounds.width)),
    height: asCanonicalDimension(Math.max(1, bounds.height)),
  }
  warnings.push(
    `Normalized oversized canvas to content bounds ${normalizedCanvas.width}x${normalizedCanvas.height} for import usability.`,
  )
  return { components: shifted, canvas: normalizedCanvas }
}

function measureNodeRect(node: HTMLElement, root: HTMLElement): MeasuredNodeRect {
  if (typeof node.getBoundingClientRect !== 'function' || typeof root.getBoundingClientRect !== 'function') {
    return {}
  }

  const rect = node.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  if (!Number.isFinite(rect.left) || !Number.isFinite(rootRect.left)) return {}

  return {
    x: Math.max(0, rect.left - rootRect.left),
    y: Math.max(0, rect.top - rootRect.top),
    width: Number.isFinite(rect.width) && rect.width > 0 ? rect.width : undefined,
    height: Number.isFinite(rect.height) && rect.height > 0 ? rect.height : undefined,
  }
}

function measureContentBounds(
  nodes: HTMLElement[],
  snapshot: RenderSnapshot,
  root: HTMLElement,
): { width?: number; height?: number } {
  let maxRight = 0
  let maxBottom = 0

  for (const node of nodes) {
    const nodeId = node.getAttribute('data-import-node-id') || ''
    const renderNode = snapshot.nodesById.get(nodeId) || node
    const renderRoot = snapshot.root || root
    const measured = measureNodeRect(renderNode, renderRoot)
    if (measured.width === undefined || measured.height === undefined) continue
    const x = measured.x || 0
    const y = measured.y || 0
    maxRight = Math.max(maxRight, x + measured.width)
    maxBottom = Math.max(maxBottom, y + measured.height)
  }

  return {
    width: maxRight > 0 ? maxRight : undefined,
    height: maxBottom > 0 ? maxBottom : undefined,
  }
}

function clampAutoImportCanvasAxis(axisValue: number, label: 'width' | 'height', warnings: string[]): number {
  const defaultAxis = label === 'width' ? DEFAULT_CANVAS_WIDTH : DEFAULT_CANVAS_HEIGHT
  const maxAxis = Math.round(defaultAxis * IMPORT_AUTO_CANVAS_SCALE_MAX)
  if (axisValue <= maxAxis) return axisValue

  warnings.push(
    `Source ${label} ${axisValue}px exceeds auto-import safety cap ${maxAxis}px; clamped to avoid compressed output.`,
  )
  return maxAxis
}

async function buildRenderSnapshot(doc: Document, root: HTMLElement, styleChunks: InlinedStyleChunk[]): Promise<RenderSnapshot> {
  if (typeof document === 'undefined' || !document.body) {
    return {
      root: null,
      nodesById: new Map(),
      dispose: () => {},
    }
  }

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.style.position = 'fixed'
  iframe.style.left = '-100000px'
  iframe.style.top = '-100000px'
  iframe.style.width = '1920px'
  iframe.style.height = '1080px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.zIndex = '-1'
  iframe.style.overflow = 'hidden'
  iframe.setAttribute('sandbox', 'allow-same-origin')
  document.body.appendChild(iframe)

  const sandboxDoc = iframe.contentDocument
  if (!sandboxDoc) {
    iframe.remove()
    return {
      root: null,
      nodesById: new Map(),
      dispose: () => {},
    }
  }

  sandboxDoc.open()
  sandboxDoc.write('<!doctype html><html><head></head><body></body></html>')
  sandboxDoc.close()

  const sandboxBody = sandboxDoc.body
  if (!sandboxBody) {
    iframe.remove()
    return {
      root: null,
      nodesById: new Map(),
      dispose: () => {},
    }
  }

  sandboxBody.style.margin = '0'
  sandboxBody.style.padding = '0'
  sandboxBody.style.overflow = 'hidden'

  if (styleChunks.length > 0 && sandboxDoc.head) {
    const styleEl = sandboxDoc.createElement('style')
    styleEl.textContent = styleChunks
      .map(({ cssText }) => cssText)
      .filter(Boolean)
      .join('\n')
    sandboxDoc.head.appendChild(styleEl)
  }

  let rootClone: HTMLElement | null = null
  const sourceBody = doc.body
  if (sourceBody) {
    const bodyClone = sourceBody.cloneNode(true) as HTMLElement
    for (const attr of Array.from(sourceBody.attributes)) {
      sandboxBody.setAttribute(attr.name, attr.value)
    }
    const sourceRootIsBody = root === sourceBody
    sandboxBody.replaceChildren(...Array.from(bodyClone.childNodes))

    if (sourceRootIsBody) {
      sandboxBody.setAttribute(IMPORT_ROOT_MARKER_ATTR, IMPORT_ROOT_MARKER_VALUE)
      rootClone = sandboxBody
    } else {
      rootClone = sandboxBody.querySelector<HTMLElement>(`[${IMPORT_ROOT_MARKER_ATTR}="${IMPORT_ROOT_MARKER_VALUE}"]`)
    }
  }

  if (!rootClone) {
    rootClone = root.cloneNode(true) as HTMLElement
    sandboxBody.replaceChildren(rootClone)
  }

  await settleRenderSnapshot(sandboxDoc)

  const nodesById = new Map<string, HTMLElement>()
  for (const node of Array.from(sandboxDoc.querySelectorAll<HTMLElement>('[data-import-node-id]'))) {
    const id = node.getAttribute('data-import-node-id')
    if (!id) continue
    nodesById.set(id, node)
  }

  return {
    root: rootClone,
    nodesById,
    dispose: () => {
      iframe.remove()
    },
  }
}

function hasOwnTextNode(node: HTMLElement): boolean {
  return Array.from(node.childNodes).some((child) => child.nodeType === 3 && Boolean(child.textContent?.trim()))
}

function extractPseudoComponents(
  descriptors: PseudoLayerDescriptor[],
  renderSnapshot: RenderSnapshot,
  root: HTMLElement,
  renderRoot: HTMLElement,
  warnings: string[],
): Map<string, SlideComponent[]> {
  const pseudoByHost = new Map<string, SlideComponent[]>()
  const mergedStyles = new Map<string, { pseudo: 'before' | 'after'; order: number; styleMap: Record<string, string> }>()

  for (const descriptor of descriptors) {
    const hostPseudoKey = descriptor.hostId + '|' + descriptor.pseudo
    const existing = mergedStyles.get(hostPseudoKey)
    mergedStyles.set(hostPseudoKey, {
      pseudo: descriptor.pseudo,
      order: descriptor.order,
      styleMap: {
        ...(existing?.styleMap || {}),
        ...descriptor.styleMap,
      },
    })
  }

  for (const [hostPseudoKey, { pseudo, order, styleMap }] of mergedStyles.entries()) {
    const [hostId] = hostPseudoKey.split('|')
    if (hostId === IMPORT_ROOT_NODE_ID) {
      warnings.push('Skipped root pseudo-element decorative overlay during import.')
      continue
    }
    const hostNode = root.querySelector<HTMLElement>(`[data-import-node-id="${hostId}"]`)
    if (!hostNode) continue

    const renderNode = renderSnapshot.nodesById.get(hostId) || hostNode
    const measuredHost = measureNodeRect(renderNode, renderRoot)
    const hostStyleMap = parseInlineStyle(hostNode.getAttribute('style') || '')
    const hostComputedStyle = readComputedStyleSafe(renderNode)
    const hostLabel = getNodeLabel(hostNode)

    const pseudoLabel = hostLabel + '::' + pseudo
    const pseudoContent = buildPseudoContent(styleMap, pseudoLabel, warnings)
    const pseudoWidth = parsePseudoDimension(styleMap, 'width', pseudoLabel, warnings)
    const pseudoHeight = parsePseudoDimension(styleMap, 'height', pseudoLabel, warnings)
    if (!shouldImportPseudoLayer(styleMap, pseudoWidth, pseudoHeight)) continue

    const hostX = typeof measuredHost.x === 'number' && Number.isFinite(measuredHost.x) ? measuredHost.x : 0
    const hostY = typeof measuredHost.y === 'number' && Number.isFinite(measuredHost.y) ? measuredHost.y : 0
    const pseudoX = hostX + computePseudoOffset(styleMap, 'x', measuredHost, pseudoLabel, warnings)
    const pseudoY = hostY + computePseudoOffset(styleMap, 'y', measuredHost, pseudoLabel, warnings)

    const mergedStyleMap = {
      ...hostStyleMap,
      ...styleMap,
    }
    const extractedStyle = extractStyle(mergedStyleMap, hostComputedStyle, warnings, pseudoLabel)

    const pseudoComponent: SlideComponent = {
      id: `import-${hostId}-${pseudo}-${order}`,
      type: 'panel',
      sourceLabel: pseudoLabel,
      x: asCanonicalDimension(pseudoX),
      y: asCanonicalDimension(pseudoY),
      width: asCanonicalDimension(pseudoWidth ?? 16),
      height: asCanonicalDimensionOptional(pseudoHeight),
      content: pseudoContent || '\u00a0',
      style: extractedStyle,
      locked: false,
      visible: true,
    }
    pseudoByHost.set(hostId, [...(pseudoByHost.get(hostId) || []), pseudoComponent])
  }

  for (const [, components] of pseudoByHost) {
    components.sort((a, b) => {
      const aBefore = (a.sourceLabel || '').includes('::before')
      const bBefore = (b.sourceLabel || '').includes('::before')
      if (aBefore && !bBefore) return -1
      if (!aBefore && bBefore) return 1
      return 0
    })
  }

  return pseudoByHost
}

function shouldImportFlowNode(
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
function collectNestedTextLeaves(
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

export async function convertHtmlToSlideComponents(html: string): Promise<SlideImportResult> {
  const warnings: string[] = []
  const buildEmergencyFallbackImportResult = (reason: string): SlideImportResult => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const emergencyRoot = getCanvasRoot(doc) || doc.body
    const rootStyle = emergencyRoot ? parseInlineStyle(emergencyRoot.getAttribute('style') || '') : {}
    const fallbackCanvas = {
      width: parseCanvasPx(rootStyle.width, 'width', warnings) || DEFAULT_CANVAS_WIDTH,
      height: parseCanvasPx(rootStyle.height, 'height', warnings) || DEFAULT_CANVAS_HEIGHT,
    }
    const sanitizedRoot = emergencyRoot ? buildSanitizedContentNode(emergencyRoot) : null
    const fallbackContent = sanitizedRoot?.innerHTML.trim() || sanitizedRoot?.outerHTML.trim() || html.trim()
    const fallbackComponents: SlideComponent[] = [{
      id: 'import-001',
      type: 'panel',
      sourceLabel: `${emergencyRoot ? getNodeLabel(emergencyRoot) : 'html-root'} (fallback)`,
      x: 0,
      y: 0,
      width: fallbackCanvas.width,
      height: fallbackCanvas.height,
      content: fallbackContent,
      style: extractStyle(rootStyle, emergencyRoot ? readComputedStyleSafe(emergencyRoot) : null, warnings, 'fallback-root'),
      locked: true,
      visible: true,
    }]
    warnings.push(`Import parser fallback engaged (${reason}); loaded simplified locked layer.`)
    const uniqueWarnings = Array.from(new Set(warnings))
    return {
      document: createSlideDocument({
        canvas: fallbackCanvas,
        components: fallbackComponents,
        warnings: uniqueWarnings,
      }),
      canvas: fallbackCanvas,
      components: fallbackComponents,
      warnings: uniqueWarnings,
    }
  }

  let normalizedHtml = ''
  let doc: Document
  let root: HTMLElement | null = null
  try {
    normalizedHtml = normalizeImportedHtmlMarkup(html, warnings)
    const parser = new DOMParser()
    doc = parser.parseFromString(normalizedHtml, 'text/html')
    root = getCanvasRoot(doc)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'normalize_or_parse_failed')
    return buildEmergencyFallbackImportResult(message)
  }

  if (!root) {
    return buildEmergencyFallbackImportResult('slide_root_not_detected')
  }

  root.setAttribute(IMPORT_ROOT_MARKER_ATTR, IMPORT_ROOT_MARKER_VALUE)
  root.setAttribute('data-import-node-id', IMPORT_ROOT_NODE_ID)
  const allNodes = Array.from(root.querySelectorAll<HTMLElement>('*'))
  for (let index = 0; index < allNodes.length; index += 1) {
    allNodes[index].setAttribute('data-import-node-id', `import-node-${index + 1}`)
  }

  let inlinedStyleChunks: InlinedStyleChunk[] = []
  try {
    inlinedStyleChunks = await inlineExternalStylesheets(doc, warnings)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'stylesheet_inline_failed')
    warnings.push(`Stylesheet inlining failed (${message}); continuing with available styles.`)
  }
  const styleSources = inlinedStyleChunks.map(({ cssText }) => cssText).join('\n')
  const styleSourceText = inlinedStyleChunks.map(({ cssText }) => cssText).join('\n').toLowerCase()
  if (styleSourceText.includes('@keyframes') || /\banimation\s*:/.test(styleSourceText)) {
    warnings.push('Detected CSS animations; animation effects are not imported and static styles are used.')
  }
  if (root.querySelector('canvas')) {
    warnings.push('Detected canvas elements; canvas pixel content is not extracted into editable layers.')
  }
  if (root.querySelector('video')) {
    warnings.push('Detected video elements; video playback layers are not imported as editable slide components.')
  }
  const buildFallbackImportResult = (reason: string): SlideImportResult => {
    const rootStyle = parseInlineStyle(root.getAttribute('style') || '')
    const fallbackCanvas = {
      width: parseCanvasPx(rootStyle.width ?? root.getAttribute('width') ?? undefined, 'width', warnings) || DEFAULT_CANVAS_WIDTH,
      height: parseCanvasPx(rootStyle.height ?? root.getAttribute('height') ?? undefined, 'height', warnings) || DEFAULT_CANVAS_HEIGHT,
    }
    const sanitizedRoot = buildSanitizedContentNode(root)
    const fallbackComponents: SlideComponent[] = [{
      id: 'import-001',
      type: 'panel',
      sourceLabel: `${getNodeLabel(root)} (fallback)`,
      x: 0,
      y: 0,
      width: fallbackCanvas.width,
      height: fallbackCanvas.height,
      content: sanitizedRoot.innerHTML.trim() || sanitizedRoot.outerHTML.trim(),
      style: extractStyle(rootStyle, readComputedStyleSafe(root), warnings, getNodeLabel(root)),
      locked: true,
      visible: true,
    }]
    warnings.push(`High-fidelity import mode failed (${reason}); loaded simplified fallback layer.`)
    const uniqueWarnings = Array.from(new Set(warnings))
    return {
      document: createSlideDocument({
        canvas: fallbackCanvas,
        components: fallbackComponents,
        warnings: uniqueWarnings,
      }),
      canvas: fallbackCanvas,
      components: fallbackComponents,
      warnings: uniqueWarnings,
    }
  }

  let renderSnapshot: RenderSnapshot
  try {
    renderSnapshot = await buildRenderSnapshot(doc, root, inlinedStyleChunks)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'render_snapshot_failed')
    return buildFallbackImportResult(message)
  }

  try {
    const rootStyle = parseInlineStyle(root.getAttribute('style') || '')
    const measuredRootRect = renderSnapshot.root ? measureNodeRect(renderSnapshot.root, renderSnapshot.root) : {}
    const explicitCanvasWidth = parseCanvasPx(rootStyle.width ?? root.getAttribute('width') ?? undefined, 'width', warnings)
    const explicitCanvasHeight = parseCanvasPx(rootStyle.height ?? root.getAttribute('height') ?? undefined, 'height', warnings)
    const computedRootStyle = readComputedStyleSafe(renderSnapshot.root || root)
    const computedCanvasWidth = parseLength(computedRootStyle?.width || '')?.value
    const computedCanvasHeight = parseLength(computedRootStyle?.height || '')?.value
    const sourceBodyStyle = doc.body ? parseInlineStyle(doc.body.getAttribute('style') || '') : {}
    const sourceHtmlStyle = doc.documentElement ? parseInlineStyle(doc.documentElement.getAttribute('style') || '') : {}
    const renderBody = renderSnapshot.root?.ownerDocument?.body
    const renderHtml = renderSnapshot.root?.ownerDocument?.documentElement
    const computedBodyStyle = renderBody ? readComputedStyleSafe(renderBody) : null
    const computedHtmlStyle = renderHtml ? readComputedStyleSafe(renderHtml) : null
    const rootBackground = resolveComputedBackground(computedRootStyle, rootStyle)
    const bodyBackground = resolveComputedBackground(computedBodyStyle, sourceBodyStyle)
    const htmlBackground = resolveComputedBackground(computedHtmlStyle, sourceHtmlStyle)
    const canvasBackground = normalizeBackgroundFill(
      rootBackground.backgroundFill ||
      rootBackground.backgroundColor ||
      bodyBackground.backgroundFill ||
      bodyBackground.backgroundColor ||
      htmlBackground.backgroundFill ||
      htmlBackground.backgroundColor,
    )

    const absoluteNodes = allNodes.filter((node) => {
      const nodeId = node.getAttribute('data-import-node-id') || ''
      const renderNode = renderSnapshot.nodesById.get(nodeId) || node
      return shouldImportNode(node, readComputedStyleSafe(renderNode))
    })
    const fallbackNodes = Array.from(root.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
    const flowNodes = allNodes.filter((node) => {
      const nodeId = node.getAttribute('data-import-node-id') || ''
      const renderNode = renderSnapshot.nodesById.get(nodeId) || node
      const renderRoot = renderSnapshot.root || root
      const measuredRect = measureNodeRect(renderNode, renderRoot)
      return shouldImportFlowNode(node, readComputedStyleSafe(renderNode), measuredRect)
    })
    const nodes = absoluteNodes.length > 0
      ? absoluteNodes
      : flowNodes.length > 0
        ? flowNodes
        : fallbackNodes.length > 0
          ? fallbackNodes
          : [root]
    const importMode = absoluteNodes.length > 0
      ? 'absolute'
      : flowNodes.length > 0
        ? 'flow'
        : fallbackNodes.length > 0
          ? 'fallback'
          : 'root-fallback'
    const contentBounds = measureContentBounds(nodes, renderSnapshot, root)
    const pseudoDescriptors = parsePseudoLayerDescriptors(styleSources, root)
    const pseudoByHost = extractPseudoComponents(
      pseudoDescriptors,
      renderSnapshot,
      root,
      renderSnapshot.root || root,
      warnings,
    )
    const pseudoLayerCount = Array.from(pseudoByHost.values()).reduce((total, entries) => total + entries.length, 0)
    if (pseudoDescriptors.length > 0 && pseudoLayerCount === 0) {
      warnings.push('Pseudo-element selectors were detected but could not be resolved to rendered layers.')
    } else if (pseudoLayerCount > 0) {
      warnings.push(
        'Extracted ' + pseudoLayerCount + ' pseudo-element layer' + (pseudoLayerCount === 1 ? '' : 's') + ' from CSS.',
      )
    }
    const hasDeclaredCanvasWidth = explicitCanvasWidth !== undefined || typeof computedCanvasWidth === 'number'
    const hasDeclaredCanvasHeight = explicitCanvasHeight !== undefined || typeof computedCanvasHeight === 'number'

    let sourceCanvasWidth = explicitCanvasWidth
      ?? (typeof computedCanvasWidth === 'number' ? canonicalCanvasValue(computedCanvasWidth, DEFAULT_CANVAS_WIDTH, warnings, 'width', 'computed style') : undefined)
      ?? canonicalCanvasValue(measuredRootRect.width, DEFAULT_CANVAS_WIDTH, warnings, 'width', 'measured root')
    let sourceCanvasHeight = explicitCanvasHeight
      ?? (typeof computedCanvasHeight === 'number' ? canonicalCanvasValue(computedCanvasHeight, DEFAULT_CANVAS_HEIGHT, warnings, 'height', 'computed style') : undefined)
      ?? canonicalCanvasValue(measuredRootRect.height, DEFAULT_CANVAS_HEIGHT, warnings, 'height', 'measured root')

    sourceCanvasWidth = clampAutoImportCanvasAxis(sourceCanvasWidth, 'width', warnings)
    sourceCanvasHeight = clampAutoImportCanvasAxis(sourceCanvasHeight, 'height', warnings)

    if (!hasDeclaredCanvasWidth && contentBounds.width && sourceCanvasWidth > contentBounds.width * CANVAS_AUTO_SCALE_RATIO_THRESHOLD) {
      sourceCanvasWidth = Math.max(contentBounds.width, DEFAULT_CANVAS_WIDTH)
      warnings.push(
        'Detected oversized root width during import; normalized canvas width using layer bounds to avoid compressed output.',
      )
    }
    if (!hasDeclaredCanvasHeight && contentBounds.height && sourceCanvasHeight > contentBounds.height * CANVAS_AUTO_SCALE_RATIO_THRESHOLD) {
      sourceCanvasHeight = Math.max(contentBounds.height, DEFAULT_CANVAS_HEIGHT)
      warnings.push(
        'Detected oversized root height during import; normalized canvas height using layer bounds to avoid compressed output.',
      )
    }

    if (absoluteNodes.length === 0) {
      if (flowNodes.length > 0) {
        warnings.push('No absolutely positioned elements found; imported flow-layout nodes using computed bounds.')
      } else {
        warnings.push('No absolutely positioned elements found; imported top-level nodes as fallback.')
      }
    }
    if (sourceCanvasWidth !== DEFAULT_CANVAS_WIDTH || sourceCanvasHeight !== DEFAULT_CANVAS_HEIGHT) {
      warnings.push(
        'Detected source canvas ' +
        sourceCanvasWidth +
        'x' +
        sourceCanvasHeight +
        ' (canonical coordinates preserved).',
      )
    }
    if (importMode === 'fallback' && nodes.length > 0) {
      warnings.push(`Imported ${nodes.length} fallback node${nodes.length === 1 ? '' : 's'} as locked layers for visual fidelity.`)
    }
    if (importMode === 'root-fallback') {
      warnings.push('No importable child layers were detected; imported the slide root as a locked fallback layer.')
    }

    // In absolute mode, split text nested inside a positioned container into its own
    // text-box layers (each keeps its font/size/color) instead of collapsing the whole
    // container into one uniform text blob. The container is then imported as a
    // background/shape layer with the extracted text removed.
    const strippedIdsByContainer = new Map<string, Set<string>>()
    let nodesForBuild = nodes
    if (importMode === 'absolute') {
      const absoluteIdSet = new Set(absoluteNodes.map((entry) => entry.getAttribute('data-import-node-id') || ''))
      const extraNodes: HTMLElement[] = []
      const seenExtra = new Set<string>()
      for (const container of absoluteNodes) {
        const containerId = container.getAttribute('data-import-node-id') || ''
        const leaves = collectNestedTextLeaves(container, absoluteIdSet, renderSnapshot, root)
        const stripSet = new Set<string>()
        for (const leaf of leaves) {
          const leafId = leaf.getAttribute('data-import-node-id') || ''
          if (!leafId || seenExtra.has(leafId)) continue
          seenExtra.add(leafId)
          stripSet.add(leafId)
          extraNodes.push(leaf)
        }
        // Strip nested positioned descendants: each becomes its own component, so
        // leaving it inside this container's content would render its text twice.
        for (const descendant of Array.from(container.querySelectorAll<HTMLElement>('[data-import-node-id]'))) {
          const descId = descendant.getAttribute('data-import-node-id') || ''
          if (descId && descId !== containerId && absoluteIdSet.has(descId)) stripSet.add(descId)
        }
        if (stripSet.size > 0) strippedIdsByContainer.set(containerId, stripSet)
      }
      if (extraNodes.length > 0) {
        const orderIndex = new Map(allNodes.map((entry, i) => [entry, i] as const))
        nodesForBuild = [...absoluteNodes, ...extraNodes].sort(
          (a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0),
        )
        warnings.push(
          'Split ' + extraNodes.length + ' nested text element' + (extraNodes.length === 1 ? '' : 's') + ' into separate editable text layers.',
        )
      }
    }

    const components: SlideComponent[] = []
    for (let index = 0; index < nodesForBuild.length; index += 1) {
      const node = nodesForBuild[index]
      const styleMap = parseInlineStyle(node.getAttribute('style') || '')
      const nodeLabel = getNodeLabel(node)
      const nodeId = node.getAttribute('data-import-node-id') || ''
      const renderNode = renderSnapshot.nodesById.get(nodeId) || node
      const renderRoot = renderSnapshot.root || root
      const computedStyle = readComputedStyleSafe(renderNode)
      const measured = measureNodeRect(renderNode, renderRoot)
      const sanitizedNode = buildSanitizedContentNode(renderNode)
      const stripSet = strippedIdsByContainer.get(nodeId)
      if (stripSet) {
        for (const stripId of stripSet) {
          sanitizedNode.querySelectorAll('[data-import-node-id="' + stripId + '"]').forEach((el) => el.remove())
        }
      }
      const isSvg = node.tagName.toLowerCase() === 'svg'
      const content = isSvg
        ? resolveSvgImageFallback(sanitizedNode, nodeLabel, warnings)
        : stripSet
          ? sanitizedNode.innerHTML.trim()
          : (sanitizedNode.innerHTML.trim() || sanitizedNode.outerHTML.trim())

      const explicitLeft = parseStylePositionPx(styleMap, 'left', nodeLabel, warnings, sourceCanvasWidth)
      const explicitTop = parseStylePositionPx(styleMap, 'top', nodeLabel, warnings, sourceCanvasHeight)
      const explicitMarginLeft = parseStyleOffsetPx(styleMap, 'margin-left', nodeLabel, warnings, sourceCanvasWidth)
      const explicitMarginTop = parseStyleOffsetPx(styleMap, 'margin-top', nodeLabel, warnings, sourceCanvasHeight)
      const computedLeft = parseComputedPositionPx(computedStyle?.left, 'left', nodeLabel, warnings, sourceCanvasWidth)
      const computedTop = parseComputedPositionPx(computedStyle?.top, 'top', nodeLabel, warnings, sourceCanvasHeight)
      const computedMarginLeft = parseStyleOffsetPx({ 'margin-left': computedStyle?.marginLeft || '' }, 'margin-left', nodeLabel, warnings, sourceCanvasWidth)
      const computedMarginTop = parseStyleOffsetPx({ 'margin-top': computedStyle?.marginTop || '' }, 'margin-top', nodeLabel, warnings, sourceCanvasHeight)
      const transformOffsets = parseTransformOffsets(styleMap.transform, nodeLabel, warnings)
      const layoutX = Number.isFinite(renderNode.offsetLeft) ? renderNode.offsetLeft : undefined
      const layoutY = Number.isFinite(renderNode.offsetTop) ? renderNode.offsetTop : undefined
      const measuredX = typeof measured.x === 'number' && Number.isFinite(measured.x) ? measured.x : undefined
      const measuredY = typeof measured.y === 'number' && Number.isFinite(measured.y) ? measured.y : undefined
      const measuredOrLayoutX = measuredX !== undefined
        ? ((measuredX === 0 && layoutX !== undefined && layoutX > 0) ? layoutX : measuredX)
        : layoutX
      const measuredOrLayoutY = measuredY !== undefined
        ? ((measuredY === 0 && layoutY !== undefined && layoutY > 0) ? layoutY : measuredY)
        : layoutY
      const hasNestedRenderParent = Boolean(
        renderRoot &&
        renderNode.parentElement &&
        renderNode.parentElement !== renderRoot &&
        renderRoot.contains(renderNode.parentElement),
      )
      const preferredMeasuredX = hasNestedRenderParent ? measuredOrLayoutX : undefined
      const preferredMeasuredY = hasNestedRenderParent ? measuredOrLayoutY : undefined
      const baseX = preferredMeasuredX ?? explicitLeft ?? explicitMarginLeft ?? computedLeft ?? computedMarginLeft ?? measuredOrLayoutX ?? 0
      const baseY = preferredMeasuredY ?? explicitTop ?? explicitMarginTop ?? computedTop ?? computedMarginTop ?? measuredOrLayoutY ?? 0
      const baseXUsesMeasuredRect = preferredMeasuredX !== undefined || (
        explicitLeft === undefined &&
        explicitMarginLeft === undefined &&
        computedLeft === undefined &&
        computedMarginLeft === undefined &&
        measuredOrLayoutX !== undefined
      )
      const baseYUsesMeasuredRect = preferredMeasuredY !== undefined || (
        explicitTop === undefined &&
        explicitMarginTop === undefined &&
        computedTop === undefined &&
        computedMarginTop === undefined &&
        measuredOrLayoutY !== undefined
      )
      const transformX = baseXUsesMeasuredRect && measuredX !== undefined ? 0 : transformOffsets.x
      const transformY = baseYUsesMeasuredRect && measuredY !== undefined ? 0 : transformOffsets.y
      const baseWidth = measured.width
        ?? parseStylePx(styleMap, 'width', nodeLabel, warnings)
        ?? parseAttrPx(node.getAttribute('width'), 'width', nodeLabel, warnings)
        ?? 320
      const baseHeight = measured.height
        ?? parseStylePx(styleMap, 'height', nodeLabel, warnings)
        ?? parseAttrPx(node.getAttribute('height'), 'height', nodeLabel, warnings)

      const extractedStyle = extractStyle(styleMap, computedStyle, warnings, nodeLabel)
      const fallbackLocked = importMode === 'fallback' || importMode === 'root-fallback'
      const nodeComponents: SlideComponent[] = []
      const pseudoForHost = pseudoByHost.get(nodeId)
      if (pseudoForHost) {
        nodeComponents.push(
          ...pseudoForHost.map((entry, pseudoIndex) => ({
            ...entry,
            id: `import-${String(index + 1).padStart(3, '0')}-${pseudoIndex + 1}-${entry.sourceLabel?.replace(/[^a-z0-9-]/gi, '-') || 'pseudo'}`,
          })),
        )
      }
      nodeComponents.push({
        id: 'import-' + String(index + 1).padStart(3, '0'),
        type: inferType(node),
        sourceLabel: fallbackLocked ? `${nodeLabel} (fallback)` : nodeLabel,
        x: asCanonicalDimension(baseX + transformX),
        y: asCanonicalDimension(baseY + transformY),
        width: asCanonicalDimension(baseWidth),
        height: asCanonicalDimensionOptional(baseHeight),
        content,
        style: extractedStyle,
        locked: fallbackLocked,
        visible: true,
      })
      components.push(...nodeComponents)
    }

    let canvas = {
      width: sourceCanvasWidth,
      height: sourceCanvasHeight,
      ...(canvasBackground ? { background: canvasBackground } : {}),
    }
    const normalized = normalizeCanvasToContentBounds(components, canvas, warnings)
    canvas = normalized.canvas
    const normalizedComponents = normalized.components
    const uniqueWarnings = Array.from(new Set(warnings))
    return {
      document: createSlideDocument({
        canvas,
        components: normalizedComponents,
        warnings: uniqueWarnings,
      }),
      canvas,
      components: normalizedComponents,
      warnings: uniqueWarnings,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'import_parse_failed')
    return buildFallbackImportResult(message)
  } finally {
    renderSnapshot.dispose()
  }
}
