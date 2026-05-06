import { useCallback, useState } from 'react'
import { readSlideDocumentFromMetadata, syncSlideDocument } from '@/components/slides/document'
import { convertSlideDocumentToHtml } from '@/components/slides/html-export'
import { convertSlideDocumentsToPptx } from '@/components/slides/pptx-export'
import type { SlideImportResult } from '@/components/slides/types'
import type { SlideActor, SlideRecord } from '@/components/slides/persistence-types'
import {
  downloadPptxExportJob,
  listSlides,
  recordExportEvent,
  requestPptxExportJob,
} from '@/lib/slides'

interface EditorNotice {
  tone: 'info' | 'error'
  text: string
}

interface SlidesPptxExportSlidePayload {
  id: string
  title: string
  canvas: SlideRecord['canvas']
  components: SlideRecord['components']
  document: NonNullable<SlideImportResult['document']>
}

interface RunPptxExportOptions {
  auditSlideIds?: string[]
  filenamePrefix?: string
}

interface PptxWarningReportContext {
  exportedAt: string
  jobId: string | null
  filenamePrefix: string
  slideIds: string[]
}

export interface UseSlidesPptxExportOptions {
  actor: SlideActor
  activeSlideId: string | null
  activeDocumentSlideId: string | null
  slideTitle: string
  result: SlideImportResult | null
  slides: SlideRecord[]
  pptxSelectedSlideIds: string[]
  refreshLibraryData: () => Promise<void>
  downloadBlobFile: (blob: Blob, filename: string) => void
  setSaveError: (message: string | null) => void
  setEditorNotice: (notice: EditorNotice | null) => void
}

export interface UseSlidesPptxExportResult {
  pptxExportWarnings: string[]
  pptxExportBusy: boolean
  handleDownloadPptxWarningReport: () => void
  handleExportCurrentAsPptx: () => Promise<void>
  handleExportSelectedSlidesAsPptx: () => Promise<void>
}

async function exportSlidesWithDomToPptx(slidesToExport: SlidesPptxExportSlidePayload[], fileName: string): Promise<Blob> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('dom-to-pptx requires a browser DOM environment.')
  }
  const module = await import('@halobiron/dom-to-pptx')
  const exportToPptx = module.exportToPptx as (
    target: Array<HTMLElement | string> | HTMLElement | string,
    options: { fileName?: string; skipDownload?: boolean; svgAsVector?: boolean },
  ) => Promise<Blob>
  if (typeof exportToPptx !== 'function') {
    throw new Error('dom-to-pptx exportToPptx API is unavailable.')
  }

  const mountHost = document.createElement('div')
  mountHost.setAttribute('data-dom-to-pptx-host', '1')
  mountHost.style.position = 'fixed'
  mountHost.style.left = '-100000px'
  mountHost.style.top = '-100000px'
  mountHost.style.width = '1px'
  mountHost.style.height = '1px'
  mountHost.style.pointerEvents = 'none'
  mountHost.style.opacity = '0'
  mountHost.style.overflow = 'hidden'
  document.body.appendChild(mountHost)

  try {
    const slideRoots: HTMLElement[] = []
    for (const slide of slidesToExport) {
      const html = convertSlideDocumentToHtml({
        document: slide.document,
        metadata: {
          slideId: slide.id,
          source: 'dom-to-pptx-export',
          exportedAt: new Date().toISOString(),
        },
      })
      const parsed = new DOMParser().parseFromString(html, 'text/html')
      const root = parsed.querySelector<HTMLElement>('.slide-canvas') || parsed.body.firstElementChild as HTMLElement | null
      if (!root) continue
      const importedRoot = document.importNode(root, true) as HTMLElement
      slideRoots.push(importedRoot)
      mountHost.appendChild(importedRoot)
    }
    if (slideRoots.length === 0) {
      throw new Error('No slide roots were generated for dom-to-pptx export.')
    }
    return await exportToPptx(slideRoots, {
      fileName,
      skipDownload: true,
      svgAsVector: true,
    })
  } finally {
    mountHost.remove()
  }
}

