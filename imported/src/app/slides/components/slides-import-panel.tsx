import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'
import type { SlideImportFailure } from '@/components/slides/import-validation'

type WarningGroup = {
  label: string
  items: Array<{
    text: string
    count: number
  }>
}

interface SlidesImportPanelProps {
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  openFilePicker: () => void
  parseStatus: string
  parseStatusLabel: string
  parsePercentLabel: string | null
  parseMessage: string
  parseProgress: number
  rawHtml: string
  setRawHtml: Dispatch<SetStateAction<string>>
  rawHtmlExpanded: boolean
  setRawHtmlExpanded: Dispatch<SetStateAction<boolean>>
  runParseWithProgress: (html: string, source?: 'file-picker' | 'chat-upload' | 'pasted' | 'unknown') => Promise<void>
  handleImportHtmlAsNewDeckSlide: () => Promise<void> | void
  handleImportHtmlAsNewDeck: () => Promise<void> | void
  cancelParse: () => void
  result: unknown
  setDirty: () => void
  importError: SlideImportFailure | null
  setImportError: Dispatch<SetStateAction<SlideImportFailure | null>>
  parseReportOpen: boolean
  setParseReportOpen: Dispatch<SetStateAction<boolean>>
  parseReportErrorsCount: number
  parseReportWarningsCount: number
  parseReportNoticesCount: number
  warningGroups: WarningGroup[]
  parseReportNotices: string[]
}

export function SlidesImportPanel({
  fileInputRef,
  onFileChange,
  openFilePicker,
  parseStatus,
  parseStatusLabel,
  parsePercentLabel,
  parseMessage,
  parseProgress,
  rawHtml,
  setRawHtml,
  rawHtmlExpanded,
  setRawHtmlExpanded,
  runParseWithProgress,
  handleImportHtmlAsNewDeckSlide,
  handleImportHtmlAsNewDeck,
  cancelParse,
  result,
  setDirty,
  importError,
  setImportError,
  parseReportOpen,
  setParseReportOpen,
  parseReportErrorsCount,
  parseReportWarningsCount,
  parseReportNoticesCount,
  warningGroups,
  parseReportNotices,
}: SlidesImportPanelProps) {
  return (
    <>
      <input
        ref={fileInputRef}
        id="slides-html-file"
        type="file"
        accept=".html,.htm,.css,text/html,text/css"
        multiple
        onChange={onFileChange}
        hidden
      />

      <section className="slides-import-panel">
        <div className="slides-panel-heading">
          <h2 className="module-card-title">Import Source</h2>
          <p className="module-card-copy">Upload HTML, paste markup, or reuse the current editor HTML to generate an editable slide canvas.</p>
        </div>

        <div className="module-action-row slides-actions">
          <button type="button" className="btn btn-primary btn--compact" onClick={openFilePicker} disabled={parseStatus === 'parsing'}>
            Import HTML File
          </button>
          <button
            type="button"
            className="btn btn-ghost btn--compact"
            onClick={() => void runParseWithProgress(rawHtml, 'pasted')}
            disabled={parseStatus === 'parsing'}
          >
            Parse Pasted HTML
          </button>
          <button
            type="button"
            className="btn btn-ghost btn--compact"
            onClick={() => void handleImportHtmlAsNewDeckSlide()}
          >
            Import as New Slide
          </button>
          <button
            type="button"
            className="btn btn-ghost btn--compact"
            onClick={() => void handleImportHtmlAsNewDeck()}
          >
            Import as New Deck
          </button>
          {parseStatus === 'parsing' && (
            <button type="button" className="btn btn-danger btn--compact" onClick={cancelParse}>
              Cancel Parse
            </button>
          )}
        </div>

        <div className="module-action-row slides-status-row" role="status" aria-live="polite">
          <span className={`slides-status-chip slides-status-chip-${parseStatus}`}>{parseStatusLabel}</span>
          {parsePercentLabel && <span className="module-card-copy slides-status-meta">{parsePercentLabel}</span>}
          <span className="module-card-copy slides-status-meta">{parseMessage}</span>
        </div>

        {parseStatus === 'parsing' && (
          <div className="slides-progress" role="status" aria-live="polite">
            <div className="slides-progress-track" aria-hidden="true">
              <div className="slides-progress-fill" style={{ width: `${parseProgress}%` }} />
            </div>
          </div>
        )}

        <div className="slides-inline-actions">
          <button
            type="button"
            className="btn btn-sm btn-ghost btn--compact"
            onClick={() => setRawHtmlExpanded((value) => !value)}
          >
            {rawHtmlExpanded ? 'Collapse Raw HTML' : 'Expand Raw HTML'}
          </button>
        </div>

        {rawHtmlExpanded && (
          <>
            <label className="slides-label" htmlFor="slides-raw-html">Raw HTML</label>
            <textarea
              id="slides-raw-html"
              className="slides-textarea"
              value={rawHtml}
              onChange={(event) => {
                setRawHtml(event.target.value)
                if (result) setDirty()
              }}
              placeholder="<div class='slide-canvas' style='width:1920px;height:1080px;'>...</div>"
              disabled={parseStatus === 'parsing'}
            />
          </>
        )}

        {importError && (
          <div className="module-card slides-state-panel" data-tone="error" data-testid="slides-import-error-state" role="alert">
            <h3 className="module-empty-state-title slides-state-title">Import parse blocked</h3>
            <p className="module-empty-state-copy slides-state-copy">
              Import failed ({importError.code.replace(/_/g, ' ')}): {importError.message}
            </p>
            <div className="module-action-row slides-state-actions">
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => setImportError(null)}>
                Clear
              </button>
            </div>
          </div>
        )}

        <details
          className="slides-parse-report"
          open={parseReportOpen}
          onToggle={(event) => {
            setParseReportOpen((event.currentTarget as HTMLDetailsElement).open)
          }}
        >
          <summary>
            Parse Report · Errors {parseReportErrorsCount} · Warnings {parseReportWarningsCount} · Notices {parseReportNoticesCount}
          </summary>
          <div className="slides-parse-report-body">
            {importError && (
              <div className="slides-warning-group" role="alert">
                <h3>General</h3>
                <ul className="slides-warning-list">
                  <li>{`Import failed (${importError.code.replace(/_/g, ' ')}): ${importError.message}`}</li>
                </ul>
              </div>
            )}

            {(['General', 'Units', 'Canvas'] as const).map((label) => {
              const group = warningGroups.find((item) => item.label === label)
              return (
                <div key={label} className="slides-warning-group">
                  <h3>{label}</h3>
                  {group && group.items.length > 0 ? (
                    <ul className="slides-warning-list">
                      {group.items.map((item) => (
                        <li key={item.text}>
                          {item.text}
                          {item.count > 1 ? ` (${item.count})` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="slides-parse-report-empty">No parser messages.</p>
                  )}
                </div>
              )
            })}

            <div className="slides-warning-group">
              <h3>Notices</h3>
              {parseReportNotices.length > 0 ? (
                <ul className="slides-warning-list">
                  {parseReportNotices.map((notice) => (
                    <li key={notice}>{notice}</li>
                  ))}
                </ul>
              ) : (
                <p className="slides-parse-report-empty">No notices.</p>
              )}
            </div>
          </div>
        </details>
      </section>
    </>
  )
}
