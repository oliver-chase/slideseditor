import { useCallback } from 'react'
import { applyLayoutConstraintToComponents, syncSlideDocument } from '@/components/slides/document'
import type { Dispatch, SetStateAction } from 'react'
import type { SlideComponent, SlideImportResult, SlideLayoutConstraint } from '@/components/slides/types'

interface CanvasEditorNotice {
  tone: 'info' | 'error'
  text: string
}

interface UseSlidesEditorToolbarMutationsOptions {
  result: SlideImportResult | null
  activeDocumentSlideId: string | null
  selectedComponentIds: string[]
  selectedComponents: SlideComponent[]
  minFontSize: number
  minComponentWidth: number
  minComponentHeight: number
  setResult: Dispatch<SetStateAction<SlideImportResult | null>>
  setEditorNotice: Dispatch<SetStateAction<CanvasEditorNotice | null>>
  setDirty: () => void
  pushHistorySnapshot: (components: SlideComponent[]) => void
  areComponentsEqual: (a: SlideComponent[], b: SlideComponent[]) => boolean
  supportsTextAutoSize: (component: SlideComponent) => boolean
  measureTextAutoSizeHeight: (component: SlideComponent, width: number) => number
  clampCanvasCoordinates: (
    component: SlideComponent,
    canvas: { width: number; height: number },
    x: number,
    y: number,
  ) => { x: number; y: number }
}

