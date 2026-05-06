import {
  appendSlideToDocument,
  deleteSlideFromDocument,
  duplicateSlideInDocument,
  reorderSlideInDocument,
} from '@/components/slides/document'
import type { SlideCanvas, SlideComponent, SlideDocument, SlideImportResult } from '@/components/slides/types'
import { buildSyncedSlideDocument } from '@/app/slides/helpers/canvas-document-transforms'

export interface DeckDocumentInput {
  result: SlideImportResult
  activeSlideId?: string
}

export function createDeckSlideDocument({
  result,
  activeSlideId,
  nextSlideId,
}: DeckDocumentInput & {
  nextSlideId: string
}): SlideDocument {
  return appendSlideToDocument({
    document: buildSyncedSlideDocument({ result, slideId: activeSlideId }),
    slideId: nextSlideId,
    canvas: result.canvas,
    components: [],
  })
}

export function duplicateDeckSlideDocument({
  result,
  activeSlideId,
  sourceSlideId,
  nextSlideId,
}: DeckDocumentInput & {
  sourceSlideId: string
  nextSlideId: string
}): SlideDocument {
  return duplicateSlideInDocument(
    buildSyncedSlideDocument({ result, slideId: activeSlideId }),
    sourceSlideId,
    nextSlideId,
  )
}

export function deleteDeckSlideDocument({
  result,
  activeSlideId,
  sourceSlideId,
}: DeckDocumentInput & {
  sourceSlideId: string
}): SlideDocument {
  return deleteSlideFromDocument(
    buildSyncedSlideDocument({ result, slideId: activeSlideId }),
    sourceSlideId,
  )
}

export function reorderDeckSlideDocument({
  result,
  activeSlideId,
  sourceSlideId,
  direction,
}: DeckDocumentInput & {
  sourceSlideId: string
  direction: 'up' | 'down'
}): SlideDocument {
  return reorderSlideInDocument(
    buildSyncedSlideDocument({ result, slideId: activeSlideId }),
    sourceSlideId,
    direction,
  )
}

export function appendImportedHtmlAsDeckSlide({
  result,
  activeSlideId,
  nextSlideId,
  canvas,
  components,
}: DeckDocumentInput & {
  nextSlideId: string
  canvas: SlideCanvas
  components: SlideComponent[]
}): SlideDocument {
  return appendSlideToDocument({
    document: buildSyncedSlideDocument({ result, slideId: activeSlideId }),
    slideId: nextSlideId,
    canvas,
    components,
  })
}
