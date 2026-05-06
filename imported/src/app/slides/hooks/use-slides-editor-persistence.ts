import { saveSlide, SlideConflictError } from '@/lib/slides'
import { useCallback, useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { syncSlideDocument } from '@/components/slides/document'
import type { SlideActor, SlideRecord } from '@/components/slides/persistence-types'
import type { SlideComponent, SlideImportResult } from '@/components/slides/types'
import { convertHtmlToSlideComponents } from '@/components/slides/html-import'
import {
  classifyImportError,
  validateHtmlImportInput,
  type SlideImportFailure,
  validateParsedResult,
} from '@/components/slides/import-validation'

interface EditorNotice {
  tone: 'info' | 'error'
  text: string
}

export type ParseStatus = 'idle' | 'parsing' | 'completed' | 'canceled' | 'failed'
export type SaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'queued' | 'error' | 'conflict'

export interface AutosaveRetryState {
  attempt: number
  delayMs: number
  nextAttemptAt: number
  lastError: string
}

export interface SlidesDegradedState {
  mode: 'local-draft'
  message: string
  correlationId: string | null
  rayId: string | null
  endpoint: string
}

export interface SlideErrorSummary {
  message: string
  correlationId: string | null
  rayId: string | null
  endpoint: string
}

export type SlidesImportSource = 'file-picker' | 'chat-upload' | 'pasted' | 'unknown'

export interface SlidesImportDiagnostics {
  source: SlidesImportSource
  fileName: string | null
  fileSizeBytes: number | null
  rawHtmlChars: number
  lastStartedAt: string | null
  lastCompletedAt: string | null
  lastDurationMs: number | null
  lastOutcome: 'idle' | 'success' | 'failed' | 'canceled'
  lastComponentCount: number | null
  lastWarningCount: number | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
}

interface SaveOptions {
  autosave?: boolean
  overwrite?: boolean
  titleOverride?: string
}

interface UseSlidesEditorPersistenceOptions {
  actor: SlideActor
  workspaceTab: 'import' | 'my-slides' | 'templates'
  parseAbortRef: MutableRefObject<AbortController | null>
  pendingImportWarningsRef: MutableRefObject<string[]>
  result: SlideImportResult | null
  rawHtmlLength: number
  slideTitle: string
  activeSlideId: string | null
  activeDocumentSlideId: string | null
  activeRevision: number
  saveStatus: SaveStatus
  autosaveEnabled: boolean
  autosaveRetryState: AutosaveRetryState | null
  autosaveDelayMs: number
  autosaveRetryBaseDelayMs: number
  autosaveRetryMaxDelayMs: number
  autosaveRetryMaxAttempts: number
  setResult: Dispatch<SetStateAction<SlideImportResult | null>>
  setImportError: Dispatch<SetStateAction<SlideImportFailure | null>>
  setParseStatus: Dispatch<SetStateAction<ParseStatus>>
  setParseProgress: Dispatch<SetStateAction<number>>
  setParseMessage: Dispatch<SetStateAction<string>>
  setSelectedComponentIds: Dispatch<SetStateAction<string[]>>
  setEditingComponentId: Dispatch<SetStateAction<string | null>>
  setDraggingComponentId: Dispatch<SetStateAction<string | null>>
  setResizingComponentId: Dispatch<SetStateAction<string | null>>
  setEditorNotice: Dispatch<SetStateAction<EditorNotice | null>>
  setExportHtml: Dispatch<SetStateAction<string>>
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>
  setSaveError: Dispatch<SetStateAction<string | null>>
  setAutosaveRetryState: Dispatch<SetStateAction<AutosaveRetryState | null>>
  setAutosaveEnabled: Dispatch<SetStateAction<boolean>>
  setConflictServerSlide: Dispatch<SetStateAction<SlideRecord | null>>
  setDegradedState: Dispatch<SetStateAction<SlidesDegradedState | null>>
  setActiveSlideId: Dispatch<SetStateAction<string | null>>
  setActiveRevision: Dispatch<SetStateAction<number>>
  setSlideTitle: Dispatch<SetStateAction<string>>
  setLastSavedAt: Dispatch<SetStateAction<string | null>>
  setLibraryError: Dispatch<SetStateAction<string | null>>
  setImportDiagnostics: Dispatch<SetStateAction<SlidesImportDiagnostics>>
  clearHistory: () => void
  setDirty: () => void
  refreshLibraryData: () => Promise<void>
  normalizeComponentsForPersistence: (components: SlideComponent[]) => SlideComponent[]
  getErrorSummary: (error: unknown) => SlideErrorSummary
  isAutosaveRetryableError: (error: unknown) => boolean
}

interface UseSlidesEditorPersistenceResult {
  parseHtmlSync: (html: string) => Promise<SlideImportResult>
  runParseWithProgress: (html: string, source?: SlidesImportSource) => Promise<void>
  cancelParse: () => void
  handleSave: (options?: SaveOptions) => Promise<SlideRecord | null>
  retrySlidesService: () => Promise<void>
  scheduleAutosaveRetryNow: () => void
  dismissAutosaveRetry: () => void
  clearDegradedMode: () => void
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function extractPlainTextFromHtml(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped
}

function buildFallbackImportResult(
  html: string,
  parsed: SlideImportResult,
): SlideImportResult {
  const canvasWidth = Math.max(640, Math.round(parsed.canvas.width || 1920))
  const canvasHeight = Math.max(360, Math.round(parsed.canvas.height || 1080))
  const fallbackText = extractPlainTextFromHtml(html)
  const summary =
    fallbackText.length > 0
      ? fallbackText.slice(0, 1800)
      : 'Imported HTML did not expose positioned layers. Continue editing this block or adjust source markup.'

  const fallbackComponent: SlideComponent = {
    id: `fallback-import-${Date.now().toString(36)}`,
    type: 'text',
    x: 72,
    y: 72,
    width: Math.max(360, canvasWidth - 144),
    height: Math.max(180, canvasHeight - 144),
    content: `<h2>Import Fallback Layer</h2><p>${summary}</p>`,
    sourceLabel: 'Fallback import',
    style: {
      fontSize: 24,
      lineHeight: 34,
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--color-bg-card)',
      textAlign: 'left',
    },
    visible: true,
    locked: false,
  }

  return {
    ...parsed,
    components: [fallbackComponent],
    warnings: [
      ...parsed.warnings,
      'Import completed with a simplified editable layer because the source markup did not include enough positioned nodes.',
    ],
  }
}

export function useSlidesEditorPersistence({
  actor,
  workspaceTab,
  parseAbortRef,
  pendingImportWarningsRef,
  result,
  rawHtmlLength,
  slideTitle,
  activeSlideId,
  activeDocumentSlideId,
  activeRevision,
  saveStatus,
  autosaveEnabled,
  autosaveRetryState,
  autosaveDelayMs,
  autosaveRetryBaseDelayMs,
  autosaveRetryMaxDelayMs,
  autosaveRetryMaxAttempts,
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
  getErrorSummary,
  isAutosaveRetryableError,
}: UseSlidesEditorPersistenceOptions): UseSlidesEditorPersistenceResult {
  const queueAutosaveRetry = useCallback((errorMessage: string, attempt: number) => {
    const delayMs = Math.min(
      autosaveRetryMaxDelayMs,
      autosaveRetryBaseDelayMs * (2 ** (attempt - 1)),
    )
    const retryInSeconds = Math.max(1, Math.ceil(delayMs / 1000))
    setAutosaveRetryState({
      attempt,
      delayMs,
      nextAttemptAt: Date.now() + delayMs,
      lastError: errorMessage,
    })
    setSaveStatus('queued')
    setSaveError(`Autosave failed (${errorMessage}). Retrying in ${retryInSeconds}s.`)
  }, [activeSlideId, actor, autosaveRetryBaseDelayMs, autosaveRetryMaxDelayMs, setAutosaveRetryState, setSaveError, setSaveStatus, workspaceTab])

  const scheduleAutosaveRetryNow = useCallback(() => {
    setAutosaveRetryState((previous) => {
      if (!previous) return null
      return {
        ...previous,
        nextAttemptAt: Date.now(),
      }
    })
  }, [setAutosaveRetryState])

  const dismissAutosaveRetry = useCallback(() => {
    setAutosaveRetryState(null)
    setSaveError(null)
    setSaveStatus(result ? 'dirty' : 'clean')
  }, [result, setAutosaveRetryState, setSaveError, setSaveStatus])

  const clearDegradedMode = useCallback(() => {
    setDegradedState(null)
  }, [setDegradedState])

  const parseHtmlSync = useCallback(async (html: string): Promise<SlideImportResult> => {
    const pendingWarnings = pendingImportWarningsRef.current
    pendingImportWarningsRef.current = []

    const preflight = validateHtmlImportInput(html)
    if (preflight) {
      setImportError(preflight)
      setParseStatus('failed')
      setParseMessage(preflight.message)
      throw new Error(preflight.message)
    }

    const parsed = await convertHtmlToSlideComponents(html)
    const parsedValidation = validateParsedResult(parsed)
    const normalizedParsed =
      parsedValidation?.code === 'unsupported_layout'
        ? buildFallbackImportResult(html, parsed)
        : parsed
    if (parsedValidation && parsedValidation.code !== 'unsupported_layout') {
      setImportError(parsedValidation)
      setParseStatus('failed')
      setParseMessage(parsedValidation.message)
      throw new Error(parsedValidation.message)
    }

    const mergedWarnings = pendingWarnings.length > 0
      ? Array.from(new Set([...pendingWarnings, ...normalizedParsed.warnings]))
      : normalizedParsed.warnings
    const parsedResult = mergedWarnings === normalizedParsed.warnings
      ? normalizedParsed
      : {
          ...normalizedParsed,
          warnings: mergedWarnings,
        }

    const firstVisibleComponentId =
      parsedResult.components.find((component) => component.visible !== false)?.id || null

    setResult(parsedResult)
    setSelectedComponentIds(firstVisibleComponentId ? [firstVisibleComponentId] : [])
    setEditingComponentId(null)
    setDraggingComponentId(null)
    setResizingComponentId(null)
    clearHistory()
    setEditorNotice(null)
    setImportError(null)
    setParseStatus('completed')
    setParseProgress(100)
    setParseMessage(`Parsed ${parsedResult.components.length} components.`)
    if (parsedValidation?.code === 'unsupported_layout') {
      setEditorNotice({
        tone: 'info',
        text: 'Imported file used a non-positioned layout. Added an editable layer so you can continue immediately.',
      })
    }
    setExportHtml('')
    setDirty()
    return parsedResult
  }, [
    clearHistory,
    pendingImportWarningsRef,
    setDirty,
    setEditingComponentId,
    setEditorNotice,
    setExportHtml,
    setImportError,
    setParseMessage,
    setParseProgress,
    setParseStatus,
    setResizingComponentId,
    setResult,
    setSelectedComponentIds,
    setDraggingComponentId,
  ])

  const runParseWithProgress = useCallback(async (html: string, source: SlidesImportSource = 'pasted') => {
    const correlationId = `slides-import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    const parseStartedAt = new Date().toISOString()
    const parseStartedAtMs = Date.now()
    const preflight = validateHtmlImportInput(html)
    if (preflight) {
      setImportError(preflight)
      setParseStatus('failed')
      setParseProgress(0)
      setParseMessage(preflight.message)
      setImportDiagnostics((previous) => ({
        ...previous,
        rawHtmlChars: html.length,
        lastStartedAt: parseStartedAt,
        lastCompletedAt: new Date().toISOString(),
        lastDurationMs: Date.now() - parseStartedAtMs,
        lastOutcome: 'failed',
        lastComponentCount: 0,
        lastWarningCount: 0,
        lastErrorCode: preflight.code,
        lastErrorMessage: preflight.message,
      }))
      return
    }

    const controller = new AbortController()
    parseAbortRef.current = controller
    setImportError(null)
    setParseStatus('parsing')
    setParseProgress(5)
    setParseMessage('Validating input…')
    setImportDiagnostics((previous) => ({
      ...previous,
      rawHtmlChars: html.length,
      lastStartedAt: parseStartedAt,
      lastCompletedAt: null,
      lastDurationMs: null,
      lastOutcome: 'idle',
      lastErrorCode: null,
      lastErrorMessage: null,
    }))

    try {
      await delay(100)
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      setParseProgress(35)
      setParseMessage('Parsing slide HTML…')

      await delay(120)
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      setParseProgress(70)
      setParseMessage('Normalizing components…')

      await delay(120)
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      const parsed = await parseHtmlSync(html)
      setParseProgress(100)
      setParseMessage('Parse complete.')
      const warningCount = parsed.warnings.length
      const fallbackWarningCount = parsed.warnings.filter((warning) => /fallback/i.test(String(warning))).length
      setImportDiagnostics((previous) => ({
        ...previous,
        lastCompletedAt: new Date().toISOString(),
        lastDurationMs: Date.now() - parseStartedAtMs,
        lastOutcome: 'success',
        lastComponentCount: parsed.components.length,
        lastWarningCount: warningCount,
        lastErrorCode: null,
        lastErrorMessage: null,
      }))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setParseStatus('canceled')
        setParseProgress(0)
        setParseMessage('Import canceled.')
        setImportDiagnostics((previous) => ({
          ...previous,
          lastCompletedAt: new Date().toISOString(),
          lastDurationMs: Date.now() - parseStartedAtMs,
          lastOutcome: 'canceled',
          lastErrorCode: 'canceled',
          lastErrorMessage: 'Import canceled by user.',
        }))
        return
      }

      const failure = classifyImportError(error)
      setImportError(failure)
      setParseStatus('failed')
      setParseProgress(0)
      setParseMessage(failure.message)
      setImportDiagnostics((previous) => ({
        ...previous,
        lastCompletedAt: new Date().toISOString(),
        lastDurationMs: Date.now() - parseStartedAtMs,
        lastOutcome: 'failed',
        lastComponentCount: 0,
        lastWarningCount: 0,
        lastErrorCode: failure.code,
        lastErrorMessage: failure.message,
      }))
    } finally {
      parseAbortRef.current = null
    }
  }, [actor, parseAbortRef, parseHtmlSync, setImportDiagnostics, setImportError, setParseMessage, setParseProgress, setParseStatus])

  const cancelParse = useCallback(() => {
    parseAbortRef.current?.abort()
  }, [parseAbortRef])

  const handleSave = useCallback(async (options?: SaveOptions) => {
    if (!result) {
      setSaveStatus('error')
      setSaveError('Parse HTML before saving a slide.')
      return null
    }

    if (!options?.autosave) {
      setAutosaveRetryState(null)
    }

    setSaveStatus('saving')
    setSaveError(null)

    try {
      const titleToPersist = options?.titleOverride?.trim() || slideTitle.trim() || 'Untitled Slide'
      const normalizedComponents = normalizeComponentsForPersistence(result.components)
      const response = await saveSlide(actor, {
        id: activeSlideId || undefined,
        title: titleToPersist,
        canvas: result.canvas,
        components: normalizedComponents,
        document: syncSlideDocument({
          document: result.document,
          canvas: result.canvas,
          components: normalizedComponents,
          warnings: result.warnings,
          slideId: activeDocumentSlideId || activeSlideId || undefined,
        }),
        metadata: {
          warning_count: result.warnings.length,
          warnings: result.warnings,
          raw_html_length: rawHtmlLength,
          active_document_slide_id: activeDocumentSlideId || activeSlideId,
        },
        revision: activeRevision,
        autosave: options?.autosave === true,
        overwrite: options?.overwrite === true,
      })

      setActiveSlideId(response.slide.id)
      setActiveRevision(response.slide.revision)
      setSlideTitle(response.slide.title)
      setLastSavedAt(response.slide.updated_at)
      setSaveStatus('saved')
      setAutosaveRetryState(null)
      setConflictServerSlide(null)
      setSaveError(null)
      setDegradedState(null)

      await refreshLibraryData()
      return response.slide
    } catch (error) {
      if (error instanceof SlideConflictError) {
        setSaveStatus('conflict')
        setAutosaveRetryState(null)
        setConflictServerSlide(error.serverSlide)
        setSaveError('Save conflict: newer revision exists. Reload, overwrite, or save as copy.')
        return null
      }

      if (options?.autosave) {
        const summary = getErrorSummary(error)
        const nextAttempt = (autosaveRetryState?.attempt || 0) + 1
        if (isAutosaveRetryableError(error) && nextAttempt <= autosaveRetryMaxAttempts) {
          queueAutosaveRetry(summary.message, nextAttempt)
          return null
        }

        const retryExhausted = nextAttempt > autosaveRetryMaxAttempts
        const baseMessage = retryExhausted
          ? `Autosave paused after ${autosaveRetryMaxAttempts} failed attempts.`
          : 'Autosave stopped due to a terminal save error.'
        const recoveryMessage = `${baseMessage} Draft mode is active until Slides service recovers.`
        setAutosaveEnabled(false)
        setAutosaveRetryState(null)
        setSaveStatus('error')
        setSaveError(`${recoveryMessage} ${summary.message}`)
        setDegradedState({
          mode: 'local-draft',
          message: recoveryMessage,
          correlationId: summary.correlationId,
          rayId: summary.rayId,
          endpoint: summary.endpoint,
        })
        return null
      }

      setSaveStatus('error')
      const summary = getErrorSummary(error)
      setSaveError(summary.message)
      return null
    }
  }, [
    activeDocumentSlideId,
    activeRevision,
    activeSlideId,
    actor,
    autosaveRetryMaxAttempts,
    autosaveRetryState,
    getErrorSummary,
    isAutosaveRetryableError,
    normalizeComponentsForPersistence,
    queueAutosaveRetry,
    rawHtmlLength,
    refreshLibraryData,
    result,
    setActiveRevision,
    setActiveSlideId,
    setAutosaveEnabled,
    setAutosaveRetryState,
    setConflictServerSlide,
    setDegradedState,
    setLastSavedAt,
    setSaveError,
    setSaveStatus,
    setSlideTitle,
    slideTitle,
  ])

  const retrySlidesService = useCallback(async () => {
    setLibraryError(null)
    setSaveError(null)
    setAutosaveRetryState(null)
    setAutosaveEnabled(true)
    setDegradedState(null)
    await refreshLibraryData()
    if (result && (saveStatus === 'dirty' || saveStatus === 'queued' || saveStatus === 'error' || saveStatus === 'conflict')) {
      await handleSave({ autosave: true })
    }
  }, [
    handleSave,
    refreshLibraryData,
    result,
    saveStatus,
    setAutosaveEnabled,
    setAutosaveRetryState,
    setDegradedState,
    setLibraryError,
    setSaveError,
  ])

  useEffect(() => {
    if (!autosaveEnabled || saveStatus !== 'dirty' || !result) return
    const timer = window.setTimeout(() => {
      void handleSave({ autosave: true })
    }, autosaveDelayMs)
    return () => window.clearTimeout(timer)
  }, [autosaveDelayMs, autosaveEnabled, handleSave, result, saveStatus])

  useEffect(() => {
    if (!autosaveEnabled || !autosaveRetryState || !result) return
    const waitMs = Math.max(0, autosaveRetryState.nextAttemptAt - Date.now())
    const timer = window.setTimeout(() => {
      void handleSave({ autosave: true })
    }, waitMs)
    return () => window.clearTimeout(timer)
  }, [autosaveEnabled, autosaveRetryState, handleSave, result])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOnline = () => {
      if (!autosaveRetryState) return
      setAutosaveRetryState((previous) => {
        if (!previous) return null
        return {
          ...previous,
          nextAttemptAt: Date.now() + 250,
        }
      })
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [autosaveRetryState, setAutosaveRetryState])

  return {
    parseHtmlSync,
    runParseWithProgress,
    cancelParse,
    handleSave,
    retrySlidesService,
    scheduleAutosaveRetryNow,
    dismissAutosaveRetry,
    clearDegradedMode,
  }
}
