import { useMemo } from 'react'

type SlidesAuditStateOptions = {
  libraryLoading: boolean
  libraryError: string | null
  saveStatus: string
  saveError: string | null
  lastSavedAt: string | null
  degradedMode: boolean
}

export function useSlidesAuditState({
  libraryLoading,
  libraryError,
  saveStatus,
  saveError,
  lastSavedAt,
  degradedMode,
}: SlidesAuditStateOptions) {
  return useMemo(() => {
    const hasError = Boolean(libraryError || saveError)
    const isSyncing = libraryLoading || saveStatus === 'saving' || saveStatus === 'queued'

    const slidesSyncState: 'syncing' | 'error' | 'ok' = hasError
      ? 'error'
      : isSyncing
        ? 'syncing'
        : 'ok'

    const slidesSyncLabel = slidesSyncState === 'error'
      ? (libraryError || saveError || 'Slides sync needs attention.')
      : slidesSyncState === 'syncing'
        ? 'Syncing Slides…'
        : lastSavedAt
          ? `Slides synced ${new Date(lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : degradedMode
            ? 'Slides running in local draft mode'
            : 'Slides synced'

    return {
      slidesSyncState,
      slidesSyncLabel,
      slidesSyncActionLabel: slidesSyncState === 'error' ? 'Retry' : 'Refresh',
    }
  }, [degradedMode, lastSavedAt, libraryError, libraryLoading, saveError, saveStatus])
}
