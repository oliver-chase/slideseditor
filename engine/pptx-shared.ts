export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

export const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main'

export const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'

export const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

export const SLIDE_WIDTH_EMU = 9_144_000

export const SLIDE_HEIGHT_EMU = 5_143_500

// CSS reference pixel at 96dpi: 1px = 9525 EMU. Sizing the slide this way keeps the
// geometry scale and the font scale (1px = 0.75pt) consistent BY CONSTRUCTION — a
// 28px heading in a 1920px canvas exports as a 21pt run in a 20in slide, exactly the
// proportion the browser rendered.
export const EMU_PER_PX = 9525

// PowerPoint's hard ceiling is 56in per axis (51,206,400 EMU).
const MAX_SLIDE_AXIS_EMU = 51_206_400

// PowerPoint's smallest slide side is 1in (914,400 EMU).
const MIN_SLIDE_AXIS_EMU = 914_400

export interface SlideEmu {
  w: number
  h: number
  emuPerPx: number
}

// Map the canvas to the slide at true 96dpi (1px = 9525 EMU), shrinking the scale
// uniformly only if a huge canvas would exceed PowerPoint's 56in axis limit, and growing it
// if the short side would fall under PowerPoint's 1in minimum. The aspect ratio is always preserved.
export function computeSlideEmu(canvasWidth: number, canvasHeight: number): SlideEmu {
  const w = Math.max(1, canvasWidth || 1920)
  const h = Math.max(1, canvasHeight || 1080)
  const fitted = Math.min(EMU_PER_PX, MAX_SLIDE_AXIS_EMU / Math.max(w, h))
  const emuPerPx = Math.max(fitted, MIN_SLIDE_AXIS_EMU / Math.min(w, h))
  return { w: Math.round(w * emuPerPx), h: Math.round(h * emuPerPx), emuPerPx }
}

export function escXml(value: string): string {
  return value
    // XML 1.0 forbids control characters other than tab, line feed and carriage return.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function codePointText(codePoint: number): string {
  // A surrogate half is not a character, and XML cannot hold one.
  const isSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff
  return codePoint > 0 && codePoint <= 0x10ffff && !isSurrogate ? String.fromCodePoint(codePoint) : ''
}

// One pass over the references, so "&#38;amp;" decodes once to "&amp;" and not twice to "&".
const NAMED_REFERENCES: Record<string, string> = {
  nbsp: '\u00a0', lt: '<', gt: '>', quot: '"', apos: "'", amp: '&',
  copy: '\u00a9', reg: '\u00ae', trade: '\u2122', deg: '\u00b0', times: '\u00d7', middot: '\u00b7',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026', bull: '\u2022',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  laquo: '\u00ab', raquo: '\u00bb', euro: '\u20ac', pound: '\u00a3', yen: '\u00a5', cent: '\u00a2',
  larr: '\u2190', rarr: '\u2192', uarr: '\u2191', darr: '\u2193',
}

function decodeReferences(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ref: string) => {
    if (ref[0] === '#') {
      const hex = ref[1] === 'x' || ref[1] === 'X'
      return codePointText(Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10))
    }
    const name = ref.toLowerCase()
    return Object.prototype.hasOwnProperty.call(NAMED_REFERENCES, name) ? NAMED_REFERENCES[name] : match
  })
}

export function toPlainText(html: string): string {
  // A newline in the source is a space when rendered, so only br and the end of a p or div break a line.
  const withLineBreaks = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[ \t\r\n\f]+/g, ' ')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/(?:div|h[1-6]|li|tr|section|article|ul|ol|blockquote)>/gi, '\n')
  const noTags = withLineBreaks.replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, '')
  return decodeReferences(noTags)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
}

export function toEmu(px: number, scale: number): number {
  return Math.max(0, Math.round(px * scale))
}

// A position may be negative when the source places an element past the slide edge.
export function toEmuOffset(px: number, scale: number): number {
  return Math.round(px * scale)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export interface TextRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  color?: string
}

interface RunStyle {
  bold: boolean
  italic: boolean
  underline: boolean
  color?: string
}

