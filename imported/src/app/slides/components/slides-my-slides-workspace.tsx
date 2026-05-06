'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { SlideRecord } from '@/components/slides/persistence-types'
import CustomPicker from '@/components/shared/CustomPicker'
import type { MySlidesRow, MySlidesStatus, WorkspaceTab } from '@/app/slides/page-model'

type TemplatePublishDraft = {
  slideId: string
  name: string
  description: string
  isShared: boolean
} | null

type SlidesMySlidesWorkspaceProps = {
  pptxSelectedSlideIds: string[]
  handleExportSelectedSlidesAsPptx: () => Promise<void> | void
  pptxExportBusy: boolean
  selectAllVisibleSlides: () => void
  filteredMySlidesRows: MySlidesRow[]
  slides: SlideRecord[]
  areAllVisibleSlidesSelected: boolean
  keepVisibleSelection: () => void
  hasHiddenSelections: boolean
  clearPptxSelection: () => void
  selectedVisibleSlideCount: number
  selectedHiddenSlideCount: number
  trimmedSearchValue: string
  handleWorkspaceTabChange: (tab: WorkspaceTab) => void
  togglePptxSlideSelection: (slideId: string) => void
  formatMySlidesStatus: (status: MySlidesStatus) => string
  formatDateTime: (iso: string | null | undefined) => string
  loadSlide: (slide: SlideRecord, options?: { skipUnsavedConfirm?: boolean }) => void
  handleDuplicateSlide: (slideId: string) => Promise<void> | void
  handleRenameSlide: (slide: SlideRecord) => Promise<void> | void
  openPublishTemplateDraft: (slide: SlideRecord) => void
  handleDeleteSlide: (slide: SlideRecord) => Promise<void> | void
  templatePublishDraft: TemplatePublishDraft
  setTemplatePublishDraft: Dispatch<SetStateAction<TemplatePublishDraft>>
  isSlidesAdmin: boolean
  handlePublishTemplate: () => Promise<void> | void
  templatePublishBusy: boolean
  closePublishTemplateDraft: () => void
}

