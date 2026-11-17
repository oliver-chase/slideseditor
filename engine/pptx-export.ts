import type { SlideCanvas, SlideComponent, SlideDocument } from './types'
import { A_NS, EMU_PER_PX, PPTX_MIME, P_NS, R_NS, computeSlideEmu, escXml, toEmu, toEmuOffset, toPlainText } from './pptx-shared'
import type { SlideEmu } from './pptx-shared'
import { buildZipStore } from './pptx-zip'
import { buildGradientFillXml, buildSolidFillXml, parseCssColor, parseLinearGradient } from './pptx-paint'
import type { ParsedColor } from './pptx-paint'
import { buildPicXml, buildShapeXml, decodeDataUriImage, extractComponentImageUri, imageAspectRatio, stripImageMarkup } from './pptx-shapes'
import type { DecodedImage } from './pptx-shapes'
import { buildAppPropsXml, buildContentTypesXml, buildCorePropsXml, buildPresentationRelsXml, buildPresentationXml, buildRootRelsXml, buildSlideLayoutRelsXml, buildSlideLayoutXml, buildSlideMasterRelsXml, buildSlideMasterXml, buildSlideRelsXml, buildThemeXml } from './pptx-parts'

interface SlidePptxExportInput {
  id: string
  title: string
  canvas: SlideCanvas
  components: SlideComponent[]
}

interface SlidePptxExportResult {
  blob: Blob
  warnings: string[]
}

interface SlideDocumentPptxExportInput {
  id: string
  title: string
  document: SlideDocument
}

interface SlideXmlResult {
  xml: string
  relsXml: string
}

function buildBackgroundShapeXml(background: string | undefined, slideEmu: SlideEmu, shapeId: number): string | null {
  const canvasGradient = parseLinearGradient(background)
  const canvasColor = parseCssColor(background)
  if (!canvasGradient && !canvasColor) return null
  const fillXml = canvasGradient
    ? buildGradientFillXml(canvasGradient)
    : buildSolidFillXml(canvasColor as ParsedColor)
  return `<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="slide-background"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideEmu.w}" cy="${slideEmu.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fillXml}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
}

// The picture, plus a caption text shape on top when the component also carries text.
function buildPictureShapes(
  component: SlideComponent,
  rId: string,
  aspect: number | null,
  shapeId: number,
  scaleX: number,
  scaleY: number,
  slideRef: string,
  warnings: string[],
  fontScale: number,
): string[] {
  const x = toEmuOffset(component.x, scaleX)
  const y = toEmuOffset(component.y, scaleY)
  const w = toEmu(component.width, scaleX)
  const imageHeight = typeof component.height === 'number' && component.height > 0 ? component.height : component.width * (aspect ?? 1)
  const h = toEmu(imageHeight, scaleY)
  const shapes = [buildPicXml(component, shapeId, rId, x, y, w, h)]

  // A component may carry both an image and a caption. Emit the caption as a
  // transparent text shape on top so the picture stays visible beneath it:
  // retype to 'text' and clear the fill so buildShapeXml produces noFill
  // (card/panel/row/stat would otherwise paint an opaque default fill).
  const captionContent = stripImageMarkup(component.content || '')
  if (toPlainText(captionContent)) {
    const captionShape = buildShapeXml(
      { ...component, type: 'text', content: captionContent, style: { ...component.style, backgroundFill: undefined, backgroundColor: undefined } },
      shapeId + 1,
      scaleX,
      scaleY,
      slideRef,
      warnings,
      fontScale,
    )
    if (captionShape) shapes.push(captionShape)
  }
  return shapes
}

function buildFallbackNoteXml(): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="2" name="fallback-note"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="457200"/><a:ext cx="8229600" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1800"><a:solidFill><a:srgbClr val="666666"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${escXml('This slide had no exportable native components.')}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`
}

function buildSlideTreeXml(shapes: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="${A_NS}" xmlns:r="${R_NS}" xmlns:p="${P_NS}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
}

