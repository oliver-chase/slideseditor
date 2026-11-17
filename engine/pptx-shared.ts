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

export interface SlideEmu {
  w: number
  h: number
  emuPerPx: number
}

// Map the canvas to the slide at true 96dpi (1px = 9525 EMU), shrinking the scale
// uniformly only if a huge canvas would exceed PowerPoint's 56in axis limit. The
// aspect ratio is always preserved exactly.
export function computeSlideEmu(canvasWidth: number, canvasHeight: number): SlideEmu {
  const w = Math.max(1, canvasWidth || 1920)
  const h = Math.max(1, canvasHeight || 1080)
  const emuPerPx = Math.min(EMU_PER_PX, MAX_SLIDE_AXIS_EMU / Math.max(w, h))
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
  return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ''
}

export function toPlainText(html: string): string {
  const withLineBreaks = html
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
  const noTags = withLineBreaks.replace(/<[^>]*>/g, '')
  // One pass over the references, so "&#38;amp;" decodes once to "&amp;" and not twice to "&".
  const NAMED: Record<string, string> = { nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }
  return noTags
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ref: string) => {
      if (ref[0] === '#') {
        const hex = ref[1] === 'x' || ref[1] === 'X'
        return codePointText(Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10))
      }
      return NAMED[ref.toLowerCase()] ?? match
    })
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
