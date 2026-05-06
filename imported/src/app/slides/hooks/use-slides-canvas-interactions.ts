import { useCallback } from 'react'
import { syncSlideDocument } from '@/components/slides/document'
import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from 'react'
import type { SlideComponent, SlideComponentType, SlideImportResult } from '@/components/slides/types'

interface CanvasEditorNotice {
  tone: 'info' | 'error'
  text: string
}

interface CanvasSnapGuides {
  x: number | null
  y: number | null
}

export interface CanvasDragState {
  componentIds: string[]
  pointerId: number
  startClientX: number
  startClientY: number
  originById: Record<string, { x: number; y: number }>
  snapshotBefore: SlideComponent[]
}

export interface CanvasResizeState {
  componentId: string
  pointerId: number
  startClientX: number
  startClientY: number
  originX: number
  originY: number
  originWidth: number
  originHeight: number
  supportsHeight: boolean
  snapshotBefore: SlideComponent[]
}

interface UseSlidesCanvasInteractionsOptions {
  result: SlideImportResult | null
  activeDocumentSlideId: string | null
  selectedComponentIds: string[]
  editingComponentId: string | null
  draggingComponentId: string | null
  historyPast: SlideComponent[][]
  historyFuture: SlideComponent[][]
  primarySelectedComponentId: string | null
  canInlineEditSelected: boolean
  canvasScale: number
  minComponentWidth: number
  minComponentHeight: number
  maxHistoryEntries: number
  snapTolerancePx: number
  editableComponentTypes: Set<SlideComponentType>
  setResult: Dispatch<SetStateAction<SlideImportResult | null>>
  setSelectedComponentIds: Dispatch<SetStateAction<string[]>>
  setEditingComponentId: Dispatch<SetStateAction<string | null>>
  setDraggingComponentId: Dispatch<SetStateAction<string | null>>
  setResizingComponentId: Dispatch<SetStateAction<string | null>>
  setHistoryPast: Dispatch<SetStateAction<SlideComponent[][]>>
  setHistoryFuture: Dispatch<SetStateAction<SlideComponent[][]>>
  setEditorNotice: Dispatch<SetStateAction<CanvasEditorNotice | null>>
  canvasDragRef: MutableRefObject<CanvasDragState | null>
  canvasResizeRef: MutableRefObject<CanvasResizeState | null>
  canvasDragMovedRef: MutableRefObject<boolean>
  canvasResizeMovedRef: MutableRefObject<boolean>
  canvasContentRefs: MutableRefObject<Record<string, HTMLDivElement | null>>
  isTextEntryTarget: (target: EventTarget | null) => boolean
  pushHistorySnapshot: (components: SlideComponent[]) => void
  cloneComponents: (components: SlideComponent[]) => SlideComponent[]
  areComponentsEqual: (a: SlideComponent[], b: SlideComponent[]) => boolean
  updateCanvasSnapGuides: (next: CanvasSnapGuides) => void
  setDirty: () => void
  supportsTextAutoSize: (component: SlideComponent) => boolean
  measureTextAutoSizeHeight: (component: SlideComponent, width: number) => number
  clampCanvasCoordinates: (
    component: SlideComponent,
    canvas: { width: number; height: number },
    x: number,
    y: number,
  ) => { x: number; y: number }
  buildCanvasSnapTargets: (
    components: SlideComponent[],
    excludedIds: Set<string>,
    canvas: { width: number; height: number },
  ) => { x: number[]; y: number[] }
  findMoveSnap: (
    start: number,
    size: number,
    targets: number[],
    tolerance: number,
  ) => { delta: number; guide: number | null }
  findEndSnap: (
    end: number,
    targets: number[],
    tolerance: number,
  ) => { delta: number; guide: number | null }
  resolveComponentHeight: (component: SlideComponent) => number
  groupSelection?: () => void
  ungroupSelection?: () => void
}

