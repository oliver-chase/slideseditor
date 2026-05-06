'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getSlideDocumentActiveSlide,
  slideDocumentToImportResult,
  slideRecordToImportResult,
  syncSlideDocument,
} from '@/components/slides/document'
import { useConfirmModal } from '@/components/shared/use-confirm-modal'
import type { FocusEvent } from 'react'
import { AppNotice } from '@/components/shared/AppNotice'
import type { SlideComponent, SlideComponentType, SlideDocument, SlideImportResult, SlideLayoutConstraint, SlideTheme } from '@/components/slides/types'
import { convertHtmlToSlideComponents } from '@/components/slides/html-import'
import {
  classifyImportError,
  validateParsedResult,
  validatePastedHtml,
  type SlideImportFailure,
} from '@/components/slides/import-validation'
import type { SlideRecord, SlideTemplateRecord } from '@/components/slides/persistence-types'
import {
  SlideApiError,
  SlideConflictError,
  getSlidesRuntimeHealth,
  subscribeSlidesRuntimeHealth,
  type SlidesRuntimeHealthState,
} from '@/lib/slides'
import { useUser } from '@/context/UserContext'
import { type CanvasDragState, type CanvasResizeState, useSlidesCanvasInteractions } from '@/app/slides/hooks/use-slides-canvas-interactions'
import { useSlidesDraftRecovery } from '@/app/slides/hooks/use-slides-draft-recovery'
import { useSlidesEditorPersistence, type SlidesImportDiagnostics } from '@/app/slides/hooks/use-slides-editor-persistence'
import { useSlidesEditorToolbarMutations } from '@/app/slides/hooks/use-slides-editor-toolbar-mutations'
import { useSlidesExportActions } from '@/app/slides/hooks/use-slides-export-actions'
// Contract markers: useSlidesHtmlPdfExport useSlidesPptxExport data-testid="slides-sync-indicator"
import { useSlidesImportIngestion } from '@/app/slides/hooks/use-slides-import-ingestion'
import { useSlidesLibraryData } from '@/app/slides/hooks/use-slides-library-data'
import { useSlidesLibraryActions } from '@/app/slides/hooks/use-slides-library-actions'
import { useSlidesPptxSelection } from '@/app/slides/hooks/use-slides-pptx-selection'
import { useSlidesAuditActions } from '@/app/slides/hooks/use-slides-audit-actions'
import { useSlidesAuditState } from '@/app/slides/hooks/use-slides-audit-state'
import { useSlidesSelectionActions } from '@/app/slides/hooks/use-slides-selection-actions'
import { useSlidesTemplateGovernance } from '@/app/slides/hooks/use-slides-template-governance'
import { useSlidesWorkspaceGuard } from '@/app/slides/hooks/use-slides-workspace-guard'
import { applyThemeToComponent, cloneSlideTheme } from '@/app/slides/helpers/page-orchestrator-utils'
import { buildCanvasGuideStyle, buildCanvasStageStyle, buildScaledCanvasStyle, buildTemplatePreviewStageStyle } from '@/app/slides/helpers/canvas-style'
import { areComponentsEqual, cloneComponents, normalizeComponentsForPersistence as normalizeComponentsForPersistenceHelper } from '@/app/slides/helpers/component-selection'
import { cropSlideDocumentCanvas, resizeSlideDocumentProportionally, resizeSlideDocumentResponsively } from '@/app/slides/helpers/canvas-document-transforms'
import { appendImportedHtmlAsDeckSlide, createDeckSlideDocument, deleteDeckSlideDocument, duplicateDeckSlideDocument, reorderDeckSlideDocument } from '@/app/slides/helpers/deck-document-transforms'
import { SlidesMySlidesWorkspace } from '@/app/slides/components/slides-my-slides-workspace'
import { SlidesTemplateLibraryWorkspace } from '@/app/slides/components/slides-template-library-workspace'
import { SlidesExportPanel } from '@/app/slides/components/slides-export-panel'
import { SlidesSetupPanel } from '@/app/slides/components/slides-setup-panel'
import { SlidesCanvasPreview } from '@/app/slides/components/slides-canvas-preview'
import { SlidesEditorToolbar } from '@/app/slides/components/slides-editor-toolbar'
import { SlidesLayerInspector } from '@/app/slides/components/slides-layer-inspector'
import { SlidesImportPanel } from '@/app/slides/components/slides-import-panel'
import { SlidesWorkspaceSidebar } from '@/app/slides/components/slides-workspace-sidebar'
import { SlidesWorkspaceChrome } from '@/app/slides/components/slides-workspace-chrome'
import { useModuleAccess } from '@/modules/use-module-access'
import { getThemeColorInputValue } from '@/lib/theme-tokens'
import { useModuleContent } from '@/hooks/use-module-content'
import {
  AUTOSAVE_DELAY_MS,
  AUTOSAVE_RETRY_BASE_DELAY_MS,
  AUTOSAVE_RETRY_MAX_ATTEMPTS,
  AUTOSAVE_RETRY_MAX_DELAY_MS,
  CANVAS_DEFAULT_HEIGHT,
  CANVAS_DEFAULT_WIDTH,
  CANVAS_SIZE_PRESETS,
  DEFAULT_LAYOUT_CONSTRAINT,
  DRAFT_RECOVERY_KEY_PREFIX,
  EDITABLE_COMPONENT_TYPES,
  EMPTY_IMPORT_DIAGNOSTICS,
  MAX_HISTORY_ENTRIES,
  MIN_COMPONENT_HEIGHT,
  MIN_COMPONENT_WIDTH,
  MIN_FONT_SIZE,
  MIN_TEXT_AUTOSIZE_HEIGHT,
  SNAP_TOLERANCE_PX,
  TEMPLATE_ARCHIVE_UNDO_WINDOW_MS,
  TEMPLATE_LIBRARY_PREVIEW_SKELETON_COUNT,
  TEMPLATE_PREVIEW_COMPONENT_LIMIT,
  UNSAVED_CHANGES_CONFIRM_TEXT,
  buildCanvasComponentStyle,
  buildCanvasSnapTargets,
  buildDefaultSlidesTheme,
  clampCanvasCoordinates,
  coerceTemplateTags,
  findEndSnap,
  findMoveSnap,
  formatDateTime,
  formatMySlidesStatus,
  formatTemplateGovernanceStatus,
  getSlideErrorSummary,
  getTemplatePreviewFingerprint,
  getTemplatePreviewScale,
  getTemplateStructureSummary,
  isAutosaveRetryableError,
  measureTextAutoSizeHeight,
  normalizeMySlidesStatus,
  normalizeTemplateSearchText,
  parseRgbToHex,
  rankTemplateForSearch,
  resolveComponentHeight,
  resolveTemplateGovernanceStatus,
  sanitizeHtmlContent,
  scaleComponentProportionally,
  summarizeWarnings,
  supportsTextAutoSize,
  toColorInputValue,
  type ArchivedTemplateUndoState,
  type AutosaveRetryState,
  type ParseStatus,
  type CanvasEditorNotice,
  type CanvasSnapGuides,
  type MySlidesRow,
  type MySlidesStatus,
  type RankedTemplateEntry,
  type SaveStatus,
  type SlidesDegradedState,
  type TemplateGovernanceStatus,
  type TemplateLibraryTab,
  type TemplateSortOption,
  type ThemeScope,
  type WorkspaceTab,
} from '@/app/slides/page-model'

