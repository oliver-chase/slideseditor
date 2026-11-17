import type { SlideComponent } from './types'
import { clamp, escXml, toEmu, toEmuOffset, toPlainText } from './pptx-shared'
import { buildLineXml, buildShapeFillXml, normalizeHexColor, parseBoxShadow, toPptAlpha } from './pptx-paint'

function fontSizeForComponent(component: SlideComponent): number {
  if (typeof component.style.fontSize === 'number' && component.style.fontSize > 0) {
    return component.style.fontSize
  }
  if (component.type === 'heading') return 54
  if (component.type === 'subheading') return 36
  if (component.type === 'stat') return 40
  return 24
}

function defaultHeightForComponent(component: SlideComponent, text: string): number {
  if (typeof component.height === 'number' && component.height > 0) return component.height
  const lines = Math.max(1, text.split('\n').length)
  const estimated = Math.ceil(fontSizeForComponent(component) * 1.4 * lines + 18)
  return clamp(estimated, 40, 800)
}

function resolveTypeface(fontFamily: string | undefined): string {
  if (!fontFamily) return 'Arial'
  const token = fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '')
  return token || 'Arial'
}

function buildTextParagraphs(
  text: string,
  fontSizePt: number,
  textColorHex: string,
  align: string,
  bold: boolean,
  italic: boolean,
  typeface: string,
  fontScale = 1,
  lineHeightPx?: number,
  letterSpacingPx?: number,
): string {
  const lines = text.split('\n')
  // fontSizePt arrives as CSS px; PPTX sz is hundredths of a point (px * 0.75 = pt).
  // fontScale (normally 1) shrinks fonts with the geometry when a huge canvas had to
  // be scaled down to fit PowerPoint's 56in axis limit.
  const size = Math.round(clamp(fontSizePt * 0.75 * fontScale, 4, 400) * 100)
  const boldAttr = bold ? ' b="1"' : ''
  const italicAttr = italic ? ' i="1"' : ''
  // line-height and letter-spacing arrive as CSS px; spcPts and spc are hundredths of a point.
  const spacingAttr = letterSpacingPx ? ` spc="${Math.round(clamp(letterSpacingPx * 0.75 * fontScale, -400, 2000) * 100)}"` : ''
  const lineSpacingXml = lineHeightPx && lineHeightPx > 0
    ? `<a:lnSpc><a:spcPts val="${Math.round(clamp(lineHeightPx * 0.75 * fontScale, 1, 1584) * 100)}"/></a:lnSpc>`
    : ''
  const pPr = lineSpacingXml ? `<a:pPr algn="${align}">${lineSpacingXml}</a:pPr>` : `<a:pPr algn="${align}"/>`

  return lines
    .map((line) => {
      const content = line.trim().length > 0 ? line : ' '
      return `<a:p>${pPr}<a:r><a:rPr lang="en-US" sz="${size}"${boldAttr}${italicAttr}${spacingAttr}><a:solidFill><a:srgbClr val="${textColorHex}"/></a:solidFill><a:latin typeface="${escXml(typeface)}"/></a:rPr><a:t>${escXml(content)}</a:t></a:r><a:endParaRPr lang="en-US" sz="${size}"/></a:p>`
    })
    .join('')
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const IMAGE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export interface DecodedImage {
  ext: string
  bytes: Uint8Array
}

// Height over width of an image, read from its file header. Returns null when the format is
// not read (WebP) or the header is short, and the caller then keeps the layer's own box.
export function imageAspectRatio(image: DecodedImage): number | null {
  const b = image.bytes
  let w = 0
  let h = 0
  if (image.ext === 'png' && b.length >= 24) {
    w = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0
    h = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0
  } else if (image.ext === 'gif' && b.length >= 10) {
    w = b[6] | (b[7] << 8)
    h = b[8] | (b[9] << 8)
  } else if (image.ext === 'jpeg') {
    // Walk the marker segments until a start-of-frame marker, which holds height then width.
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i += 1; continue }
      const marker = b[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        h = (b[i + 5] << 8) | b[i + 6]
        w = (b[i + 7] << 8) | b[i + 8]
        break
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3])
    }
  }
  return w > 0 && h > 0 ? h / w : null
}

export function decodeDataUriImage(uri: string, warnings: string[], ref: string): DecodedImage | null {
  const match = uri.match(/^data:([^;,]+)((?:;[^,]*)?),([\s\S]*)$/i)
  if (!match) return null
  const isBase64 = /;base64$/i.test(match[2] || '')
  const mime = (match[1] || '').toLowerCase()
  const ext = IMAGE_MIME_EXT[mime]
  if (!ext) {
    warnings.push(`${ref}: embedded image type "${mime || 'unknown'}" is not supported for PPTX and was skipped.`)
    return null
  }
  try {
    const bytes = isBase64
      ? base64ToBytes(match[3] || '')
      : new TextEncoder().encode(decodeURIComponent(match[3] || ''))
    if (bytes.length === 0) return null
    return { ext, bytes }
  } catch {
    warnings.push(`${ref}: embedded image data could not be decoded and was skipped.`)
    return null
  }
}

