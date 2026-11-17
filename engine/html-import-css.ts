import { CSS_IMPORT_MAX_RECURSION_DEPTH, REMOTE_STYLESHEET_MAX_BYTES } from './html-import-shared'
import type { CssImportResult, InlinedStyleChunk } from './html-import-shared'

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

// Fetch a web address with a timeout and a byte limit. The declared length is checked first, then the body
// is read in pieces and dropped as soon as it passes the limit, so an oversized response is never held whole.
export async function fetchLimited(url: string, maxBytes: number, timeoutMs: number): Promise<{ bytes: Uint8Array; type: string } | null> {
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
    const declaredLength = Number.parseInt(response.headers.get('content-length') || '', 10)
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null
    const pieces: Uint8Array[] = []
    let total = 0
    if (response.body) {
      const reader = response.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) { controller.abort(); return null }
        pieces.push(value)
      }
    } else {
      const whole = new Uint8Array(await response.arrayBuffer())
      if (whole.byteLength > maxBytes) return null
      pieces.push(whole)
      total = whole.byteLength
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const piece of pieces) { bytes.set(piece, offset); offset += piece.byteLength }
    return { bytes, type: response.headers.get('content-type') || '' }
  } catch {
    return null
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 1500): Promise<string | null> {
  const result = await fetchLimited(url, REMOTE_STYLESHEET_MAX_BYTES, timeoutMs)
  return result ? new TextDecoder().decode(result.bytes) : null
}

function stripCssComments(cssText: string): string {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, (comment) => ' '.repeat(comment.length))
}

export function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function getCssImportUrl(rawUrl: string): string | null {
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
    // Past the depth limit the text is kept as it is, and every @import left in it is unresolved.
    return { cssText, importedCount: 0, unresolvedCount: (cssText.match(/@import/gi) || []).length }
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

function documentBaseUrl(doc: Document): string {
  return doc.baseURI && !doc.baseURI.startsWith('about:') ? doc.baseURI : window.location.href
}

function plural(count: number, noun: string): string {
  return count + ' ' + noun + (count === 1 ? '' : 's')
}

// A <style> block: resolve its @import rules and keep the text.
async function inlineStyleBlock(
  node: Element,
  index: number,
  doc: Document,
  warnings: string[],
): Promise<InlinedStyleChunk | null> {
  const { cssText: inlinedText, importedCount, unresolvedCount } = await parseCssImportUrls(
    node.textContent || '',
    documentBaseUrl(doc),
    warnings,
  )
  const chunk: InlinedStyleChunk | null = inlinedText.trim() ? { cssText: inlinedText, source: 'inline', order: index } : null
  if (importedCount > 0) {
    warnings.push('Inlined ' + plural(importedCount, '@import stylesheet') + ' from inline style.')
  }
  if (unresolvedCount > 0) {
    warnings.push(
      'Could not inline ' + plural(unresolvedCount, 'inline @import stylesheet') + '; source fallback may differ from original.',
    )
  }
  return chunk
}

// A fetched <link> stylesheet: resolve its nested @import rules against the link's own URL.
async function inlineLinkedStylesheet(
  node: Element,
  index: number,
  fetchedText: string,
  doc: Document,
  warnings: string[],
): Promise<InlinedStyleChunk> {
  const linkedBase = node.getAttribute('href')
    ? makeSafeResolvedUrl(node.getAttribute('href') || '', documentBaseUrl(doc))
    || doc.baseURI
    || window.location.href
    : doc.baseURI || window.location.href
  const { cssText: inlinedText, importedCount, unresolvedCount } = await parseCssImportUrls(fetchedText, linkedBase, warnings)
  if (importedCount > 0) {
    warnings.push('Inlined ' + plural(importedCount, 'nested @import stylesheet') + ' from linked stylesheet.')
  }
  const chunk: InlinedStyleChunk = {
    cssText: inlinedText,
    source: 'external',
    order: index,
    linkHref: node.getAttribute('href') || undefined,
  }
  if (unresolvedCount > 0) {
    warnings.push(
      'Could not inline ' + plural(unresolvedCount, 'nested @import stylesheet') + '; nested fallback may differ from source.',
    )
  }
  return chunk
}

export async function inlineExternalStylesheets(doc: Document, warnings: string[]): Promise<InlinedStyleChunk[]> {
  const styleNodes = Array.from(
    doc.querySelectorAll('style,link[rel~="stylesheet"][href]'),
  ) as Array<HTMLStyleElement | HTMLLinkElement>
  if (styleNodes.length === 0) return []

  warnings.push(
    'Detected ' + plural(styleNodes.length, 'style definition block') + '; attempting to inline stylesheet resources for fidelity.',
  )

  const baseUrl = documentBaseUrl(doc)
  const stylesheetNodes = styleNodes.filter(
    (styleNode): styleNode is HTMLLinkElement => styleNode.tagName.toLowerCase() === 'link',
  )
  const linkByNode = new Map<HTMLLinkElement, Promise<string | null>>()
  for (const stylesheet of stylesheetNodes) {
    const href = parseStylesheetHref(stylesheet, baseUrl)
    linkByNode.set(stylesheet, href ? fetchWithTimeout(href) : Promise.resolve(null))
  }
  const fetched = await Promise.allSettled(Array.from(linkByNode.values()))

  const inlinedStyles: InlinedStyleChunk[] = []
  let linkResultCursor = 0
  let unresolvedCount = 0

  for (let index = 0; index < styleNodes.length; index += 1) {
    const node = styleNodes[index]
    if (node.tagName.toLowerCase() === 'style') {
      const block = await inlineStyleBlock(node, index, doc, warnings)
      if (block) inlinedStyles.push(block)
      continue
    }

    const result = fetched[linkResultCursor]
    linkResultCursor += 1
    if (result?.status === 'fulfilled' && result.value) {
      inlinedStyles.push(await inlineLinkedStylesheet(node, index, result.value, doc, warnings))
      continue
    }

    unresolvedCount += 1
  }

  if (unresolvedCount > 0) {
    warnings.push(
      'Could not inline ' + plural(unresolvedCount, 'linked stylesheet') + '; remaining fallback styles may differ from source.',
    )
  }

  return inlinedStyles.sort((a, b) => a.order - b.order)
}

// Split on semicolons that sit outside quotes and parentheses, so url("data:...;base64,...") stays whole.
function splitDeclarations(raw: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (quote) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '(') {
      depth += 1
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1)
    } else if (ch === ';' && depth === 0) {
      parts.push(raw.slice(start, i))
      start = i + 1
    }
  }
  parts.push(raw.slice(start))
  return parts
}

