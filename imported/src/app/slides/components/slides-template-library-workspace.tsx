import type { Dispatch, SetStateAction } from 'react'
import CustomPicker from '@/components/shared/CustomPicker'
import type { SlideActor, SlideTemplateRecord } from '@/components/slides/persistence-types'
import type {
  RankedTemplateEntry,
  TemplateGovernanceStatus,
  TemplateSortOption,
} from '@/app/slides/page-model'
import {
  formatTemplateGovernanceStatus,
  getTemplatePreviewScale,
  getTemplateStructureSummary,
  sanitizeHtmlContent,
} from '@/app/slides/page-model'
import { buildCanvasComponentStyle } from '@/app/slides/page-model'
import { buildTemplatePreviewStageStyle } from '@/app/slides/helpers/canvas-style'
import { SlidesTemplatePreviewModal } from '@/app/slides/components/slides-template-preview-modal'

type TemplatePreviewStatus = {
  missing: boolean
  stale: boolean
  needsRefresh: boolean
  visibleCount: number
  missingReason: 'no-visible-components' | 'not-generated' | null
}

interface SlidesTemplateLibraryWorkspaceProps {
  actor: SlideActor
  isSlidesAdmin: boolean
  templates: SlideTemplateRecord[]
  libraryLoading: boolean
  trimmedSearchValue: string
  rankedTemplates: RankedTemplateEntry[]
  filteredRankedTemplates: RankedTemplateEntry[]
  templateStatusFilter: 'all' | TemplateGovernanceStatus
  setTemplateStatusFilter: Dispatch<SetStateAction<'all' | TemplateGovernanceStatus>>
  templateOwnerFilter: string
  setTemplateOwnerFilter: Dispatch<SetStateAction<string>>
  templateOwnerOptions: string[]
  templateTagFilter: string
  setTemplateTagFilter: Dispatch<SetStateAction<string>>
  templateTagOptions: string[]
  templateSort: TemplateSortOption
  setTemplateSort: Dispatch<SetStateAction<TemplateSortOption>>
  templatePreviewStatusById: Record<string, TemplatePreviewStatus>
  templateActionBusyId: string | null
  activeTemplateQuickPreview: RankedTemplateEntry | null
  setTemplateQuickPreviewId: (value: string | null) => void
  handleDuplicateTemplate: (templateId: string) => Promise<void> | void
  handleTemplateVisibilityToggle: (template: SlideTemplateRecord) => Promise<void> | void
  setSearchValue: Dispatch<SetStateAction<string>>
  formatDateTime: (value: string | null | undefined) => string
}

const TEMPLATE_LIBRARY_PREVIEW_SKELETON_COUNT = 3
const TEMPLATE_PREVIEW_COMPONENT_LIMIT = 18

