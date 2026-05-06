import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { syncSlideDocument } from '@/components/slides/document'
import { convertSlideDocumentToHtml } from '@/components/slides/html-export'
import type { SlideComponent, SlideImportResult } from '@/components/slides/types'
import type { SlideActor, SlideRecord } from '@/components/slides/persistence-types'
import { saveSlide } from '@/lib/slides'
import type { SaveStatus } from '@/app/slides/page-model'
import { useSlidesHtmlPdfExport } from '@/app/slides/hooks/use-slides-html-pdf-export'
import { useSlidesPptxExport } from '@/app/slides/hooks/use-slides-pptx-export'
import type { CanvasEditorNotice } from '@/app/slides/page-model'

interface UseSlidesExportActionsOptions {
  actor: SlideActor
  activeSlideId: string | null
  activeDocumentSlideId: string | null
  activeRevision: number
  slideTitle: string
  rawHtmlLength: number
  result: SlideImportResult | null
  slides: SlideRecord[]
  pptxSelectedSlideIds: string[]
  exportHtml: string
  conflictServerSlide: SlideRecord | null
  normalizeComponentsForPersistence: (components: SlideComponent[]) => SlideComponent[]
  handleSave: (options?: { overwrite?: boolean }) => Promise<SlideRecord | null>
  loadSlide: (slide: SlideRecord, options?: { skipUnsavedConfirm?: boolean }) => void
  refreshLibraryData: () => Promise<void>
  setExportHtml: (value: string) => void
  setJsonCopyState: (value: 'idle' | 'copied' | 'failed') => void
  setConflictServerSlide: (value: SlideRecord | null) => void
  setSaveStatus: (value: SaveStatus) => void
  setSaveError: Dispatch<SetStateAction<string | null>>
  setActiveSlideId: (value: string | null) => void
  setActiveDocumentSlideId: (value: string | null) => void
  setActiveRevision: (value: number) => void
  setSlideTitle: (value: string) => void
  setLastSavedAt: (value: string | null) => void
  setEditorNotice: (value: CanvasEditorNotice | null) => void
}

