import type { SlideComponent } from './types'
import { clamp, toEmu } from './pptx-shared'

export interface ParsedColor {
  hex: string
  alpha: number
}

interface ParsedGradientStop {
  color: ParsedColor
  pos: number
}

interface ParsedLinearGradient {
  angleDeg: number
  stops: ParsedGradientStop[]
}

// Standard CSS named colors -> 6-digit hex. Computed styles usually resolve to
// rgb(), but pasted or inline-styled HTML frequently uses names like "white".
const CSS_NAMED_COLORS: Record<string, string> = {
  aliceblue: 'F0F8FF', antiquewhite: 'FAEBD7', aqua: '00FFFF', aquamarine: '7FFFD4', azure: 'F0FFFF',
  beige: 'F5F5DC', bisque: 'FFE4C4', black: '000000', blanchedalmond: 'FFEBCD', blue: '0000FF',
  blueviolet: '8A2BE2', brown: 'A52A2A', burlywood: 'DEB887', cadetblue: '5F9EA0', chartreuse: '7FFF00',
  chocolate: 'D2691E', coral: 'FF7F50', cornflowerblue: '6495ED', cornsilk: 'FFF8DC', crimson: 'DC143C',
  cyan: '00FFFF', darkblue: '00008B', darkcyan: '008B8B', darkgoldenrod: 'B8860B', darkgray: 'A9A9A9',
  darkgreen: '006400', darkgrey: 'A9A9A9', darkkhaki: 'BDB76B', darkmagenta: '8B008B', darkolivegreen: '556B2F',
  darkorange: 'FF8C00', darkorchid: '9932CC', darkred: '8B0000', darksalmon: 'E9967A', darkseagreen: '8FBC8F',
  darkslateblue: '483D8B', darkslategray: '2F4F4F', darkslategrey: '2F4F4F', darkturquoise: '00CED1',
  darkviolet: '9400D3', deeppink: 'FF1493', deepskyblue: '00BFFF', dimgray: '696969', dimgrey: '696969',
  dodgerblue: '1E90FF', firebrick: 'B22222', floralwhite: 'FFFAF0', forestgreen: '228B22', fuchsia: 'FF00FF',
  gainsboro: 'DCDCDC', ghostwhite: 'F8F8FF', gold: 'FFD700', goldenrod: 'DAA520', gray: '808080',
  green: '008000', greenyellow: 'ADFF2F', grey: '808080', honeydew: 'F0FFF0', hotpink: 'FF69B4',
  indianred: 'CD5C5C', indigo: '4B0082', ivory: 'FFFFF0', khaki: 'F0E68C', lavender: 'E6E6FA',
  lavenderblush: 'FFF0F5', lawngreen: '7CFC00', lemonchiffon: 'FFFACD', lightblue: 'ADD8E6', lightcoral: 'F08080',
  lightcyan: 'E0FFFF', lightgoldenrodyellow: 'FAFAD2', lightgray: 'D3D3D3', lightgreen: '90EE90', lightgrey: 'D3D3D3',
  lightpink: 'FFB6C1', lightsalmon: 'FFA07A', lightseagreen: '20B2AA', lightskyblue: '87CEFA', lightslategray: '778899',
  lightslategrey: '778899', lightsteelblue: 'B0C4DE', lightyellow: 'FFFFE0', lime: '00FF00', limegreen: '32CD32',
  linen: 'FAF0E6', magenta: 'FF00FF', maroon: '800000', mediumaquamarine: '66CDAA', mediumblue: '0000CD',
  mediumorchid: 'BA55D3', mediumpurple: '9370DB', mediumseagreen: '3CB371', mediumslateblue: '7B68EE',
  mediumspringgreen: '00FA9A', mediumturquoise: '48D1CC', mediumvioletred: 'C71585', midnightblue: '191970',
  mintcream: 'F5FFFA', mistyrose: 'FFE4E1', moccasin: 'FFE4B5', navajowhite: 'FFDEAD', navy: '000080',
  oldlace: 'FDF5E6', olive: '808000', olivedrab: '6B8E23', orange: 'FFA500', orangered: 'FF4500',
  orchid: 'DA70D6', palegoldenrod: 'EEE8AA', palegreen: '98FB98', paleturquoise: 'AFEEEE', palevioletred: 'DB7093',
  papayawhip: 'FFEFD5', peachpuff: 'FFDAB9', peru: 'CD853F', pink: 'FFC0CB', plum: 'DDA0DD',
  powderblue: 'B0E0E6', purple: '800080', rebeccapurple: '663399', red: 'FF0000', rosybrown: 'BC8F8F',
  royalblue: '4169E1', saddlebrown: '8B4513', salmon: 'FA8072', sandybrown: 'F4A460', seagreen: '2E8B57',
  seashell: 'FFF5EE', sienna: 'A0522D', silver: 'C0C0C0', skyblue: '87CEEB', slateblue: '6A5ACD',
  slategray: '708090', slategrey: '708090', snow: 'FFFAFA', springgreen: '00FF7F', steelblue: '4682B4',
  tan: 'D2B48C', teal: '008080', thistle: 'D8BFD8', tomato: 'FF6347', turquoise: '40E0D0',
  violet: 'EE82EE', wheat: 'F5DEB3', white: 'FFFFFF', whitesmoke: 'F5F5F5', yellow: 'FFFF00', yellowgreen: '9ACD32',
}

