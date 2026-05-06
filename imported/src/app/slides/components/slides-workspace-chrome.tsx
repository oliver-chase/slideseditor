import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { ModuleTopbar } from '@/components/shared/ModuleTopbar'
import {
  ModuleEmptyState,
  ModuleFilterCard,
  ModuleSurfaceHeader,
  ModuleText,
  ModuleViewToggle,
} from '@/components/module-workspace/ModuleWorkspaceLayout'
import type { WorkspaceTab } from '@/app/slides/page-model'

type RecoveryDraft = {
  createdAt: string
} | null

type DegradedState = {
  message: string
  endpoint: string
  correlationId?: string | null
  rayId?: string | null
} | null

interface SlidesWorkspaceChromeProps {
  sidebarOpen: boolean
  setSidebarOpen: Dispatch<SetStateAction<boolean>>
  title: string
  slidesSyncState: 'ok' | 'syncing' | 'error'
  slidesSyncLabel: string
  slidesSyncActionLabel?: string
  onSlidesSyncAction?: () => void | Promise<void>
  refreshLibraryData: () => Promise<void> | void
  libraryLoading: boolean
  workspaceLabel: string
  workspaceTab: WorkspaceTab
  handleWorkspaceTabChange: (tab: WorkspaceTab) => Promise<boolean> | boolean
  importSourceSummary: string
  saveStatusLabel: string
  syncStatusLabel: string
  conflictStatusLabel: string
  recoveryDraft: RecoveryDraft
  formatDateTime: (value: string | null | undefined) => string
  restoreDraft: () => void
  discardDraft: () => void
  degradedState: DegradedState
  retrySlidesService: () => Promise<void> | void
  clearDegradedMode: () => void
  searchLabel: string
  searchValue: string
  setSearchValue: Dispatch<SetStateAction<string>>
  searchPlaceholder: string
  libraryError: string | null
  children: ReactNode
}

export function SlidesWorkspaceChrome({
  sidebarOpen,
  setSidebarOpen,
  title,
  slidesSyncState,
  slidesSyncLabel,
  slidesSyncActionLabel,
  onSlidesSyncAction,
  refreshLibraryData,
  libraryLoading,
  workspaceLabel,
  workspaceTab,
  handleWorkspaceTabChange,
  importSourceSummary,
  saveStatusLabel,
  syncStatusLabel,
  conflictStatusLabel,
  recoveryDraft,
  formatDateTime,
  restoreDraft,
  discardDraft,
  degradedState,
  retrySlidesService,
  clearDegradedMode,
  searchLabel,
  searchValue,
  setSearchValue,
  searchPlaceholder,
  libraryError,
  children,
}: SlidesWorkspaceChromeProps) {
  const statusSummary = (
    <div className="module-metric-grid module-metric-grid-4 slides-workspace-status-row" aria-label="Workspace status summary">
      {[
        ['Import Source', importSourceSummary],
        ['Save Status', saveStatusLabel],
        ['Sync Status', syncStatusLabel],
        ['Conflict Status', conflictStatusLabel],
      ].map(([label, value]) => (
        <article key={label} className="module-metric-card card slides-workspace-status-chip">
          <p className="module-metric-label">{label}</p>
          <p className="module-metric-value">{value}</p>
        </article>
      ))}
    </div>
  )

  return (
    <div className="main slides-main">
      <ModuleTopbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        title={title}
      >
        <div className="sync-indicator slides-sync-indicator module-sync-indicator" role="status" aria-live="polite" data-testid="slides-sync-indicator">
          <div className={'sync-dot' + (slidesSyncState === 'syncing' ? ' syncing' : slidesSyncState === 'error' ? ' error' : '') + ' module-sync-dot'} />
          <span>{slidesSyncLabel}</span>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn--compact"
            title="Refresh slides data"
            aria-label="Refresh slides data"
            onClick={() => void onSlidesSyncAction?.()}
          >
            {slidesSyncActionLabel || (slidesSyncState === 'error' ? 'Retry' : 'Refresh')}
          </button>
          <button
            type="button"
            className="module-refresh-btn"
            title="Refresh slides data"
            aria-label="Refresh slides data"
            onClick={() => void refreshLibraryData()}
            disabled={libraryLoading}
          >
            {slidesSyncState === 'error' ? 'Retry' : 'Refresh'}
          </button>
        </div>
      </ModuleTopbar>

      <main className="page slides-page" id="main-content">
        <section className="module-card slides-card">
          <ModuleSurfaceHeader
            eyebrow="Slides Workspace"
            title="HTML to Editable Components"
            subtitle="Import HTML, edit the parsed canvas, manage saved slides and templates, and export finished work."
            actions={<p className="slides-workspace-pill">{workspaceLabel}</p>}
            className="slides-heading-row"
          />

          <ModuleViewToggle
            options={[
              { value: 'import', label: 'Workspace' },
              { value: 'my-slides', label: 'My Slides' },
              { value: 'templates', label: 'Template Library' },
            ]}
            value={workspaceTab}
            onChange={(tab) => { void handleWorkspaceTabChange(tab) }}
            className="module-view-toggle slides-tab-strip"
          />

          {statusSummary}

          {recoveryDraft && (
            <ModuleEmptyState className="slides-recovery">
              <div>
                Recovered draft available from {formatDateTime(recoveryDraft.createdAt)}.
              </div>
              <div className="slides-inline-actions">
                <button type="button" className="btn btn-sm btn-primary btn--compact" onClick={restoreDraft}>Restore Draft</button>
                <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={discardDraft}>Discard</button>
              </div>
            </ModuleEmptyState>
          )}

          {degradedState && (
            <ModuleEmptyState className="slides-degraded">
              <strong>Draft mode active</strong>
              <ModuleText>{degradedState.message}</ModuleText>
              <ModuleText className="slides-degraded-meta">
                Endpoint: {degradedState.endpoint}
                {degradedState.correlationId ? ` · Correlation ${degradedState.correlationId}` : ''}
                {degradedState.rayId ? ` · Ray ${degradedState.rayId}` : ''}
              </ModuleText>
              <div className="slides-inline-actions">
                <button type="button" className="btn btn-sm btn-primary btn--compact" onClick={() => void retrySlidesService()}>
                  Retry Slides Service
                </button>
                <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={clearDegradedMode}>
                  Dismiss
                </button>
              </div>
            </ModuleEmptyState>
          )}

          <ModuleFilterCard
            className="slides-toolbar-row"
            actions={(
              <button type="button" className="btn btn-sm btn-ghost btn--compact" onClick={() => void refreshLibraryData()} disabled={libraryLoading}>
                {libraryLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
          >
            <label className="module-field-control slides-search-wrap" htmlFor="slides-search">
              <span className="module-field-label slides-search-label">{searchLabel}</span>
              <input
                id="slides-search"
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={searchPlaceholder}
                className="module-filter-search slides-search"
              />
            </label>
          </ModuleFilterCard>

          {libraryError && (
            <ModuleEmptyState className="module-card slides-state-panel" data-testid="slides-library-error-state">
              <h2 className="module-empty-state-title slides-state-title">Library sync issue</h2>
              <p className="module-empty-state-copy slides-state-copy">Library error: {libraryError}</p>
              <div className="module-action-row slides-state-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-primary btn--compact"
                  onClick={() => void refreshLibraryData()}
                  disabled={libraryLoading}
                >
                  {libraryLoading ? 'Retrying…' : 'Retry Library Refresh'}
                </button>
              </div>
            </ModuleEmptyState>
          )}

          {children}
        </section>
      </main>
    </div>
  )
}
