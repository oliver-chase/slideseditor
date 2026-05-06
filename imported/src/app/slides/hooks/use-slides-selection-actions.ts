import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { syncSlideDocument } from '@/components/slides/document'
import type { SlideComponent, SlideImportResult } from '@/components/slides/types'
import type { CanvasEditorNotice } from '@/app/slides/page-model'

interface UseSlidesSelectionActionsOptions {
  result: SlideImportResult | null
  activeDocumentSlideId: string | null
  activeSlideId: string | null
  selectedComponentIds: string[]
  pushHistorySnapshot: (components: SlideComponent[]) => void
  setResult: Dispatch<SetStateAction<SlideImportResult | null>>
  setEditingComponentId: Dispatch<SetStateAction<string | null>>
  setDirty: () => void
  setEditorNotice: Dispatch<SetStateAction<CanvasEditorNotice | null>>
}

export function useSlidesSelectionActions({
  result,
  activeDocumentSlideId,
  activeSlideId,
  selectedComponentIds,
  pushHistorySnapshot,
  setResult,
  setEditingComponentId,
  setDirty,
  setEditorNotice,
}: UseSlidesSelectionActionsOptions) {
  const groupSelection = useCallback(() => {
    if (!result || selectedComponentIds.length < 2) {
      setEditorNotice({ tone: 'error', text: 'Select at least two layers before grouping.' })
      return
    }

    const selected = result.components.filter((component) => selectedComponentIds.includes(component.id))
    const unlocked = selected.filter((component) => !component.locked)
    if (unlocked.length < 2) {
      setEditorNotice({ tone: 'error', text: 'Select at least two unlocked layers before grouping.' })
      return
    }

    const nextGroupId = `group-${Date.now().toString(36)}`
    const nextGroupName = `Group ${nextGroupId.slice(-4).toUpperCase()}`
    const targetIds = new Set(unlocked.map((component) => component.id))

    pushHistorySnapshot(result.components)
    setResult((previous) => {
      if (!previous) return previous
      const nextComponents = previous.components.map((component) => (
        targetIds.has(component.id)
          ? { ...component, groupId: nextGroupId, groupName: nextGroupName }
          : component
      ))
      return {
        ...previous,
        components: nextComponents,
        document: syncSlideDocument({
          document: previous.document,
          canvas: previous.canvas,
          components: nextComponents,
          warnings: previous.warnings,
          slideId: activeDocumentSlideId || activeSlideId || undefined,
        }),
      }
    })

    setDirty()
    setEditorNotice({ tone: 'info', text: `Grouped ${unlocked.length} layer(s).` })
  }, [activeDocumentSlideId, activeSlideId, pushHistorySnapshot, result, selectedComponentIds, setDirty, setEditorNotice, setResult])

  const ungroupSelection = useCallback(() => {
    if (!result || selectedComponentIds.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one layer before ungrouping.' })
      return
    }

    const selected = result.components.filter((component) => selectedComponentIds.includes(component.id))
    const unlocked = selected.filter((component) => !component.locked)
    if (unlocked.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Selected layers are locked and cannot be ungrouped.' })
      return
    }

    const selectedGroupIds = new Set(unlocked.map((component) => component.groupId).filter(Boolean))
    if (selectedGroupIds.size === 0) {
      setEditorNotice({ tone: 'info', text: 'Selected layers are not grouped.' })
      return
    }

    pushHistorySnapshot(result.components)
    setResult((previous) => {
      if (!previous) return previous
      const nextComponents = previous.components.map((component) => (
        component.groupId && selectedGroupIds.has(component.groupId)
          ? { ...component, groupId: undefined, groupName: undefined }
          : component
      ))
      return {
        ...previous,
        components: nextComponents,
        document: syncSlideDocument({
          document: previous.document,
          canvas: previous.canvas,
          components: nextComponents,
          warnings: previous.warnings,
          slideId: activeDocumentSlideId || activeSlideId || undefined,
        }),
      }
    })

    setDirty()
    setEditorNotice({ tone: 'info', text: `Ungrouped ${selectedGroupIds.size} group(s).` })
  }, [activeDocumentSlideId, activeSlideId, pushHistorySnapshot, result, selectedComponentIds, setDirty, setEditorNotice, setResult])

  const handleSetSelectionLocked = useCallback((locked: boolean) => {
    if (!result || selectedComponentIds.length === 0) {
      setEditorNotice({ tone: 'error', text: 'Select at least one layer before changing lock state.' })
      return 'Select at least one layer before changing lock state.'
    }

    const selected = result.components.filter((component) => selectedComponentIds.includes(component.id))
    const target = selected.filter((component) => component.locked !== locked)
    if (target.length === 0) {
      const text = locked ? 'Selected layers are already locked.' : 'Selected layers are already unlocked.'
      setEditorNotice({ tone: 'info', text })
      return text
    }

    const targetIds = new Set(target.map((component) => component.id))
    pushHistorySnapshot(result.components)
    setResult((previous) => {
      if (!previous) return previous
      const nextComponents = previous.components.map((component) => (
        targetIds.has(component.id)
          ? { ...component, locked }
          : component
      ))
      return {
        ...previous,
        components: nextComponents,
        document: syncSlideDocument({
          document: previous.document,
          canvas: previous.canvas,
          components: nextComponents,
          warnings: previous.warnings,
          slideId: activeDocumentSlideId || activeSlideId || undefined,
        }),
      }
    })

    if (locked) {
      setEditingComponentId((previous) => (previous && targetIds.has(previous) ? null : previous))
    }

    setDirty()
    const text = `${locked ? 'Locked' : 'Unlocked'} ${target.length} layer(s).`
    setEditorNotice({ tone: 'info', text })
    return text
  }, [
    activeDocumentSlideId,
    activeSlideId,
    pushHistorySnapshot,
    result,
    selectedComponentIds,
    setDirty,
    setEditingComponentId,
    setEditorNotice,
    setResult,
  ])

  return {
    groupSelection,
    ungroupSelection,
    handleSetSelectionLocked,
  }
}