export function SlidesTemplateLibraryWorkspace({
  actor,
  isSlidesAdmin,
  templates,
  libraryLoading,
  trimmedSearchValue,
  rankedTemplates,
  filteredRankedTemplates,
  templateStatusFilter,
  setTemplateStatusFilter,
  templateOwnerFilter,
  setTemplateOwnerFilter,
  templateOwnerOptions,
  templateTagFilter,
  setTemplateTagFilter,
  templateTagOptions,
  templateSort,
  setTemplateSort,
  templatePreviewStatusById,
  templateActionBusyId,
  activeTemplateQuickPreview,
  setTemplateQuickPreviewId,
  handleDuplicateTemplate,
  handleTemplateVisibilityToggle,
  setSearchValue,
  formatDateTime,
}: SlidesTemplateLibraryWorkspaceProps) {
  return (
    <div className="slides-library-section">
      <h2>Template Library</h2>
      <div className="module-action-row slides-inline-actions slides-filter-strip" style={{ marginBottom: 'var(--spacing-sm)' }}>
        <span className="module-card-copy slides-card-note">Templates can be previewed and duplicated into My Slides.</span>
      </div>

      <div className="module-chip-row slides-inline-actions slides-chip-row" style={{ marginBottom: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
        <label className="module-field-control slides-editor-field">
          <span>Status</span>
          <CustomPicker
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'approved', label: 'Approved' },
              { value: 'draft', label: 'Draft' },
            ]}
            selected={templateStatusFilter}
            onChange={(value) => setTemplateStatusFilter((Array.isArray(value) ? value[0] : value) as 'all' | TemplateGovernanceStatus)}
            searchable={false}
            showUnassigned={false}
            triggerClassName="slides-select"
          />
        </label>
        <label className="module-field-control slides-editor-field">
          <span>Owner</span>
          <CustomPicker
            options={[
              { value: 'all', label: 'All owners' },
              ...templateOwnerOptions.map((owner) => ({ value: owner, label: owner })),
            ]}
            selected={templateOwnerFilter}
            onChange={(value) => setTemplateOwnerFilter(Array.isArray(value) ? (value[0] ?? 'all') : value)}
            placeholder="All owners"
            showUnassigned={false}
            triggerClassName="slides-select"
          />
        </label>
        <label className="module-field-control slides-editor-field">
          <span>Tags</span>
          <CustomPicker
            options={[
              { value: 'all', label: 'All tags' },
              ...templateTagOptions.map((tag) => ({ value: tag, label: tag })),
            ]}
            selected={templateTagFilter}
            onChange={(value) => setTemplateTagFilter(Array.isArray(value) ? (value[0] ?? 'all') : value)}
            placeholder="All tags"
            showUnassigned={false}
            triggerClassName="slides-select"
          />
        </label>
        <label className="module-field-control slides-editor-field">
          <span>Sort</span>
          <CustomPicker
            options={[
              { value: 'updated-desc', label: 'Updated (Newest)' },
              { value: 'updated-asc', label: 'Updated (Oldest)' },
              { value: 'title-asc', label: 'Title (A-Z)' },
              { value: 'title-desc', label: 'Title (Z-A)' },
            ]}
            selected={templateSort}
            onChange={(value) => setTemplateSort((Array.isArray(value) ? value[0] : value) as TemplateSortOption)}
            searchable={false}
            showUnassigned={false}
            triggerClassName="slides-select"
          />
        </label>
      </div>

      {trimmedSearchValue && filteredRankedTemplates.length > 0 && (
        <p className="module-card-copy slides-card-note slides-template-search-summary">
          Showing {filteredRankedTemplates.length} template match{filteredRankedTemplates.length === 1 ? '' : 'es'} sorted by relevance.
        </p>
      )}

      {filteredRankedTemplates.length === 0 && (
        <div className="module-empty-state slides-state-panel slides-empty-state" data-testid="slides-templates-empty-state">
          <h3 className="module-empty-state-title slides-state-title">Template Library is empty</h3>
          <p className="module-empty-state-copy slides-state-copy">
            {trimmedSearchValue
              ? `No templates match "${trimmedSearchValue}". Clear or update search to continue.`
              : 'No templates available yet.'}
          </p>
          <div className="module-action-row slides-state-actions">
            <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => setSearchValue('')}>
              Clear Search
            </button>
          </div>
        </div>
      )}

      {libraryLoading && rankedTemplates.length === 0 && templates.length === 0 && (
        <div className="module-card slides-state-panel" data-tone="loading" data-testid="slides-templates-loading-state">
          <h3 className="module-empty-state-title slides-state-title">Loading template library</h3>
          <p className="module-empty-state-copy slides-state-copy">Fetching template previews and permissions.</p>
        </div>
      )}

      {libraryLoading && rankedTemplates.length === 0 && templates.length === 0 && (
        <div className="slides-template-skeleton-list" aria-label="Loading templates">
          {Array.from({ length: TEMPLATE_LIBRARY_PREVIEW_SKELETON_COUNT }).map((_, index) => (
            <article key={`template-skeleton-${index}`} className="module-card slides-library-card">
              <div className="slides-template-skeleton-preview" />
              <div className="slides-template-skeleton-line" />
              <div className="slides-template-skeleton-line slides-template-skeleton-line-sm" />
              <div className="slides-template-skeleton-actions">
                <span className="slides-template-skeleton-btn" />
                <span className="slides-template-skeleton-btn" />
              </div>
            </article>
          ))}
        </div>
      )}

      {filteredRankedTemplates.map((entry) => {
        const template = entry.template
        const templateStatus = templatePreviewStatusById[template.id]
        const visibleComponents = template.components.filter((component) => component.visible !== false)

        return (
          <article key={template.id} className="module-card slides-library-card slides-library-card--template">
            <div className="slides-template-card-shell">
              <div className="slides-template-preview" aria-hidden="true">
                <div
                  className="slides-template-preview-stage"
                  style={buildTemplatePreviewStageStyle(template.canvas, getTemplatePreviewScale(template.canvas, 220, 124))}
                >
                  {visibleComponents.length === 0 ? (
                    <div className="slides-template-preview-empty" role="img" aria-label="No visible preview components">
                      No preview components
                    </div>
                  ) : (
                    visibleComponents
                      .slice(0, TEMPLATE_PREVIEW_COMPONENT_LIMIT)
                      .map((component) => (
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
                      ))
                  )}
                </div>
              </div>

              <div className="slides-template-card-main">
                <div className="slides-card-topline">
                  <h3 className="module-card-title">{template.name}</h3>
                  <span className="module-chip-compact slides-card-note slides-card-pill">{formatTemplateGovernanceStatus(entry.governanceStatus)}</span>
                </div>
                <p>{template.description || 'No description'}</p>
                <div className="slides-card-meta-grid" aria-label="Template metadata">
                  <span>Owner: {template.owner_user_id || 'n/a'}</span>
                  <span>Visibility: {template.is_shared ? 'Shared' : 'Private'}</span>
                  <span>Updated: {formatDateTime(template.updated_at)}</span>
                  <span>Slides: {visibleComponents.length}</span>
                  <span>Preview: {templateStatus?.visibleCount || 0}</span>
                </div>

                {entry.tags.length > 0 ? (
                  <div className="module-chip-row slides-chip-row" aria-label="Template tags">
                    {entry.tags.map((tag) => (
                      <span key={`${template.id}:${tag}`} className="module-chip-compact slides-card-note slides-card-pill">{tag}</span>
                    ))}
                  </div>
                ) : null}

                <p className="module-card-copy slides-card-note">Template structure: {getTemplateStructureSummary(template)}</p>

                {templateStatus?.missing ? (
                  <p className="module-card-copy slides-card-note">
                    {templateStatus.missingReason === 'not-generated'
                      ? 'Preview missing: backend snapshot has not been generated yet.'
                      : 'Preview missing: no visible components captured.'}
                  </p>
                ) : (
                  <p className="module-card-copy slides-card-note">Preview components: {templateStatus?.visibleCount || 0}</p>
                )}

                {trimmedSearchValue && (
                  <p className="module-card-copy slides-card-note slides-template-rank-note" data-rank={entry.isBestMatch ? 'top' : 'match'}>
                    {entry.isBestMatch ? 'Best match' : `Match score ${entry.searchScore}`}
                    {entry.matchSignals.length > 0 ? ` · ${entry.matchSignals.join(' · ')}` : ''}
                  </p>
                )}
              </div>
            </div>

            <details className="module-card slides-template-draft module-action-menu slides-card-actions-shell">
              <summary className="module-card-copy slides-card-note">Actions Menu</summary>
              <div className="module-action-menu-panel slides-inline-actions slides-card-actions" style={{ marginTop: 'var(--spacing-xs)' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost btn--compact"
                  onClick={() => setTemplateQuickPreviewId(template.id)}
                >
                  Quick Preview
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary btn--compact"
                  onClick={() => void handleDuplicateTemplate(template.id)}
                >
                  Duplicate to My Slides
                </button>
                {(template.is_shared || isSlidesAdmin || template.owner_user_id === actor.user_id) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost btn--compact"
                    onClick={() => void handleTemplateVisibilityToggle(template)}
                    disabled={templateActionBusyId === template.id}
                  >
                    {template.is_shared ? 'Make Private' : 'Make Shared'}
                  </button>
                )}
              </div>
            </details>
          </article>
        )
      })}

      <SlidesTemplatePreviewModal
        activeTemplateQuickPreview={activeTemplateQuickPreview}
        isPreviewStale={false}
        trimmedSearchValue={trimmedSearchValue}
        onClose={() => setTemplateQuickPreviewId(null)}
        onDuplicateTemplate={async (templateId) => { await handleDuplicateTemplate(templateId) }}
        formatDateTime={formatDateTime}
        getTemplateStructureSummary={getTemplateStructureSummary}
        getTemplatePreviewScale={getTemplatePreviewScale}
        buildCanvasComponentStyle={buildCanvasComponentStyle}
        sanitizeHtmlContent={sanitizeHtmlContent}
      />
    </div>
  )
}
