import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { SlideImportResult } from '@/components/slides/types'
import type { SlideActor, SlideRecord } from '@/components/slides/persistence-types'
import {
  deleteSlide,
  duplicateSlide,
  duplicateTemplateAsSlide,
  renameSlide,
} from '@/lib/slides'
import type { CanvasEditorNotice, SaveStatus } from '@/app/slides/page-model'

interface ConfirmDeleteOptions {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
}

interface UseSlidesLibraryActionsOptions {
  actor: SlideActor
  activeSlideId: string | null
  confirm: (options: ConfirmDeleteOptions) => Promise<boolean>
  confirmDiscardUnsaved: () => boolean
  loadSlide: (slide: SlideRecord, options?: { skipUnsavedConfirm?: boolean }) => void
  refreshLibraryData: () => Promise<void>
  clearHistory: () => void
  setActiveSlideId: Dispatch<SetStateAction<string | null>>
  setActiveDocumentSlideId: Dispatch<SetStateAction<string | null>>
  setActiveRevision: Dispatch<SetStateAction<number>>
  setSlideTitle: Dispatch<SetStateAction<string>>
  setResult: Dispatch<SetStateAction<SlideImportResult | null>>
  setSelectedComponentIds: Dispatch<SetStateAction<string[]>>
  setEditingComponentId: Dispatch<SetStateAction<string | null>>
  setDraggingComponentId: Dispatch<SetStateAction<string | null>>
  setResizingComponentId: Dispatch<SetStateAction<string | null>>
  setEditorNotice: Dispatch<SetStateAction<CanvasEditorNotice | null>>
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>
  setSaveError: Dispatch<SetStateAction<string | null>>
  setLastSavedAt: Dispatch<SetStateAction<string | null>>
  setExportHtml: Dispatch<SetStateAction<string>>
  setLibraryError: Dispatch<SetStateAction<string | null>>
}

export function useSlidesLibraryActions({
  actor,
  activeSlideId,
  confirm,
  confirmDiscardUnsaved,
  loadSlide,
  refreshLibraryData,
  clearHistory,
  setActiveSlideId,
  setActiveDocumentSlideId,
  setActiveRevision,
  setSlideTitle,
  setResult,
  setSelectedComponentIds,
  setEditingComponentId,
  setDraggingComponentId,
  setResizingComponentId,
  setEditorNotice,
  setSaveStatus,
  setSaveError,
  setLastSavedAt,
  setExportHtml,
  setLibraryError,
}: UseSlidesLibraryActionsOptions) {
  const handleDuplicateSlide = useCallback(async (slideId: string) => {
    if (!confirmDiscardUnsaved()) return
    try {
      const copy = await duplicateSlide(actor, slideId)
      await refreshLibraryData()
      loadSlide(copy, { skipUnsavedConfirm: true })
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : String(error))
    }
  }, [actor, confirmDiscardUnsaved, loadSlide, refreshLibraryData, setLibraryError])

  const handleRenameSlide = useCallback(async (slide: SlideRecord) => {
    const name = window.prompt('Rename slide', slide.title)
    if (!name || !name.trim()) return

    try {
      const updated = await renameSlide(actor, slide.id, name.trim())
      await refreshLibraryData()
      if (activeSlideId === updated.id) {
        setSlideTitle(updated.title)
        setActiveRevision(updated.revision)
      }
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : String(error))
    }
  }, [activeSlideId, actor, refreshLibraryData, setActiveRevision, setLibraryError, setSlideTitle])

  const handleDeleteSlide = useCallback(async (slide: SlideRecord) => {
    const approved = await confirm({
      title: 'Delete Slide',
      message: `Delete slide "${slide.title}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    })
    if (!approved) return

    try {
      await deleteSlide(actor, slide.id)
      await refreshLibraryData()
      if (activeSlideId === slide.id) {
        setActiveSlideId(null)
        setActiveDocumentSlideId(null)
        setActiveRevision(0)
        setResult(null)
        setSelectedComponentIds([])
        setEditingComponentId(null)
        setDraggingComponentId(null)
        setResizingComponentId(null)
        clearHistory()
        setEditorNotice({ tone: 'info', text: 'Deleted active slide. Import or load another slide to continue editing.' })
        setSaveStatus('clean')
        setSaveError(null)
        setLastSavedAt(null)
        setExportHtml('')
      }
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : String(error))
    }
  }, [
    activeSlideId,
    actor,
    clearHistory,
    confirm,
    refreshLibraryData,
    setActiveDocumentSlideId,
    setActiveRevision,
    setActiveSlideId,
    setDraggingComponentId,
    setEditingComponentId,
    setEditorNotice,
    setExportHtml,
    setLastSavedAt,
    setLibraryError,
    setResizingComponentId,
    setResult,
    setSaveError,
    setSaveStatus,
    setSelectedComponentIds,
  ])

  const handleDuplicateTemplate = useCallback(async (templateId: string) => {
    if (!confirmDiscardUnsaved()) return
    try {
      const slide = await duplicateTemplateAsSlide(actor, templateId)
      await refreshLibraryData()
      loadSlide(slide, { skipUnsavedConfirm: true })
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : String(error))
    }
  }, [actor, confirmDiscardUnsaved, loadSlide, refreshLibraryData, setLibraryError])

  return {
    handleDuplicateSlide,
    handleRenameSlide,
    handleDeleteSlide,
    handleDuplicateTemplate,
  }
}
