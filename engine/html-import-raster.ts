import type { SlideComponent } from './types'
import type { RasterCandidates, RenderSnapshot } from './html-import-shared'
import { fetchLimited, parseRuleDeclarations } from './html-import-css'
import { hasOwnTextNode, isVisibleEl, measureNodeRect, readComputedStyleSafe } from './html-import-render'
import { extractStyle, hasRenderedBorder } from './html-import-values'
import { asCanonicalDimension, asCanonicalDimensionOptional } from './html-import-position'
import { escapeHtmlText, getNodeLabel } from './html-import-markup'

const XHTML_NS = 'http://www.w3.org/1999/xhtml'

function loadImageFromUrl(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return }
    let settled = false
    let timer: number | undefined
    const done = (v: HTMLImageElement | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(v)
    }
    const img = new Image()
    img.onload = () => done(img)
    img.onerror = () => done(null)
    // Never hang the import if the image never fires load/error.
    timer = window.setTimeout(() => done(null), 8000)
    img.src = url
  })
}

// Draw a loaded SVG data URL onto a scaled canvas and return a PNG data URI.
async function drawSvgToPng(svgUrl: string, w: number, h: number, scale: number): Promise<string | null> {
  const img = await loadImageFromUrl(svgUrl)
  if (!img) return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)
  try { return canvas.toDataURL('image/png') } catch { return null }
}

// PowerPoint cannot embed a plain SVG, so turn each SVG image into a PNG at the component's size.
export async function rasterizeSvgComponents(components: SlideComponent[], warnings: string[]): Promise<void> {
  const svgImg = /(<img\b[^>]*?\bsrc\s*=\s*)(?:"(data:image\/svg\+xml[^"]*)"|'(data:image\/svg\+xml[^']*)')/gi
  for (const component of components) {
    const content = component.content || ''
    const matches = Array.from(content.matchAll(svgImg))
    if (matches.length === 0) continue
    const w = Math.max(1, Math.round(component.width || 0))
    const h = Math.max(1, Math.round(component.height || component.width || 0))
    // Convert every SVG image of the component, in order, and keep the original for any that fails.
    const pngs: Array<string | null> = []
    for (const match of matches) {
      const unescaped = (match[2] ?? match[3]).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      let markup = unescaped.slice(unescaped.indexOf(',') + 1)
      try { markup = decodeURIComponent(markup) } catch { /* already plain text */ }
      const img = await loadImageFromUrl('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup))
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      let png: string | null = null
      if (img && ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        try { png = canvas.toDataURL('image/png') } catch { png = null }
      }
      if (!png) warnings.push('Component ' + component.id + ' SVG image could not be converted to a picture and was left as an SVG.')
      pngs.push(png)
    }
    let next = 0
    component.content = content.replace(svgImg, (whole, head: string) => {
      const png = pngs[next]
      next += 1
      return png ? head + '"' + png + '"' : whole
    })
  }
}

function svgDataUrlFromSerializedXhtml(inner: string, w: number, h: number): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
    '<foreignObject width="100%" height="100%">' + inner + '</foreignObject></svg>'
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function isGradientTextElement(el: HTMLElement, win: Window): boolean {
  const cs = win.getComputedStyle(el)
  const clip = ((cs as unknown as Record<string, string>).webkitBackgroundClip || cs.backgroundClip || '')
  return /gradient/i.test(cs.backgroundImage || '') && /text/i.test(clip)
}

function isMeaningfulBackground(cs: CSSStyleDeclaration): boolean {
  const bg = cs.backgroundColor || ''
  if (!bg || bg === 'transparent') return false
  const m = bg.match(/rgba?\(([^)]+)\)/i)
  if (m) {
    const parts = m[1].split(',').map((v) => v.trim())
    if (parts.length === 4 && parseFloat(parts[3]) === 0) return false
  }
  return true
}

