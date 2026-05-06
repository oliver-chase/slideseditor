import type { CSSProperties } from 'react'
import type { SlideComponent } from '@/components/slides/types'
import type { SlideTemplateRecord } from '@/components/slides/persistence-types'
import { buildTemplatePreviewStageStyle } from '@/app/slides/helpers/canvas-style'

interface RankedTemplateEntry {
  template: SlideTemplateRecord
  searchScore: number
  matchSignals: string[]
  pendingApprovals: number
  isBestMatch: boolean
}

interface SlidesTemplatePreviewModalProps {
  activeTemplateQuickPreview: RankedTemplateEntry | null
  isPreviewStale: boolean
  trimmedSearchValue: string
  onClose: () => void
  onDuplicateTemplate: (templateId: string) => Promise<void>
  formatDateTime: (iso: string | null | undefined) => string
  getTemplateStructureSummary: (template: SlideTemplateRecord) => string
  getTemplatePreviewScale: (canvas: { width: number; height: number }, maxWidth: number, maxHeight: number) => number
  buildCanvasComponentStyle: (component: SlideComponent) => CSSProperties
  sanitizeHtmlContent: (content: string) => string
}

export function SlidesTemplatePreviewModal({
  activeTemplateQuickPreview,
  isPreviewStale,
  trimmedSearchValue,
  onClose,
  onDuplicateTemplate,
  formatDateTime,
  getTemplateStructureSummary,
  getTemplatePreviewScale,
  buildCanvasComponentStyle,
  sanitizeHtmlContent,
}: SlidesTemplatePreviewModalProps) {
  if (!activeTemplateQuickPreview) return null

  const { template } = activeTemplateQuickPreview
  const visibleComponents = template.components.filter((component) => component.visible !== false)
  const hasVisibleComponents = visibleComponents.length > 0

  return (
    <div
      className="slides-template-preview-modal-backdrop"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        onClose()
      }}
      role="presentation"
    >
      <section
        className="slides-template-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Quick Preview: ${template.name}`}
      >
        <div className="slides-template-preview-modal-header">
          <h3>Quick Preview: {template.name}</h3>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn--compact"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="module-card-copy slides-card-note">
          {template.description || 'No description'} · Components: {template.components.length}
        </p>
        {!hasVisibleComponents && (
          <p className="module-card-copy slides-card-note">
            Preview missing: no visible components captured.
          </p>
        )}
        {isPreviewStale && (
          <p className="module-card-copy slides-card-note">
            Preview may be stale relative to latest template updates.
          </p>
        )}
        <p className="module-card-copy slides-card-note">
          Visibility: {template.is_shared ? 'Shared' : 'Private'} · Updated: {formatDateTime(template.updated_at)}
        </p>
        <p className="module-card-copy slides-card-note">
          Template structure: {getTemplateStructureSummary(template)}
        </p>
        {trimmedSearchValue && (
          <p className="module-card-copy slides-card-note slides-template-rank-note" data-rank={activeTemplateQuickPreview.isBestMatch ? 'top' : 'match'}>
            {activeTemplateQuickPreview.isBestMatch ? 'Best match' : `Match score ${activeTemplateQuickPreview.searchScore}`}
            {activeTemplateQuickPreview.matchSignals.length > 0 ? ` · ${activeTemplateQuickPreview.matchSignals.join(' · ')}` : ''}
          </p>
        )}
        <div className="slides-template-preview-modal-stage-shell">
          {hasVisibleComponents ? (
            <div
              className="slides-template-preview-stage"
              style={buildTemplatePreviewStageStyle(template.canvas, getTemplatePreviewScale(template.canvas, 860, 500))}
            >
              {visibleComponents.slice(0, 28).map((component) => (
                <div
                  key={`${template.id}:${component.id}`}
                  className="slides-template-preview-component"
                  data-preview-type={component.type}
                  style={buildCanvasComponentStyle(component)}
                >
                  {component.type === 'logo' ? (
                    <span className="slides-template-preview-asset">{component.sourceLabel || component.type}</span>
                  ) : (
                    <div
                      className="slides-template-preview-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(component.content || '') }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="slides-template-preview-empty slides-template-preview-empty--large">
              No preview components
            </div>
          )}
        </div>
        <div className="slides-inline-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary btn--compact"
            onClick={() => {
              onClose()
              void onDuplicateTemplate(template.id)
            }}
          >
            Duplicate to My Slides
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn--compact"
            onClick={onClose}
          >
            Close Preview
          </button>
        </div>
      </section>
    </div>
  )
}