export function SlidesMySlidesWorkspace({
  pptxSelectedSlideIds,
  handleExportSelectedSlidesAsPptx,
  pptxExportBusy,
  selectAllVisibleSlides,
  filteredMySlidesRows,
  slides,
  areAllVisibleSlidesSelected,
  keepVisibleSelection,
  hasHiddenSelections,
  clearPptxSelection,
  selectedVisibleSlideCount,
  selectedHiddenSlideCount,
  trimmedSearchValue,
  handleWorkspaceTabChange,
  togglePptxSlideSelection,
  formatMySlidesStatus,
  formatDateTime,
  loadSlide,
  handleDuplicateSlide,
  handleRenameSlide,
  openPublishTemplateDraft,
  handleDeleteSlide,
  templatePublishDraft,
  setTemplatePublishDraft,
  isSlidesAdmin,
  handlePublishTemplate,
  templatePublishBusy,
  closePublishTemplateDraft,
}: SlidesMySlidesWorkspaceProps) {
  return (
    <div className="slides-library-section">
      <h2>My Slides</h2>
      <div className="slides-inline-actions">
        <span className="module-card-copy slides-card-note">Selected: {pptxSelectedSlideIds.length}</span>
        <button
          type="button"
          className="btn btn-sm btn-ghost btn--compact"
          onClick={() => void handleExportSelectedSlidesAsPptx()}
          disabled={pptxExportBusy || pptxSelectedSlideIds.length === 0}
        >
          {pptxExportBusy ? 'Exporting PPTX…' : `Export Selected PPTX (${pptxSelectedSlideIds.length})`}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost btn--compact"
          onClick={selectAllVisibleSlides}
          disabled={pptxExportBusy || slides.length === 0 || areAllVisibleSlidesSelected}
        >
          Select Visible ({filteredMySlidesRows.length})
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost btn--compact"
          onClick={() => keepVisibleSelection()}
          disabled={!hasHiddenSelections || pptxExportBusy}
        >
          Keep Visible Only
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost btn--compact"
          onClick={() => clearPptxSelection()}
          disabled={pptxSelectedSlideIds.length === 0 || pptxExportBusy}
        >
          Clear Selection
        </button>
      </div>
      <p className="slides-selection-hint">
        Selected for export: {selectedVisibleSlideCount} visible / {pptxSelectedSlideIds.length} total.
      </p>
      {selectedHiddenSlideCount > 0 && (
        <p className="slides-selection-hint" data-tone="warning">
          {selectedHiddenSlideCount} selected slide{selectedHiddenSlideCount === 1 ? '' : 's'} {selectedHiddenSlideCount === 1 ? 'is' : 'are'} hidden by the current search filter.
        </p>
      )}
      {filteredMySlidesRows.length === 0 && (
        <div className="module-empty-state slides-state-panel slides-empty-state" data-testid="slides-my-slides-empty-state">
          <h3 className="module-empty-state-title slides-state-title">My Slides is empty</h3>
          <p className="module-empty-state-copy slides-state-copy">
            {trimmedSearchValue
              ? `No saved slides or decks match "${trimmedSearchValue}". Clear or update search to continue.`
              : 'No saved slides or decks yet. Open Workspace to import and save your first slide.'}
          </p>
          <div className="module-action-row slides-state-actions">
            <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => handleWorkspaceTabChange('import')}>
              Open Workspace
            </button>
          </div>
        </div>
      )}
      {filteredMySlidesRows.map((row) => {
        const slide = row.itemType === 'slide' ? slides.find((entry) => entry.id === row.id) : null
        const allSelected = row.slideIds.length > 0 && row.slideIds.every((slideId) => pptxSelectedSlideIds.includes(slideId))
        return (
          <article key={row.id} className="module-card slides-library-card slides-library-card--compact">
            <div className="slides-card-topline">
              <label className="slides-checkbox-row" htmlFor={`slides-pptx-select-${row.id}`}>
                <input
                  id={`slides-pptx-select-${row.id}`}
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    if (allSelected) {
                      row.slideIds.forEach((slideId) => {
                        if (pptxSelectedSlideIds.includes(slideId)) togglePptxSlideSelection(slideId)
                      })
                      return
                    }
                    row.slideIds.forEach((slideId) => {
                      if (!pptxSelectedSlideIds.includes(slideId)) togglePptxSlideSelection(slideId)
                    })
                  }}
                />
                Include in PPTX export
              </label>
              <span className="module-chip-compact slides-card-note slides-card-pill">Status: {formatMySlidesStatus(row.status)}</span>
            </div>
            <div className="slides-card-main">
              <div className="slides-card-summary">
                <h3 className="module-card-title">{row.title}</h3>
                <p className="module-card-copy slides-card-note">Deck: {row.deckTitle || (row.itemType === 'deck' ? row.title : 'None')}</p>
              </div>
              <div className="slides-card-meta-grid" aria-label="Slide metadata">
                <span>Type: {row.itemType}</span>
                <span>Updated: {formatDateTime(row.updatedAt)}</span>
                <span>Owner: {row.owner}</span>
                <span>Visibility: {row.visibility}</span>
              </div>
              {row.tags.length > 0 && (
                <div className="module-chip-row slides-chip-row" aria-label="Slide tags">
                  {row.tags.map((tag) => (
                    <span key={`${row.id}:${tag}`} className="module-chip-compact slides-card-note slides-card-pill">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <details className="module-action-menu slides-card-actions-shell">
              <summary className="btn btn-sm btn-ghost btn--compact">Actions</summary>
              <div className="module-action-menu-panel slides-inline-actions slides-card-actions">
                <button type="button" className="btn btn-sm btn-primary btn--compact" onClick={() => slide && loadSlide(slide)} disabled={!slide}>Load</button>
                <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => slide && void handleDuplicateSlide(slide.id)} disabled={!slide}>Duplicate</button>
                <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => slide && void handleRenameSlide(slide)} disabled={!slide}>Rename</button>
                <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => slide && openPublishTemplateDraft(slide)} disabled={!slide}>Publish Template</button>
                <button type="button" className="btn btn-sm btn-danger btn--compact" onClick={() => slide && void handleDeleteSlide(slide)} disabled={!slide}>Delete</button>
              </div>
            </details>
            {slide && templatePublishDraft?.slideId === slide.id && (
              <div className="module-card slides-template-draft">
                <label className="slides-label" htmlFor="slides-template-name">Template Name</label>
                <input
                  id="slides-template-name"
                  className="slides-input"
                  value={templatePublishDraft.name}
                  onChange={(event) =>
                    setTemplatePublishDraft({
                      ...templatePublishDraft,
                      name: event.target.value,
                    })}
                  placeholder={`${slide.title} Template`}
                />

                <label className="slides-label" htmlFor="slides-template-description">Template Description</label>
                <input
                  id="slides-template-description"
                  className="slides-input"
                  value={templatePublishDraft.description}
                  onChange={(event) =>
                    setTemplatePublishDraft({
                      ...templatePublishDraft,
                      description: event.target.value,
                    })}
                  placeholder="Published from My Slides"
                />

                <label className="slides-label" htmlFor="slides-template-visibility">Visibility</label>
                <CustomPicker
                  selected={templatePublishDraft.isShared ? 'shared' : 'private'}
                  options={[
                    { value: 'private', label: 'Private (owner only)' },
                    { value: 'shared', label: 'Shared (team library)' },
                  ]}
                  onChange={(value) =>
                    setTemplatePublishDraft({
                      ...templatePublishDraft,
                      isShared: value === 'shared' && isSlidesAdmin,
                    })}
                  disabled={!isSlidesAdmin}
                  searchable={false}
                  showUnassigned={false}
                  triggerClassName="slides-select"
                />
                {!isSlidesAdmin && (
                  <p className="module-card-copy slides-card-note">
                    Shared template publishing is restricted to admins. Your template will remain private.
                  </p>
                )}

                <div className="slides-inline-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary btn--compact"
                    onClick={() => void handlePublishTemplate()}
                    disabled={templatePublishBusy}
                  >
                    {templatePublishBusy ? 'Publishing…' : 'Confirm Publish Template'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost btn--compact"
                    onClick={closePublishTemplateDraft}
                    disabled={templatePublishBusy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