function buildSlideXml(
  slide: SlidePptxExportInput,
  slideIndex: number,
  warnings: string[],
  media: Array<{ path: string; data: Uint8Array }>,
  slideEmu: SlideEmu,
): SlideXmlResult {
  const safeWidth = Math.max(1, slide.canvas.width || 1920)
  const safeHeight = Math.max(1, slide.canvas.height || 1080)
  const scaleX = slideEmu.w / safeWidth
  const scaleY = slideEmu.h / safeHeight
  // 1 while the slide maps at true 96dpi; <1 only when a >56in canvas was scaled down.
  const fontScale = slideEmu.emuPerPx / EMU_PER_PX
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

  const background = buildBackgroundShapeXml(slide.canvas.background, slideEmu, shapeId)
  if (background) {
    shapes.push(background)
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
        const pictureShapes = buildPictureShapes(component, rId, imageAspectRatio(decoded), shapeId, scaleX, scaleY, slideRef, warnings, fontScale)
        shapes.push(...pictureShapes)
        shapeId += pictureShapes.length
        continue
      }
      // Decoding failed and already warned. An image-only logo has nothing else to
      // render, so it is skipped and no empty text shape is written.
      if (component.type === 'logo') continue
      // Otherwise fall through: the component may still have text/background/border.
    } else if (component.type === 'logo') {
      warnings.push(`${componentRef} had no embeddable image data and was skipped.`)
      continue
    }

    const shapeXml = buildShapeXml(component, shapeId, scaleX, scaleY, slideRef, warnings, fontScale)
    if (!shapeXml) continue
    shapes.push(shapeXml)
    shapeId += 1
  }

  if (shapes.length === 0) {
    shapes.push(buildFallbackNoteXml())
    warnings.push(`${slideRef}: no exportable components found; added fallback note.`)
  }

  const xml = buildSlideTreeXml(shapes)
  return { xml, relsXml: buildSlideRelsXml(imageRels) }
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
  // Slide size is presentation-level (one size for all slides); derive it from the
  // first slide's canvas, which reflects the chosen 16:9 / 1:1 preset for the deck.
  const slideEmu = computeSlideEmu(slides[0].canvas.width, slides[0].canvas.height)

  const media: Array<{ path: string; data: Uint8Array }> = []
  const slideEntries: Array<{ path: string; data: Uint8Array }> = []
  slides.forEach((slide, index) => {
    const { xml, relsXml } = buildSlideXml(slide, index, warnings, media, slideEmu)
    slideEntries.push({ path: `ppt/slides/slide${index + 1}.xml`, data: encoder.encode(xml) })
    slideEntries.push({ path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, data: encoder.encode(relsXml) })
  })
  const imageExtensions = media.map((entry) => entry.path.slice(entry.path.lastIndexOf('.') + 1))

  entries.push({ path: '[Content_Types].xml', data: encoder.encode(buildContentTypesXml(slides.length, imageExtensions)) })
  entries.push({ path: '_rels/.rels', data: encoder.encode(buildRootRelsXml()) })
  entries.push({ path: 'docProps/app.xml', data: encoder.encode(buildAppPropsXml(slides.length, slideEmu)) })
  entries.push({ path: 'docProps/core.xml', data: encoder.encode(buildCorePropsXml()) })
  entries.push({ path: 'ppt/presentation.xml', data: encoder.encode(buildPresentationXml(slides.length, slideEmu)) })
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
  }
}

export function convertSlideDocumentsToPptx(slidesInput: SlideDocumentPptxExportInput[]): SlidePptxExportResult {
  // Every slide of every document becomes a PPTX slide. A document with no slides exports one empty slide.
  return convertSlidesToPptx(slidesInput.flatMap((slide) => {
    const deck = slide.document.deck
    const deckSlides = deck.slides.length > 0 ? deck.slides : [undefined]
    return deckSlides.map((deckSlide, index) => ({
      id: index === 0 ? slide.id : `${slide.id}-${index + 1}`,
      title: slide.title,
      canvas: {
        width: deck.width,
        height: deck.height,
        ...(deckSlide?.background?.fill ? { background: deckSlide.background.fill } : {}),
      },
      components: Array.isArray(deckSlide?.elements) ? deckSlide.elements : [],
    }))
  }))
}
