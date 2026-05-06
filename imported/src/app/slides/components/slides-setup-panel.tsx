import type { Dispatch, SetStateAction } from 'react'
import CustomPicker from '@/components/shared/CustomPicker'
import type { SlideTheme } from '@/components/slides/types'

type SaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'error' | 'queued' | 'conflict'
type ThemeScope = 'slide' | 'deck'

type CanvasPreset = {
  id: string
  label: string
  width: number
  height: number
}

type DeckSlide = {
  id: string
}

type SetupPanelResult = {
  canvas: {
    width: number
    height: number
  }
}


type ConflictServerSlide = {
  revision: number
} | null

interface SlidesSetupPanelProps {
  result: SetupPanelResult | null
  slideTitle: string
  setSlideTitle: Dispatch<SetStateAction<string>>
  setDirty: () => void

  deckSlides: DeckSlide[]
  activeDeckSlide: DeckSlide | null
  handleCreateDeckSlide: () => void
  handleDuplicateDeckSlide: () => void
  handleDeleteDeckSlide: () => Promise<void> | void
  handleReorderDeckSlide: (direction: 'up' | 'down') => void
  handleSelectDeckSlide: (slideId: string) => void

  handleSave: (options?: { autosave?: boolean }) => Promise<unknown> | void
  saveStatus: SaveStatus
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>
  saveStatusTone: string
  saveStatusLabel: string
  saveError: string | null
  setSaveError: Dispatch<SetStateAction<string | null>>
  lastSavedAt: string | null
  formatDateTime: (value: string | null | undefined) => string

  autosaveEnabled: boolean
  setAutosaveEnabled: Dispatch<SetStateAction<boolean>>
  autosaveRetryState: { attempt: number; delayMs: number } | null
  setAutosaveRetryState: (value: null) => void
  scheduleAutosaveRetryNow: () => void
  dismissAutosaveRetry: () => void

  importSourceSummary: string

  canvasSizePresets: readonly CanvasPreset[]
  handleApplyCanvasPreset: (width: number, height: number) => void
  resizeCanvasWidthInput: string
  setResizeCanvasWidthInput: Dispatch<SetStateAction<string>>
  canvasWidthError: string | null
  resizeCanvasHeightInput: string
  setResizeCanvasHeightInput: Dispatch<SetStateAction<string>>
  canvasHeightError: string | null
  aspectRatioChanging: boolean
  currentCanvasAspectRatio: number | null
  nextCanvasAspectRatio: number | null
  handleResizeCanvasProportionally: () => void
  handleResizeCanvasResponsively: () => void
  canvasResizeInvalid: boolean

  cropXInput: string
  setCropXInput: Dispatch<SetStateAction<string>>
  cropYInput: string
  setCropYInput: Dispatch<SetStateAction<string>>
  cropWidthInput: string
  setCropWidthInput: Dispatch<SetStateAction<string>>
  cropHeightInput: string
  setCropHeightInput: Dispatch<SetStateAction<string>>
  handleApplyCanvasCrop: () => void
  handleResetCanvasCrop: () => void
  cropRestoreDocument: unknown

  themeDraft: SlideTheme
  setThemeDraft: Dispatch<SetStateAction<SlideTheme>>
  themeScope: ThemeScope
  setThemeScope: Dispatch<SetStateAction<ThemeScope>>
  themeConvertImported: boolean
  setThemeConvertImported: Dispatch<SetStateAction<boolean>>
  handleApplyTheme: () => void

  conflictServerSlide: ConflictServerSlide
  handleConflictReload: () => void
  handleConflictOverwrite: () => Promise<void> | void
  handleConflictSaveAsCopy: () => Promise<void> | void
}

