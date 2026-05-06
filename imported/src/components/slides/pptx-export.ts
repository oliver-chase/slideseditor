import type { SlideCanvas, SlideComponent, SlideDocument } from '@/components/slides/types'

interface SlidePptxExportInput {
  id: string
  title: string
  canvas: SlideCanvas
  components: SlideComponent[]
}

interface SlidePptxExportResult {
  blob: Blob
  warnings: string[]
  slideCount: number
}

interface SlideDocumentPptxExportInput {
  id: string
  title: string
  document: SlideDocument
}

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const SLIDE_WIDTH_EMU = 9_144_000
const SLIDE_HEIGHT_EMU = 5_143_500

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function toDosDateTime(value = new Date()): { date: number; time: number } {
  const year = Math.max(1980, value.getFullYear())
  const month = value.getMonth() + 1
  const day = value.getDate()
  const hours = value.getHours()
  const minutes = value.getMinutes()
  const seconds = Math.floor(value.getSeconds() / 2)

  const date = ((year - 1980) << 9) | (month << 5) | day
  const time = (hours << 11) | (minutes << 5) | seconds
  return { date, time }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

function buildZipStore(entries: Array<{ path: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  const dos = toDosDateTime()

  for (const entry of entries) {
    const name = encoder.encode(entry.path)
    const data = entry.data
    const crc = crc32(data)

    const localHeader = new Uint8Array(30)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, dos.time, true)
    localView.setUint16(12, dos.date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true)

    const localChunk = concatBytes([localHeader, name, data])
    locals.push(localChunk)

    const centralHeader = new Uint8Array(46)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, dos.time, true)
    centralView.setUint16(14, dos.date, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)

    centrals.push(concatBytes([centralHeader, name]))
    offset += localChunk.length
  }

  const centralSize = centrals.reduce((sum, entry) => sum + entry.length, 0)
  const endHeader = new Uint8Array(22)
  const endView = new DataView(endHeader.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  endView.setUint16(20, 0, true)

  return concatBytes([...locals, ...centrals, endHeader])
}

function escXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toPlainText(html: string): string {
  const withLineBreaks = html
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
  const noTags = withLineBreaks.replace(/<[^>]*>/g, '')
  return noTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
}

interface ParsedColor {
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

function parseCssColor(value: string | undefined): ParsedColor | null {
  if (!value) return null
  const raw = value.trim().toLowerCase()
  if (!raw) return null
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
    const vals = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((part) => Number.parseInt(part.trim(), 10))
    if (!vals.every((part) => Number.isFinite(part) && part >= 0 && part <= 255)) return null
    const alphaRaw = rgbMatch[4] ? Number.parseFloat(rgbMatch[4].trim()) : 1
    if (!Number.isFinite(alphaRaw)) return null
    return {
      hex: vals.map((part) => part.toString(16).padStart(2, '0')).join('').toUpperCase(),
      alpha: clamp(alphaRaw, 0, 1),
    }
  }
  return null
}

function normalizeHexColor(value: string | undefined): string | null {
  return parseCssColor(value)?.hex || null
}

function toPptAlpha(alpha: number): number {
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

function parseLinearGradient(value: string | undefined): ParsedLinearGradient | null {
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

function buildSolidFillXml(color: ParsedColor): string {
  const alphaXml = color.alpha < 1 ? `<a:alpha val="${toPptAlpha(color.alpha)}"/>` : ''
  return `<a:solidFill><a:srgbClr val="${color.hex}">${alphaXml}</a:srgbClr></a:solidFill>`
}

function buildGradientFillXml(gradient: ParsedLinearGradient): string {
  // CSS gradient angle is clockwise from north; PPTX ang is clockwise from east
  const angle = (((gradient.angleDeg - 90) % 360) + 360) % 360
  const pptAngle = Math.round(angle * 60_000)
  const stops = gradient.stops.map((stop) => {
    const alphaXml = stop.color.alpha < 1 ? `<a:alpha val="${toPptAlpha(stop.color.alpha)}"/>` : ''
    return `<a:gs pos="${stop.pos}"><a:srgbClr val="${stop.color.hex}">${alphaXml}</a:srgbClr></a:gs>`
  }).join('')
  return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:lin ang="${pptAngle}" scaled="1"/></a:gradFill>`
}

function toEmu(px: number, scale: number): number {
  return Math.max(0, Math.round(px * scale))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

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
): string {
  const lines = text.split('\n')
  // fontSizePt arrives as CSS px; PPTX sz is hundredths of a point (px * 0.75 = pt)
  const size = Math.round(clamp(fontSizePt * 0.75, 8, 120) * 100)
  const boldAttr = bold ? ' b="1"' : ''
  const italicAttr = italic ? ' i="1"' : ''

  return lines
    .map((line) => {
      const content = line.trim().length > 0 ? line : ' '
      return `<a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${size}"${boldAttr}${italicAttr}><a:solidFill><a:srgbClr val="${textColorHex}"/></a:solidFill><a:latin typeface="${escXml(typeface)}"/></a:rPr><a:t>${escXml(content)}</a:t></a:r><a:endParaRPr lang="en-US" sz="${size}"/></a:p>`
    })
    .join('')
}

function parseBoxShadow(value: string | undefined): { x: number; y: number; blur: number; color: ParsedColor } | null {
  if (!value) return null
  const candidates = splitCssArgs(value)
  for (const candidate of candidates) {
    if (!candidate || /\binset\b/i.test(candidate)) continue
    const colorMatch = candidate.match(/(rgba?\([^\)]*\)|#[0-9a-fA-F]{3,8})/)
    const color = parseCssColor(colorMatch?.[1])
    if (!color) continue
    const clean = candidate.replace(colorMatch?.[1] || '', ' ')
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

function buildLineXml(component: SlideComponent): string {
  const borderWidth = typeof component.style.borderWidth === 'number' && component.style.borderWidth > 0
    ? component.style.borderWidth
    : 0
  const borderColor = parseCssColor(component.style.borderColor)
  if (borderWidth <= 0 || !borderColor) return '<a:ln><a:noFill/></a:ln>'

  const dash = component.style.borderStyle && /dashed|dotted/i.test(component.style.borderStyle)
    ? '<a:prstDash val="sysDot"/>'
    : ''
  return `<a:ln w="${toEmu(borderWidth, 9_525)}"><a:solidFill><a:srgbClr val="${borderColor.hex}">${borderColor.alpha < 1 ? `<a:alpha val="${toPptAlpha(borderColor.alpha)}"/>` : ''}</a:srgbClr></a:solidFill>${dash}</a:ln>`
}

function buildShapeFillXml(component: SlideComponent, hasDefaultFill: boolean, warnings: string[], warningPrefix: string): string {
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

interface DecodedImage {
  ext: string
  bytes: Uint8Array
}

function decodeDataUriImage(uri: string, warnings: string[], ref: string): DecodedImage | null {
  const match = uri.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/i)
  if (!match) return null
  const mime = (match[1] || '').toLowerCase()
  const ext = IMAGE_MIME_EXT[mime]
  if (!ext) {
    warnings.push(`${ref}: embedded image type "${mime || 'unknown'}" is not supported for PPTX and was skipped.`)
    return null
  }
  try {
    const bytes = match[2]
      ? base64ToBytes(match[3] || '')
      : new TextEncoder().encode(decodeURIComponent(match[3] || ''))
    if (bytes.length === 0) return null
    return { ext, bytes }
  } catch {
    warnings.push(`${ref}: embedded image data could not be decoded and was skipped.`)
    return null
  }
}

function extractComponentImageUri(component: SlideComponent): string | null {
  const content = component.content || ''
  const imgMatch = content.match(/<img\b[^>]*?\bsrc\s*=\s*["']?(data:[^"'\s>]+)/i)
  if (imgMatch) return imgMatch[1]
  const backgroundFill = component.style.backgroundFill || ''
  const urlMatch = backgroundFill.match(/url\(\s*["']?(data:[^)"']+?)["']?\s*\)/i)
  if (urlMatch) return urlMatch[1]
  return null
}

function stripImageMarkup(content: string): string {
  return content.replace(/<img\b[^>]*>/gi, '')
}

function buildPicXml(
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

function buildShapeXml(
  component: SlideComponent,
  shapeId: number,
  scaleX: number,
  scaleY: number,
  slideRef: string,
  warnings: string[],
): string {
  const text = toPlainText(component.content || '')
  const hasBackground = !!(component.style.backgroundFill || component.style.backgroundColor)
  const hasBorder = !!(component.style.borderColor && component.style.borderWidth && component.style.borderWidth > 0)
  const hasShadow = !!component.style.boxShadow
  if (!text && !hasBackground && !hasBorder && !hasShadow) {
    warnings.push(`${slideRef}: component ${component.id} skipped because it contains no text content.`)
    return ''
  }

  const x = toEmu(component.x, scaleX)
  const y = toEmu(component.y, scaleY)
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
  const txBody = `<p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${buildTextParagraphs(text || component.type, fontSize, textColorHex, align, bold, italic, typeface)}</p:txBody>`

  return `<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="${escXml(component.type + '-' + component.id)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>${spPr}${txBody}</p:sp>`
}

interface SlideXmlResult {
  xml: string
  relsXml: string
}

function buildSlideXml(
  slide: SlidePptxExportInput,
  slideIndex: number,
  warnings: string[],
  media: Array<{ path: string; data: Uint8Array }>,
): SlideXmlResult {
  const safeWidth = Math.max(1, slide.canvas.width || 1920)
  const safeHeight = Math.max(1, slide.canvas.height || 1080)
  const scaleX = SLIDE_WIDTH_EMU / safeWidth
  const scaleY = SLIDE_HEIGHT_EMU / safeHeight
  const slideRef = `slide ${slideIndex + 1} (${slide.title || slide.id})`

  const shapes: string[] = []
  const imageRels: Array<{ rId: string; target: string }> = []
  let shapeId = 2
  let relCounter = 2 // rId1 is reserved for the slide-layout relationship

  const registerImage = (image: DecodedImage): string => {
    const globalIndex = media.length + 1
    media.push({ path: `ppt/media/image${globalIndex}.${image.ext}`, data: image.bytes })
    const rId = `rId${relCounter}`
    relCounter += 1
    imageRels.push({ rId, target: `../media/image${globalIndex}.${image.ext}` })
    return rId
  }

  const canvasGradient = parseLinearGradient(slide.canvas.background)
  const canvasColor = parseCssColor(slide.canvas.background)
  if (canvasGradient || canvasColor) {
    const fillXml = canvasGradient
      ? buildGradientFillXml(canvasGradient)
      : buildSolidFillXml(canvasColor as ParsedColor)
    const bg = `<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="slide-background"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_WIDTH_EMU}" cy="${SLIDE_HEIGHT_EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fillXml}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
    shapes.push(bg)
    shapeId += 1
  }

  for (const component of slide.components) {
    if (component.visible === false) {
      warnings.push(`${slideRef}: component ${component.id} (${component.type}) was hidden and was skipped in PPTX export.`)
      continue
    }

    const componentRef = `${slideRef}: component ${component.id} (${component.type})`
    const imageUri = extractComponentImageUri(component)
    if (imageUri) {
      const decoded = decodeDataUriImage(imageUri, warnings, componentRef)
      if (decoded) {
        const rId = registerImage(decoded)
        const x = toEmu(component.x, scaleX)
        const y = toEmu(component.y, scaleY)
        const w = toEmu(component.width, scaleX)
        const imageHeight = typeof component.height === 'number' && component.height > 0 ? component.height : component.width
        const h = toEmu(imageHeight, scaleY)
        shapes.push(buildPicXml(component, shapeId, rId, x, y, w, h))
        shapeId += 1

        // A component may carry both an image and a caption. Emit the caption as a
        // transparent text shape on top so the picture stays visible beneath it:
        // retype to 'text' and clear the fill so buildShapeXml produces noFill
        // (card/panel/row/stat would otherwise paint an opaque default fill).
        const captionContent = stripImageMarkup(component.content || '')
        if (toPlainText(captionContent)) {
          const captionShape = buildShapeXml(
            { ...component, type: 'text', content: captionContent, style: { ...component.style, backgroundFill: undefined, backgroundColor: undefined } },
            shapeId,
            scaleX,
            scaleY,
            slideRef,
            warnings,
          )
          if (captionShape) {
            shapes.push(captionShape)
            shapeId += 1
          }
        }
        continue
      }
      // Decoding failed and already warned. An image-only logo has nothing else to
      // render, so skip it rather than falling through to an empty text shape.
      if (component.type === 'logo') continue
      // Otherwise fall through: the component may still have text/background/border.
    } else if (component.type === 'logo') {
      warnings.push(`${componentRef} had no embeddable image data and was skipped.`)
      continue
    }

    const shapeXml = buildShapeXml(component, shapeId, scaleX, scaleY, slideRef, warnings)
    if (!shapeXml) continue
    shapes.push(shapeXml)
    shapeId += 1
  }

  if (shapes.length === 0) {
    const fallback = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="fallback-note"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="8229600" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1800"><a:solidFill><a:srgbClr val="666666"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${escXml('This slide had no exportable native components.')}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`
    shapes.push(fallback)
    warnings.push(`${slideRef}: no exportable components found; added fallback note.`)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  return { xml, relsXml: buildSlideRelsXml(imageRels) }
}

const IMAGE_EXT_CONTENT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

function buildContentTypesXml(slideCount: number, imageExtensions: string[] = []): string {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) =>
    `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join('')

  const imageDefaults = Array.from(new Set(imageExtensions))
    .map((ext) => `<Default Extension="${ext}" ContentType="${IMAGE_EXT_CONTENT_TYPE[ext] || 'application/octet-stream'}"/>`)
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imageDefaults}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slideOverrides}</Types>`
}

function buildPresentationXml(slideCount: number): string {
  const slideIds = Array.from({ length: slideCount }, (_, index) =>
    `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`,
  ).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:presentation xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${SLIDE_WIDTH_EMU}" cy="${SLIDE_HEIGHT_EMU}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`
}

function buildPresentationRelsXml(slideCount: number): string {
  const slideRels = Array.from({ length: slideCount }, (_, index) =>
    `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
  ).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRels}</Relationships>`
}

function buildRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
}

function buildSlideMasterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sldMaster xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:cSld name="Master"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`
}

function buildSlideMasterRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`
}

function buildSlideLayoutXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sldLayout xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
}

function buildSlideLayoutRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`
}

function buildThemeXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<a:theme xmlns:a="${A_NS}" name="Oliver Theme"><a:themeElements><a:clrScheme name="Oliver"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F9FAFB"/></a:lt2><a:accent1><a:srgbClr val="EC4899"/></a:accent1><a:accent2><a:srgbClr val="3B82F6"/></a:accent2><a:accent3><a:srgbClr val="10B981"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="8B5CF6"/></a:accent5><a:accent6><a:srgbClr val="EF4444"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Oliver"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Oliver"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`
}

function buildSlideRelsXml(imageRels: Array<{ rId: string; target: string }> = []): string {
  const imageRelXml = imageRels
    .map((rel) => `<Relationship Id="${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${rel.target}"/>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${imageRelXml}</Relationships>`
}

function buildAppPropsXml(slideCount: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Oliver App</Application><Slides>${slideCount}</Slides><PresentationFormat>Widescreen</PresentationFormat></Properties>`
}

function buildCorePropsXml(): string {
  const iso = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Oliver Slide Export</dc:title><dc:creator>Oliver App</dc:creator><cp:lastModifiedBy>Oliver App</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`
}

function convertSlidesToPptx(slidesInput: SlidePptxExportInput[]): SlidePptxExportResult {
  if (!Array.isArray(slidesInput) || slidesInput.length === 0) {
    throw new Error('At least one slide is required for PPTX export.')
  }

  const slides = slidesInput.map((slide) => ({
    ...slide,
    title: slide.title || slide.id,
    canvas: {
      width: Math.max(1, Number(slide.canvas?.width || 1920)),
      height: Math.max(1, Number(slide.canvas?.height || 1080)),
      ...(typeof slide.canvas?.background === 'string' && slide.canvas.background.trim()
        ? { background: slide.canvas.background.trim() }
        : {}),
    },
    components: Array.isArray(slide.components) ? slide.components : [],
  }))

  const warnings: string[] = []
  const encoder = new TextEncoder()
  const entries: Array<{ path: string; data: Uint8Array }> = []

  // Build slides first so embedded-image media parts and their content-type
  // Defaults are known before [Content_Types].xml is written. ZIP entry order
  // is not significant, so the manifest can be pushed after the slide loop.
  const media: Array<{ path: string; data: Uint8Array }> = []
  const slideEntries: Array<{ path: string; data: Uint8Array }> = []
  slides.forEach((slide, index) => {
    const { xml, relsXml } = buildSlideXml(slide, index, warnings, media)
    slideEntries.push({ path: `ppt/slides/slide${index + 1}.xml`, data: encoder.encode(xml) })
    slideEntries.push({ path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, data: encoder.encode(relsXml) })
  })
  const imageExtensions = media.map((entry) => entry.path.slice(entry.path.lastIndexOf('.') + 1))

  entries.push({ path: '[Content_Types].xml', data: encoder.encode(buildContentTypesXml(slides.length, imageExtensions)) })
  entries.push({ path: '_rels/.rels', data: encoder.encode(buildRootRelsXml()) })
  entries.push({ path: 'docProps/app.xml', data: encoder.encode(buildAppPropsXml(slides.length)) })
  entries.push({ path: 'docProps/core.xml', data: encoder.encode(buildCorePropsXml()) })
  entries.push({ path: 'ppt/presentation.xml', data: encoder.encode(buildPresentationXml(slides.length)) })
  entries.push({ path: 'ppt/_rels/presentation.xml.rels', data: encoder.encode(buildPresentationRelsXml(slides.length)) })
  entries.push({ path: 'ppt/slideMasters/slideMaster1.xml', data: encoder.encode(buildSlideMasterXml()) })
  entries.push({ path: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: encoder.encode(buildSlideMasterRelsXml()) })
  entries.push({ path: 'ppt/slideLayouts/slideLayout1.xml', data: encoder.encode(buildSlideLayoutXml()) })
  entries.push({ path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: encoder.encode(buildSlideLayoutRelsXml()) })
  entries.push({ path: 'ppt/theme/theme1.xml', data: encoder.encode(buildThemeXml()) })

  entries.push(...slideEntries)
  for (const entry of media) entries.push(entry)

  const zipBytes = buildZipStore(entries)
  const zipBuffer = new ArrayBuffer(zipBytes.byteLength)
  new Uint8Array(zipBuffer).set(zipBytes)
  const blob = new Blob([zipBuffer], { type: PPTX_MIME })
  return {
    blob,
    warnings,
    slideCount: slides.length,
  }
}

export function convertSlideDocumentsToPptx(slidesInput: SlideDocumentPptxExportInput[]): SlidePptxExportResult {
  return convertSlidesToPptx(slidesInput.map((slide) => {
    const primarySlide = slide.document.deck.slides[0]
    return {
      id: slide.id,
      title: slide.title,
      canvas: {
        width: slide.document.deck.width,
        height: slide.document.deck.height,
        ...(primarySlide?.background?.fill ? { background: primarySlide.background.fill } : {}),
      },
      components: Array.isArray(primarySlide?.elements) ? primarySlide.elements : [],
    }
  }))
}
