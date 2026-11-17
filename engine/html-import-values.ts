import type { SlideComponentStyle } from './types'
import type { ParsedLength } from './html-import-shared'
import { stripWrappingQuotes } from './html-import-css'

export function parseRuleValueExists(styleMap: Record<string, string>, key: string): boolean {
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

  const fallback = /\b(serif|times|georgia|garamond|didot|cambria|cochin|palatino)\b/i.test(rawFamily)
    ? 'serif'
    : 'sans-serif'
  const sanitized = rawFamily.trim() ? `${rawFamily}, ${fallback}` : fallback
  warnings.push('Node "' + nodeLabel + '" font-family "' + rawFamily + '" normalized with fallback "' + fallback + '".')
  return sanitized
}

export function parseLength(value: string | null | undefined): ParsedLength | undefined {
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

export function isPxLike(length: ParsedLength): boolean {
  return length.value === 0 || length.unit === '' || length.unit === 'px'
}

export function parsePositivePx(rawValue: string | null | undefined): number | undefined {
  const px = parsePxLength(rawValue ?? undefined)
  return px !== undefined && px > 0 ? px : undefined
}

export function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  if (!normalized) return undefined
  if (normalized === 'transparent') return undefined
  if (normalized === 'rgba(0, 0, 0, 0)' || normalized === 'rgba(0,0,0,0)') return undefined
  return normalized
}

export function normalizeBackgroundFill(value: string | undefined): string | undefined {
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

export function normalizeBackgroundImage(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  if (!normalized || normalized.toLowerCase() === 'none') return undefined
  if (/url\(\s*javascript:/i.test(normalized)) return undefined
  return normalized
}

export function resolveComputedBackground(
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

export function hasRenderedBorder(style: CSSStyleDeclaration): boolean {
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

export function extractStyle(
  styleMap: Record<string, string>,
  computedStyle: CSSStyleDeclaration | null,
  warnings: string[] = [],
  nodeLabel = 'element',
): SlideComponentStyle {
  const fontSizeLength = parseLength(computedStyle?.fontSize || styleMap['font-size'])
  const lineHeightLength = parseLength(computedStyle?.lineHeight || styleMap['line-height'])
  const letterSpacingLength = parseLength(computedStyle?.letterSpacing || styleMap['letter-spacing'])
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
    letterSpacing: letterSpacingLength && isPxLike(letterSpacingLength) && letterSpacingLength.value !== 0 ? letterSpacingLength.value : undefined,
    textAlign,
  }
}