export function useSlidesPptxExport({
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
}: UseSlidesPptxExportOptions): UseSlidesPptxExportResult {
  const [pptxExportWarnings, setPptxExportWarnings] = useState<string[]>([])
  const [pptxExportBusy, setPptxExportBusy] = useState(false)
  const [warningReportContext, setWarningReportContext] = useState<PptxWarningReportContext | null>(null)

  const runPptxExport = useCallback(async (
    slidesToExport: SlidesPptxExportSlidePayload[],
    options?: RunPptxExportOptions,
  ) => {
    if (slidesToExport.length === 0) {
      setSaveError('Select at least one slide to export as PPTX.')
      return
    }

    setPptxExportBusy(true)
    setPptxExportWarnings([])
    setWarningReportContext(null)
    setSaveError(null)
    try {
      const backendJob = await requestPptxExportJob(actor, {
        slideIds: options?.auditSlideIds || [],
        slides: slidesToExport,
        filenamePrefix: options?.filenamePrefix || 'slides-export',
        includeHidden: true,
        idempotencyKey: `${(options?.filenamePrefix || 'slides-export').trim().toLowerCase()}-${slidesToExport.map((slide) => slide.id).join(',')}`,
        maxAttempts: 3,
      })

      if (backendJob.status === 'failed') {
        throw new Error(backendJob.error_message || 'PPTX export job failed.')
      }

      const resolvedJob = await downloadPptxExportJob(actor, backendJob.id)
      const backendWarnings = Array.isArray(resolvedJob.warnings)
        ? resolvedJob.warnings.map((warning) => warning.message)
        : []

      const prefix = (options?.filenamePrefix || 'slides-export').replace(/\\s+/g, '-').toLowerCase()
      const domToPptxWarnings: string[] = []
      const legacyProjection = convertSlideDocumentsToPptx(
        slidesToExport.map((slide) => ({
          id: slide.id,
          title: slide.title,
          document: slide.document,
        })),
      )
      let blob: Blob
      try {
        blob = await exportSlidesWithDomToPptx(slidesToExport, `${prefix}.pptx`)
      } catch (domError) {
        const domErrorMessage = domError instanceof Error ? domError.message : String(domError)
        domToPptxWarnings.push(`dom-to-pptx export used a recovery path: ${domErrorMessage}`)
        blob = legacyProjection.blob
      }
      downloadBlobFile(blob, `${prefix}.pptx`)
      const warnings = [...domToPptxWarnings, ...legacyProjection.warnings]
      const mergedWarnings = Array.from(new Set([...backendWarnings, ...warnings]))
      setPptxExportWarnings(mergedWarnings)
      setWarningReportContext({
        exportedAt: new Date().toISOString(),
        jobId: backendJob.id,
        filenamePrefix: prefix,
        slideIds: slidesToExport.map((slide) => slide.id),
      })

      const auditSlideIds = options?.auditSlideIds || []
      if (auditSlideIds.length > 0) {
        await refreshLibraryData()
      }

      setEditorNotice({
        tone: 'info',
        text: mergedWarnings.length > 0
          ? `Exported ${slidesToExport.length} slide(s) to PPTX with ${mergedWarnings.length} warning(s).`
          : `Exported ${slidesToExport.length} slide(s) to PPTX.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSaveError(`PPTX export failed: ${message}`)
      const auditSlideIds = options?.auditSlideIds || []
      if (auditSlideIds.length > 0) {
        await Promise.all(auditSlideIds.map(async (slideId) => {
          try {
            await recordExportEvent(actor, {
              slideId,
              format: 'pptx',
              outcome: 'failure',
              errorClass: message,
            })
          } catch {
            // Keep surfacing the primary error.
          }
        }))
        await refreshLibraryData()
      }
    } finally {
      setPptxExportBusy(false)
    }
  }, [actor, downloadBlobFile, refreshLibraryData, setEditorNotice, setSaveError])

  const handleDownloadPptxWarningReport = useCallback(() => {
    if (!warningReportContext || pptxExportWarnings.length === 0) {
      setEditorNotice({
        tone: 'error',
        text: 'No PPTX warning report is available yet.',
      })
      return
    }
    const payload = {
      exported_at: warningReportContext.exportedAt,
      filename_prefix: warningReportContext.filenamePrefix,
      job_id: warningReportContext.jobId,
      slide_ids: warningReportContext.slideIds,
      warning_count: pptxExportWarnings.length,
      warnings: pptxExportWarnings,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    downloadBlobFile(
      blob,
      `${warningReportContext.filenamePrefix}-pptx-warning-report.json`,
    )
    setEditorNotice({
      tone: 'info',
      text: 'Downloaded PPTX warning report.',
    })
  }, [downloadBlobFile, pptxExportWarnings, setEditorNotice, warningReportContext])

  const handleExportCurrentAsPptx = useCallback(async () => {
    if (!result) {
      setSaveError('Parse HTML before exporting PPTX.')
      return
    }

    await runPptxExport(
      [{
        id: activeSlideId || 'unsaved-slide',
        title: slideTitle || 'Untitled Slide',
        canvas: result.canvas,
        components: result.components,
        document: syncSlideDocument({
          document: result.document,
          canvas: result.canvas,
          components: result.components,
          warnings: result.warnings,
          slideId: activeDocumentSlideId || activeSlideId || undefined,
        }),
      }],
      {
        auditSlideIds: activeSlideId ? [activeSlideId] : [],
        filenamePrefix: slideTitle || 'slide-export',
      },
    )
  }, [activeDocumentSlideId, activeSlideId, result, runPptxExport, setSaveError, slideTitle])

  const handleExportSelectedSlidesAsPptx = useCallback(async () => {
    if (pptxSelectedSlideIds.length === 0) {
      setSaveError('Select at least one slide to export as PPTX.')
      return
    }

    let exportableSlides = slides
    const selectedIds = Array.from(new Set(pptxSelectedSlideIds))
    const missingSelectedIds = selectedIds.filter((slideId) => !exportableSlides.some((slide) => slide.id === slideId))

    if (missingSelectedIds.length > 0) {
      try {
        exportableSlides = await listSlides(actor, '')
      } catch (error) {
        setSaveError(`Could not load selected hidden slides for export: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
    }

    const selectedSlides = exportableSlides.filter((slide) => selectedIds.includes(slide.id))
    if (selectedSlides.length === 0) {
      setSaveError('Selected slides are no longer available for export.')
      return
    }

    if (selectedSlides.length < selectedIds.length) {
      setEditorNotice({
        tone: 'error',
        text: `Exporting ${selectedSlides.length} slide(s); ${selectedIds.length - selectedSlides.length} selected slide(s) were not found.`,
      })
    }

    await runPptxExport(
      selectedSlides.map((slide) => ({
        id: slide.id,
        title: slide.title,
        canvas: slide.canvas,
        components: slide.components,
        document: readSlideDocumentFromMetadata(slide.metadata) || syncSlideDocument({
          canvas: slide.canvas,
          components: slide.components,
          warnings: Array.isArray(slide.metadata?.warnings) ? slide.metadata.warnings as string[] : [],
          slideId: slide.id,
        }),
      })),
      {
        auditSlideIds: selectedSlides.map((slide) => slide.id),
        filenamePrefix: selectedSlides.length === 1 ? selectedSlides[0].title : 'slides-export',
      },
    )
  }, [actor, pptxSelectedSlideIds, runPptxExport, setEditorNotice, setSaveError, slides])

  return {
    pptxExportWarnings,
    pptxExportBusy,
    handleDownloadPptxWarningReport,
    handleExportCurrentAsPptx,
    handleExportSelectedSlidesAsPptx,
  }
}
