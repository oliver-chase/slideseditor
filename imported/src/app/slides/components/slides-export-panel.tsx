import type { Dispatch, SetStateAction } from 'react'
import type { SlideCanvas, SlideComponent, SlideDocument } from '@/components/slides/types'
import { syncSlideDocument } from '@/components/slides/document'

type SlidesExportPanelResult = {
  canvas: SlideCanvas
  components: SlideComponent[]
  warnings: string[]
  document: SlideDocument
}

interface SlidesExportPanelProps {
  result: SlidesExportPanelResult
  exportHtml: string
  showRawJson: boolean
  setShowRawJson: Dispatch<SetStateAction<boolean>>
  jsonCopyState: 'idle' | 'copied' | 'failed'
  copyParsedJson: () => Promise<void> | void
  downloadTextFile: (content: string, filename: string, type: string) => void
  generateExport: () => void
  handleExportHtml: () => Promise<void> | void
  handleExportPdf: () => Promise<void> | void
  handleExportCurrentAsPptx: () => Promise<void> | void
  pptxExportBusy: boolean
  pptxExportWarnings: string[]
  handleDownloadPptxWarningReport: () => void
  slideTitle: string
  activeSlideId: string | null
  activeDocumentSlideId: string | null
}

function buildCurrentSlideDocument({
  result,
  activeDocumentSlideId,
  activeSlideId,
}: {
  result: SlidesExportPanelResult
  activeDocumentSlideId: string | null
  activeSlideId: string | null
}): SlideDocument {
  return syncSlideDocument({
    document: result.document,
    canvas: result.canvas,
    components: result.components,
    warnings: result.warnings,
    slideId: activeDocumentSlideId || activeSlideId || undefined,
  })
}

export function SlidesExportPanel({
  result,
  exportHtml,
  showRawJson,
  setShowRawJson,
  jsonCopyState,
  copyParsedJson,
  downloadTextFile,
  generateExport,
  handleExportHtml,
  handleExportPdf,
  handleExportCurrentAsPptx,
  pptxExportBusy,
  pptxExportWarnings,
  handleDownloadPptxWarningReport,
  slideTitle,
  activeSlideId,
  activeDocumentSlideId,
}: SlidesExportPanelProps) {
  const currentDocument = buildCurrentSlideDocument({
    result,
    activeDocumentSlideId,
    activeSlideId,
  })
  const safeTitle = (slideTitle || 'slide').replace(/\s+/g, '-').toLowerCase()

  return (
    <>
      <section className="slides-export-section" aria-labelledby="slides-export-heading">
        <div className="slides-panel-heading">
          <h3 id="slides-export-heading">Export</h3>
          <p className="module-card-copy">Direct exports stay here for quick downloads.</p>
        </div>
        <div className="slides-export-actions">
          <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => void copyParsedJson()}>
            {jsonCopyState === 'copied' ? 'JSON Copied' : jsonCopyState === 'failed' ? 'Copy Failed' : 'Copy Parsed JSON'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn--compact"
            onClick={() => downloadTextFile(
              JSON.stringify(currentDocument, null, 2),
              `${safeTitle}.json`,
              'application/json;charset=utf-8',
            )}
          >
            Download JSON
          </button>
          <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => generateExport()}>
            Generate HTML Export
          </button>
          <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => void handleExportHtml()}>
            Download HTML
          </button>
          <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => void handleExportPdf()}>
            Export PDF (Print)
          </button>
          <button type="button" className="btn btn-sm btn-primary btn--compact" onClick={() => void handleExportCurrentAsPptx()} disabled={pptxExportBusy}>
            {pptxExportBusy ? 'Exporting PPTX…' : 'Export PPTX (Current)'}
          </button>
        </div>
        <div className="slides-export-queued">
          <p className="slides-export-queued-note">
            Use direct export controls for finished slide files.
          </p>
        </div>
      </section>

      {pptxExportWarnings.length > 0 && (
        <div className="slides-warning-group" role="status" aria-live="polite">
          <h3>PPTX Export Warnings</h3>
          <ul className="slides-warning-list">
            {pptxExportWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn--compact"
            onClick={handleDownloadPptxWarningReport}
          >
            Download PPTX Warning Report
          </button>
        </div>
      )}

      {exportHtml && (
        <section className="slides-export-html-section" aria-label="Export HTML output">
          <label className="slides-label" htmlFor="slides-export-html">Export HTML (deterministic metadata)</label>
          <textarea id="slides-export-html" className="slides-textarea slides-export-textarea" value={exportHtml} readOnly />
        </section>
      )}

      <button
        type="button"
        className="btn btn-sm btn-ghost btn--compact"
        onClick={() => setShowRawJson((value) => !value)}
      >
        {showRawJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
      </button>

      {showRawJson && (
        <pre className="slides-code">
          {JSON.stringify(currentDocument, null, 2)}
        </pre>
      )}
    </>
  )
}