export function SlidesSetupPanel({
  result,
  slideTitle,
  setSlideTitle,
  setDirty,
  deckSlides,
  activeDeckSlide,
  handleCreateDeckSlide,
  handleDuplicateDeckSlide,
  handleDeleteDeckSlide,
  handleReorderDeckSlide,
  handleSelectDeckSlide,
  handleSave,
  saveStatus,
  setSaveStatus,
  saveStatusTone,
  saveStatusLabel,
  saveError,
  setSaveError,
  lastSavedAt,
  formatDateTime,
  autosaveEnabled,
  setAutosaveEnabled,
  autosaveRetryState,
  setAutosaveRetryState,
  scheduleAutosaveRetryNow,
  dismissAutosaveRetry,
  importSourceSummary,
  canvasSizePresets,
  handleApplyCanvasPreset,
  resizeCanvasWidthInput,
  setResizeCanvasWidthInput,
  canvasWidthError,
  resizeCanvasHeightInput,
  setResizeCanvasHeightInput,
  canvasHeightError,
  aspectRatioChanging,
  currentCanvasAspectRatio,
  nextCanvasAspectRatio,
  handleResizeCanvasProportionally,
  handleResizeCanvasResponsively,
  canvasResizeInvalid,
  cropXInput,
  setCropXInput,
  cropYInput,
  setCropYInput,
  cropWidthInput,
  setCropWidthInput,
  cropHeightInput,
  setCropHeightInput,
  handleApplyCanvasCrop,
  handleResetCanvasCrop,
  cropRestoreDocument,
  themeDraft,
  setThemeDraft,
  themeScope,
  setThemeScope,
  themeConvertImported,
  setThemeConvertImported,
  handleApplyTheme,
  conflictServerSlide,
  handleConflictReload,
  handleConflictOverwrite,
  handleConflictSaveAsCopy,
}: SlidesSetupPanelProps) {
  return (
    <section className="slides-import-panel slides-import-panel-save">
      <div className="slides-panel-heading">
        <h2 className="module-card-title">Slide Setup</h2>
        <p className="module-card-copy">Set the slide title, keep autosave active, and surface save or conflict state without leaving the page.</p>
      </div>

      <div className="slides-save-panel">
        <label className="slides-label" htmlFor="slides-title">Slide Title</label>
        <input
          id="slides-title"
          className="slides-input"
          value={slideTitle}
          onChange={(event) => {
            setSlideTitle(event.target.value)
            if (result) setDirty()
          }}
          placeholder="Untitled Slide"
        />

        {result && (
          <p className="module-card-copy slides-card-note" role="status">
            Working item: {deckSlides.length <= 1
              ? 'Single slide'
              : `Deck · Slide ${Math.max(1, deckSlides.findIndex((slide) => slide.id === activeDeckSlide?.id) + 1)} of ${deckSlides.length}`}
          </p>
        )}

        {result && (
          <div className="module-card slides-state-panel" data-testid="slides-deck-strip">
            <div className="slides-panel-heading">
              <h3>Deck Slides</h3>
              <p className="module-card-copy">{deckSlides.length} slide{deckSlides.length === 1 ? '' : 's'} in the working deck.</p>
            </div>
            <div className="slides-inline-actions">
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={handleCreateDeckSlide}>
                New Slide
              </button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={handleDuplicateDeckSlide} disabled={!activeDeckSlide}>
                Duplicate Slide
              </button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => void handleDeleteDeckSlide()} disabled={!activeDeckSlide || deckSlides.length <= 1}>
                Delete Slide
              </button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => handleReorderDeckSlide('up')} disabled={!activeDeckSlide || deckSlides.findIndex((slide) => slide.id === activeDeckSlide.id) <= 0}>
                Move Up
              </button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => handleReorderDeckSlide('down')} disabled={!activeDeckSlide || deckSlides.findIndex((slide) => slide.id === activeDeckSlide.id) === deckSlides.length - 1}>
                Move Down
              </button>
            </div>
            <div className="slides-inline-actions" role="tablist" aria-label="Deck slide navigation">
              {deckSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={'btn btn-sm btn--compact ' + (slide.id === activeDeckSlide?.id ? 'btn-primary' : 'btn-ghost')}
                  onClick={() => handleSelectDeckSlide(slide.id)}
                  data-testid={`slides-deck-tab-${index + 1}`}
                >
                  {`Slide ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="slides-inline-actions">
          <button
            type="button"
            className="btn btn-primary btn--compact"
            onClick={() => void handleSave()}
            disabled={!result || saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save Slide'}
          </button>
          <label className="slides-checkbox-row">
            <input
              type="checkbox"
              checked={autosaveEnabled}
              onChange={(event) => {
                const enabled = event.target.checked
                setAutosaveEnabled(enabled)
                if (!enabled && autosaveRetryState) {
                  setAutosaveRetryState(null)
                  setSaveStatus(result ? 'dirty' : 'clean')
                  setSaveError(null)
                }
              }}
            />
            Autosave every 5s when dirty
          </label>
        </div>

        <div className="slides-save-status" data-save-status={saveStatusTone} role="status" aria-live="polite">
          <span className="slides-save-status-badge">{saveStatusLabel}</span>
          <span className="slides-save-status-text">
            {saveStatus === 'conflict'
              ? 'Conflict detected. Resolve before continuing.'
              : saveStatus === 'error'
                ? 'Save failed. Retry to resync.'
                : saveStatus === 'queued'
                  ? 'Save queued and will retry automatically.'
                  : saveStatus === 'saving'
                    ? 'Saving updates to /api/slides.'
                    : saveStatus === 'dirty'
                      ? 'Unsaved changes in workspace.'
                      : saveStatus === 'saved'
                        ? 'Changes saved.'
                        : 'Workspace is in sync.'}
          </span>
          <span className="slides-save-status-time">
            {lastSavedAt ? `Last saved ${formatDateTime(lastSavedAt)}` : 'Last saved not available yet'}
          </span>
          {(saveStatus === 'dirty' || saveStatus === 'queued' || saveStatus === 'error') && (
            <button
              type="button"
              className="btn btn-sm btn-ghost btn--compact"
              onClick={() => void handleSave()}
              disabled={!result}
            >
              Retry Save
            </button>
          )}
        </div>

        {!result && (
          <div className="slides-empty-canvas-state" data-testid="slides-empty-canvas-state">
            <h3>Import or paste HTML to generate an editable canvas.</h3>
            <p className="module-card-copy">Once imported, the canvas preview, layer inspector, export tools, and diagnostics will shift into the editor layout below.</p>
            <div className="slides-empty-canvas-guidance">
              <span>Recent import source: {importSourceSummary}</span>
              <span>Autosave: {autosaveEnabled ? 'On' : 'Off'}</span>
              <span>Save status: {saveStatusLabel}</span>
            </div>
          </div>
        )}

        {result && (
          <div className="module-card slides-state-panel slides-state-panel--canvas-settings" data-testid="slides-canvas-resize-panel">
            <div className="slides-panel-heading">
              <h3>Canvas Settings</h3>
              <p className="module-card-copy">Resize scales the full deck proportionally without responsive reflow.</p>
            </div>
            <div className="slides-toolbar-fields">
              <p className="slides-panel-meta">
                Detected source canvas: {result.canvas.width} × {result.canvas.height}
              </p>
              <div className="slides-inline-actions">
                {canvasSizePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="btn btn-sm btn-ghost btn--compact"
                    onClick={() => handleApplyCanvasPreset(preset.width, preset.height)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <label className="module-field-control slides-editor-field" htmlFor="slides-canvas-width">
                <span>Canvas Width</span>
                <input
                  id="slides-canvas-width"
                  className="slides-input"
                  type="number"
                  min={320}
                  step={1}
                  value={resizeCanvasWidthInput}
                  onChange={(event) => setResizeCanvasWidthInput(event.target.value)}
                  aria-invalid={canvasWidthError ? true : undefined}
                />
                {canvasWidthError && <span className="slides-field-error">{canvasWidthError}</span>}
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-canvas-height">
                <span>Canvas Height</span>
                <input
                  id="slides-canvas-height"
                  className="slides-input"
                  type="number"
                  min={180}
                  step={1}
                  value={resizeCanvasHeightInput}
                  onChange={(event) => setResizeCanvasHeightInput(event.target.value)}
                  aria-invalid={canvasHeightError ? true : undefined}
                />
                {canvasHeightError && <span className="slides-field-error">{canvasHeightError}</span>}
              </label>
              {aspectRatioChanging && (
                <p className="slides-panel-warning" role="status">
                  Aspect ratio is changing from {(currentCanvasAspectRatio || 0).toFixed(3)} to {(nextCanvasAspectRatio || 0).toFixed(3)}. This will intentionally stretch/scale layout coordinates.
                </p>
              )}
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={handleResizeCanvasProportionally} disabled={canvasResizeInvalid}>
                Resize Canvas Proportionally
              </button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={handleResizeCanvasResponsively} disabled={canvasResizeInvalid}>
                Adapt Layout Responsively
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="module-card slides-state-panel" data-testid="slides-canvas-crop-panel">
            <div className="slides-panel-heading">
              <h3>Canvas Crop</h3>
              <p className="module-card-copy">Crop the visible slide area without deleting source layers. Reset Crop restores the pre-crop document.</p>
            </div>
            <div className="slides-toolbar-fields">
              <label className="module-field-control slides-editor-field" htmlFor="slides-crop-x">
                <span>Crop X</span>
                <input id="slides-crop-x" className="slides-input" type="number" min={0} step={1} value={cropXInput} onChange={(event) => setCropXInput(event.target.value)} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-crop-y">
                <span>Crop Y</span>
                <input id="slides-crop-y" className="slides-input" type="number" min={0} step={1} value={cropYInput} onChange={(event) => setCropYInput(event.target.value)} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-crop-width">
                <span>Crop Width</span>
                <input id="slides-crop-width" className="slides-input" type="number" min={1} step={1} value={cropWidthInput} placeholder={String(result.canvas.width)} onChange={(event) => setCropWidthInput(event.target.value)} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-crop-height">
                <span>Crop Height</span>
                <input id="slides-crop-height" className="slides-input" type="number" min={1} step={1} value={cropHeightInput} placeholder={String(result.canvas.height)} onChange={(event) => setCropHeightInput(event.target.value)} />
              </label>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={handleApplyCanvasCrop}>
                Apply Crop
              </button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={handleResetCanvasCrop} disabled={!cropRestoreDocument}>
                Reset Crop
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="module-card slides-state-panel" data-testid="slides-theme-panel">
            <div className="slides-panel-heading">
              <h3>Brand Theme</h3>
              <p className="module-card-copy">Apply linked brand styling to the current slide or full deck.</p>
            </div>
            <div className="slides-toolbar-fields">
              <label className="module-field-control slides-editor-field" htmlFor="slides-theme-heading-font">
                <span>Heading font</span>
                <input id="slides-theme-heading-font" className="slides-input" value={themeDraft.fonts.heading} onChange={(event) => setThemeDraft((theme) => ({ ...theme, fonts: { ...theme.fonts, heading: event.target.value } }))} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-theme-body-font">
                <span>Body font</span>
                <input id="slides-theme-body-font" className="slides-input" value={themeDraft.fonts.body} onChange={(event) => setThemeDraft((theme) => ({ ...theme, fonts: { ...theme.fonts, body: event.target.value } }))} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-theme-primary">
                <span>Primary</span>
                <input id="slides-theme-primary" className="slides-input" type="color" value={themeDraft.colors.primary} onChange={(event) => setThemeDraft((theme) => ({ ...theme, colors: { ...theme.colors, primary: event.target.value } }))} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-theme-secondary">
                <span>Secondary</span>
                <input id="slides-theme-secondary" className="slides-input" type="color" value={themeDraft.colors.secondary} onChange={(event) => setThemeDraft((theme) => ({ ...theme, colors: { ...theme.colors, secondary: event.target.value } }))} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-theme-background">
                <span>Background</span>
                <input id="slides-theme-background" className="slides-input" type="color" value={themeDraft.colors.background} onChange={(event) => setThemeDraft((theme) => ({ ...theme, colors: { ...theme.colors, background: event.target.value } }))} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-theme-accent">
                <span>Accent</span>
                <input id="slides-theme-accent" className="slides-input" type="color" value={themeDraft.colors.accent} onChange={(event) => setThemeDraft((theme) => ({ ...theme, colors: { ...theme.colors, accent: event.target.value } }))} />
              </label>
              <label className="module-field-control slides-editor-field" htmlFor="slides-theme-scope">
                <span>Scope</span>
                <CustomPicker
                  options={[
                    { value: 'slide', label: 'Current slide' },
                    { value: 'deck', label: 'Full deck' },
                  ]}
                  selected={themeScope}
                  onChange={(value) => setThemeScope((Array.isArray(value) ? value[0] : value) as ThemeScope)}
                  searchable={false}
                  showUnassigned={false}
                  triggerClassName="slides-select"
                />
              </label>
              <label className="slides-checkbox-row" htmlFor="slides-theme-convert-imported">
                <input id="slides-theme-convert-imported" type="checkbox" checked={themeConvertImported} onChange={(event) => setThemeConvertImported(event.target.checked)} />
                Convert imported layers
              </label>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={handleApplyTheme}>
                Apply Theme
              </button>
            </div>
          </div>
        )}

        {saveError && (
          <p className="slides-error" role="alert">
            {saveError}
          </p>
        )}

        {autosaveRetryState && (
          <div className="slides-retry" role="status">
            <p className="module-card-copy">
              Autosave retry queued. Attempt {autosaveRetryState.attempt} with {Math.ceil(autosaveRetryState.delayMs / 1000)}s backoff.
            </p>
            <div className="slides-inline-actions">
              <button type="button" className="btn btn-sm btn-primary btn--compact" onClick={() => void handleSave({ autosave: true })}>
                Retry Autosave Now
              </button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={scheduleAutosaveRetryNow}>
                Requeue Immediate Retry
              </button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={dismissAutosaveRetry}>
                Dismiss Retry Queue
              </button>
            </div>
          </div>
        )}

        {saveStatus === 'conflict' && conflictServerSlide && (
          <div className="slides-conflict">
            <p className="module-card-copy">
              Conflict with server revision {conflictServerSlide.revision}.
            </p>
            <div className="slides-inline-actions">
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={handleConflictReload}>Reload Server Version</button>
              <button type="button" className="btn btn-sm btn-primary btn--compact" onClick={() => void handleConflictOverwrite()}>Overwrite Server</button>
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => void handleConflictSaveAsCopy()}>Save as Copy</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