// Render an element out of context with all computed styles inlined. This path honors
// -webkit-background-clip:text (the in-context whole-slide render does not). For a
// single-line run we force nowrap (cloning out of context can sub-pixel-reflow it);
// for a run that already wraps to multiple lines we keep the source width so it wraps
// identically (nowrap would collapse it to one line and the exporter would crush it).
async function rasterizeElementInline(el: HTMLElement, win: Window, scale: number): Promise<string | null> {
  const rect = el.getBoundingClientRect()
  const cs0 = win.getComputedStyle(el)
  const fontPx = parseFloat(cs0.fontSize || '16') || 16
  const singleLine = rect.height <= fontPx * 1.6
  const w = Math.max(1, Math.ceil(rect.width) + (singleLine ? 8 : 2))
  const h = Math.max(1, Math.ceil(rect.height) + 4)
  const clone = el.cloneNode(true) as HTMLElement
  const srcNodes: HTMLElement[] = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))]
  const clNodes: HTMLElement[] = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]
  for (let i = 0; i < srcNodes.length; i += 1) {
    const cs = win.getComputedStyle(srcNodes[i])
    let css = ''
    for (let j = 0; j < cs.length; j += 1) css += cs[j] + ':' + cs.getPropertyValue(cs[j]) + ';'
    clNodes[i].setAttribute('style', css)
  }
  clone.style.margin = '0'
  clone.style.position = 'static'
  clone.style.inset = 'auto'
  if (singleLine) clone.style.whiteSpace = 'nowrap'
  const wrapWs = singleLine ? 'white-space:nowrap;' : ''
  const wrap = document.createElementNS(XHTML_NS, 'div') as unknown as HTMLElement
  wrap.setAttribute('style', 'width:' + w + 'px;height:' + h + 'px;overflow:visible;' + wrapWs)
  wrap.appendChild(clone)
  const inner = new XMLSerializer().serializeToString(wrap)
  return await drawSvgToPng(svgDataUrlFromSerializedXhtml(inner, w, h), w, h, scale)
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

async function inlineRemoteImages(root: HTMLElement): Promise<void> {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async (img) => {
    const src = img.getAttribute('src') || ''
    if (!/^https?:/i.test(src)) return
    const data = await fetchAsDataUrl(src)
    if (data) img.setAttribute('src', data)
  }))
}