export function extractComponentImageUri(component: SlideComponent): string | null {
  const content = component.content || ''
  const imgMatch = content.match(/<img\b[^>]*?\bsrc\s*=\s*["']?(data:[^"'\s>]+)/i)
  if (imgMatch) return imgMatch[1]
  const backgroundFill = component.style.backgroundFill || ''
  const urlMatch = backgroundFill.match(/url\(\s*["']?(data:[^)"']+?)["']?\s*\)/i)
  if (urlMatch) return urlMatch[1]
  return null
}

export function stripImageMarkup(content: string): string {
  return content.replace(/<img\b[^>]*>/gi, '')
}

export function buildPicXml(
  component: SlideComponent,
  shapeId: number,
  relId: string,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const name = escXml(`image-${component.id}`)
  return `<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="${name}"/><p:cNvPicPr><a:picLocks noChangeAspect="0"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
}

export function buildShapeXml(
  component: SlideComponent,
  shapeId: number,
  scaleX: number,
  scaleY: number,
  slideRef: string,
  warnings: string[],
  fontScale = 1,
): string {
  const text = toPlainText(component.content || '')
  const hasBackground = !!(component.style.backgroundFill || component.style.backgroundColor)
  const hasBorder = !!(component.style.borderColor && component.style.borderWidth && component.style.borderWidth > 0)
  const hasShadow = !!component.style.boxShadow
  if (!text && !hasBackground && !hasBorder && !hasShadow) {
    warnings.push(`${slideRef}: component ${component.id} skipped because it contains no text content.`)
    return ''
  }

  const x = toEmuOffset(component.x, scaleX)
  const y = toEmuOffset(component.y, scaleY)
  const w = toEmu(component.width, scaleX)
  const h = toEmu(defaultHeightForComponent(component, text), scaleY)

  const textColorHex = normalizeHexColor(component.style.color) || '111111'
  const hasDefaultFill = ['card', 'panel', 'row', 'stat'].includes(component.type)
  const align = component.style.textAlign === 'center'
    ? 'ctr'
    : component.style.textAlign === 'right'
      ? 'r'
      : component.style.textAlign === 'justify'
        ? 'just'
        : 'l'
  const fontSize = fontSizeForComponent(component)
  const bold = (component.style.fontWeight || 0) >= 600 || component.type === 'heading'
  const italic = component.style.fontStyle === 'italic'
  const cornerRadius = typeof component.style.borderRadius === 'number' ? component.style.borderRadius : 0
  const shapeGeom = ['card', 'panel'].includes(component.type) || cornerRadius > 1 ? 'roundRect' : 'rect'
  const fillXml = buildShapeFillXml(component, hasDefaultFill, warnings, `${slideRef}: component ${component.id} (${component.type})`)
  const lineXml = buildLineXml(component)
  const shadow = parseBoxShadow(component.style.boxShadow)
  const shadowXml = shadow
    ? `<a:effectLst><a:outerShdw blurRad="${toEmu(shadow.blur, 9_525)}" dist="${toEmu(Math.hypot(shadow.x, shadow.y), 9_525)}" dir="${Math.round((((Math.atan2(shadow.y, shadow.x) * 180) / Math.PI) + 360) % 360 * 60_000)}" algn="ctr" rotWithShape="0"><a:srgbClr val="${shadow.color.hex}">${shadow.color.alpha < 1 ? `<a:alpha val="${toPptAlpha(shadow.color.alpha)}"/>` : ''}</a:srgbClr></a:outerShdw></a:effectLst>`
    : ''
  const typeface = resolveTypeface(component.style.fontFamily)

  const spPr = `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${shapeGeom}"><a:avLst/></a:prstGeom>${fillXml}${lineXml}${shadowXml}</p:spPr>`
  // A box the browser rendered as a single line must stay a single line: viewer
  // fallback fonts (e.g. Arial for Aptos) run wider and would wrap "LOW" to
  // L/O/W in the exact-measured box. Let short runs overflow instead of wrapping.
  const singleLine = !text.includes('\n') &&
    typeof component.height === 'number' && component.height > 0 && component.height <= fontSize * 1.8
  const txBody = `<p:txBody><a:bodyPr wrap="${singleLine ? 'none' : 'square'}"/><a:lstStyle/>${buildTextParagraphs(text, fontSize, textColorHex, align, bold, italic, typeface, fontScale, component.style.lineHeight, component.style.letterSpacing)}</p:txBody>`

  return `<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="${escXml(component.type + '-' + component.id)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>${spPr}${txBody}</p:sp>`
}