interface UseSlidesCanvasInteractionsResult {
  updateCanvasComponentContent: (componentId: string, content: string) => void
  beginInlineEditMode: (componentId: string) => void
  handleCanvasLayerSelect: (componentId: string, options?: { multi?: boolean }) => void
  handleUndo: () => void
  handleRedo: () => void
  reorderSelection: (mode: 'forward' | 'backward' | 'front' | 'back') => void
  duplicateSelection: () => void
  deleteSelection: () => void
  handleCanvasKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  handleCanvasPointerDown: (component: SlideComponent, event: ReactPointerEvent<HTMLElement>) => void
  handleResizePointerDown: (component: SlideComponent, event: ReactPointerEvent<HTMLElement>) => void
  handleCanvasPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  handleCanvasResizeMove: (event: ReactPointerEvent<HTMLElement>) => void
  handleCanvasPointerRelease: (event: ReactPointerEvent<HTMLElement>) => void
}

function getUnlockedSelectedIds(components: SlideComponent[], selectedComponentIds: string[]): Set<string> {
  return new Set(
    components
      .filter((component) => selectedComponentIds.includes(component.id) && !component.locked)
      .map((component) => component.id),
  )
}

function getArrowDelta(key: string, step: number): { x: number; y: number } | null {
  if (key === 'ArrowLeft') return { x: -step, y: 0 }
  if (key === 'ArrowRight') return { x: step, y: 0 }
  if (key === 'ArrowUp') return { x: 0, y: -step }
  if (key === 'ArrowDown') return { x: 0, y: step }
  return null
}