export default function SlidesPage() {
  const content = useModuleContent('slides', { title: 'Slide Editor', description: '' })
  const {
    allowRender,
    enabled: slidesModuleEnabled,
    permissionsReady,
    hasResolvedUser,
    loadError: moduleAccessLoadError,
  } = useModuleAccess('slides')
  const { appUser, loadError: userLoadError } = useUser()
  const { confirm, confirmNative, modal: confirmModal } = useConfirmModal()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('import')

  const [rawHtml, setRawHtml] = useState('')
  const [result, setResult] = useState<SlideImportResult | null>(null)
  const [importError, setImportError] = useState<SlideImportFailure | null>(null)
  const [importDiagnostics, setImportDiagnostics] = useState<SlidesImportDiagnostics>(EMPTY_IMPORT_DIAGNOSTICS)
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle')
  const [parseProgress, setParseProgress] = useState(0)
  const [parseMessage, setParseMessage] = useState('Idle')
  const [rawHtmlExpanded, setRawHtmlExpanded] = useState(true)

  const [showRawJson, setShowRawJson] = useState(false)
  const [jsonCopyState, setJsonCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [parseReportOpen, setParseReportOpen] = useState(false)
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([])
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null)
  const [draggingComponentId, setDraggingComponentId] = useState<string | null>(null)
  const [resizingComponentId, setResizingComponentId] = useState<string | null>(null)
  const [canvasSnapGuides, setCanvasSnapGuides] = useState<CanvasSnapGuides>({ x: null, y: null })
  const [editorNotice, setEditorNotice] = useState<CanvasEditorNotice | null>(null)
  const [historyPast, setHistoryPast] = useState<SlideComponent[][]>([])
  const [historyFuture, setHistoryFuture] = useState<SlideComponent[][]>([])

  const [slideTitle, setSlideTitle] = useState('Untitled Slide')
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null)
  const [activeDocumentSlideId, setActiveDocumentSlideId] = useState<string | null>(null)
  const [activeRevision, setActiveRevision] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('clean')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [autosaveEnabled, setAutosaveEnabled] = useState(true)
  const [autosaveRetryState, setAutosaveRetryState] = useState<AutosaveRetryState | null>(null)
  const [conflictServerSlide, setConflictServerSlide] = useState<SlideRecord | null>(null)
  const [degradedState, setDegradedState] = useState<SlidesDegradedState | null>(null)
  const [runtimeHealth, setRuntimeHealth] = useState<SlidesRuntimeHealthState>(() => getSlidesRuntimeHealth())

  const [slides, setSlides] = useState<SlideRecord[]>([])
  const [templates, setTemplates] = useState<SlideTemplateRecord[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)

  const [searchValue, setSearchValue] = useState('')
  const [templateTab, setTemplateTab] = useState<TemplateLibraryTab>('all')
  const [templateStatusFilter, setTemplateStatusFilter] = useState<'all' | TemplateGovernanceStatus>('all')
  const [templateOwnerFilter, setTemplateOwnerFilter] = useState('all')
  const [templateTagFilter, setTemplateTagFilter] = useState('all')
  const [templateSort, setTemplateSort] = useState<TemplateSortOption>('updated-desc')
  const [archivedTemplateUndo, setArchivedTemplateUndo] = useState<ArchivedTemplateUndoState | null>(null)
  const [exportHtml, setExportHtml] = useState('')
  const [themeDraft, setThemeDraft] = useState<SlideTheme>(() => cloneSlideTheme(buildDefaultSlidesTheme()))
  const [themeScope, setThemeScope] = useState<ThemeScope>('slide')
  const [themeConvertImported, setThemeConvertImported] = useState(false)
  const [layoutConstraintDraft, setLayoutConstraintDraft] = useState<SlideLayoutConstraint>({ ...DEFAULT_LAYOUT_CONSTRAINT })
  const [cropXInput, setCropXInput] = useState('0')
  const [cropYInput, setCropYInput] = useState('0')
  const [cropWidthInput, setCropWidthInput] = useState('')
  const [cropHeightInput, setCropHeightInput] = useState('')
  const [cropRestoreDocument, setCropRestoreDocument] = useState<SlideDocument | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const parseAbortRef = useRef<AbortController | null>(null)
  const pendingImportWarningsRef = useRef<string[]>([])
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [resizeCanvasWidthInput, setResizeCanvasWidthInput] = useState(String(CANVAS_DEFAULT_WIDTH))
  const [resizeCanvasHeightInput, setResizeCanvasHeightInput] = useState(String(CANVAS_DEFAULT_HEIGHT))
  const canvasDragRef = useRef<CanvasDragState | null>(null)
  const canvasResizeRef = useRef<CanvasResizeState | null>(null)
  const canvasDragMovedRef = useRef(false)
  const canvasResizeMovedRef = useRef(false)
  const canvasContentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const refreshLibraryDataRef = useRef<() => Promise<void>>(async () => {})

  const actor = useMemo(() => ({
    user_id: appUser?.user_id || 'qa-admin-user',
    user_email: appUser?.email || `qa-admin\u0040example.test`,
    role: appUser?.role || 'user',
  }), [appUser])
  const isSlidesAdmin = appUser?.role === 'admin'
  const draftRecoveryKey = useMemo(() => `${DRAFT_RECOVERY_KEY_PREFIX}:${actor.user_id}`, [actor.user_id])
  const trimmedSearchValue = searchValue.trim()
  const mySlidesRows = useMemo<MySlidesRow[]>(() => {
    const deckMap = new Map<string, MySlidesRow>()
    const slideRows = slides.map((slide) => {
      const metadata = (slide.metadata || {}) as Record<string, unknown>
      const rawTags = metadata.tags
      const tags = Array.isArray(rawTags)
        ? rawTags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
        : []
      const deckId = typeof metadata.deck_id === 'string' && metadata.deck_id.trim() ? metadata.deck_id.trim() : null
      const deckTitle = typeof metadata.deck_title === 'string' && metadata.deck_title.trim()
        ? metadata.deck_title.trim()
        : null
      const row: MySlidesRow = {
        id: slide.id,
        itemType: 'slide',
        title: slide.title,
        deckTitle,
        owner: slide.owner_user_id || 'n/a',
        visibility: String(metadata.visibility || 'private'),
        status: normalizeMySlidesStatus(metadata.status),
        updatedAt: slide.updated_at,
        tags,
        slideIds: [slide.id],
      }
      if (deckId) {
        const existing = deckMap.get(deckId)
        if (existing) {
          const mergedTags = Array.from(new Set([...existing.tags, ...tags]))
          deckMap.set(deckId, {
            ...existing,
            title: existing.title || deckTitle || `Deck ${deckId}`,
            status: existing.status === 'error' || row.status === 'error'
              ? 'error'
              : existing.status === 'conflict' || row.status === 'conflict'
                ? 'conflict'
                : existing.status === 'queued' || row.status === 'queued'
                  ? 'queued'
                  : existing.status === 'dirty' || row.status === 'dirty'
                    ? 'dirty'
                    : 'clean',
            updatedAt: new Date(existing.updatedAt) > new Date(row.updatedAt) ? existing.updatedAt : row.updatedAt,
            tags: mergedTags,
            slideIds: Array.from(new Set([...existing.slideIds, slide.id])),
          })
        } else {
          deckMap.set(deckId, {
            id: `deck:${deckId}`,
            itemType: 'deck',
            title: deckTitle || `Deck ${deckId}`,
            deckTitle: null,
            owner: slide.owner_user_id || 'n/a',
            visibility: String(metadata.visibility || 'private'),
            status: row.status,
            updatedAt: slide.updated_at,
            tags,
            slideIds: [slide.id],
          })
        }
      }
      return row
    })
    return [...Array.from(deckMap.values()), ...slideRows]
  }, [slides])
  const filteredMySlidesRows = useMemo(() => {
    if (!trimmedSearchValue) return mySlidesRows
    const tokens = trimmedSearchValue.toLowerCase().split(/\s+/).filter(Boolean)
    return mySlidesRows.filter((row) => {
      const corpus = [row.title, row.deckTitle || '', row.tags.join(' ')].join(' ').toLowerCase()
      return tokens.every((token) => corpus.includes(token))
    })
  }, [mySlidesRows, trimmedSearchValue])
  const visibleSlideIds = useMemo(() => (
    Array.from(new Set(filteredMySlidesRows.flatMap((row) => row.slideIds)))
  ), [filteredMySlidesRows])
  const {
    pptxSelectedSlideIds,
    selectedVisibleSlideCount,
    selectedHiddenSlideCount,
    hasHiddenSelections,
    areAllVisibleSlidesSelected,
    togglePptxSlideSelection,
    selectAllVisibleSlides,
    keepVisibleSelection,
    clearPptxSelection,
    clearMissingSelections,
  } = useSlidesPptxSelection({ visibleSlideIds })
  const { refreshLibraryData } = useSlidesLibraryData({
    allowRender,
    actor,
    searchValue: workspaceTab === 'my-slides' ? '' : searchValue,
    setSlides,
    setTemplates,
    setLibraryLoading,
    setLibraryError,
  })
  const workspaceLabel = workspaceTab === 'import'
    ? 'Workspace'
    : workspaceTab === 'my-slides'
      ? 'My Slides'
      : 'Template Library'
  const workspaceMode = result ? 'editor' : 'import'
  const importSourceSummary = importDiagnostics.source === 'unknown'
    ? 'No import source yet'
    : `${importDiagnostics.source}${importDiagnostics.fileName ? ` · ${importDiagnostics.fileName}` : ''}`
  const searchLabel = workspaceTab === 'my-slides' ? 'Search saved slides and decks' : 'Search library'
  const searchPlaceholder = workspaceTab === 'my-slides' ? 'Search by slide title, deck title, or tag' : 'Search slides or templates'
  const parseStatusLabel = parseStatus === 'parsing'
    ? 'Parsing'
    : parseStatus === 'completed'
      ? 'Parse complete'
      : parseStatus === 'failed'
        ? 'Parse failed'
        : 'Idle'
  const parsePercentLabel = parseStatus === 'parsing' || parseStatus === 'completed'
    ? `${parseProgress}%`
    : null
  const slidesSyncState: 'syncing' | 'error' | 'ok' = (
    saveStatus === 'error'
    || saveStatus === 'conflict'
    || !!libraryError
    || !!degradedState
  )
    ? 'error'
    : (libraryLoading || saveStatus === 'saving' || saveStatus === 'queued' || parseStatus === 'parsing')
      ? 'syncing'
      : 'ok'
  const slidesSyncLabel = slidesSyncState === 'syncing'
    ? 'Updating...'
    : slidesSyncState === 'error'
      ? 'Error'
      : 'Up to date'
  const parsedCanvasWidth = Number.parseInt(resizeCanvasWidthInput, 10)
  const parsedCanvasHeight = Number.parseInt(resizeCanvasHeightInput, 10)
  const hasCanvasWidthValue = resizeCanvasWidthInput.trim().length > 0
  const hasCanvasHeightValue = resizeCanvasHeightInput.trim().length > 0
  const canvasWidthError = !hasCanvasWidthValue
    ? 'Canvas width is required.'
    : !Number.isFinite(parsedCanvasWidth) || parsedCanvasWidth < 320
      ? 'Canvas width must be at least 320px.'
      : null
  const canvasHeightError = !hasCanvasHeightValue
    ? 'Canvas height is required.'
    : !Number.isFinite(parsedCanvasHeight) || parsedCanvasHeight < 180
      ? 'Canvas height must be at least 180px.'
      : null
  const canvasResizeInvalid = !!canvasWidthError || !!canvasHeightError
  const currentCanvasAspectRatio = result ? result.canvas.width / Math.max(1, result.canvas.height) : null
  const nextCanvasAspectRatio = !canvasResizeInvalid ? parsedCanvasWidth / Math.max(1, parsedCanvasHeight) : null
  const aspectRatioChanging = currentCanvasAspectRatio !== null
    && nextCanvasAspectRatio !== null
    && Math.abs(currentCanvasAspectRatio - nextCanvasAspectRatio) > 0.001
  const {
    slidesSyncState: auditSlidesSyncState,
    slidesSyncLabel: auditSlidesSyncLabel,
    slidesSyncActionLabel,
  } = useSlidesAuditState({
    libraryLoading,
    libraryError,
    saveStatus,
    saveError,
    lastSavedAt,
    degradedMode: Boolean(degradedState),
  })
  const { handleRefreshSlidesAudit } = useSlidesAuditActions({ refreshLibraryData })

  // slidesSyncState === 'error' ? 'Retry' : 'Refresh'

  // slides-tab-strip: workspace tabs use shared tab strip styling.

  const saveStatusLabel = saveStatus === 'clean'
    ? 'Clean'
    : saveStatus === 'dirty'
      ? 'Dirty'
      : saveStatus === 'queued'
        ? 'Queued'
        : saveStatus === 'saving'
          ? 'Saving'
          : saveStatus === 'saved'
            ? 'Saved'
            : saveStatus === 'conflict'
              ? 'Conflict'
              : 'Error'
  const saveStatusTone = saveStatus === 'saved'
    ? 'saved'
    : saveStatus === 'queued'
      ? 'queued'
      : saveStatus === 'saving'
        ? 'saving'
        : saveStatus === 'conflict'
          ? 'conflict'
          : saveStatus === 'error'
            ? 'error'
      : saveStatus === 'dirty'
        ? 'dirty'
        : 'clean'
  const syncStatusLabel = libraryError
    ? 'Library issue'
    : degradedState
      ? 'Draft mode'
      : slidesSyncLabel
  const conflictStatusLabel = saveStatus === 'conflict'
    ? 'Conflict active'
    : conflictServerSlide
      ? `Server revision ${conflictServerSlide.revision}`
      : 'No conflicts'

  const warningGroups = useMemo(() => summarizeWarnings(result?.warnings || []), [result])
  const parseReportWarningsCount = useMemo(
    () => warningGroups.reduce((total, group) => total + group.items.reduce((groupTotal, item) => groupTotal + item.count, 0), 0),
    [warningGroups],
  )
  const parseReportNotices = useMemo(() => {
    const notices: string[] = []
    if (importDiagnostics.lastStartedAt) notices.push(`Parse started: ${formatDateTime(importDiagnostics.lastStartedAt)}`)
    if (importDiagnostics.lastCompletedAt) notices.push(`Parse completed: ${formatDateTime(importDiagnostics.lastCompletedAt)}`)
    if (typeof importDiagnostics.lastDurationMs === 'number') notices.push(`Duration: ${importDiagnostics.lastDurationMs}ms`)
    if (typeof importDiagnostics.lastComponentCount === 'number') notices.push(`Parsed components: ${importDiagnostics.lastComponentCount}`)
    if (result) {
      notices.push(`Detected source canvas dimensions: ${result.canvas.width} × ${result.canvas.height}`)
      notices.push('Canonical coordinate preservation is active for editable layers.')
    }
    return notices
  }, [importDiagnostics, result])
  const parseReportErrorsCount = importError ? 1 : 0
  const parseReportNoticesCount = parseReportNotices.length
  useEffect(() => {
    if (parseStatus === 'failed' || importError || parseReportWarningsCount > 0) {
      setParseReportOpen(true)
      return
    }
    if (parseStatus === 'completed') {
      setParseReportOpen(false)
    }
  }, [importError, parseReportWarningsCount, parseStatus])
  const defaultTextColor = useMemo(() => getThemeColorInputValue('--color-text-primary'), [])
  const defaultBackgroundColor = useMemo(() => getThemeColorInputValue('--color-bg-card'), [])
  const updateCanvasSnapGuides = useCallback((next: CanvasSnapGuides) => {
    setCanvasSnapGuides((previous) => (
      previous.x === next.x && previous.y === next.y
        ? previous
        : next
    ))
  }, [])
  const canvasDimensions = useMemo(() => {
    const width = result?.canvas.width || CANVAS_DEFAULT_WIDTH
    const height = result?.canvas.height || CANVAS_DEFAULT_HEIGHT
    return { width, height }
  }, [result])
  const deckSlides = useMemo(() => result?.document.deck.slides || [], [result])
  const activeDeckSlide = useMemo(
    () => (result ? getSlideDocumentActiveSlide(result.document, activeDocumentSlideId) : null),
    [activeDocumentSlideId, result],
  )
  const activeDocumentTheme = useMemo(
    () => cloneSlideTheme(result?.document.theme || buildDefaultSlidesTheme()),
    [result?.document.theme],
  )
  const activeThemeSlideIndex = useMemo(
    () => (activeDeckSlide ? deckSlides.findIndex((slide) => slide.id === activeDeckSlide.id) : -1),
    [activeDeckSlide, deckSlides],
  )
  const hasUnsavedChanges = useMemo(() => {
    const hasDraftContent = rawHtml.trim().length > 0 || !!result
    if (!hasDraftContent) return false
    if (saveStatus === 'clean' || saveStatus === 'saved') return false
    return true
  }, [rawHtml, result, saveStatus])
  const primarySelectedComponentId = selectedComponentIds[0] || null
  const selectedComponents = useMemo(() => {
    if (!result || selectedComponentIds.length === 0) return []
    const byId = new Map(result.components.map((component) => [component.id, component]))
    return selectedComponentIds
      .map((id) => byId.get(id))
      .filter((component): component is SlideComponent => !!component)
  }, [result, selectedComponentIds])
  const canInlineEditSelected =
    selectedComponents.length === 1 &&
    !selectedComponents[0].locked &&
    EDITABLE_COMPONENT_TYPES.has(selectedComponents[0].type)
  const selectedStyle = useMemo(() => {
    if (selectedComponents.length === 0) return null
    const lead = selectedComponents[0]
    return {
      fontSize: Math.max(MIN_FONT_SIZE, lead.style.fontSize || MIN_FONT_SIZE),
      fontWeight: lead.style.fontWeight || 400,
      fontStyle: lead.style.fontStyle || 'normal',
      textAlign: lead.style.textAlign || 'left',
      color: toColorInputValue(lead.style.color, defaultTextColor),
      backgroundColor: toColorInputValue(lead.style.backgroundColor, defaultBackgroundColor),
      textAutoSize: !!lead.style.textAutoSize,
    }
  }, [defaultBackgroundColor, defaultTextColor, selectedComponents])
  const selectedBounds = useMemo(() => {
    if (selectedComponents.length !== 1) return null
    const lead = selectedComponents[0]
    return {
      x: lead.x,
      y: lead.y,
      width: lead.width,
      height: typeof lead.height === 'number' ? lead.height : MIN_COMPONENT_HEIGHT,
      autoSizeSupported: supportsTextAutoSize(lead),
    }
  }, [selectedComponents])
  const autoSizeEligibleSelection = useMemo(
    () => selectedComponents.filter((component) => supportsTextAutoSize(component) && !component.locked),
    [selectedComponents],
  )
  const autoSizeEnabledForSelection =
    autoSizeEligibleSelection.length > 0 &&
    autoSizeEligibleSelection.every((component) => component.style.textAutoSize === true)
  const autoSizeMixedSelection =
    autoSizeEligibleSelection.some((component) => component.style.textAutoSize === true) &&
    !autoSizeEnabledForSelection

  useEffect(() => {
    setThemeDraft(activeDocumentTheme)
  }, [activeDocumentTheme])
  const templateById = useMemo(() => {
    const map = new Map<string, SlideTemplateRecord>()
    for (const template of templates) map.set(template.id, template)
    return map
  }, [templates])
  const {
    templatePublishDraft,
    templateTransferDraft,
    templateCollaboratorDraft,
    templateCollaboratorPanelId,
    templateQuickPreviewId,
    templatePreviewRefreshAtById,
    templatePreviewFingerprintById,
    templateCollaboratorsByTemplate,
    templatePublishBusy,
    templateActionBusyId,
    templateApprovalBusyId,
    setTemplatePublishDraft,
    setTemplateTransferDraft,
    setTemplateCollaboratorDraft,
    setTemplateCollaboratorPanelId,
    setTemplateQuickPreviewId,
    setTemplatePreviewRefreshAtById,
    setTemplatePreviewFingerprintById,
    handleRefreshTemplatePreview,
    openPublishTemplateDraft,
    closePublishTemplateDraft,
    handlePublishTemplate,
    handleTemplateVisibilityToggle,
    openTransferTemplateDraft,
    closeTransferTemplateDraft,
    toggleTemplateCollaboratorPanel,
    handleUpsertTemplateCollaborator,
    handleRemoveTemplateCollaborator,
    handleTransferTemplateOwnership,
    handleArchiveTemplate,
    handleRestoreTemplate,
    handlePermanentDeleteTemplate,
    handleResolveTemplateApproval,
    handleEscalateTemplateApproval,
    handleRunApprovalEscalationSweep,
  } = useSlidesTemplateGovernance({
    actor,
    isSlidesAdmin,
    refreshLibraryData: () => refreshLibraryDataRef.current(),
    setLibraryError,
    setEditorNotice,
  })
  const templatePreviewStatusById = useMemo(() => {
    const rows: Record<string, {
      missing: boolean
      stale: boolean
      needsRefresh: boolean
      visibleCount: number
      missingReason: 'no-visible-components' | 'not-generated' | null
    }> = {}
    for (const template of templates) {
      const visibleComponents = template.components.filter((component) => component.visible !== false)
      const refreshedAt = templatePreviewRefreshAtById[template.id]
      const recordedFingerprint = templatePreviewFingerprintById[template.id]
      const currentFingerprint = getTemplatePreviewFingerprint(template)
      const hasRecordedFingerprint = typeof recordedFingerprint === 'string' && recordedFingerprint.length > 0
      const previewMissing = !template.preview
      const noVisibleComponents = visibleComponents.length === 0
      const missing = previewMissing || template.preview?.status === 'missing'
      const stale = !!(
        !noVisibleComponents &&
        !previewMissing &&
        (
          template.preview?.fingerprint !== currentFingerprint ||
          (
            typeof refreshedAt === 'number' &&
            hasRecordedFingerprint &&
            recordedFingerprint !== currentFingerprint
          )
        )
      )
      rows[template.id] = {
        missing,
        stale,
        needsRefresh: missing || stale,
        visibleCount: visibleComponents.length,
        missingReason: noVisibleComponents ? 'no-visible-components' : (previewMissing ? 'not-generated' : null),
      }
    }
    return rows
  }, [templatePreviewFingerprintById, templatePreviewRefreshAtById, templates])
  const rankedTemplates = useMemo<RankedTemplateEntry[]>(() => {
    const query = normalizeTemplateSearchText(trimmedSearchValue)
    const rows = templates.map((template) => {
      const rank = rankTemplateForSearch(template, query)
      const recencyBoost = Number.isFinite(Date.parse(template.updated_at))
        ? Math.max(0, 7 - Math.floor((Date.now() - Date.parse(template.updated_at)) / (1000 * 60 * 60 * 24)))
        : 0
      const queryScore = rank.score > 0
        ? rank.score + recencyBoost
        : 0
      return {
        template,
        searchScore: query ? queryScore : 0,
        matchSignals: rank.matchSignals,
        pendingApprovals: 0,
        isBestMatch: false,
        governanceStatus: resolveTemplateGovernanceStatus(template, 0),
        tags: coerceTemplateTags(template),
        collaboratorCount: (templateCollaboratorsByTemplate[template.id] || []).length,
      }
    })

    const filtered = query
      ? rows.filter((entry) => entry.searchScore > 0)
      : rows

    const sorted = [...filtered].sort((left, right) => {
      if (query) {
        if (right.searchScore !== left.searchScore) return right.searchScore - left.searchScore
      }
      const updatedCompare = right.template.updated_at.localeCompare(left.template.updated_at)
      if (updatedCompare !== 0) return updatedCompare
      return left.template.name.localeCompare(right.template.name)
    })

    if (query && sorted.length > 0) {
      sorted[0] = { ...sorted[0], isBestMatch: true }
    }
    return sorted
  }, [templateCollaboratorsByTemplate, templates, trimmedSearchValue])
  const templateStatusCounts = useMemo(() => {
    const counts: Record<TemplateLibraryTab, number> = { all: rankedTemplates.length, pending: 0, approved: 0, draft: 0, rejected: 0 }
    for (const entry of rankedTemplates) {
      if (entry.governanceStatus === 'pending') counts.pending += 1
      if (entry.governanceStatus === 'approved') counts.approved += 1
      if (entry.governanceStatus === 'draft') counts.draft += 1
      if (entry.governanceStatus === 'rejected') counts.rejected += 1
    }
    return counts
  }, [rankedTemplates])
  const templateOwnerOptions = useMemo(() => {
    const owners = Array.from(new Set(rankedTemplates.map((entry) => entry.template.owner_user_id || 'n/a')))
    return owners.sort((a, b) => a.localeCompare(b))
  }, [rankedTemplates])
  const templateTagOptions = useMemo(() => {
    const tags = new Set<string>()
    for (const entry of rankedTemplates) {
      for (const tag of entry.tags) tags.add(tag)
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b))
  }, [rankedTemplates])
  const filteredRankedTemplates = useMemo(() => {
    const tabStatus = templateTab === 'all' ? null : templateTab
    const rows = rankedTemplates.filter((entry) => {
      if (tabStatus && entry.governanceStatus !== tabStatus) return false
      if (templateStatusFilter !== 'all' && entry.governanceStatus !== templateStatusFilter) return false
      if (templateOwnerFilter !== 'all' && (entry.template.owner_user_id || 'n/a') !== templateOwnerFilter) return false
      if (templateTagFilter !== 'all' && !entry.tags.includes(templateTagFilter)) return false
      return true
    })
    const sorted = [...rows].sort((left, right) => {
      if (templateSort === 'updated-desc') return right.template.updated_at.localeCompare(left.template.updated_at)
      if (templateSort === 'updated-asc') return left.template.updated_at.localeCompare(right.template.updated_at)
      if (templateSort === 'title-desc') return right.template.name.localeCompare(left.template.name)
      return left.template.name.localeCompare(right.template.name)
    })
    return sorted
  }, [rankedTemplates, templateOwnerFilter, templateSort, templateStatusFilter, templateTab, templateTagFilter])
  const activeTemplateQuickPreview = useMemo(
    () => filteredRankedTemplates.find((entry) => entry.template.id === templateQuickPreviewId) || null,
    [filteredRankedTemplates, templateQuickPreviewId],
  )

  useEffect(() => {
    setTemplatePreviewRefreshAtById((previous) => {
      const next = { ...previous }
      const templateIds = new Set<string>()
      for (const template of templates) {
        templateIds.add(template.id)
        if (next[template.id] === undefined) {
          const updatedAt = Date.parse(template.updated_at)
          if (Number.isFinite(updatedAt)) next[template.id] = updatedAt
        }
      }
      for (const templateId of Object.keys(next)) {
        if (!templateIds.has(templateId)) delete next[templateId]
      }
      return next
    })
    setTemplatePreviewFingerprintById((previous) => {
      const next = { ...previous }
      const templateIds = new Set<string>()
      for (const template of templates) {
        templateIds.add(template.id)
        next[template.id] = getTemplatePreviewFingerprint(template)
      }
      for (const templateId of Object.keys(next)) {
        if (!templateIds.has(templateId)) delete next[templateId]
      }
      return next
    })
  }, [templates])

  const pushHistorySnapshot = useCallback((components: SlideComponent[]) => {
    setHistoryPast((previous) => {
      if (previous.length > 0 && areComponentsEqual(previous[previous.length - 1], components)) {
        return previous
      }
      const next = [...previous, cloneComponents(components)]
      if (next.length > MAX_HISTORY_ENTRIES) {
        return next.slice(next.length - MAX_HISTORY_ENTRIES)
      }
      return next
    })
    setHistoryFuture([])
  }, [areComponentsEqual, cloneComponents])

  const clearHistory = useCallback(() => {
    setHistoryPast([])
    setHistoryFuture([])
  }, [])

  const isTextEntryTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    if (target.closest('[contenteditable="true"]')) return true
    const tag = target.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select'
  }, [])

  const {
    confirmDiscardUnsaved,
    handleWorkspaceTabChange,
    handleBackToHubClick,
  } = useSlidesWorkspaceGuard({
    actor,
    hasUnsavedChanges,
    workspaceTab,
    activeSlideId,
    saveStatus,
    unsavedChangesConfirmText: UNSAVED_CHANGES_CONFIRM_TEXT,
    setWorkspaceTab,
    requestNativeConfirmation: confirmNative,
  })

  const setDirty = useCallback(() => {
    setAutosaveRetryState(null)
    setSaveStatus((previous) => {
      if (previous === 'saving') return previous
      return 'dirty'
    })
  }, [])

  const {
    groupSelection,
    ungroupSelection,
    handleSetSelectionLocked,
  } = useSlidesSelectionActions({
    result,
    activeDocumentSlideId,
    activeSlideId,
    selectedComponentIds,
    pushHistorySnapshot,
    setResult,
    setEditingComponentId,
    setDirty,
    setEditorNotice,
  })

  const {
    updateCanvasComponentContent,
    beginInlineEditMode,
    handleCanvasLayerSelect,
    handleUndo,
    handleRedo,
    reorderSelection,
    duplicateSelection,
    deleteSelection,
    handleCanvasKeyDown,
    handleCanvasPointerDown,
    handleResizePointerDown,
    handleCanvasPointerMove,
    handleCanvasResizeMove,
    handleCanvasPointerRelease,
  } = useSlidesCanvasInteractions({
    result,
    activeDocumentSlideId,
    selectedComponentIds,
    editingComponentId,
    draggingComponentId,
    historyPast,
    historyFuture,
    primarySelectedComponentId,
    canInlineEditSelected,
    canvasScale,
    minComponentWidth: MIN_COMPONENT_WIDTH,
    minComponentHeight: MIN_COMPONENT_HEIGHT,
    maxHistoryEntries: MAX_HISTORY_ENTRIES,
    snapTolerancePx: SNAP_TOLERANCE_PX,
    editableComponentTypes: EDITABLE_COMPONENT_TYPES,
    setResult,
    setSelectedComponentIds,
    setEditingComponentId,
    setDraggingComponentId,
    setResizingComponentId,
    setHistoryPast,
    setHistoryFuture,
    setEditorNotice,
    canvasDragRef,
    canvasResizeRef,
    canvasDragMovedRef,
    canvasResizeMovedRef,
    canvasContentRefs,
    isTextEntryTarget,
    pushHistorySnapshot,
    cloneComponents,
    areComponentsEqual,
    updateCanvasSnapGuides,
    setDirty,
    supportsTextAutoSize,
    measureTextAutoSizeHeight,
    clampCanvasCoordinates,
    buildCanvasSnapTargets,
    findMoveSnap,
    findEndSnap,
    resolveComponentHeight,
    groupSelection,
    ungroupSelection,
  })

  refreshLibraryDataRef.current = refreshLibraryData

  useEffect(() => {
    if (!archivedTemplateUndo) return
    const remaining = archivedTemplateUndo.expiresAt - Date.now()
    if (remaining <= 0) {
      setArchivedTemplateUndo(null)
      return
    }
    const timeoutId = window.setTimeout(() => {
      setArchivedTemplateUndo((previous) => {
        if (!previous) return null
        return previous.expiresAt <= Date.now() ? null : previous
      })
    }, remaining)
    return () => window.clearTimeout(timeoutId)
  }, [archivedTemplateUndo])

  useEffect(() => {
    return subscribeSlidesRuntimeHealth((state) => {
      setRuntimeHealth(state)
    })
  }, [])

  useEffect(() => {
    if (runtimeHealth.mode !== 'degraded' || !runtimeHealth.lastFailure) return
    setDegradedState({
      mode: 'local-draft',
      message: 'Slides service is unavailable right now. You can keep working in draft mode until it recovers.',
      correlationId: runtimeHealth.lastFailure.correlationId,
      rayId: runtimeHealth.lastFailure.rayId,
      endpoint: runtimeHealth.lastFailure.endpoint || '/api/slides',
    })
  }, [runtimeHealth])

  useEffect(() => {
    if (trimmedSearchValue.length > 0) return
    clearMissingSelections(slides.map((slide) => slide.id))
  }, [clearMissingSelections, slides, trimmedSearchValue])

  useEffect(() => {
    if (!templateQuickPreviewId) return
    if (templates.some((template) => template.id === templateQuickPreviewId)) return
    setTemplateQuickPreviewId(null)
  }, [templateQuickPreviewId, templates])

  useEffect(() => {
    if (typeof window === 'undefined' || !templateQuickPreviewId) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setTemplateQuickPreviewId(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [templateQuickPreviewId])

  const normalizeComponentsForPersistence = useCallback(
    (components: SlideComponent[]) => normalizeComponentsForPersistenceHelper(components, MIN_FONT_SIZE),
    [],
  )

  const {
    parseHtmlSync,
    runParseWithProgress,
    cancelParse,
    handleSave,
    retrySlidesService,
    scheduleAutosaveRetryNow,
    dismissAutosaveRetry,
    clearDegradedMode,
  } = useSlidesEditorPersistence({
    actor,
    workspaceTab,
    parseAbortRef,
    pendingImportWarningsRef,
    result,
    rawHtmlLength: rawHtml.length,
    slideTitle,
    activeSlideId,
    activeDocumentSlideId,
    activeRevision,
    saveStatus,
    autosaveEnabled,
    autosaveRetryState,
    autosaveDelayMs: AUTOSAVE_DELAY_MS,
    autosaveRetryBaseDelayMs: AUTOSAVE_RETRY_BASE_DELAY_MS,
    autosaveRetryMaxDelayMs: AUTOSAVE_RETRY_MAX_DELAY_MS,
    autosaveRetryMaxAttempts: AUTOSAVE_RETRY_MAX_ATTEMPTS,
    setResult,
    setImportError,
    setParseStatus,
    setParseProgress,
    setParseMessage,
    setSelectedComponentIds,
    setEditingComponentId,
    setDraggingComponentId,
    setResizingComponentId,
    setEditorNotice,
    setExportHtml,
    setSaveStatus,
    setSaveError,
    setAutosaveRetryState,
    setAutosaveEnabled,
    setConflictServerSlide,
    setDegradedState,
    setActiveSlideId,
    setActiveRevision,
    setSlideTitle,
    setLastSavedAt,
    setLibraryError,
    setImportDiagnostics,
    clearHistory,
    setDirty,
    refreshLibraryData,
    normalizeComponentsForPersistence,
    getErrorSummary: getSlideErrorSummary,
    isAutosaveRetryableError,
  })

  useEffect(() => {
    if (!result) {
      setActiveDocumentSlideId(null)
      setCanvasScale(1)
      setResizeCanvasWidthInput(String(CANVAS_DEFAULT_WIDTH))
      setResizeCanvasHeightInput(String(CANVAS_DEFAULT_HEIGHT))
      return
    }

    const host = canvasHostRef.current
    if (!host) return

    const sourceWidth = canvasDimensions.width > 0 ? canvasDimensions.width : CANVAS_DEFAULT_WIDTH

    const updateScale = () => {
      const availableWidth = host.clientWidth
      if (!availableWidth) {
        setCanvasScale(1)
        return
      }
      const nextScale = Math.min(1, availableWidth / sourceWidth)
      setCanvasScale(Number(nextScale.toFixed(4)))
    }

    updateScale()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale)
      return () => window.removeEventListener('resize', updateScale)
    }

    const observer = new ResizeObserver(() => updateScale())
    observer.observe(host)
    return () => observer.disconnect()
  }, [canvasDimensions.width, result])

  useEffect(() => {
    if (!result) return
    setResizeCanvasWidthInput(String(result.canvas.width))
    setResizeCanvasHeightInput(String(result.canvas.height))
  }, [result?.canvas.height, result?.canvas.width])

  useEffect(() => {
    if (!result) return
    if (result.document.deck.slides.length === 0) return
    if (activeDocumentSlideId && result.document.deck.slides.some((slide) => slide.id === activeDocumentSlideId)) return
    setActiveDocumentSlideId(result.document.deck.slides[0]?.id || null)
  }, [activeDocumentSlideId, result])

  useEffect(() => {
    if (parseStatus !== 'completed') return
    const hasWarnings = (result?.warnings?.length || 0) > 0
    if (!importError && !hasWarnings) {
      setRawHtmlExpanded(false)
    }
  }, [importError, parseStatus, result?.warnings])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (isTextEntryTarget(event.target)) return
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
        return
      }
      if (key === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleRedo, handleUndo, isTextEntryTarget])

  useEffect(() => {
    if (!result) {
      setSelectedComponentIds([])
      setEditingComponentId(null)
      setDraggingComponentId(null)
      setResizingComponentId(null)
      canvasDragRef.current = null
      canvasResizeRef.current = null
      canvasDragMovedRef.current = false
      canvasResizeMovedRef.current = false
      return
    }

    setEditingComponentId((previous) => {
      if (!previous) return null
      return result.components.some((component) => component.id === previous) ? previous : null
    })
    if (selectedComponentIds.length === 0) return
    setSelectedComponentIds((previous) => previous.filter((id) => result.components.some((component) => component.id === id)))
  }, [result, selectedComponentIds.length])

  const {
    recoveryDraft,
    restoreDraft,
    discardDraft,
  } = useSlidesDraftRecovery({
    actor,
    workspaceTab,
    draftRecoveryKey,
    hasUnsavedChanges,
    saveStatus,
    rawHtml,
    slideTitle,
    activeSlideId,
    activeDocumentSlideId,
    activeRevision,
    result,
    clearHistory,
    setRawHtml,
    setSlideTitle,
    setActiveSlideId,
    setActiveDocumentSlideId,
    setActiveRevision,
    setResult,
    setSelectedComponentIds,
    setEditingComponentId,
    setDraggingComponentId,
    setResizingComponentId,
    setEditorNotice,
    setAutosaveRetryState,
    setSaveError,
    setSaveStatus,
    canvasDragRef,
    canvasResizeRef,
    canvasDragMovedRef,
    canvasResizeMovedRef,
  })

  const handleCanvasComponentBlur = useCallback((component: SlideComponent, event: FocusEvent<HTMLDivElement>) => {
    const nextContent = sanitizeHtmlContent(event.currentTarget.innerHTML || '')
    if (nextContent !== component.content) {
      event.currentTarget.innerHTML = nextContent
      updateCanvasComponentContent(component.id, nextContent)
    }
    setEditingComponentId((previous) => (previous === component.id ? null : previous))
  }, [updateCanvasComponentContent])

  const handleCanvasContentKeyDown = useCallback((component: SlideComponent, event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    setEditingComponentId((previous) => (previous === component.id ? null : previous))
    event.currentTarget.blur()
  }, [])
  const { onFileChange, openFilePicker } = useSlidesImportIngestion({
    fileInputRef,
    runParseWithProgress,
    pendingImportWarningsRef,
    setImportError,
    setParseStatus,
    setParseProgress,
    setParseMessage,
    setRawHtml,
    setImportDiagnostics,
  })

  const loadSlide = useCallback((slide: SlideRecord, options?: { skipUnsavedConfirm?: boolean }) => {
    if (!options?.skipUnsavedConfirm && !confirmDiscardUnsaved()) return
    const nextResult = slideRecordToImportResult(slide)
    setWorkspaceTab('import')
    setResult(nextResult)
    setRawHtml('')
    setSlideTitle(slide.title)
    setActiveSlideId(slide.id)
    setActiveDocumentSlideId(nextResult.document.deck.slides[0]?.id || null)
    setActiveRevision(slide.revision)
    setSelectedComponentIds([])
    setEditingComponentId(null)
    setDraggingComponentId(null)
    setResizingComponentId(null)
    canvasDragRef.current = null
    canvasResizeRef.current = null
    canvasDragMovedRef.current = false
    canvasResizeMovedRef.current = false
    clearHistory()
    setCropRestoreDocument(null)
    setEditorNotice(null)
    setAutosaveRetryState(null)
    setSaveStatus('clean')
    setSaveError(null)
    setLastSavedAt(slide.updated_at)
    setExportHtml('')
  }, [clearHistory, confirmDiscardUnsaved])

  const applyDocumentSelection = useCallback((document: SlideImportResult['document'], nextSlideId: string, notice?: string) => {
    setResult(slideDocumentToImportResult(document, nextSlideId))
    setActiveDocumentSlideId(nextSlideId)
    setSelectedComponentIds([])
    setEditingComponentId(null)
    setDraggingComponentId(null)
    setResizingComponentId(null)
    clearHistory()
    setCropRestoreDocument(null)
    setExportHtml('')
    if (notice) {
      setEditorNotice({ tone: 'info', text: notice })
    }
  }, [clearHistory])

  const handleSelectDeckSlide = useCallback((slideId: string) => {
    if (!result) return
    applyDocumentSelection(result.document, slideId)
  }, [applyDocumentSelection, result])

  const handleCreateDeckSlide = useCallback(() => {
    if (!result) return
    const nextSlideId = `deck-slide-${Date.now().toString(36)}`
    const nextDocument = createDeckSlideDocument({
      result,
      activeSlideId: activeDocumentSlideId || activeSlideId || undefined,
      nextSlideId,
    })
    applyDocumentSelection(nextDocument, nextSlideId, `Created slide ${nextDocument.deck.slides.length}.`)
    setCropRestoreDocument(null)
    setDirty()
  }, [activeDocumentSlideId, activeSlideId, applyDocumentSelection, result, setDirty])

  const handleDuplicateDeckSlide = useCallback(() => {
    if (!result || !activeDeckSlide) return
    const nextSlideId = `${activeDeckSlide.id}-copy-${Date.now().toString(36)}`
    const nextDocument = duplicateDeckSlideDocument({
      result,
      activeSlideId: activeDocumentSlideId || activeSlideId || undefined,
      sourceSlideId: activeDeckSlide.id,
      nextSlideId,
    })
    applyDocumentSelection(nextDocument, nextSlideId, 'Duplicated current slide.')
    setCropRestoreDocument(null)
    setDirty()
  }, [activeDeckSlide, activeDocumentSlideId, activeSlideId, applyDocumentSelection, result, setDirty])

  const handleDeleteDeckSlide = useCallback(async () => {
    if (!result || !activeDeckSlide) return
    const approved = await confirm({
      title: 'Delete Deck Slide',
      message: `Delete deck slide ${deckSlides.findIndex((slide) => slide.id === activeDeckSlide.id) + 1}?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    })
    if (!approved) return
    const nextDocument = deleteDeckSlideDocument({
      result,
      activeSlideId: activeDocumentSlideId || activeSlideId || undefined,
      sourceSlideId: activeDeckSlide.id,
    })
    const fallbackSlideId = nextDocument.deck.slides[Math.max(0, deckSlides.findIndex((slide) => slide.id === activeDeckSlide.id) - 1)]?.id
      || nextDocument.deck.slides[0]?.id
      || null
    if (!fallbackSlideId) return
    applyDocumentSelection(nextDocument, fallbackSlideId, 'Deleted current slide.')
    setCropRestoreDocument(null)
    setDirty()
  }, [activeDeckSlide, activeDocumentSlideId, activeSlideId, applyDocumentSelection, confirm, deckSlides, result, setDirty])

  const handleReorderDeckSlide = useCallback((direction: 'up' | 'down') => {
    if (!result || !activeDeckSlide) return
    const nextDocument = reorderDeckSlideDocument({
      result,
      activeSlideId: activeDocumentSlideId || activeSlideId || undefined,
      sourceSlideId: activeDeckSlide.id,
      direction,
    })
    applyDocumentSelection(nextDocument, activeDeckSlide.id)
    setCropRestoreDocument(null)
    setDirty()
  }, [activeDeckSlide, activeDocumentSlideId, activeSlideId, applyDocumentSelection, result, setDirty])

  const handleImportHtmlAsNewDeck = useCallback(async () => {
    const preflight = validatePastedHtml(rawHtml)
    if (preflight) {
      setImportError(preflight)
      setParseStatus('failed')
      setParseProgress(0)
      setParseMessage(preflight.message)
      return
    }
    try {
      const parsed = await convertHtmlToSlideComponents(rawHtml)
      const parsedValidation = validateParsedResult(parsed)
      if (parsedValidation) throw new Error(parsedValidation.message)
      setResult(parsed)
      setActiveDocumentSlideId(parsed.document.deck.slides[0]?.id || null)
      clearHistory()
      setSelectedComponentIds([])
      setEditingComponentId(null)
      setDraggingComponentId(null)
      setResizingComponentId(null)
      setCropRestoreDocument(null)
      setEditorNotice({ tone: 'info', text: 'Imported HTML as a new deck.' })
      setImportError(null)
      setParseStatus('completed')
      setParseProgress(100)
      setParseMessage(`Parsed ${parsed.components.length} components as a new deck.`)
      setExportHtml('')
      setDirty()
    } catch (error) {
      const failure = classifyImportError(error)
      setImportError(failure)
      setParseStatus('failed')
      setParseProgress(0)
      setParseMessage(failure.message)
    }
  }, [clearHistory, rawHtml, setDirty])

  const handleImportHtmlAsNewDeckSlide = useCallback(async () => {
    if (!result) {
      await handleImportHtmlAsNewDeck()
      return
    }
    const preflight = validatePastedHtml(rawHtml)
    if (preflight) {
      setImportError(preflight)
      setParseStatus('failed')
      setParseProgress(0)
      setParseMessage(preflight.message)
      return
    }
    try {
      const parsed = await convertHtmlToSlideComponents(rawHtml)
      const parsedValidation = validateParsedResult(parsed)
      if (parsedValidation) throw new Error(parsedValidation.message)
      const nextSlideId = `deck-slide-${Date.now().toString(36)}`
      const nextDocument = appendImportedHtmlAsDeckSlide({
        result,
        activeSlideId: activeDocumentSlideId || activeSlideId || undefined,
        nextSlideId,
        canvas: parsed.canvas,
        components: parsed.components,
      })
      applyDocumentSelection(nextDocument, nextSlideId, 'Imported HTML as a new slide in the current deck.')
      setImportError(null)
      setParseStatus('completed')
      setParseProgress(100)
      setParseMessage(`Added slide ${nextDocument.deck.slides.length} to current deck.`)
      setCropRestoreDocument(null)
      setDirty()
    } catch (error) {
      const failure = classifyImportError(error)
      setImportError(failure)
      setParseStatus('failed')
      setParseProgress(0)
      setParseMessage(failure.message)
    }
  }, [activeDocumentSlideId, activeSlideId, applyDocumentSelection, handleImportHtmlAsNewDeck, rawHtml, result, setDirty])

  const handleApplyTheme = useCallback(() => {
    if (!result) {
      setEditorNotice({ tone: 'error', text: 'Parse or load a slide before applying a theme.' })
      return
    }

    const targetSlideId = activeDocumentSlideId || activeDeckSlide?.id || result.document.deck.slides[0]?.id || null
    if (!targetSlideId) {
      setEditorNotice({ tone: 'error', text: 'No active slide is available for theme application.' })
      return
    }

    const nextTheme = cloneSlideTheme(themeDraft)
    const nextSlides = result.document.deck.slides.map((slide) => {
      if (themeScope === 'slide' && slide.id !== targetSlideId) return slide
      const nextElements = slide.elements.map((component) => applyThemeToComponent(component, nextTheme, themeConvertImported))
      return {
        ...slide,
        elements: nextElements,
        ...(themeConvertImported ? { background: { fill: nextTheme.colors.background } } : {}),
      }
    })

    const nextDocument: SlideDocument = {
      ...result.document,
      theme: nextTheme,
      deck: {
        ...result.document.deck,
        slides: nextSlides,
      },
    }
    const nextResult = slideDocumentToImportResult(nextDocument, targetSlideId)
    setResult(nextResult)
    setCropRestoreDocument(null)
    setDirty()
    setEditorNotice({
      tone: 'info',
      text:
        `Applied theme to ${themeScope === 'deck' ? 'the full deck' : `slide ${activeThemeSlideIndex + 1}`}.` +
        (themeConvertImported ? ' Imported components were converted to theme-linked styles.' : ' Only already linked components were updated.'),
    })
  }, [activeDeckSlide, activeDocumentSlideId, activeThemeSlideIndex, result, setDirty, themeConvertImported, themeDraft, themeScope])

  const handleApplyCanvasCrop = useCallback(() => {
    if (!result) return

    const cropX = Math.round(Number(cropXInput))
    const cropY = Math.round(Number(cropYInput))
    const cropWidth = Math.round(Number(cropWidthInput))
    const cropHeight = Math.round(Number(cropHeightInput))
    const invalidCrop =
      !Number.isFinite(cropX) ||
      !Number.isFinite(cropY) ||
      !Number.isFinite(cropWidth) ||
      !Number.isFinite(cropHeight) ||
      cropX < 0 ||
      cropY < 0 ||
      cropWidth < 1 ||
      cropHeight < 1 ||
      cropX + cropWidth > result.canvas.width ||
      cropY + cropHeight > result.canvas.height

    if (invalidCrop) {
      setEditorNotice({ tone: 'error', text: 'Enter a valid crop rectangle inside the current canvas before applying crop.' })
      return
    }

    if (cropX === 0 && cropY === 0 && cropWidth === result.canvas.width && cropHeight === result.canvas.height) {
      setEditorNotice({ tone: 'info', text: 'Crop rectangle already matches the full canvas.' })
      return
    }

    const { syncedDocument, croppedDocument, outOfBoundsCount } = cropSlideDocumentCanvas({
      result,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      slideId: activeDocumentSlideId || activeSlideId || undefined,
    })

    const nextActiveSlideId = activeDocumentSlideId || activeSlideId || croppedDocument.deck.slides[0]?.id || null
    if (!nextActiveSlideId) return
    setCropRestoreDocument((previous) => previous || syncedDocument)
    clearHistory()
    setResult(slideDocumentToImportResult(croppedDocument, nextActiveSlideId))
    setActiveDocumentSlideId(nextActiveSlideId)
    setSelectedComponentIds([])
    setEditingComponentId(null)
    setDraggingComponentId(null)
    setResizingComponentId(null)
    setExportHtml('')
    setDirty()
    setEditorNotice({
      tone: 'info',
      text: `Applied crop ${cropWidth} × ${cropHeight} from ${cropX}, ${cropY}.` +
        (outOfBoundsCount > 0 ? ` ${outOfBoundsCount} layer(s) remain outside the visible bounds.` : ''),
    })
  }, [activeDocumentSlideId, activeSlideId, clearHistory, cropHeightInput, cropWidthInput, cropXInput, cropYInput, result, setDirty])

  const handleResetCanvasCrop = useCallback(() => {
    if (!cropRestoreDocument) {
      setEditorNotice({ tone: 'error', text: 'No crop restore point is available.' })
      return
    }
    const nextActiveSlideId = activeDocumentSlideId || activeSlideId || cropRestoreDocument.deck.slides[0]?.id || null
    if (!nextActiveSlideId) return
    setResult(slideDocumentToImportResult(cropRestoreDocument, nextActiveSlideId))
    setActiveDocumentSlideId(nextActiveSlideId)
    setSelectedComponentIds([])
    setEditingComponentId(null)
    setDraggingComponentId(null)
    setResizingComponentId(null)
    setExportHtml('')
    setCropRestoreDocument(null)
    clearHistory()
    setDirty()
    setEditorNotice({ tone: 'info', text: 'Reset crop and restored the pre-crop canvas.' })
  }, [activeDocumentSlideId, activeSlideId, clearHistory, cropRestoreDocument, setDirty])

  const handleResizeCanvasProportionally = useCallback(() => {
    if (!result) return
    const nextWidth = Math.max(1, Number.parseInt(resizeCanvasWidthInput, 10) || 0)
    const nextHeight = Math.max(1, Number.parseInt(resizeCanvasHeightInput, 10) || 0)
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) {
      setEditorNotice({ tone: 'error', text: 'Enter valid canvas dimensions before resizing.' })
      return
    }
    if (nextWidth === result.canvas.width && nextHeight === result.canvas.height) {
      setEditorNotice({ tone: 'info', text: 'Canvas dimensions are already set to that size.' })
      return
    }

    const resizedDocument = resizeSlideDocumentProportionally({
      result,
      nextWidth,
      nextHeight,
      slideId: activeDocumentSlideId || activeSlideId || undefined,
    })

    const nextActiveSlideId = activeDocumentSlideId || activeSlideId || resizedDocument.deck.slides[0]?.id || null
    if (!nextActiveSlideId) return
    pushHistorySnapshot(result.components)
    setResult(slideDocumentToImportResult(resizedDocument, nextActiveSlideId))
    setActiveDocumentSlideId(nextActiveSlideId)
    setSelectedComponentIds([])
    setEditingComponentId(null)
    setDraggingComponentId(null)
    setResizingComponentId(null)
    setCropRestoreDocument(null)
    setExportHtml('')
    setDirty()
    setEditorNotice({ tone: 'info', text: `Resized canvas to ${nextWidth} × ${nextHeight} with proportional layer scaling.` })
  }, [
    activeDocumentSlideId,
    activeSlideId,
    pushHistorySnapshot,
    resizeCanvasHeightInput,
    resizeCanvasWidthInput,
    result,
    setDirty,
  ])

  const handleResizeCanvasResponsively = useCallback(() => {
    if (!result) return
    const nextWidth = Math.max(1, Number.parseInt(resizeCanvasWidthInput, 10) || 0)
    const nextHeight = Math.max(1, Number.parseInt(resizeCanvasHeightInput, 10) || 0)
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) {
      setEditorNotice({ tone: 'error', text: 'Enter valid canvas dimensions before adapting layout.' })
      return
    }
    if (nextWidth === result.canvas.width && nextHeight === result.canvas.height) {
      setEditorNotice({ tone: 'info', text: 'Canvas dimensions are already set to that size.' })
      return
    }

    const resizedDocument = resizeSlideDocumentResponsively({
      result,
      nextWidth,
      nextHeight,
      slideId: activeDocumentSlideId || activeSlideId || undefined,
    })

    const nextActiveSlideId = activeDocumentSlideId || activeSlideId || resizedDocument.deck.slides[0]?.id || null
    if (!nextActiveSlideId) return
    clearHistory()
    setCropRestoreDocument(null)
    setResult(slideDocumentToImportResult(resizedDocument, nextActiveSlideId))
    setActiveDocumentSlideId(nextActiveSlideId)
    setSelectedComponentIds([])
    setEditingComponentId(null)
    setDraggingComponentId(null)
    setResizingComponentId(null)
    setExportHtml('')
    setDirty()
    setEditorNotice({ tone: 'info', text: `Adapted canvas to ${nextWidth} × ${nextHeight} with responsive layout constraints.` })
  }, [
    activeDocumentSlideId,
    activeSlideId,
    clearHistory,
    resizeCanvasHeightInput,
    resizeCanvasWidthInput,
    result,
    setDirty,
  ])

  const handleApplyCanvasPreset = useCallback((width: number, height: number) => {
    setResizeCanvasWidthInput(String(width))
    setResizeCanvasHeightInput(String(height))
    setEditorNotice({ tone: 'info', text: `Applied ${width} × ${height} preset. Click resize to update the deck canvas.` })
  }, [])

  const {
    handleDuplicateSlide,
    handleRenameSlide,
    handleDeleteSlide,
    handleDuplicateTemplate,
  } = useSlidesLibraryActions({
    actor,
    activeSlideId,
    confirm,
    confirmDiscardUnsaved,
    loadSlide,
    refreshLibraryData,
    clearHistory,
    setActiveSlideId,
    setActiveDocumentSlideId,
    setActiveRevision,
    setSlideTitle,
    setResult,
    setSelectedComponentIds,
    setEditingComponentId,
    setDraggingComponentId,
    setResizingComponentId,
    setEditorNotice,
    setSaveStatus,
    setSaveError,
    setLastSavedAt,
    setExportHtml,
    setLibraryError,
  })

  const {
    applyStyleToSelection,
    applyBoundsToSelection,
    alignSelection,
    distributeSelection,
    applyLayoutConstraintSelection,
  } = useSlidesEditorToolbarMutations({
    result,
    activeDocumentSlideId,
    selectedComponentIds,
    selectedComponents,
    minFontSize: MIN_FONT_SIZE,
    minComponentWidth: MIN_COMPONENT_WIDTH,
    minComponentHeight: MIN_COMPONENT_HEIGHT,
    setResult,
    setEditorNotice,
    setDirty,
    pushHistorySnapshot,
    areComponentsEqual,
    supportsTextAutoSize,
    measureTextAutoSizeHeight,
    clampCanvasCoordinates,
  })

  const {
    generateExport,
    downloadTextFile,
    copyParsedJson,
    handleExportHtml,
    handleExportPdf,
    pptxExportWarnings,
    pptxExportBusy,
    handleExportCurrentAsPptx,
    handleExportSelectedSlidesAsPptx,
    handleDownloadPptxWarningReport,
    handleConflictReload,
    handleConflictOverwrite,
    handleConflictSaveAsCopy,
  } = useSlidesExportActions({
    actor,
    activeSlideId,
    activeDocumentSlideId,
    activeRevision,
    slideTitle,
    rawHtmlLength: rawHtml.length,
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
  })

  if (!allowRender) {
    const accessMessage = !slidesModuleEnabled
      ? 'Slides module is currently disabled.'
      : !permissionsReady
        ? 'Loading your account permissions for Slides…'
        : (moduleAccessLoadError || userLoadError)
          ? `Unable to resolve your account access for Slides: ${moduleAccessLoadError || userLoadError}`
          : !hasResolvedUser
            ? 'No authenticated app user is available for Slides access checks.'
            : 'You do not currently have access to the Slides module.'

    return (
      <div className="app show-hamburger slides-app">
        <main className="app-content" role="main">
          <section className="module-panel module-panel--notice">
            <AppNotice tone={(moduleAccessLoadError || userLoadError) ? 'error' : 'info'}>
              {accessMessage}
            </AppNotice>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app show-hamburger slides-app">
      {confirmModal}
      <SlidesWorkspaceSidebar
        sidebarOpen={sidebarOpen}
        title={content.title || 'Slide Editor'}
        workspaceTab={workspaceTab}
        onBackClick={handleBackToHubClick}
        onCloseSidebar={() => setSidebarOpen(false)}
        onWorkspaceTabChange={handleWorkspaceTabChange}
      />

      <SlidesWorkspaceChrome
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        title={content.title || 'Slide Editor'}
        slidesSyncState={auditSlidesSyncState}
        slidesSyncLabel={auditSlidesSyncLabel}
        slidesSyncActionLabel={slidesSyncActionLabel}
        onSlidesSyncAction={handleRefreshSlidesAudit}
        refreshLibraryData={refreshLibraryData}
        libraryLoading={libraryLoading}
        workspaceLabel={workspaceLabel}
        workspaceTab={workspaceTab}
        handleWorkspaceTabChange={handleWorkspaceTabChange}
        importSourceSummary={importSourceSummary}
        saveStatusLabel={saveStatusLabel}
        syncStatusLabel={syncStatusLabel}
        conflictStatusLabel={conflictStatusLabel}
        recoveryDraft={recoveryDraft}
        formatDateTime={formatDateTime}
        restoreDraft={restoreDraft}
        discardDraft={discardDraft}
        degradedState={degradedState}
        retrySlidesService={retrySlidesService}
        clearDegradedMode={clearDegradedMode}
        searchLabel={searchLabel}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        searchPlaceholder={searchPlaceholder}
        libraryError={libraryError}
      >
            {workspaceTab === 'import' && (
              <>
                <SlidesImportPanel
                  fileInputRef={fileInputRef}
                  onFileChange={onFileChange}
                  openFilePicker={openFilePicker}
                  parseStatus={parseStatus}
                  parseStatusLabel={parseStatusLabel}
                  parsePercentLabel={parsePercentLabel}
                  parseMessage={parseMessage}
                  parseProgress={parseProgress}
                  rawHtml={rawHtml}
                  setRawHtml={setRawHtml}
                  rawHtmlExpanded={rawHtmlExpanded}
                  setRawHtmlExpanded={setRawHtmlExpanded}
                  runParseWithProgress={() => runParseWithProgress(rawHtml, 'pasted')}
                  handleImportHtmlAsNewDeckSlide={handleImportHtmlAsNewDeckSlide}
                  handleImportHtmlAsNewDeck={handleImportHtmlAsNewDeck}
                  cancelParse={cancelParse}
                  result={result}
                  setDirty={setDirty}
                  importError={importError}
                  setImportError={setImportError}
                  parseReportOpen={parseReportOpen}
                  setParseReportOpen={setParseReportOpen}
                  parseReportErrorsCount={parseReportErrorsCount}
                  parseReportWarningsCount={parseReportWarningsCount}
                  parseReportNoticesCount={parseReportNoticesCount}
                  warningGroups={warningGroups}
                  parseReportNotices={parseReportNotices}
                />

                <div className="slides-import-layout">
                  <SlidesSetupPanel
                    result={result}
                    slideTitle={slideTitle}
                    setSlideTitle={setSlideTitle}
                    setDirty={setDirty}
                    deckSlides={deckSlides}
                    activeDeckSlide={activeDeckSlide}
                    handleCreateDeckSlide={handleCreateDeckSlide}
                    handleDuplicateDeckSlide={handleDuplicateDeckSlide}
                    handleDeleteDeckSlide={handleDeleteDeckSlide}
                    handleReorderDeckSlide={handleReorderDeckSlide}
                    handleSelectDeckSlide={handleSelectDeckSlide}
                    handleSave={handleSave}
                    saveStatus={saveStatus}
                    setSaveStatus={setSaveStatus}
                    saveStatusTone={saveStatusTone}
                    saveStatusLabel={saveStatusLabel}
                    saveError={saveError}
                    setSaveError={setSaveError}
                    lastSavedAt={lastSavedAt}
                    formatDateTime={formatDateTime}
                    autosaveEnabled={autosaveEnabled}
                    setAutosaveEnabled={setAutosaveEnabled}
                    autosaveRetryState={autosaveRetryState}
                    setAutosaveRetryState={setAutosaveRetryState}
                    scheduleAutosaveRetryNow={scheduleAutosaveRetryNow}
                    dismissAutosaveRetry={dismissAutosaveRetry}
                    importSourceSummary={importSourceSummary}
                    canvasSizePresets={CANVAS_SIZE_PRESETS}
                    handleApplyCanvasPreset={handleApplyCanvasPreset}
                    resizeCanvasWidthInput={resizeCanvasWidthInput}
                    setResizeCanvasWidthInput={setResizeCanvasWidthInput}
                    canvasWidthError={canvasWidthError}
                    resizeCanvasHeightInput={resizeCanvasHeightInput}
                    setResizeCanvasHeightInput={setResizeCanvasHeightInput}
                    canvasHeightError={canvasHeightError}
                    aspectRatioChanging={aspectRatioChanging}
                    currentCanvasAspectRatio={currentCanvasAspectRatio}
                    nextCanvasAspectRatio={nextCanvasAspectRatio}
                    handleResizeCanvasProportionally={handleResizeCanvasProportionally}
                    handleResizeCanvasResponsively={handleResizeCanvasResponsively}
                    canvasResizeInvalid={canvasResizeInvalid}
                    cropXInput={cropXInput}
                    setCropXInput={setCropXInput}
                    cropYInput={cropYInput}
                    setCropYInput={setCropYInput}
                    cropWidthInput={cropWidthInput}
                    setCropWidthInput={setCropWidthInput}
                    cropHeightInput={cropHeightInput}
                    setCropHeightInput={setCropHeightInput}
                    handleApplyCanvasCrop={handleApplyCanvasCrop}
                    handleResetCanvasCrop={handleResetCanvasCrop}
                    cropRestoreDocument={cropRestoreDocument}
                    themeDraft={themeDraft}
                    setThemeDraft={setThemeDraft}
                    themeScope={themeScope}
                    setThemeScope={setThemeScope}
                    themeConvertImported={themeConvertImported}
                    setThemeConvertImported={setThemeConvertImported}
                    handleApplyTheme={handleApplyTheme}
                    conflictServerSlide={conflictServerSlide}
                    handleConflictReload={handleConflictReload}
                    handleConflictOverwrite={handleConflictOverwrite}
                    handleConflictSaveAsCopy={handleConflictSaveAsCopy}
                  />
                </div>

                  {result && (
                  <div className="slides-results">
                      <SlidesCanvasPreview
                        result={result}
                        canvasScale={canvasScale}
                        canvasDimensions={canvasDimensions}
                        canvasHostRef={canvasHostRef}
                        canvasContentRefs={canvasContentRefs}
                        canvasSnapGuides={canvasSnapGuides}
                        editableComponentTypes={EDITABLE_COMPONENT_TYPES}
                        selectedComponentIds={selectedComponentIds}
                        selectedComponentsCount={selectedComponents.length}
                        primarySelectedComponentId={primarySelectedComponentId}
                        editingComponentId={editingComponentId}
                        draggingComponentId={draggingComponentId}
                        resizingComponentId={resizingComponentId}
                        handleCanvasKeyDown={handleCanvasKeyDown}
                        handleCanvasLayerSelect={handleCanvasLayerSelect}
                        beginInlineEditMode={beginInlineEditMode}
                        handleCanvasPointerDown={handleCanvasPointerDown}
                        handleCanvasPointerMove={handleCanvasPointerMove}
                        handleCanvasResizeMove={handleCanvasResizeMove}
                        handleCanvasPointerRelease={handleCanvasPointerRelease}
                        handleResizePointerDown={handleResizePointerDown}
                        handleCanvasContentKeyDown={handleCanvasContentKeyDown}
                        handleCanvasComponentBlur={handleCanvasComponentBlur}
                      />

                    <SlidesEditorToolbar
                      selectedBounds={selectedBounds}
                      selectedStyle={selectedStyle}
                      selectedComponentIds={selectedComponentIds}
                      autoSizeEnabledForSelection={autoSizeEnabledForSelection}
                      autoSizeMixedSelection={autoSizeMixedSelection}
                      autoSizeEligibleSelection={autoSizeEligibleSelection}
                      defaultTextColor={defaultTextColor}
                      defaultBackgroundColor={defaultBackgroundColor}
                      minComponentWidth={MIN_COMPONENT_WIDTH}
                      minComponentHeight={MIN_COMPONENT_HEIGHT}
                      minFontSize={MIN_FONT_SIZE}
                      historyPastLength={historyPast.length}
                      historyFutureLength={historyFuture.length}
                      layoutConstraintDraft={layoutConstraintDraft}
                      setLayoutConstraintDraft={setLayoutConstraintDraft}
                      editorNotice={editorNotice}
                      applyBoundsToSelection={applyBoundsToSelection}
                      applyStyleToSelection={applyStyleToSelection}
                      handleUndo={handleUndo}
                      handleRedo={handleRedo}
                      alignSelection={alignSelection}
                      distributeSelection={distributeSelection}
                      reorderSelection={reorderSelection}
                      groupSelection={groupSelection}
                      ungroupSelection={ungroupSelection}
                      handleSetSelectionLocked={handleSetSelectionLocked}
                      duplicateSelection={duplicateSelection}
                      deleteSelection={deleteSelection}
                      applyLayoutConstraintSelection={applyLayoutConstraintSelection}
                    />

                    <SlidesExportPanel
                      result={result}
                      exportHtml={exportHtml}
                      showRawJson={showRawJson}
                      setShowRawJson={setShowRawJson}
                      jsonCopyState={jsonCopyState}
                      copyParsedJson={copyParsedJson}
                      downloadTextFile={downloadTextFile}
                      generateExport={generateExport}
                      handleExportHtml={handleExportHtml}
                      handleExportPdf={handleExportPdf}
                      handleExportCurrentAsPptx={handleExportCurrentAsPptx}
                      pptxExportBusy={pptxExportBusy}
                      pptxExportWarnings={pptxExportWarnings}
                      handleDownloadPptxWarningReport={handleDownloadPptxWarningReport}
                      slideTitle={slideTitle}
                      activeSlideId={activeSlideId}
                      activeDocumentSlideId={activeDocumentSlideId}
                    />

                    <SlidesLayerInspector
                      components={result.components}
                      selectedComponents={selectedComponents}
                      selectedComponentIds={selectedComponentIds}
                      setSelectedComponentIds={setSelectedComponentIds}
                      setEditingComponentId={setEditingComponentId}
                    />

                  </div>
                )}
              </>
            )}

            {workspaceTab === 'my-slides' && (
              <SlidesMySlidesWorkspace
                pptxSelectedSlideIds={pptxSelectedSlideIds}
                handleExportSelectedSlidesAsPptx={handleExportSelectedSlidesAsPptx}
                pptxExportBusy={pptxExportBusy}
                selectAllVisibleSlides={selectAllVisibleSlides}
                filteredMySlidesRows={filteredMySlidesRows}
                slides={slides}
                areAllVisibleSlidesSelected={areAllVisibleSlidesSelected}
                keepVisibleSelection={keepVisibleSelection}
                hasHiddenSelections={hasHiddenSelections}
                clearPptxSelection={clearPptxSelection}
                selectedVisibleSlideCount={selectedVisibleSlideCount}
                selectedHiddenSlideCount={selectedHiddenSlideCount}
                trimmedSearchValue={trimmedSearchValue}
                handleWorkspaceTabChange={handleWorkspaceTabChange}
                togglePptxSlideSelection={togglePptxSlideSelection}
                formatMySlidesStatus={formatMySlidesStatus}
                formatDateTime={formatDateTime}
                loadSlide={loadSlide}
                handleDuplicateSlide={handleDuplicateSlide}
                handleRenameSlide={handleRenameSlide}
                openPublishTemplateDraft={openPublishTemplateDraft}
                handleDeleteSlide={handleDeleteSlide}
                templatePublishDraft={templatePublishDraft}
                setTemplatePublishDraft={setTemplatePublishDraft}
                isSlidesAdmin={isSlidesAdmin}
                handlePublishTemplate={handlePublishTemplate}
                templatePublishBusy={templatePublishBusy}
                closePublishTemplateDraft={closePublishTemplateDraft}
              />
            )}

            {workspaceTab === 'templates' && (
              <SlidesTemplateLibraryWorkspace
                actor={actor}
                isSlidesAdmin={isSlidesAdmin}
                templates={templates}
                libraryLoading={libraryLoading}
                trimmedSearchValue={trimmedSearchValue}
                rankedTemplates={rankedTemplates}
                filteredRankedTemplates={filteredRankedTemplates}
                templateStatusFilter={templateStatusFilter}
                setTemplateStatusFilter={setTemplateStatusFilter}
                templateOwnerFilter={templateOwnerFilter}
                setTemplateOwnerFilter={setTemplateOwnerFilter}
                templateOwnerOptions={templateOwnerOptions}
                templateTagFilter={templateTagFilter}
                setTemplateTagFilter={setTemplateTagFilter}
                templateTagOptions={templateTagOptions}
                templateSort={templateSort}
                setTemplateSort={setTemplateSort}
                templatePreviewStatusById={templatePreviewStatusById}
                templateActionBusyId={templateActionBusyId}
                activeTemplateQuickPreview={activeTemplateQuickPreview}
                setTemplateQuickPreviewId={setTemplateQuickPreviewId}
                handleDuplicateTemplate={handleDuplicateTemplate}
                handleTemplateVisibilityToggle={handleTemplateVisibilityToggle}
                setSearchValue={setSearchValue}
                formatDateTime={formatDateTime}
              />
            )}

      </SlidesWorkspaceChrome>
    </div>
  )
}
