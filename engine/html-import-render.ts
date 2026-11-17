import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH, IMPORT_ROOT_MARKER_ATTR, IMPORT_ROOT_MARKER_VALUE } from './html-import-shared'
import type { InlinedStyleChunk, MeasuredNodeRect, RenderSnapshot } from './html-import-shared'

export function normalizeImportedHtmlMarkup(html: string, warnings: string[]): string {
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

  const timeoutMs = 1500
  let timer: number | undefined
  const timeout = new Promise<void>((_resolve, reject) => {
    timer = window.setTimeout(() => reject(new Error(`Timeout waiting for import render settle after ${timeoutMs}ms.`)), timeoutMs)
  })
  try {
    await Promise.race([Promise.all(pending), timeout])
  } catch {
    // Best-effort render settling for import fidelity.
  } finally {
    window.clearTimeout(timer)
  }
}

export function readComputedStyleSafe(node: HTMLElement): CSSStyleDeclaration | null {
  const styleWindow = node.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null)
  if (!styleWindow || typeof styleWindow.getComputedStyle !== 'function') return null
  try {
    return styleWindow.getComputedStyle(node)
  } catch {
    return null
  }
}

export function measureNodeRect(node: HTMLElement, root: HTMLElement): MeasuredNodeRect {
  if (typeof node.getBoundingClientRect !== 'function' || typeof root.getBoundingClientRect !== 'function') {
    return {}
  }

  const rect = node.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  if (!Number.isFinite(rect.left) || !Number.isFinite(rootRect.left)) return {}

  return {
    x: rect.left - rootRect.left,
    y: rect.top - rootRect.top,
    width: Number.isFinite(rect.width) && rect.width > 0 ? rect.width : undefined,
    height: Number.isFinite(rect.height) && rect.height > 0 ? rect.height : undefined,
  }
}

function emptyRenderSnapshot(): RenderSnapshot {
  return { root: null, nodesById: new Map(), dispose: () => {} }
}

// An invisible, script-less iframe that lays the slide out at the default canvas size for measuring.
function createHiddenRenderFrame(): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.style.position = 'fixed'
  iframe.style.left = '-100000px'
  iframe.style.top = '-100000px'
  iframe.style.width = DEFAULT_CANVAS_WIDTH + 'px'
  iframe.style.height = DEFAULT_CANVAS_HEIGHT + 'px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.zIndex = '-1'
  iframe.style.overflow = 'hidden'
  iframe.setAttribute('sandbox', 'allow-same-origin')
  document.body.appendChild(iframe)
  return iframe
}

// Copy the parsed slide into the sandbox body and return the clone of its root.
function cloneSlideIntoSandbox(sandboxBody: HTMLElement, doc: Document, root: HTMLElement): HTMLElement {
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
  return rootClone
}

function indexNodesById(sandboxDoc: Document): Map<string, HTMLElement> {
  const nodesById = new Map<string, HTMLElement>()
  for (const node of Array.from(sandboxDoc.querySelectorAll<HTMLElement>('[data-import-node-id]'))) {
    const id = node.getAttribute('data-import-node-id')
    if (!id) continue
    nodesById.set(id, node)
  }
  return nodesById
}

// Lay the slide out inside the frame. Returns null when the frame has no document or body to use.
async function fillRenderFrame(
  iframe: HTMLIFrameElement,
  doc: Document,
  root: HTMLElement,
  styleChunks: InlinedStyleChunk[],
): Promise<RenderSnapshot | null> {
  const sandboxDoc = iframe.contentDocument
  if (!sandboxDoc) return null

  sandboxDoc.open()
  sandboxDoc.write('<!doctype html><html><head></head><body></body></html>')
  sandboxDoc.close()

  const sandboxBody = sandboxDoc.body
  if (!sandboxBody) return null

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

  const rootClone = cloneSlideIntoSandbox(sandboxBody, doc, root)
  await settleRenderSnapshot(sandboxDoc)

  return {
    root: rootClone,
    nodesById: indexNodesById(sandboxDoc),
    dispose: () => {
      iframe.remove()
    },
  }
}

export async function buildRenderSnapshot(doc: Document, root: HTMLElement, styleChunks: InlinedStyleChunk[]): Promise<RenderSnapshot> {
  if (typeof document === 'undefined' || !document.body) return emptyRenderSnapshot()

  const iframe = createHiddenRenderFrame()
  try {
    const snapshot = await fillRenderFrame(iframe, doc, root, styleChunks)
    if (snapshot) return snapshot
  } catch (error) {
    // A failed layout must not leave its offscreen frame in the page.
    iframe.remove()
    throw error
  }
  iframe.remove()
  return emptyRenderSnapshot()
}

export function hasOwnTextNode(node: HTMLElement): boolean {
  return Array.from(node.childNodes).some((child) => child.nodeType === 3 && Boolean(child.textContent?.trim()))
}

export function isVisibleEl(el: HTMLElement, win: Window): boolean {
  const cs = win.getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return false
  const op = parseFloat(cs.opacity || '1')
  return !(Number.isFinite(op) && op <= 0.01)
}