export function useSlidesExportActions({
  actor,
  activeSlideId,
  activeDocumentSlideId,
  activeRevision,
  slideTitle,
  rawHtmlLength,
  result,
  slides,
  pptxSelectedSlideIds,
  exportHtml,
  conflictServerSlide,
  normalizeComponentsForPersistence,
  handleSave,
  loadSlide,
  refreshLibraryData,
  setExportHtml,
  setJsonCopyState,
  setConflictServerSlide,
  setSaveStatus,
  setSaveError,
  setActiveSlideId,
  setActiveDocumentSlideId,
  setActiveRevision,
  setSlideTitle,
  setLastSavedAt,
  setEditorNotice,
}: UseSlidesExportActionsOptions) {
  const generateExport = useCallback(() => {
    if (!result) return ''
    const document = syncSlideDocument({
      document: result.document,
      canvas: result.canvas,
      components: result.components,
      warnings: result.warnings,
      slideId: activeDocumentSlideId || activeSlideId || undefined,
    })
    const html = convertSlideDocumentToHtml({
      document,
      metadata: {
        slideId: activeDocumentSlideId || activeSlideId || 'unsaved-slide',
        revision: activeRevision,
        source: 'oliver-app',
        exportedAt: new Date().toISOString(),
      },
    })
    setExportHtml(html)
    return html
  }, [activeDocumentSlideId, activeRevision, activeSlideId, result, setExportHtml])

  const downloadBlobFile = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
      anchor.remove()
    }, 0)
  }, [])

  const downloadTextFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    downloadBlobFile(blob, filename)
  }, [downloadBlobFile])

  const copyParsedJson = useCallback(async () => {
    if (!result) return
    try {
      const document = syncSlideDocument({
        document: result.document,
        canvas: result.canvas,
        components: result.components,
        warnings: result.warnings,
        slideId: activeDocumentSlideId || activeSlideId || undefined,
      })
      await navigator.clipboard.writeText(JSON.stringify(document, null, 2))
      setJsonCopyState('copied')
      window.setTimeout(() => setJsonCopyState('idle'), 1400)
    } catch {
      setJsonCopyState('failed')
      window.setTimeout(() => setJsonCopyState('idle'), 2000)
    }
  }, [activeDocumentSlideId, activeSlideId, result, setJsonCopyState])

  const { handleExportHtml, handleExportPdf } = useSlidesHtmlPdfExport({
    actor,
    activeSlideId,
    slideTitle,
    result,
    exportHtml,
    generateExport,
    refreshLibraryData,
    setSaveError,
  })

  const pptxExportState = useSlidesPptxExport({
    actor,
    activeSlideId,
    activeDocumentSlideId,
    slideTitle,
    result,
    slides,
    pptxSelectedSlideIds,
    refreshLibraryData,
    downloadBlobFile,
    setSaveError,
    setEditorNotice,
  })

  const pptxExportWarnings = Array.isArray(pptxExportState.pptxExportWarnings)
    ? pptxExportState.pptxExportWarnings
    : []

  const handleConflictReload = useCallback(() => {
    if (!conflictServerSlide) return
    loadSlide(conflictServerSlide, { skipUnsavedConfirm: true })
    setConflictServerSlide(null)
  }, [conflictServerSlide, loadSlide, setConflictServerSlide])

  const handleConflictOverwrite = useCallback(async () => {
    await handleSave({ overwrite: true })
  }, [handleSave])

  const handleConflictSaveAsCopy = useCallback(async () => {
    if (!result) return

    const copyTitle = `${slideTitle} (Copy)`
    setConflictServerSlide(null)
    setSaveStatus('saving')
    setSaveError(null)

    try {
      const normalizedComponents = normalizeComponentsForPersistence(result.components)
      const response = await saveSlide(actor, {
        title: copyTitle,
        canvas: result.canvas,
        components: normalizedComponents,
        document: syncSlideDocument({
          document: result.document,
          canvas: result.canvas,
          components: normalizedComponents,
          warnings: result.warnings,
          slideId: activeDocumentSlideId || activeSlideId || undefined,
        }),
        metadata: {
          warning_count: result.warnings.length,
          warnings: result.warnings,
          raw_html_length: rawHtmlLength,
          active_document_slide_id: activeDocumentSlideId || activeSlideId,
        },
      })

      setActiveSlideId(response.slide.id)
      setActiveDocumentSlideId(activeDocumentSlideId || activeSlideId)
      setActiveRevision(response.slide.revision)
      setSlideTitle(response.slide.title)
      setLastSavedAt(response.slide.updated_at)
      setSaveStatus('saved')
      await refreshLibraryData()
    } catch (error) {
      setSaveStatus('error')
      setSaveError(error instanceof Error ? error.message : String(error))
    }
  }, [
    activeDocumentSlideId,
    activeSlideId,
    actor,
    normalizeComponentsForPersistence,
    rawHtmlLength,
    refreshLibraryData,
    result,
    setActiveDocumentSlideId,
    setActiveRevision,
    setActiveSlideId,
    setConflictServerSlide,
    setLastSavedAt,
    setSaveError,
    setSaveStatus,
    setSlideTitle,
    slideTitle,
  ])

  return {
    generateExport,
    downloadTextFile,
    copyParsedJson,
    handleExportHtml,
    handleExportPdf,
    pptxExportWarnings,
    pptxExportBusy: pptxExportState.pptxExportBusy,
    handleExportCurrentAsPptx: pptxExportState.handleExportCurrentAsPptx,
    handleExportSelectedSlidesAsPptx: pptxExportState.handleExportSelectedSlidesAsPptx,
    handleDownloadPptxWarningReport: pptxExportState.handleDownloadPptxWarningReport,
    handleConflictReload,
    handleConflictOverwrite,
    handleConflictSaveAsCopy,
  }
}