export function parseRuleDeclarations(rawDeclarations: string): Record<string, string> {
  const declarations: Record<string, string> = {}
  const declarationList = splitDeclarations(rawDeclarations)
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

// The artwork is drawn through an SVG image, which cannot load web addresses. Images and fonts that the
// slide names at a web address are fetched first and embedded as data URIs, up to a size limit each.
const REMOTE_ASSET_MAX_BYTES = 5_000_000
const REMOTE_ASSET_TIMEOUT_MS = 4000

// Each address is fetched once per import, with its own timeout and the byte limit.
const remoteAssetCache = new Map<string, Promise<string | null>>()

function fetchAsDataUrl(url: string): Promise<string | null> {
  const cached = remoteAssetCache.get(url)
  if (cached) return cached
  const pending = (async (): Promise<string | null> => {
    const result = await fetchLimited(url, REMOTE_ASSET_MAX_BYTES, REMOTE_ASSET_TIMEOUT_MS)
    if (!result) return null
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(new Blob([result.bytes], { type: result.type }))
    })
  })()
  remoteAssetCache.set(url, pending)
  return pending
}

export async function inlineRemoteImages(root: HTMLElement): Promise<void> {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async (img) => {
    const src = img.getAttribute('src') || ''
    if (!/^https?:/i.test(src)) return
    const data = await fetchAsDataUrl(src)
    if (data) img.setAttribute('src', data)
  }))
}

export async function inlineRemoteFonts(cssText: string): Promise<string> {
  const urls = new Set<string>()
  for (const block of cssText.match(/@font-face\s*\{[^}]*\}/gi) || []) {
    for (const match of block.matchAll(/url\(\s*["']?(https?:[^"')]+)["']?\s*\)/gi)) urls.add(match[1])
  }
  let result = cssText
  for (const url of urls) {
    const data = await fetchAsDataUrl(url)
    if (data) result = result.split(url).join(data)
  }
  return result
}