// Elements with no closing tag. They carry no text, so they never change the style of what follows.
const VOID_TAGS = new Set(['img', 'input', 'hr', 'wbr', 'area', 'base', 'col', 'embed', 'link', 'meta', 'source', 'track'])

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'section', 'article', 'ul', 'ol', 'blockquote'])

function styleOfTag(tag: string, attributes: string, inherited: RunStyle): RunStyle {
  const next = { ...inherited }
  if (tag === 'b' || tag === 'strong') next.bold = true
  if (tag === 'i' || tag === 'em') next.italic = true
  if (tag === 'u') next.underline = true
  const colorAttr = attributes.match(/\bcolor\s*=\s*["']([^"']+)["']/i)
  if (tag === 'font' && colorAttr) next.color = colorAttr[1]
  const style = attributes.match(/(?:^|\s)style\s*=\s*"([^"]*)"|(?:^|\s)style\s*=\s*'([^']*)'/i)
  const declarations = style ? (style[1] ?? style[2]) : ''
  for (const declaration of declarations.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon < 0) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const value = declaration.slice(colon + 1).trim().toLowerCase()
    if (property === 'font-weight') next.bold = value === 'bold' || value === 'bolder' || Number.parseInt(value, 10) >= 600
    else if (property === 'font-style') next.italic = value === 'italic' || value === 'oblique'
    else if (property === 'text-decoration' || property === 'text-decoration-line') next.underline = /underline/.test(value)
    else if (property === 'color' && value) next.color = declaration.slice(colon + 1).trim()
  }
  return next
}

// Split inline HTML into lines of runs that carry bold, italic, underline and color. Line breaks follow
// toPlainText: a br and the end of a p or div start a new line.
export function toTextLines(rawHtml: string): TextRun[][] {
  const html = rawHtml.replace(/<!--[\s\S]*?-->/g, '').replace(/[ \t\r\n\f]+/g, ' ')
  const lines: TextRun[][] = [[]]
  const stack: Array<{ tag: string; style: RunStyle }> = []
  let current: RunStyle = { bold: false, italic: false, underline: false }
  const pushText = (raw: string): void => {
    const text = decodeReferences(raw).replace(/\r\n?/g, '\n')
    const parts = text.split('\n')
    parts.forEach((part, index) => {
      if (index > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ text: part, ...current })
    })
  }
  const tagPattern = /<(\/?)([a-z][a-z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi
  let last = 0
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(html)) !== null) {
    pushText(html.slice(last, match.index))
    last = match.index + match[0].length
    const closing = match[1] === '/'
    const tag = match[2].toLowerCase()
    if (tag === 'br') { if (!closing) lines.push([]); continue }
    if (closing) {
      const at = stack.map((entry) => entry.tag).lastIndexOf(tag)
      if (at >= 0) {
        stack.length = at
        current = stack.length > 0 ? stack[stack.length - 1].style : { bold: false, italic: false, underline: false }
      }
      // The end of a block starts a new line, unless the line is still empty.
      if (BLOCK_TAGS.has(tag) && lines[lines.length - 1].length > 0) lines.push([])
      continue
    }
    // A block also starts on a new line when text came before it.
    if (BLOCK_TAGS.has(tag) && lines[lines.length - 1].length > 0) lines.push([])
    if (/\/\s*$/.test(match[3]) || VOID_TAGS.has(tag)) continue
    current = styleOfTag(tag, match[3], current)
    stack.push({ tag, style: current })
  }
  pushText(html.slice(last))
  // Same trimming as toPlainText: no leading or trailing blank lines or spaces.
  while (lines.length > 0 && lines[0].every((run) => !run.text.trim())) lines.shift()
  while (lines.length > 0 && lines[lines.length - 1].every((run) => !run.text.trim())) lines.pop()
  if (lines.length > 0) {
    const first = lines[0]
    if (first.length > 0) first[0] = { ...first[0], text: first[0].text.replace(/^\s+/, '') }
    const lastLine = lines[lines.length - 1]
    if (lastLine.length > 0) lastLine[lastLine.length - 1] = { ...lastLine[lastLine.length - 1], text: lastLine[lastLine.length - 1].text.replace(/\s+$/, '') }
  }
  return lines
}
