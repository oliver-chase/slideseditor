import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SlideImportResult } from '@/components/slides/types'
import type { SlideActor } from '@/components/slides/persistence-types'
import { recordExportEvent } from '@/lib/slides'

interface UseSlidesHtmlPdfExportOptions {
  actor: SlideActor
  activeSlideId: string | null
  slideTitle: string
  result: SlideImportResult | null
  exportHtml: string
  generateExport: () => string
  refreshLibraryData: () => Promise<void>
  setSaveError: Dispatch<SetStateAction<string | null>>
}

interface UseSlidesHtmlPdfExportResult {
  handleExportHtml: () => Promise<void>
  handleExportPdf: () => Promise<void>
}

export function useSlidesHtmlPdfExport({
  actor,
  activeSlideId,
  slideTitle,
  result,
  exportHtml,
  generateExport,
  refreshLibraryData,
  setSaveError,
}: UseSlidesHtmlPdfExportOptions): UseSlidesHtmlPdfExportResult {
  const downloadTextFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 0)
  }, [])

  const handleExportHtml = useCallback(async () => {
    if (!result) return
    const html = exportHtml || generateExport()
    if (!html) return

    downloadTextFile(html, `${(slideTitle || 'slide').replace(/\s+/g, '-').toLowerCase()}.html`, 'text/html;charset=utf-8')

    if (activeSlideId) {
      await recordExportEvent(actor, {
        slideId: activeSlideId,
        format: 'html',
        outcome: 'success',
      })
      await refreshLibraryData()
    }
  }, [activeSlideId, actor, downloadTextFile, exportHtml, generateExport, refreshLibraryData, result, slideTitle])

  const handleExportPdf = useCallback(async () => {
    if (!result) return
    const html = exportHtml || generateExport()
    if (!html) return

    try {
      const popup = window.open('', '_blank', 'noopener,noreferrer')
      if (!popup) throw new Error('Popup blocked by browser')
      popup.document.write(html)
      popup.document.close()
      popup.focus()
      popup.print()

      if (activeSlideId) {
        await recordExportEvent(actor, {
          slideId: activeSlideId,
          format: 'pdf',
          outcome: 'success',
        })
      }
      await refreshLibraryData()
    } catch (error) {
      setSaveError('PDF export failed. Retry after enabling pop-ups, or use HTML export and browser print instead.')
      if (activeSlideId) {
        await recordExportEvent(actor, {
          slideId: activeSlideId,
          format: 'pdf',
          outcome: 'failure',
          errorClass: error instanceof Error ? error.message : 'pdf_export_error',
        })
      }
      await refreshLibraryData()
    }
  }, [activeSlideId, actor, exportHtml, generateExport, refreshLibraryData, result, setSaveError])

  return {
    handleExportHtml,
    handleExportPdf,
  }
}
