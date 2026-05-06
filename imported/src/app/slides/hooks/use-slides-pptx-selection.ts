import { useCallback, useMemo, useState } from 'react'

export interface UseSlidesPptxSelectionOptions {
  visibleSlideIds: string[]
}

export interface UseSlidesPptxSelectionResult {
  pptxSelectedSlideIds: string[]
  selectedVisibleSlideCount: number
  selectedHiddenSlideCount: number
  hasHiddenSelections: boolean
  areAllVisibleSlidesSelected: boolean
  togglePptxSlideSelection: (slideId: string) => void
  selectAllVisibleSlides: () => void
  keepVisibleSelection: () => void
  clearPptxSelection: () => void
  clearMissingSelections: (availableSlideIds: string[]) => void
}

export function useSlidesPptxSelection({
  visibleSlideIds,
}: UseSlidesPptxSelectionOptions): UseSlidesPptxSelectionResult {
  const [pptxSelectedSlideIds, setPptxSelectedSlideIds] = useState<string[]>([])

  const selectedVisibleSlideCount = useMemo(() => (
    pptxSelectedSlideIds.filter((slideId) => visibleSlideIds.includes(slideId)).length
  ), [pptxSelectedSlideIds, visibleSlideIds])

  const selectedHiddenSlideCount = Math.max(0, pptxSelectedSlideIds.length - selectedVisibleSlideCount)
  const hasHiddenSelections = selectedHiddenSlideCount > 0
  const areAllVisibleSlidesSelected = visibleSlideIds.length > 0
    && selectedVisibleSlideCount === visibleSlideIds.length

  const togglePptxSlideSelection = useCallback((slideId: string) => {
    setPptxSelectedSlideIds((previous) => (
      previous.includes(slideId)
        ? previous.filter((id) => id !== slideId)
        : [...previous, slideId]
    ))
  }, [])

  const selectAllVisibleSlides = useCallback((visibleSlides: string[]) => {
    setPptxSelectedSlideIds((previous) => {
      if (visibleSlides.length === 0) return previous
      const next = new Set(previous)
      for (const slideId of visibleSlides) {
        next.add(slideId)
      }
      return Array.from(next)
    })
  }, [])

  const keepVisibleSelection = useCallback(() => {
    setPptxSelectedSlideIds((previous) => previous.filter((slideId) => visibleSlideIds.includes(slideId)))
  }, [visibleSlideIds])

  const clearPptxSelection = useCallback(() => {
    setPptxSelectedSlideIds([])
  }, [])

  const clearMissingSelections = useCallback((availableSlideIds: string[]) => {
    const availableSet = new Set(availableSlideIds)
    setPptxSelectedSlideIds((previous) => previous.filter((slideId) => availableSet.has(slideId)))
  }, [])

  return {
    pptxSelectedSlideIds,
    selectedVisibleSlideCount,
    selectedHiddenSlideCount,
    hasHiddenSelections,
    areAllVisibleSlidesSelected,
    togglePptxSlideSelection,
    selectAllVisibleSlides: () => selectAllVisibleSlides(visibleSlideIds),
    keepVisibleSelection,
    clearPptxSelection,
    clearMissingSelections,
  }
}
