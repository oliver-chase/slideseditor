import {
  adaptComponentsToResponsiveCanvas,
  syncSlideDocument,
} from '@/components/slides/document'
import type { SlideDocument, SlideImportResult } from '@/components/slides/types'
import {
  MIN_COMPONENT_HEIGHT,
  scaleComponentProportionally,
} from '@/app/slides/page-model'

export interface SyncedSlideDocumentInput {
  result: SlideImportResult
  slideId?: string
}

export function buildSyncedSlideDocument({
  result,
  slideId,
}: SyncedSlideDocumentInput): SlideDocument {
  return syncSlideDocument({
    document: result.document,
    canvas: result.canvas,
    components: result.components,
    warnings: result.warnings,
    slideId,
  })
}

export interface CanvasCropRequest {
  result: SlideImportResult
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  slideId?: string
}

export interface CanvasCropResult {
  syncedDocument: SlideDocument
  croppedDocument: SlideDocument
  outOfBoundsCount: number
}

export function cropSlideDocumentCanvas({
  result,
  cropX,
  cropY,
  cropWidth,
  cropHeight,
  slideId,
}: CanvasCropRequest): CanvasCropResult {
  const syncedDocument = buildSyncedSlideDocument({ result, slideId })
  let outOfBoundsCount = 0

  const croppedDocument: SlideDocument = {
    ...syncedDocument,
    deck: {
      ...syncedDocument.deck,
      width: cropWidth,
      height: cropHeight,
      slides: syncedDocument.deck.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((component) => {
          const next = {
            ...component,
            x: Math.round(component.x - cropX),
            y: Math.round(component.y - cropY),
            style: { ...component.style },
            ...(component.layoutConstraint ? { layoutConstraint: { ...component.layoutConstraint } } : {}),
          }
          const height = typeof next.height === 'number' ? next.height : MIN_COMPONENT_HEIGHT
          const outside = next.x < 0 || next.y < 0 || next.x + next.width > cropWidth || next.y + height > cropHeight
          if (outside) outOfBoundsCount += 1
          return next
        }),
      })),
    },
    warnings: Array.from(new Set([
      ...syncedDocument.warnings,
      ...(outOfBoundsCount > 0
        ? [`Crop preserved ${outOfBoundsCount} layer${outOfBoundsCount === 1 ? '' : 's'} outside the visible canvas bounds; use Layers Panel or Reset Crop to recover.`]
        : []),
    ])),
  }

  return { syncedDocument, croppedDocument, outOfBoundsCount }
}

export interface CanvasResizeRequest {
  result: SlideImportResult
  nextWidth: number
  nextHeight: number
  slideId?: string
}

export function resizeSlideDocumentProportionally({
  result,
  nextWidth,
  nextHeight,
  slideId,
}: CanvasResizeRequest): SlideDocument {
  const syncedDocument = buildSyncedSlideDocument({ result, slideId })
  const widthRatio = nextWidth / Math.max(1, syncedDocument.deck.width)
  const heightRatio = nextHeight / Math.max(1, syncedDocument.deck.height)

  return {
    ...syncedDocument,
    deck: {
      ...syncedDocument.deck,
      width: nextWidth,
      height: nextHeight,
      slides: syncedDocument.deck.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((component) => scaleComponentProportionally(component, widthRatio, heightRatio)),
      })),
    },
  }
}

export function resizeSlideDocumentResponsively({
  result,
  nextWidth,
  nextHeight,
  slideId,
}: CanvasResizeRequest): SlideDocument {
  const syncedDocument = buildSyncedSlideDocument({ result, slideId })

  return {
    ...syncedDocument,
    deck: {
      ...syncedDocument.deck,
      width: nextWidth,
      height: nextHeight,
      slides: syncedDocument.deck.slides.map((slide) => ({
        ...slide,
        elements: adaptComponentsToResponsiveCanvas({
          previousCanvas: { width: syncedDocument.deck.width, height: syncedDocument.deck.height },
          nextCanvas: { width: nextWidth, height: nextHeight },
          components: slide.elements,
        }),
      })),
    },
  }
}
