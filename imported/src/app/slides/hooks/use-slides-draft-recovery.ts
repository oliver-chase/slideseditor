import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { syncSlideDocument } from '@/components/slides/document'
import type { SlideActor } from '@/components/slides/persistence-types'
import type { SlideDocument, SlideImportResult } from '@/components/slides/types'

const MAX_DRAFT_RECOVERY_BYTES = 1_500_000
const MAX_DRAFT_RECOVERY_RAW_HTML_CHARS = 120_000

interface CanvasEditorNotice {
  tone: 'info' | 'error'
  text: string
}

type SaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'queued' | 'error' | 'conflict'

export interface DraftSnapshot {
  rawHtml: string
  title: string
  activeSlideId: string | null
  activeDocumentSlideId: string | null
  revision: number
  result: SlideImportResult | null
  document: SlideDocument | null
  createdAt: string
}

interface UseSlidesDraftRecoveryOptions {
  actor: SlideActor
  workspaceTab: 'import' | 'my-slides' | 'templates'
  draftRecoveryKey: string
  hasUnsavedChanges: boolean
  saveStatus: SaveStatus
  rawHtml: string
  slideTitle: string
  activeSlideId: string | null
  activeDocumentSlideId: string | null
  activeRevision: number
  result: SlideImportResult | null
  clearHistory: () => void
  setRawHtml: Dispatch<SetStateAction<string>>
  setSlideTitle: Dispatch<SetStateAction<string>>
  setActiveSlideId: Dispatch<SetStateAction<string | null>>
  setActiveDocumentSlideId: Dispatch<SetStateAction<string | null>>
  setActiveRevision: Dispatch<SetStateAction<number>>
  setResult: Dispatch<SetStateAction<SlideImportResult | null>>
  setSelectedComponentIds: Dispatch<SetStateAction<string[]>>
  setEditingComponentId: Dispatch<SetStateAction<string | null>>
  setDraggingComponentId: Dispatch<SetStateAction<string | null>>
  setResizingComponentId: Dispatch<SetStateAction<string | null>>
  setEditorNotice: Dispatch<SetStateAction<CanvasEditorNotice | null>>
  setAutosaveRetryState: Dispatch<SetStateAction<{
    attempt: number
    delayMs: number
    nextAttemptAt: number
    lastError: string
  } | null>>
  setSaveError: Dispatch<SetStateAction<string | null>>
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>
  canvasDragRef: MutableRefObject<{ pointerId: number } | null>
  canvasResizeRef: MutableRefObject<{ pointerId: number } | null>
  canvasDragMovedRef: MutableRefObject<boolean>
  canvasResizeMovedRef: MutableRefObject<boolean>
}

interface UseSlidesDraftRecoveryResult {
  recoveryDraft: DraftSnapshot | null
  restoreDraft: () => void
  discardDraft: () => void
}

export function useSlidesDraftRecovery({
  actor,
  workspaceTab,
  draftRecoveryKey,
  hasUnsavedChanges,
  saveStatus: draftSaveStatus,
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
}: UseSlidesDraftRecoveryOptions): UseSlidesDraftRecoveryResult {
  const [recoveryDraft, setRecoveryDraft] = useState<DraftSnapshot | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const raw = window.localStorage.getItem(draftRecoveryKey)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as DraftSnapshot
      if (!parsed || typeof parsed !== 'object') return
      setRecoveryDraft(parsed)
    } catch {
      window.localStorage.removeItem(draftRecoveryKey)
    }
  }, [draftRecoveryKey])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!hasUnsavedChanges) {
      window.localStorage.removeItem(draftRecoveryKey)
      return
    }

    const snapshotRawHtml = rawHtml.length > MAX_DRAFT_RECOVERY_RAW_HTML_CHARS
      ? ''
      : rawHtml
    const snapshot: DraftSnapshot = {
      rawHtml: snapshotRawHtml,
      title: slideTitle,
      activeSlideId,
      activeDocumentSlideId,
      revision: activeRevision,
      result,
      document: result
        ? syncSlideDocument({
            document: result.document,
            canvas: result.canvas,
            components: result.components,
            warnings: result.warnings,
            slideId: activeDocumentSlideId || activeSlideId || undefined,
          })
        : null,
      createdAt: new Date().toISOString(),
    }
    try {
      const serialized = JSON.stringify(snapshot)
      if (serialized.length > MAX_DRAFT_RECOVERY_BYTES) {
        window.localStorage.removeItem(draftRecoveryKey)
        return
      }
      window.localStorage.setItem(draftRecoveryKey, serialized)
    } catch {
      window.localStorage.removeItem(draftRecoveryKey)
    }
  }, [activeDocumentSlideId, activeRevision, activeSlideId, draftRecoveryKey, hasUnsavedChanges, rawHtml, result, slideTitle])

  const restoreDraft = useCallback(() => {
    if (!recoveryDraft) return
    setRawHtml(recoveryDraft.rawHtml)
    setSlideTitle(recoveryDraft.title || 'Recovered Slide')
    setActiveSlideId(recoveryDraft.activeSlideId)
    setActiveDocumentSlideId(recoveryDraft.activeDocumentSlideId || recoveryDraft.activeSlideId)
    setActiveRevision(recoveryDraft.revision || 0)
    setResult(recoveryDraft.result
      ? {
          ...recoveryDraft.result,
          document: recoveryDraft.document || syncSlideDocument({
            document: recoveryDraft.result.document,
            canvas: recoveryDraft.result.canvas,
            components: recoveryDraft.result.components,
            warnings: recoveryDraft.result.warnings,
            slideId: recoveryDraft.activeDocumentSlideId || recoveryDraft.activeSlideId || undefined,
          }),
        }
      : null)
    setSelectedComponentIds([])
    setEditingComponentId(null)
    setDraggingComponentId(null)
    setResizingComponentId(null)
    canvasDragRef.current = null
    canvasResizeRef.current = null
    canvasDragMovedRef.current = false
    canvasResizeMovedRef.current = false
    clearHistory()
    setEditorNotice(null)
    setAutosaveRetryState(null)
    setSaveError(null)
    setSaveStatus('dirty')
    setRecoveryDraft(null)
  }, [
    canvasDragMovedRef,
    canvasDragRef,
    canvasResizeMovedRef,
    canvasResizeRef,
    clearHistory,
    recoveryDraft,
    setActiveRevision,
    setActiveSlideId,
    setActiveDocumentSlideId,
    setAutosaveRetryState,
    setDraggingComponentId,
    setEditingComponentId,
    setEditorNotice,
    setRawHtml,
    setRecoveryDraft,
    setResizingComponentId,
    setResult,
    setSaveError,
    setSaveStatus,
    setSelectedComponentIds,
    setSlideTitle,
  ])

  const discardDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftRecoveryKey)
    }
    setRecoveryDraft(null)
  }, [activeSlideId, actor, draftRecoveryKey, recoveryDraft, draftSaveStatus, workspaceTab])

  return {
    recoveryDraft,
    restoreDraft,
    discardDraft,
  }
}