export function useSlidesCanvasInteractions({
  result,
  activeDocumentSlideId,
  selectedComponentIds,
  editingComponentId,
  draggingComponentId,
  historyPast,
  historyFuture,
  primarySelectedComponentId,
  canInlineEditSelected,
  canvasScale,
  minComponentWidth,
  minComponentHeight,
  maxHistoryEntries,
  snapTolerancePx,
  editableComponentTypes,
  setResult,
  setSelectedComponentIds,
  setEditingComponentId,
  setDraggingComponentId,
  setResizingComponentId,
  setHistoryPast,
  setHistoryFuture,
  setEditorNotice,
  canvasDragRef,
  canvasResizeRef,
  canvasDragMovedRef,
  canvasResizeMovedRef,
  canvasContentRefs,
  isTextEntryTarget,
  pushHistorySnapshot,
  cloneComponents,
  areComponentsEqual,
  updateCanvasSnapGuides,
  setDirty,
  supportsTextAutoSize,
  measureTextAutoSizeHeight,
  clampCanvasCoordinates,
  buildCanvasSnapTargets,
  findMoveSnap,
  findEndSnap,
  resolveComponentHeight,
  groupSelection,
  ungroupSelection,
}: UseSlidesCanvasInteractionsOptions): UseSlidesCanvasInteractionsResult {
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

  const focusInlineEditor = useCallback((componentId: string) => {
    window.requestAnimationFrame(() => {
      const node = canvasContentRefs.current[componentId]
      if (!node) return
      node.focus()
      if (document.getSelection) {
        const selection = document.getSelection()
        if (!selection) return
        const range = document.createRange()
        range.selectNodeContents(node)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    })
  }, [canvasContentRefs])

  const beginInlineEditMode = useCallback((componentId: string) => {
    if (!result) return
    const component = result.components.find((entry) => entry.id === componentId)
    if (!component || component.locked || !editableComponentTypes.has(component.type)) return
    setSelectedComponentIds([componentId])
    setEditingComponentId(componentId)
    focusInlineEditor(componentId)
  }, [editableComponentTypes, focusInlineEditor, result, setEditingComponentId, setSelectedComponentIds])

  const handleCanvasLayerSelect = useCallback((componentId: string, options?: { multi?: boolean }) => {
    const selectedComponent = result?.components.find((component) => component.id === componentId) || null
    const groupedSelectionIds = selectedComponent?.groupId
      ? result?.components
          .filter((component) => component.groupId === selectedComponent.groupId && component.visible !== false)
          .map((component) => component.id) || [componentId]
      : [componentId]
    setEditingComponentId(null)
    if (options?.multi) {
      setSelectedComponentIds((previous) => {
        if (groupedSelectionIds.every((id) => previous.includes(id))) {
          return previous.filter((id) => !groupedSelectionIds.includes(id))
        }
        return Array.from(new Set([...previous, ...groupedSelectionIds]))
      })
      return
    }
    setSelectedComponentIds(groupedSelectionIds)
  }, [result, setEditingComponentId, setSelectedComponentIds])

  const handleUndo = useCallback(() => {
    if (!result || historyPast.length === 0) return
    const previousSnapshot = historyPast[historyPast.length - 1]
    const currentSnapshot = cloneComponents(result.components)
    setHistoryPast(historyPast.slice(0, -1))
    setHistoryFuture((previous) => {
      const next = [...previous, currentSnapshot]
      return next.length > maxHistoryEntries ? next.slice(next.length - maxHistoryEntries) : next
    })
    setResult(syncResultComponents(result, cloneComponents(previousSnapshot)))
    setSelectedComponentIds((previous) => previous.filter((id) => previousSnapshot.some((component) => component.id === id)))
    setEditingComponentId(null)
    setEditorNotice({ tone: 'info', text: 'Undid last editor action.' })
    setDirty()
  }, [
    cloneComponents,
    historyPast,
    maxHistoryEntries,
    result,
    setDirty,
    setEditingComponentId,
    setEditorNotice,
    setHistoryFuture,
    setHistoryPast,
    setResult,
    setSelectedComponentIds,
  ])

  const handleRedo = useCallback(() => {
    if (!result || historyFuture.length === 0) return
    const nextSnapshot = historyFuture[historyFuture.length - 1]
    const currentSnapshot = cloneComponents(result.components)
    setHistoryFuture(historyFuture.slice(0, -1))
    setHistoryPast((previous) => {
      const next = [...previous, currentSnapshot]
      return next.length > maxHistoryEntries ? next.slice(next.length - maxHistoryEntries) : next
    })
    setResult(syncResultComponents(result, cloneComponents(nextSnapshot)))
    setSelectedComponentIds((previous) => previous.filter((id) => nextSnapshot.some((component) => component.id === id)))
    setEditingComponentId(null)
    setEditorNotice({ tone: 'info', text: 'Redid editor action.' })
    setDirty()
  }, [
    cloneComponents,
    historyFuture,
    maxHistoryEntries,
    result,
    setDirty,
    setEditingComponentId,
    setEditorNotice,
    setHistoryFuture,
    setHistoryPast,
    setResult,
    setSelectedComponentIds,
  ])

  const reorderSelection = useCallback((mode: 'forward' | 'backward' | 'front' | 'back') => {
    if (!result || selectedComponentIds.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one layer before changing ordering.' })
      return
    }

    const selectedIds = getUnlockedSelectedIds(result.components, selectedComponentIds)
    if (selectedIds.size === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one unlocked layer before changing ordering.' })
      return
    }

    const nextComponents = [...result.components]
    if (mode === 'front') {
      const moving = nextComponents.filter((component) => selectedIds.has(component.id))
      const remaining = nextComponents.filter((component) => !selectedIds.has(component.id))
      nextComponents.length = 0
      nextComponents.push(...remaining, ...moving)
    } else if (mode === 'back') {
      const moving = nextComponents.filter((component) => selectedIds.has(component.id))
      const remaining = nextComponents.filter((component) => !selectedIds.has(component.id))
      nextComponents.length = 0
      nextComponents.push(...moving, ...remaining)
    } else if (mode === 'forward') {
      const movingIds = nextComponents
        .filter((component) => selectedIds.has(component.id))
        .map((component) => component.id)
      for (const id of movingIds.reverse()) {
        const source = nextComponents.findIndex((component) => component.id === id)
        if (source < 0 || source >= nextComponents.length - 1) continue
        ;[nextComponents[source], nextComponents[source + 1]] = [nextComponents[source + 1], nextComponents[source]]
      }
    } else {
      const movingIds = nextComponents
        .filter((component) => selectedIds.has(component.id))
        .map((component) => component.id)
      for (const id of movingIds) {
        const source = nextComponents.findIndex((component) => component.id === id)
        if (source <= 0) continue
        ;[nextComponents[source], nextComponents[source - 1]] = [nextComponents[source - 1], nextComponents[source]]
      }
    }

    if (areComponentsEqual(result.components, nextComponents)) {
      setEditorNotice({ tone: 'info', text: 'Layer order did not change.' })
      return
    }

    const movedCount = selectedIds.size
    const nextSelection = nextComponents
      .filter((component) => selectedIds.has(component.id))
      .map((component) => component.id)
    pushHistorySnapshot(result.components)
    setResult((previous) => (previous ? syncResultComponents(previous, nextComponents) : previous))
    setSelectedComponentIds(nextSelection)
    setDirty()
    setEditorNotice({
      tone: 'info',
      text:
        mode === 'front'
          ? `Moved ${movedCount} layer(s) to front.`
          : mode === 'back'
            ? `Moved ${movedCount} layer(s) to back.`
            : mode === 'forward'
              ? `Raised ${movedCount} layer(s).`
              : `Lowered ${movedCount} layer(s).`,
    })
  }, [areComponentsEqual, pushHistorySnapshot, result, selectedComponentIds, setDirty, setEditorNotice, setResult, setSelectedComponentIds])

  const duplicateSelection = useCallback(() => {
    if (!result || selectedComponentIds.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one layer before duplicating.' })
      return
    }

    const selectedIds = getUnlockedSelectedIds(result.components, selectedComponentIds)
    if (selectedIds.size === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one unlocked layer before duplicating.' })
      return
    }

    const copySeed = Date.now().toString(36)
    const nextComponents: SlideComponent[] = []
    let duplicateCount = 0
    for (const component of result.components) {
      nextComponents.push(component)
      if (!selectedIds.has(component.id)) continue
      duplicateCount += 1
      const componentHeight = typeof component.height === 'number' ? component.height : minComponentHeight
      nextComponents.push({
        ...component,
        id: `${component.id}-copy-${copySeed}-${duplicateCount}`,
        x: Math.max(0, Math.min(result.canvas.width - component.width, component.x + 16)),
        y: Math.max(0, Math.min(result.canvas.height - componentHeight, component.y + 16)),
      })
    }

    if (duplicateCount === 0 || areComponentsEqual(result.components, nextComponents)) {
      setEditorNotice({ tone: 'info', text: 'Layer duplication did not change the canvas.' })
      return
    }

    const duplicateIds = nextComponents
      .filter((component) => component.id.includes(`-copy-${copySeed}-`))
      .map((component) => component.id)

    pushHistorySnapshot(result.components)
    setResult((previous) => (previous ? syncResultComponents(previous, nextComponents) : previous))
    setSelectedComponentIds(duplicateIds)
    setDirty()
    setEditorNotice({ tone: 'info', text: `Duplicated ${duplicateCount} layer(s).` })
  }, [areComponentsEqual, pushHistorySnapshot, result, selectedComponentIds, setDirty, setEditorNotice, setResult, setSelectedComponentIds, syncResultComponents])

  const deleteSelection = useCallback(() => {
    if (!result || selectedComponentIds.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one layer before deleting.' })
      return
    }

    const selectedIds = getUnlockedSelectedIds(result.components, selectedComponentIds)
    if (selectedIds.size === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one unlocked layer before deleting.' })
      return
    }

    const nextComponents = result.components.filter((component) => !selectedIds.has(component.id))
    if (nextComponents.length === result.components.length) {
      setEditorNotice({ tone: 'info', text: 'Layer deletion did not change the canvas.' })
      return
    }

    pushHistorySnapshot(result.components)
    setResult((previous) => (previous ? syncResultComponents(previous, nextComponents) : previous))
    setSelectedComponentIds((previous) => previous.filter((id) => !selectedIds.has(id)))
    setEditingComponentId(null)
    setDirty()
    setEditorNotice({ tone: 'info', text: `Deleted ${selectedIds.size} layer(s).` })
  }, [pushHistorySnapshot, result, selectedComponentIds, setDirty, setEditingComponentId, setEditorNotice, setResult, setSelectedComponentIds, syncResultComponents])

  const updateCanvasComponentContent = useCallback((componentId: string, content: string) => {
    if (!result) return
    const existing = result.components.find((component) => component.id === componentId)
    if (!existing || existing.locked || existing.content === content) return
    pushHistorySnapshot(result.components)
    setResult((previous) => {
      if (!previous) return previous
      const nextComponents = previous.components.map((component) => {
        if (component.id !== componentId) return component
        const nextHeight =
          component.style.textAutoSize && supportsTextAutoSize(component)
            ? measureTextAutoSizeHeight({ ...component, content }, component.width)
            : component.height
        return {
          ...component,
          content,
          height: nextHeight,
        }
      })
      return syncResultComponents(previous, nextComponents)
    })
    setDirty()
  }, [measureTextAutoSizeHeight, pushHistorySnapshot, result, setDirty, setResult, supportsTextAutoSize])

  const handleCanvasKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!result) return
    if (isTextEntryTarget(event.target)) {
      if (event.key === 'Escape' && editingComponentId) {
        setEditingComponentId(null)
        const target = event.target as HTMLElement
        target.blur()
      }
      return
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      const ids = result.components.filter((component) => component.visible !== false).map((component) => component.id)
      setSelectedComponentIds(ids)
      setEditorNotice({ tone: 'info', text: `Selected ${ids.length} layers.` })
      return
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) {
        handleRedo()
      } else {
        handleUndo()
      }
      return
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      handleRedo()
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key === '[') {
      event.preventDefault()
      reorderSelection('back')
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.key === ']') {
      event.preventDefault()
      reorderSelection('front')
      return
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === '[') {
      event.preventDefault()
      reorderSelection('backward')
      return
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === ']') {
      event.preventDefault()
      reorderSelection('forward')
      return
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      duplicateSelection()
      return
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      deleteSelection()
      return
    }

    if (event.key === 'Escape') {
      setSelectedComponentIds([])
      setEditingComponentId(null)
      return
    }

    if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault()
      const visibleIds = result.components.filter((component) => component.visible !== false).map((component) => component.id)
      if (visibleIds.length === 0) return
      const direction = event.key === 'PageDown' ? 1 : -1
      const currentIndex = primarySelectedComponentId ? visibleIds.indexOf(primarySelectedComponentId) : -1
      const nextIndex = currentIndex < 0
        ? 0
        : (currentIndex + direction + visibleIds.length) % visibleIds.length
      setSelectedComponentIds([visibleIds[nextIndex]])
      setEditingComponentId(null)
      return
    }

    if (event.key === 'Enter' && canInlineEditSelected && primarySelectedComponentId) {
      event.preventDefault()
      beginInlineEditMode(primarySelectedComponentId)
      return
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'g') {
      event.preventDefault()
      if (event.shiftKey) {
        ungroupSelection?.()
      } else {
        groupSelection?.()
      }
      return
    }

    if (selectedComponentIds.length === 0) return

    if (event.altKey && !event.metaKey && !event.ctrlKey) {
      const resizeDelta = getArrowDelta(event.key, event.shiftKey ? 10 : 1)
      if (!resizeDelta) return
      const { x: deltaWidth, y: deltaHeight } = resizeDelta
      event.preventDefault()

      const selectedIds = getUnlockedSelectedIds(result.components, selectedComponentIds)
      if (selectedIds.size === 0) {
        setEditorNotice({ tone: 'error', text: 'Locked layers cannot be resized with keyboard shortcuts.' })
        return
      }

      const canResize = result.components.some((component) => {
        if (!selectedIds.has(component.id)) return false
        const maxWidth = Math.max(minComponentWidth, result.canvas.width - component.x)
        const nextWidth = Math.min(maxWidth, Math.max(minComponentWidth, component.width + deltaWidth))
        const maxHeight = Math.max(minComponentHeight, result.canvas.height - component.y)
        const baseHeight = typeof component.height === 'number' ? component.height : minComponentHeight
        const nextHeight = component.style.textAutoSize && supportsTextAutoSize(component)
          ? Math.min(maxHeight, measureTextAutoSizeHeight(component, nextWidth))
          : Math.min(maxHeight, Math.max(minComponentHeight, baseHeight + deltaHeight))
        return nextWidth !== component.width || nextHeight !== baseHeight
      })
      if (!canResize) return

      pushHistorySnapshot(result.components)
      setResult((previous) => {
        if (!previous) return previous
        const nextComponents = previous.components.map((component) => {
          if (!selectedIds.has(component.id)) return component
          const maxWidth = Math.max(minComponentWidth, previous.canvas.width - component.x)
          const nextWidth = Math.min(maxWidth, Math.max(minComponentWidth, component.width + deltaWidth))
          const maxHeight = Math.max(minComponentHeight, previous.canvas.height - component.y)
          const baseHeight = typeof component.height === 'number' ? component.height : minComponentHeight
          const nextHeight = component.style.textAutoSize && supportsTextAutoSize(component)
            ? Math.min(maxHeight, measureTextAutoSizeHeight(component, nextWidth))
            : Math.min(maxHeight, Math.max(minComponentHeight, baseHeight + deltaHeight))
          return {
            ...component,
            width: nextWidth,
            height: nextHeight,
          }
        })
        return syncResultComponents(previous, nextComponents)
      })
      setDirty()
      return
    }

    const moveDelta = getArrowDelta(event.key, event.shiftKey ? 10 : 1)
    if (!moveDelta) return
    const { x: deltaX, y: deltaY } = moveDelta
    event.preventDefault()

    const selectedIds = getUnlockedSelectedIds(result.components, selectedComponentIds)
    if (selectedIds.size === 0) {
      setEditorNotice({ tone: 'error', text: 'Locked layers cannot be moved with arrow keys.' })
      return
    }
    const canMove = result.components.some((component) => {
      if (!selectedIds.has(component.id)) return false
      const nextCoordinates = clampCanvasCoordinates(
        component,
        result.canvas,
        component.x + deltaX,
        component.y + deltaY,
      )
      return nextCoordinates.x !== component.x || nextCoordinates.y !== component.y
    })
    if (!canMove) return

    pushHistorySnapshot(result.components)

    setResult((previous) => {
      if (!previous) return previous

      const nextComponents = previous.components.map((component) => {
        if (!selectedIds.has(component.id)) return component
        const nextCoordinates = clampCanvasCoordinates(
          component,
          previous.canvas,
          component.x + deltaX,
          component.y + deltaY,
        )
        return {
          ...component,
          x: nextCoordinates.x,
          y: nextCoordinates.y,
        }
      })

      return syncResultComponents(previous, nextComponents)
    })
    setDirty()
  }, [
    beginInlineEditMode,
    canInlineEditSelected,
    clampCanvasCoordinates,
    editingComponentId,
    handleRedo,
    handleUndo,
    isTextEntryTarget,
    measureTextAutoSizeHeight,
    minComponentHeight,
    minComponentWidth,
    primarySelectedComponentId,
    pushHistorySnapshot,
    reorderSelection,
    result,
    selectedComponentIds,
    setDirty,
    setEditingComponentId,
    setEditorNotice,
    setResult,
    setSelectedComponentIds,
    supportsTextAutoSize,
  ])

  const handleCanvasPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = canvasDragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return

    const scale = canvasScale > 0 ? canvasScale : 1
    const deltaX = Math.round((event.clientX - drag.startClientX) / scale)
    const deltaY = Math.round((event.clientY - drag.startClientY) / scale)

    let moved = false
    let nextGuides: CanvasSnapGuides = { x: null, y: null }
    setResult((previous) => {
      if (!previous) return previous
      const movingIdSet = new Set(drag.componentIds)
      const movingComponents = previous.components.filter((component) => movingIdSet.has(component.id))
      if (movingComponents.length === 0) return previous

      const anchorId = draggingComponentId && movingIdSet.has(draggingComponentId)
        ? draggingComponentId
        : movingComponents[0].id
      const anchorComponent = movingComponents.find((component) => component.id === anchorId) || movingComponents[0]
      const anchorOrigin = drag.originById[anchorComponent.id]
      if (!anchorOrigin) return previous

      const targets = buildCanvasSnapTargets(previous.components, movingIdSet, previous.canvas)
      const anchorHeight = resolveComponentHeight(anchorComponent)
      const snapX = findMoveSnap(anchorOrigin.x + deltaX, anchorComponent.width, targets.x, snapTolerancePx)
      const snapY = findMoveSnap(anchorOrigin.y + deltaY, anchorHeight, targets.y, snapTolerancePx)
      const translatedX = deltaX + snapX.delta
      const translatedY = deltaY + snapY.delta

      const nextComponents = previous.components.map((component) => {
        const origin = drag.originById[component.id]
        if (!origin) return component
        const nextCoordinates = clampCanvasCoordinates(
          component,
          previous.canvas,
          origin.x + translatedX,
          origin.y + translatedY,
        )
        if (nextCoordinates.x === component.x && nextCoordinates.y === component.y) return component
        moved = true
        return {
          ...component,
          x: nextCoordinates.x,
          y: nextCoordinates.y,
        }
      })

      if (!moved) return previous
      nextGuides = {
        x: snapX.guide,
        y: snapY.guide,
      }
      return syncResultComponents(previous, nextComponents)
    })

    if (moved) {
      canvasDragMovedRef.current = true
      updateCanvasSnapGuides(nextGuides)
      return
    }
    updateCanvasSnapGuides({ x: null, y: null })
  }, [
    buildCanvasSnapTargets,
    canvasDragMovedRef,
    canvasDragRef,
    canvasScale,
    clampCanvasCoordinates,
    draggingComponentId,
    findMoveSnap,
    resolveComponentHeight,
    setResult,
    snapTolerancePx,
    updateCanvasSnapGuides,
  ])

  const handleCanvasResizeMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const resize = canvasResizeRef.current
    if (!resize || event.pointerId !== resize.pointerId) return

    const scale = canvasScale > 0 ? canvasScale : 1
    const deltaX = Math.round((event.clientX - resize.startClientX) / scale)
    const deltaY = Math.round((event.clientY - resize.startClientY) / scale)

    let moved = false
    let nextGuides: CanvasSnapGuides = { x: null, y: null }
    setResult((previous) => {
      if (!previous) return previous
      const targets = buildCanvasSnapTargets(previous.components, new Set([resize.componentId]), previous.canvas)
      const nextComponents = previous.components.map((component) => {
        if (component.id !== resize.componentId) return component

        const maxWidth = Math.max(minComponentWidth, previous.canvas.width - resize.originX)
        let nextWidth = Math.min(maxWidth, Math.max(minComponentWidth, resize.originWidth + deltaX))
        const snappedX = findEndSnap(resize.originX + nextWidth, targets.x, snapTolerancePx)
        if (snappedX.guide !== null) {
          nextWidth = Math.min(maxWidth, Math.max(minComponentWidth, nextWidth + snappedX.delta))
          nextGuides.x = snappedX.guide
        }
        const maxHeight = Math.max(minComponentHeight, previous.canvas.height - resize.originY)
        const resizedHeight = resize.supportsHeight
          ? Math.min(maxHeight, Math.max(minComponentHeight, resize.originHeight + deltaY))
          : undefined
        let nextHeight =
          component.style.textAutoSize && supportsTextAutoSize(component)
            ? Math.min(maxHeight, measureTextAutoSizeHeight(component, nextWidth))
            : resizedHeight
        if (typeof nextHeight === 'number') {
          const snappedY = findEndSnap(resize.originY + nextHeight, targets.y, snapTolerancePx)
          if (snappedY.guide !== null) {
            nextHeight = Math.min(maxHeight, Math.max(minComponentHeight, nextHeight + snappedY.delta))
            nextGuides.y = snappedY.guide
          }
        }

        const widthChanged = nextWidth !== component.width
        const heightChanged = typeof nextHeight === 'number' ? nextHeight !== component.height : false
        if (!widthChanged && !heightChanged) return component

        moved = true
        return {
          ...component,
          width: nextWidth,
          height: typeof nextHeight === 'number' ? nextHeight : component.height,
        }
      })

      if (!moved) return previous
      return syncResultComponents(previous, nextComponents)
    })

    if (moved) {
      canvasResizeMovedRef.current = true
      updateCanvasSnapGuides(nextGuides)
      return
    }
    updateCanvasSnapGuides({ x: null, y: null })
  }, [
    buildCanvasSnapTargets,
    canvasResizeMovedRef,
    canvasResizeRef,
    canvasScale,
    findEndSnap,
    measureTextAutoSizeHeight,
    minComponentHeight,
    minComponentWidth,
    setResult,
    snapTolerancePx,
    supportsTextAutoSize,
    updateCanvasSnapGuides,
  ])

  const finalizeCanvasDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = canvasDragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    canvasDragRef.current = null
    setDraggingComponentId(null)
    updateCanvasSnapGuides({ x: null, y: null })
    if (canvasDragMovedRef.current) {
      canvasDragMovedRef.current = false
      pushHistorySnapshot(drag.snapshotBefore)
      setDirty()
    }
  }, [canvasDragMovedRef, canvasDragRef, pushHistorySnapshot, setDirty, setDraggingComponentId, updateCanvasSnapGuides])

  const finalizeCanvasResize = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const resize = canvasResizeRef.current
    if (!resize || event.pointerId !== resize.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    canvasResizeRef.current = null
    setResizingComponentId(null)
    updateCanvasSnapGuides({ x: null, y: null })
    if (canvasResizeMovedRef.current) {
      canvasResizeMovedRef.current = false
      pushHistorySnapshot(resize.snapshotBefore)
      setDirty()
    }
  }, [canvasResizeMovedRef, canvasResizeRef, pushHistorySnapshot, setDirty, setResizingComponentId, updateCanvasSnapGuides])

  const handleCanvasPointerDown = useCallback((component: SlideComponent, event: ReactPointerEvent<HTMLElement>) => {
    if (!result || component.locked) return
    if (event.button !== 0) return

    const target = event.target as HTMLElement | null
    if (target?.closest('[contenteditable="true"]')) return
    if (target?.closest('[data-resize-handle="se"]')) return

    if (event.shiftKey) {
      event.preventDefault()
      return
    }

    setEditingComponentId(null)
    updateCanvasSnapGuides({ x: null, y: null })
    const selectionIds = selectedComponentIds.includes(component.id) ? selectedComponentIds : [component.id]
    setSelectedComponentIds(selectionIds)
    const movableSelectionIds = result.components
      .filter((entry) => selectionIds.includes(entry.id) && !entry.locked)
      .map((entry) => entry.id)
    if (movableSelectionIds.length === 0) return
    setDraggingComponentId(component.id)
    canvasDragMovedRef.current = false
    canvasDragRef.current = {
      componentIds: movableSelectionIds,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originById: result.components.reduce<Record<string, { x: number; y: number }>>((acc, entry) => {
        if (movableSelectionIds.includes(entry.id)) {
          acc[entry.id] = { x: entry.x, y: entry.y }
        }
        return acc
      }, {}),
      snapshotBefore: cloneComponents(result.components),
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }, [
    canvasDragMovedRef,
    canvasDragRef,
    cloneComponents,
    result,
    selectedComponentIds,
    setDraggingComponentId,
    setEditingComponentId,
    setSelectedComponentIds,
    updateCanvasSnapGuides,
  ])

  const handleResizePointerDown = useCallback((component: SlideComponent, event: ReactPointerEvent<HTMLElement>) => {
    if (!result || component.locked) return
    if (event.button !== 0) return

    setEditingComponentId(null)
    updateCanvasSnapGuides({ x: null, y: null })
    setSelectedComponentIds([component.id])
    setResizingComponentId(component.id)
    canvasResizeMovedRef.current = false
    canvasResizeRef.current = {
      componentId: component.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: component.x,
      originY: component.y,
      originWidth: component.width,
      originHeight: typeof component.height === 'number' ? component.height : minComponentHeight,
      supportsHeight: typeof component.height === 'number',
      snapshotBefore: cloneComponents(result.components),
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }, [
    canvasResizeMovedRef,
    canvasResizeRef,
    cloneComponents,
    minComponentHeight,
    result,
    setEditingComponentId,
    setResizingComponentId,
    setSelectedComponentIds,
    updateCanvasSnapGuides,
  ])

  const handleCanvasPointerRelease = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    finalizeCanvasDrag(event)
    finalizeCanvasResize(event)
  }, [finalizeCanvasDrag, finalizeCanvasResize])

  return {
    updateCanvasComponentContent,
    beginInlineEditMode,
    handleCanvasLayerSelect,
    handleUndo,
    handleRedo,
    reorderSelection,
    handleCanvasKeyDown,
    handleCanvasPointerDown,
    handleResizePointerDown,
    handleCanvasPointerMove,
    handleCanvasResizeMove,
    handleCanvasPointerRelease,
    duplicateSelection,
    deleteSelection,
  }
}
