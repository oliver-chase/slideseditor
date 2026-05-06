import { useCallback } from 'react'

type SlidesAuditActionOptions = {
  refreshLibraryData: () => Promise<void>
}

export function useSlidesAuditActions({
  refreshLibraryData,
}: SlidesAuditActionOptions) {
  const handleRefreshSlidesAudit = useCallback(async () => {
    await refreshLibraryData()
  }, [refreshLibraryData])

  return {
    handleRefreshSlidesAudit,
  }
}