export function parseCssColor(value: string | undefined): ParsedColor | null {
  if (!value) return null
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  const named = CSS_NAMED_COLORS[raw]
  if (named) return { hex: named, alpha: 1 }
  if (/^#[0-9a-f]{6}$/.test(raw)) return { hex: raw.slice(1).toUpperCase(), alpha: 1 }
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    const [, r, g, b] = raw
    return { hex: `${r}${r}${g}${g}${b}${b}`.toUpperCase(), alpha: 1 }
  }
  if (/^#[0-9a-f]{8}$/.test(raw)) {
    const rgb = raw.slice(1, 7).toUpperCase()
    const alpha = Number.parseInt(raw.slice(7), 16) / 255
    return { hex: rgb, alpha: clamp(alpha, 0, 1) }
  }
  const rgbMatch = raw.match(/^rgba?\(([^,]+),\s*([^,]+),\s*([^,\)]+)(?:,\s*([^\)]+))?\)$/)
  if (rgbMatch) {
    // A channel is 0-255 or a percentage of 255, and the alpha is 0-1 or a percentage.
    const vals = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((part) => {
      const text = part.trim()
      return text.endsWith('%') ? Math.round((Number.parseFloat(text) * 255) / 100) : Number.parseInt(text, 10)
    })
    if (!vals.every((part) => Number.isFinite(part) && part >= 0 && part <= 255)) return null
    const alphaText = rgbMatch[4] ? rgbMatch[4].trim() : ''
    const alphaRaw = alphaText ? Number.parseFloat(alphaText) / (alphaText.endsWith('%') ? 100 : 1) : 1
    if (!Number.isFinite(alphaRaw)) return null
    return {
      hex: vals.map((part) => part.toString(16).padStart(2, '0')).join('').toUpperCase(),
      alpha: clamp(alphaRaw, 0, 1),
    }
  }
  return parseHslColor(raw)
}

