import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { SlideActor } from '@/components/slides/persistence-types'

type WorkspaceTab = 'import' | 'my-slides' | 'templates'

function readHistoryIndex(state: unknown): number | null {
  if (!state || typeof state !== 'object') return null
  const candidate = (state as { idx?: unknown }).idx
  return typeof candidate === 'number' ? candidate : null
}

interface UseSlidesWorkspaceGuardOptions {
  actor: SlideActor
  hasUnsavedChanges: boolean
  workspaceTab: WorkspaceTab
  activeSlideId: string | null
  saveStatus: 'clean' | 'dirty' | 'saving' | 'saved' | 'queued' | 'error' | 'conflict'
  unsavedChangesConfirmText: string
  setWorkspaceTab: (nextTab: WorkspaceTab) => void
  requestNativeConfirmation: (message: string) => boolean
}

interface UseSlidesWorkspaceGuardResult {
  confirmDiscardUnsaved: () => boolean
  handleWorkspaceTabChange: (nextTab: WorkspaceTab) => boolean
  handleBackToHubClick: (event: ReactMouseEvent<HTMLAnchorElement>) => void
}

export function useSlidesWorkspaceGuard({
  actor,
  hasUnsavedChanges,
  workspaceTab,
  activeSlideId,
  saveStatus,
  unsavedChangesConfirmText,
  setWorkspaceTab,
  requestNativeConfirmation,
}: UseSlidesWorkspaceGuardOptions): UseSlidesWorkspaceGuardResult {
  const historyIndexRef = useRef<number | null>(null)
  const historyBounceRef = useRef(false)

  const confirmDiscardUnsaved = useCallback(() => {
    if (!hasUnsavedChanges) return true
    const approved = requestNativeConfirmation(unsavedChangesConfirmText)
    return approved
  }, [activeSlideId, actor, hasUnsavedChanges, requestNativeConfirmation, saveStatus, unsavedChangesConfirmText, workspaceTab])

  const handleWorkspaceTabChange = useCallback((nextTab: WorkspaceTab) => {
    if (nextTab === workspaceTab) return true
    if (!confirmDiscardUnsaved()) return false
    setWorkspaceTab(nextTab)
    return true
  }, [confirmDiscardUnsaved, setWorkspaceTab, workspaceTab])

  const handleBackToHubClick = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (confirmDiscardUnsaved()) return
    event.preventDefault()
  }, [confirmDiscardUnsaved])

  useEffect(() => {
    if (typeof window === 'undefined' || !hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [activeSlideId, actor, hasUnsavedChanges, saveStatus, workspaceTab])

  useEffect(() => {
    if (typeof window === 'undefined') return
    historyIndexRef.current = readHistoryIndex(window.history.state)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = (event: PopStateEvent) => {
      const nextIndex = readHistoryIndex(event.state)

      if (historyBounceRef.current) {
        historyBounceRef.current = false
        historyIndexRef.current = nextIndex
        return
      }

      if (!hasUnsavedChanges) {
        historyIndexRef.current = nextIndex
        return
      }

      const approved = requestNativeConfirmation(unsavedChangesConfirmText)
      if (approved) {
        historyIndexRef.current = nextIndex
        return
      }

      const previousIndex = historyIndexRef.current
      historyBounceRef.current = true

      if (previousIndex != null && nextIndex != null && nextIndex > previousIndex) {
        window.history.back()
        return
      }

      window.history.forward()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [activeSlideId, actor, hasUnsavedChanges, requestNativeConfirmation, saveStatus, unsavedChangesConfirmText, workspaceTab])

  return {
    confirmDiscardUnsaved,
    handleWorkspaceTabChange,
    handleBackToHubClick,
  }
}