interface UseSlidesEditorToolbarMutationsResult {
  applyStyleToSelection: (patch: Partial<SlideComponent['style']>) => void
  applyBoundsToSelection: (patch: Partial<Pick<SlideComponent, 'x' | 'y' | 'width' | 'height'>>) => void
  alignSelection: (mode: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y', target?: 'selection' | 'canvas') => void
  distributeSelection: (axis: 'horizontal' | 'vertical') => void
  applyLayoutConstraintSelection: (constraint: SlideLayoutConstraint) => void
}

export function useSlidesEditorToolbarMutations({
  result,
  activeDocumentSlideId,
  selectedComponentIds,
  selectedComponents,
  minFontSize,
  minComponentWidth,
  minComponentHeight,
  setResult,
  setEditorNotice,
  setDirty,
  pushHistorySnapshot,
  areComponentsEqual,
  supportsTextAutoSize,
  measureTextAutoSizeHeight,
  clampCanvasCoordinates,
}: UseSlidesEditorToolbarMutationsOptions): UseSlidesEditorToolbarMutationsResult {
  const syncResultComponents = useCallback((previous: SlideImportResult, components: SlideComponent[]): SlideImportResult => ({
    ...previous,
    components,
    document: syncSlideDocument({
      document: previous.document,
      canvas: previous.canvas,
      components,
      warnings: previous.warnings,
      slideId: activeDocumentSlideId || undefined,
    }),
  }), [activeDocumentSlideId])

  const applyStyleToSelection = useCallback((patch: Partial<SlideComponent['style']>) => {
    if (!result || selectedComponentIds.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one layer before applying styles.' })
      return
    }

    const selected = result.components.filter((component) => selectedComponentIds.includes(component.id))
    const editableSelected = selected.filter((component) => !component.locked)
    if (editableSelected.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Selected layers are locked and cannot be styled.' })
      return
    }

    const selectedIds = new Set(editableSelected.map((component) => component.id))
    const nextComponents = result.components.map((component) => {
      if (!selectedIds.has(component.id)) return component
      const nextStyle = {
        ...component.style,
        ...patch,
      }
      if (patch.backgroundColor !== undefined) {
        delete nextStyle.backgroundFill
      }
      if (typeof nextStyle.fontSize === 'number') {
        nextStyle.fontSize = Math.max(minFontSize, nextStyle.fontSize)
      }
      const nextHeight =
        nextStyle.textAutoSize && supportsTextAutoSize(component)
          ? measureTextAutoSizeHeight({ ...component, style: nextStyle }, component.width)
          : component.height
      return {
        ...component,
        style: nextStyle,
        height: nextHeight,
      }
    })

    if (areComponentsEqual(result.components, nextComponents)) {
      setEditorNotice({ tone: 'info', text: 'No style changes were applied.' })
      return
    }

    pushHistorySnapshot(result.components)
    setResult((previous) => (previous ? syncResultComponents(previous, nextComponents) : previous))
    setDirty()
    setEditorNotice({
      tone: 'info',
      text:
        `Updated styles for ${editableSelected.length} layer(s).` +
        (selected.length > editableSelected.length ? ' Locked layers were skipped.' : ''),
    })
  }, [
    areComponentsEqual,
    measureTextAutoSizeHeight,
    minFontSize,
    pushHistorySnapshot,
    result,
    selectedComponentIds,
    setDirty,
    setEditorNotice,
    setResult,
    supportsTextAutoSize,
  ])

  const applyBoundsToSelection = useCallback((patch: Partial<Pick<SlideComponent, 'x' | 'y' | 'width' | 'height'>>) => {
    if (!result || selectedComponents.length !== 1) {
      setEditorNotice({ tone: 'error', text: 'Select one unlocked layer before editing bounds.' })
      return
    }

    const component = selectedComponents[0]
    if (component.locked) {
      setEditorNotice({ tone: 'error', text: 'Locked layers cannot be resized or moved from the inspector.' })
      return
    }

    const hasX = Number.isFinite(patch.x)
    const hasY = Number.isFinite(patch.y)
    const hasWidth = Number.isFinite(patch.width)
    const hasHeight = Number.isFinite(patch.height)
    if (!hasX && !hasY && !hasWidth && !hasHeight) return

    const nextWidth = hasWidth
      ? Math.max(minComponentWidth, Math.round(Number(patch.width)))
      : component.width
    const autoSizeEnabled = component.style.textAutoSize && supportsTextAutoSize(component)
    const maxHeight = Math.max(minComponentHeight, result.canvas.height - component.y)
    const directHeight = hasHeight
      ? Math.max(minComponentHeight, Math.round(Number(patch.height)))
      : (typeof component.height === 'number' ? component.height : minComponentHeight)
    const nextHeight = autoSizeEnabled
      ? Math.min(maxHeight, measureTextAutoSizeHeight(component, nextWidth))
      : directHeight

    const nextCoordinates = clampCanvasCoordinates(
      { ...component, width: nextWidth, height: nextHeight },
      result.canvas,
      hasX ? Math.max(0, Math.round(Number(patch.x))) : component.x,
      hasY ? Math.max(0, Math.round(Number(patch.y))) : component.y,
    )

    if (
      nextCoordinates.x === component.x &&
      nextCoordinates.y === component.y &&
      nextWidth === component.width &&
      nextHeight === (typeof component.height === 'number' ? component.height : minComponentHeight)
    ) {
      return
    }

    pushHistorySnapshot(result.components)
    setResult((previous) => {
      if (!previous) return previous
      return syncResultComponents(previous, previous.components.map((entry) => (
          entry.id === component.id
            ? {
                ...entry,
                x: nextCoordinates.x,
                y: nextCoordinates.y,
                width: nextWidth,
                height: nextHeight,
              }
            : entry
        )))
    })
    setDirty()
    setEditorNotice({
      tone: 'info',
      text: autoSizeEnabled
        ? 'Updated layer bounds. Height is auto-sized from text content.'
        : 'Updated layer bounds from inspector controls.',
    })
  }, [
    clampCanvasCoordinates,
    measureTextAutoSizeHeight,
    minComponentHeight,
    minComponentWidth,
    pushHistorySnapshot,
    result,
    selectedComponents,
    setDirty,
    setEditorNotice,
    setResult,
    supportsTextAutoSize,
  ])

  const alignSelection = useCallback((mode: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y', target: 'selection' | 'canvas' = 'selection') => {
    if (!result || selectedComponentIds.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one layer before aligning.' })
      return
    }

    const selected = result.components.filter((component) => selectedComponentIds.includes(component.id))
    const movableSelected = selected.filter((component) => !component.locked)
    if (target === 'selection' && movableSelected.length < 2) {
      setEditorNotice({ tone: 'error', text: 'Select at least two unlocked layers before aligning to selection.' })
      return
    }
    if (target === 'canvas' && movableSelected.length < 1) {
      setEditorNotice({ tone: 'error', text: 'Select at least one unlocked layer before aligning to slide.' })
      return
    }

    const minX = target === 'canvas' ? 0 : Math.min(...movableSelected.map((component) => component.x))
    const maxRight = target === 'canvas' ? result.canvas.width : Math.max(...movableSelected.map((component) => component.x + component.width))
    const minY = target === 'canvas' ? 0 : Math.min(...movableSelected.map((component) => component.y))
    const maxBottom = target === 'canvas' ? result.canvas.height : Math.max(...movableSelected.map((component) => component.y + (component.height ?? minComponentHeight)))
    const centerX = minX + ((maxRight - minX) / 2)
    const centerY = minY + ((maxBottom - minY) / 2)
    const selectedIds = new Set(movableSelected.map((component) => component.id))

    const nextComponents = result.components.map((component) => {
      if (!selectedIds.has(component.id)) return component

      let nextX = component.x
      let nextY = component.y
      if (mode === 'left') nextX = minX
      if (mode === 'right') nextX = maxRight - component.width
      if (mode === 'top') nextY = minY
      if (mode === 'bottom') nextY = maxBottom - (component.height ?? minComponentHeight)
      if (mode === 'center-x') nextX = Math.round(centerX - (component.width / 2))
      if (mode === 'center-y') nextY = Math.round(centerY - ((component.height ?? minComponentHeight) / 2))

      const nextCoordinates = clampCanvasCoordinates(component, result.canvas, nextX, nextY)
      return {
        ...component,
        x: nextCoordinates.x,
        y: nextCoordinates.y,
      }
    })

    if (areComponentsEqual(result.components, nextComponents)) {
      setEditorNotice({ tone: 'info', text: 'Alignment made no positional changes.' })
      return
    }

    pushHistorySnapshot(result.components)
    setResult((previous) => (previous ? syncResultComponents(previous, nextComponents) : previous))
    setDirty()
    setEditorNotice({
      tone: 'info',
      text:
        `Applied ${mode} alignment to ${movableSelected.length} layer(s).` +
        (target === 'canvas' ? ' Target: slide.' : ' Target: selection.') +
        (selected.length > movableSelected.length ? ' Locked layers were skipped.' : ''),
    })
  }, [
    areComponentsEqual,
    clampCanvasCoordinates,
    minComponentHeight,
    pushHistorySnapshot,
    result,
    selectedComponentIds,
    setDirty,
    setEditorNotice,
    setResult,
  ])

  const distributeSelection = useCallback((axis: 'horizontal' | 'vertical') => {
    if (!result || selectedComponentIds.length < 3) {
      setEditorNotice({ tone: 'error', text: 'Select at least three layers to distribute spacing.' })
      return
    }

    const selected = result.components.filter((component) => selectedComponentIds.includes(component.id))
    const movableSelected = selected.filter((component) => !component.locked)
    if (movableSelected.length < 3) {
      setEditorNotice({ tone: 'error', text: 'Select at least three unlocked layers to distribute spacing.' })
      return
    }

    const sorted = [...movableSelected].sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const positions = new Map<string, { x: number; y: number }>()

    if (axis === 'horizontal') {
      const totalWidths = sorted.reduce((sum, component) => sum + component.width, 0)
      const span = (last.x + last.width) - first.x
      const gap = Math.max(0, (span - totalWidths) / (sorted.length - 1))
      let cursor = first.x
      sorted.forEach((component) => {
        positions.set(component.id, { x: Math.round(cursor), y: component.y })
        cursor += component.width + gap
      })
    } else {
      const heights = sorted.map((component) => component.height ?? minComponentHeight)
      const totalHeights = heights.reduce((sum, value) => sum + value, 0)
      const lastHeight = last.height ?? minComponentHeight
      const span = (last.y + lastHeight) - first.y
      const gap = Math.max(0, (span - totalHeights) / (sorted.length - 1))
      let cursor = first.y
      sorted.forEach((component, index) => {
        positions.set(component.id, { x: component.x, y: Math.round(cursor) })
        cursor += heights[index] + gap
      })
    }

    const nextComponents = result.components.map((component) => {
      const nextPosition = positions.get(component.id)
      if (!nextPosition) return component
      const nextCoordinates = clampCanvasCoordinates(component, result.canvas, nextPosition.x, nextPosition.y)
      return {
        ...component,
        x: nextCoordinates.x,
        y: nextCoordinates.y,
      }
    })

    if (areComponentsEqual(result.components, nextComponents)) {
      setEditorNotice({ tone: 'info', text: 'Distribution made no positional changes.' })
      return
    }

    pushHistorySnapshot(result.components)
    setResult((previous) => (previous ? syncResultComponents(previous, nextComponents) : previous))
    setDirty()
    setEditorNotice({
      tone: 'info',
      text:
        `Distributed ${movableSelected.length} layer(s) ${axis === 'horizontal' ? 'horizontally' : 'vertically'}.` +
        (selected.length > movableSelected.length ? ' Locked layers were skipped.' : ''),
    })
  }, [
    areComponentsEqual,
    clampCanvasCoordinates,
    minComponentHeight,
    pushHistorySnapshot,
    result,
    selectedComponentIds,
    setDirty,
    setEditorNotice,
    setResult,
  ])

  const applyLayoutConstraintSelection = useCallback((constraint: SlideLayoutConstraint) => {
    if (!result || selectedComponentIds.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one layer before applying layout constraints.' })
      return
    }

    if (constraint.type !== 'pinned' && selectedComponentIds.length < 2) {
      setEditorNotice({ tone: 'error', text: 'Select at least two layers to apply stack, row, or grid constraints.' })
      return
    }

    const selected = result.components.filter((component) => selectedComponentIds.includes(component.id))
    const editableSelected = selected.filter((component) => !component.locked)
    if (editableSelected.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Selected layers are locked and cannot receive layout constraints.' })
      return
    }

    const nextComponents = applyLayoutConstraintToComponents({
      canvas: result.canvas,
      components: result.components,
      selectedIds: selectedComponentIds,
      constraint,
    })

    if (areComponentsEqual(result.components, nextComponents)) {
      setEditorNotice({ tone: 'info', text: 'Layout constraint made no positional changes.' })
      return
    }

    pushHistorySnapshot(result.components)
    setResult((previous) => (previous ? syncResultComponents(previous, nextComponents) : previous))
    setDirty()
    setEditorNotice({
      tone: 'info',
      text:
        `Applied ${constraint.type} constraint to ${editableSelected.length} layer(s).` +
        (selected.length > editableSelected.length ? ' Locked layers were skipped.' : ''),
    })
  }, [
    areComponentsEqual,
    pushHistorySnapshot,
    result,
    selectedComponentIds,
    setDirty,
    setEditorNotice,
    setResult,
    syncResultComponents,
  ])

  return {
    applyStyleToSelection,
    applyBoundsToSelection,
    alignSelection,
    distributeSelection,
    applyLayoutConstraintSelection,
  }
}