// hsl() and hsla(), with commas or with spaces and a slash before the alpha.
function parseHslColor(raw: string): ParsedColor | null {
  const match = raw.match(/^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/)
  if (!match) return null
  const hue = ((Number.parseFloat(match[1]) % 360) + 360) % 360
  const s = clamp(Number.parseFloat(match[2]), 0, 100) / 100
  const l = clamp(Number.parseFloat(match[3]), 0, 100) / 100
  const alphaRaw = match[4] === undefined ? 1 : Number.parseFloat(match[4]) / (match[5] ? 100 : 1)
  if (![hue, s, l, alphaRaw].every(Number.isFinite)) return null
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12
    return l - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  const hex = [channel(0), channel(8), channel(4)]
    .map((value) => Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return { hex, alpha: clamp(alphaRaw, 0, 1) }
}

export function normalizeHexColor(value: string | undefined): string | null {
  return parseCssColor(value)?.hex || null
}

export function toPptAlpha(alpha: number): number {
  return clamp(Math.round(alpha * 100_000), 0, 100_000)
}

function splitCssArgs(value: string): string[] {
  const tokens: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)
    if (char === ',' && depth === 0) {
      tokens.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  tokens.push(value.slice(start).trim())
  return tokens.filter(Boolean)
}

// Map a CSS `linear-gradient` side/corner keyword (e.g. "to right", "to top left")
// to the equivalent CSS angle in degrees (clockwise from north). Returns null if the
// direction words are unrecognized so the caller can fall back to the default.
function gradientKeywordToAngle(token: string): number | null {
  const words = token.replace(/^to\s+/, '').trim().split(/\s+/).filter(Boolean)
  const set = new Set(words)
  const has = (w: string) => set.has(w)
  if (words.length === 1) {
    if (has('top')) return 0
    if (has('right')) return 90
    if (has('bottom')) return 180
    if (has('left')) return 270
    return null
  }
  if (has('top') && has('right')) return 45
  if (has('bottom') && has('right')) return 135
  if (has('bottom') && has('left')) return 225
  if (has('top') && has('left')) return 315
  return null
}

export function parseLinearGradient(value: string | undefined): ParsedLinearGradient | null {
  if (!value) return null
  const match = value.trim().match(/^linear-gradient\(([\s\S]+)\)$/i)
  if (!match) return null
  const args = splitCssArgs(match[1] || '')
  if (args.length < 2) return null

  let angleDeg = 180
  let startIndex = 0
  const angleToken = args[0].trim().toLowerCase()
  if (/^-?\d*\.?\d+deg$/.test(angleToken)) {
    angleDeg = Number.parseFloat(angleToken.replace('deg', ''))
    startIndex = 1
  } else if (/^to\s+/.test(angleToken)) {
    const keywordAngle = gradientKeywordToAngle(angleToken)
    if (keywordAngle !== null) {
      angleDeg = keywordAngle
      startIndex = 1
    }
  }

  const rawStops = args.slice(startIndex)
  const stops: ParsedGradientStop[] = []
  for (let index = 0; index < rawStops.length; index += 1) {
    const token = rawStops[index]
    const posMatch = token.match(/(-?\d*\.?\d+)%\s*$/)
    const colorToken = posMatch ? token.slice(0, posMatch.index).trim() : token.trim()
    const color = parseCssColor(colorToken)
    if (!color) continue
    const inferredPos = rawStops.length <= 1 ? 0 : Math.round((index / (rawStops.length - 1)) * 100_000)
    const explicitPos = posMatch ? clamp(Math.round(Number.parseFloat(posMatch[1]) * 1_000), 0, 100_000) : inferredPos
    stops.push({ color, pos: explicitPos })
  }

  if (stops.length < 2) return null
  return {
    angleDeg,
    stops,
  }
}

export function buildSolidFillXml(color: ParsedColor): string {
  const alphaXml = color.alpha < 1 ? `<a:alpha val="${toPptAlpha(color.alpha)}"/>` : ''
  return `<a:solidFill><a:srgbClr val="${color.hex}">${alphaXml}</a:srgbClr></a:solidFill>`
}

export function buildGradientFillXml(gradient: ParsedLinearGradient): string {
  // CSS gradient angle is clockwise from north; PPTX ang is clockwise from east
  const angle = (((gradient.angleDeg - 90) % 360) + 360) % 360
  const pptAngle = Math.round(angle * 60_000)
  const stops = gradient.stops.map((stop) => {
    const alphaXml = stop.color.alpha < 1 ? `<a:alpha val="${toPptAlpha(stop.color.alpha)}"/>` : ''
    return `<a:gs pos="${stop.pos}"><a:srgbClr val="${stop.color.hex}">${alphaXml}</a:srgbClr></a:gs>`
  }).join('')
  return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:lin ang="${pptAngle}" scaled="1"/></a:gradFill>`
}

export function parseBoxShadow(value: string | undefined): { x: number; y: number; blur: number; color: ParsedColor } | null {
  if (!value) return null
  const candidates = splitCssArgs(value)
  for (const candidate of candidates) {
    if (!candidate || /\binset\b/i.test(candidate)) continue
    const colorToken = (candidate.match(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+/g) || [])
      .find((token) => parseCssColor(token) !== null)
    const color = parseCssColor(colorToken)
    if (!color) continue
    const clean = candidate.replace(colorToken || '', ' ')
    const lengths = clean.match(/-?\d*\.?\d+px/g) || []
    if (lengths.length < 2) continue
    const xToken = lengths[0]
    const yToken = lengths[1]
    if (!xToken || !yToken) continue
    const x = Number.parseFloat(xToken.replace('px', ''))
    const y = Number.parseFloat(yToken.replace('px', ''))
    const blur = lengths[2] ? Math.max(0, Number.parseFloat(lengths[2].replace('px', ''))) : 0
    if (![x, y, blur].every((entry) => Number.isFinite(entry))) continue
    return { x, y, blur, color }
  }
  return null
}

export function buildLineXml(component: SlideComponent): string {
  const borderWidth = typeof component.style.borderWidth === 'number' && component.style.borderWidth > 0
    ? component.style.borderWidth
    : 0
  const borderColor = parseCssColor(component.style.borderColor)
  if (borderWidth <= 0 || !borderColor) return '<a:ln><a:noFill/></a:ln>'

  const borderStyle = component.style.borderStyle || ''
  const dash = /dotted/i.test(borderStyle)
    ? '<a:prstDash val="sysDot"/>'
    : /dashed/i.test(borderStyle)
      ? '<a:prstDash val="dash"/>'
      : ''
  return `<a:ln w="${toEmu(borderWidth, 9_525)}"><a:solidFill><a:srgbClr val="${borderColor.hex}">${borderColor.alpha < 1 ? `<a:alpha val="${toPptAlpha(borderColor.alpha)}"/>` : ''}</a:srgbClr></a:solidFill>${dash}</a:ln>`
}

export function buildShapeFillXml(component: SlideComponent, hasDefaultFill: boolean, warnings: string[], warningPrefix: string): string {
  const backgroundFill = component.style.backgroundFill || component.style.backgroundColor
  const gradient = parseLinearGradient(backgroundFill)
  if (gradient) return buildGradientFillXml(gradient)

  if (typeof backgroundFill === 'string' && /gradient\(/i.test(backgroundFill)) {
    warnings.push(`${warningPrefix}: unsupported gradient syntax was simplified to a solid fill.`)
  }

  const solidColor = parseCssColor(backgroundFill) || parseCssColor(component.style.backgroundColor)
  if (solidColor) return buildSolidFillXml(solidColor)
  if (hasDefaultFill) return '<a:solidFill><a:srgbClr val="F3F4F6"/></a:solidFill>'
  return '<a:noFill/>'
}