async function inlineRemoteFonts(cssText: string): Promise<string> {
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

// Render the whole slide in context (keeps the page <style>, so boxes/meters/gradients
// lay out exactly as designed) with every text glyph stripped, producing the flat art
// layer. Returns a full-canvas PNG data URI, or null if the render fails.
async function rasterizeArtLayer(
  renderRoot: HTMLElement,
  win: Window,
  w: number,
  h: number,
  scale: number,
): Promise<string | null> {
  remoteAssetCache.clear()
  const sdoc = renderRoot.ownerDocument
  if (!sdoc) return null
  const clone = renderRoot.cloneNode(true) as HTMLElement
  const walker = sdoc.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
  const textNodes: Node[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode)
  textNodes.forEach((t) => { t.nodeValue = '' })
  const bodyCs = win.getComputedStyle(renderRoot)
  let bodyCss = ''
  for (let j = 0; j < bodyCs.length; j += 1) bodyCss += bodyCs[j] + ':' + bodyCs.getPropertyValue(bodyCs[j]) + ';'
  const wrap = document.createElementNS(XHTML_NS, 'div') as unknown as HTMLElement
  wrap.setAttribute('style', bodyCss + 'width:' + w + 'px;height:' + h + 'px;margin:0;position:relative;overflow:hidden;')
  for (const st of Array.from(sdoc.querySelectorAll('style'))) {
    const styleClone = st.cloneNode(true) as HTMLStyleElement
    styleClone.textContent = await inlineRemoteFonts(styleClone.textContent || '')
    wrap.appendChild(styleClone)
  }
  await inlineRemoteImages(clone)
  for (const ch of Array.from(clone.childNodes)) wrap.appendChild(ch)
  const inner = new XMLSerializer().serializeToString(wrap)
  return await drawSvgToPng(svgDataUrlFromSerializedXhtml(inner, w, h), w, h, scale)
}

// Rasterize only genuinely rich designed graphics: gradient fills, gradient text, or two or
// more decorative boxes. Returns null for a simple text-on-solid slide, which keeps native shapes.
function findRasterCandidates(renderRoot: HTMLElement, win: Window): RasterCandidates | null {
  // Ignore hidden elements everywhere (mirrors the native path's visibility filtering)
  // so hidden source text/decoration never leaks into the output.
  const allEls = Array.from(renderRoot.querySelectorAll<HTMLElement>('*')).filter((el) => isVisibleEl(el, win))
  const gradientTextEls = allEls
    .filter((el) => isGradientTextElement(el, win))
    .filter((el, _i, arr) => !arr.some((other) => other !== el && other.contains(el)))
  const gradientSet = new Set(gradientTextEls)
  const hasGradientFill = allEls.some((el) => /gradient/i.test(win.getComputedStyle(el).backgroundImage || ''))
  // A "visual box" is a non-text decorative element (card, bar, line, dot, meter):
  // has a fill/border/shadow/gradient and carries no text of its own. Two or more of
  // these signal a designed graphic (an infographic), even when the boxes are empty.
  const visualBoxes = allEls.filter((el) => {
    if (gradientSet.has(el) || hasOwnTextNode(el)) return false
    const cs = win.getComputedStyle(el)
    const shadow = (cs.boxShadow || '').trim()
    const filter = (cs.filter || '').trim()
    return isMeaningfulBackground(cs) || hasRenderedBorder(cs) || /gradient/i.test(cs.backgroundImage || '') ||
      (shadow && shadow !== 'none') || /drop-shadow/i.test(filter)
  })
  if (!hasGradientFill && gradientTextEls.length === 0 && visualBoxes.length < 2) return null
  return { allEls, gradientTextEls, gradientSet }
}

// Text of an element excluding any gradient-text descendant (those become their own
// image). Inline emphasis (<strong>/<em>/<span>) stays part of the run.
function plainTextOf(el: HTMLElement, gradientSet: Set<HTMLElement>): string {
  let text = ''
  const walker = (el.ownerDocument || document).createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const win = el.ownerDocument?.defaultView
  while (walker.nextNode()) {
    let p = walker.currentNode.parentElement
    let skip = false
    while (p && p !== el) {
      // A gradient-text descendant becomes its own image, and a hidden descendant adds no text.
      if (gradientSet.has(p) || (win && !isVisibleEl(p, win))) { skip = true; break }
      p = p.parentElement
    }
    if (!skip) text += walker.currentNode.textContent
  }
  return text.replace(/\s+/g, ' ').trim()
}

// A plain-text run is the OUTERMOST non-gradient element that carries text: it must
// have its own text, not be (or sit inside) a gradient-text element, and have no
// ancestor that also carries its own text, otherwise a child with text (e.g. a
// <strong> inside a heading) would emit a second overlapping box with duplicate words.
function selectPlainTextEls(renderRoot: HTMLElement, candidates: RasterCandidates): HTMLElement[] {
  const { allEls, gradientTextEls, gradientSet } = candidates
  const hasTextBearingAncestor = (el: HTMLElement): boolean => {
    let p = el.parentElement
    while (p && p !== renderRoot) {
      if (!gradientSet.has(p) && hasOwnTextNode(p)) return true
      p = p.parentElement
    }
    return false
  }
  return allEls.filter(
    (el) => hasOwnTextNode(el) && !gradientSet.has(el) &&
      !gradientTextEls.some((g) => g !== el && g.contains(el)) && !hasTextBearingAncestor(el),
  )
}

function measuredBox(el: HTMLElement, measureRoot: HTMLElement) {
  const measured = measureNodeRect(el, measureRoot)
  return {
    x: asCanonicalDimension(measured.x ?? 0),
    y: asCanonicalDimension(measured.y ?? 0),
    width: asCanonicalDimension(measured.width ?? 0),
    height: asCanonicalDimensionOptional(measured.height ?? 0),
  }
}

function buildTextBoxComponent(
  el: HTMLElement,
  id: string,
  gradientSet: Set<HTMLElement>,
  measureRoot: HTMLElement,
  warnings: string[],
): SlideComponent | null {
  const text = plainTextOf(el, gradientSet)
  if (!text) return null
  return {
    id,
    type: 'text',
    sourceLabel: getNodeLabel(el),
    ...measuredBox(el, measureRoot),
    content: escapeHtmlText(text),
    style: extractStyle(parseRuleDeclarations(el.getAttribute('style') || ''), readComputedStyleSafe(el), warnings, getNodeLabel(el)),
    locked: false,
    visible: true,
  }
}

export async function buildRasterizedSlide(
  renderSnapshot: RenderSnapshot,
  root: HTMLElement,
  canvasWidth: number,
  canvasHeight: number,
  warnings: string[],
): Promise<SlideComponent[] | null> {
  const renderRoot = renderSnapshot.root
  const win = renderRoot?.ownerDocument?.defaultView
  if (!renderRoot || !win || typeof document === 'undefined') return null

  const candidates = findRasterCandidates(renderRoot, win)
  if (!candidates) return null
  const { gradientTextEls, gradientSet } = candidates

  const artUri = await rasterizeArtLayer(renderRoot, win, canvasWidth, canvasHeight, 2)
  if (!artUri) return null // never emit a partial/broken result; fall back to native

  const plainEls = selectPlainTextEls(renderRoot, candidates)
  const components: SlideComponent[] = []
  const measureRoot = renderSnapshot.root || root
  const emitTextBox = (el: HTMLElement, idPrefix: string, seq: number): boolean => {
    const box = buildTextBoxComponent(el, idPrefix + seq, gradientSet, measureRoot, warnings)
    if (!box) return false
    components.push(box)
    return true
  }
  components.push({
    id: 'raster-art',
    type: 'panel',
    sourceLabel: 'artwork',
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    content: '<img src="' + artUri + '" />',
    style: {},
    locked: true,
    visible: true,
  })

  let gradSeq = 0
  let gradTextSeq = 0
  for (const g of gradientTextEls) {
    const uri = await rasterizeElementInline(g, win, 2)
    if (!uri) {
      // Never silently drop a run: if its image failed, keep the words as an editable
      // text box (loses the gradient look, but the content survives).
      if (emitTextBox(g, 'raster-gradtext-', gradTextSeq + 1)) gradTextSeq += 1
      continue
    }
    gradSeq += 1
    components.push({
      id: 'raster-grad-' + gradSeq,
      type: 'logo',
      sourceLabel: (getNodeLabel(g) || 'gradient text'),
      ...measuredBox(g, measureRoot),
      content: '<img src="' + uri + '" />',
      style: {},
      locked: false,
      visible: true,
    })
  }

  let textSeq = 0
  for (const el of plainEls) {
    if (emitTextBox(el, 'raster-text-', textSeq + 1)) textSeq += 1
  }

  warnings.push(
    'Rich graphic: flattened background and shapes into 1 artwork layer' +
    (gradSeq > 0 ? ', ' + gradSeq + ' gradient-text image' + (gradSeq === 1 ? '' : 's') : '') +
    ', ' + (textSeq + gradTextSeq) + ' editable text box' + (textSeq + gradTextSeq === 1 ? '' : 'es') + '.',
  )
  if (gradTextSeq > 0) warnings.push(gradTextSeq + ' gradient-text run(s) could not be rasterized and were kept as plain editable text.')
  warnings.push('Rasterized layers use the fonts available at import; upload/inline the original fonts for exact type.')
  return components
}
