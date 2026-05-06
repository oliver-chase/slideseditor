import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  SlideRecord,
  SlideTemplateRecord,
} from '@/components/slides/persistence-types'
import {
  listSlides,
  listTemplates,
} from '@/lib/slides'

type SlidesActor = {
  user_id: string
  user_email?: string
  email?: string
  role?: string
}

type UseSlidesLibraryDataOptions = {
  allowRender: boolean
  actor: SlidesActor
  searchValue: string
  setSlides: Dispatch<SetStateAction<SlideRecord[]>>
  setTemplates: Dispatch<SetStateAction<SlideTemplateRecord[]>>
  setLibraryLoading: Dispatch<SetStateAction<boolean>>
  setLibraryError: Dispatch<SetStateAction<string | null>>
}

export function useSlidesLibraryData({
  allowRender,
  actor,
  searchValue,
  setSlides,
  setTemplates,
  setLibraryLoading,
  setLibraryError,
}: UseSlidesLibraryDataOptions) {
  const requestSequenceRef = useRef(0)

  const refreshLibraryData = useCallback(async () => {
    if (!allowRender) return

    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId

    setLibraryLoading(true)
    setLibraryError(null)

    try {
      const [slidesResult, templatesResult] = await Promise.allSettled([
        listSlides(actor, searchValue),
        listTemplates(actor, searchValue),
      ])

      if (requestId !== requestSequenceRef.current) return

      if (slidesResult.status === 'fulfilled') {
        setSlides(slidesResult.value)
      } else {
        setSlides([])
      }

      if (templatesResult.status === 'fulfilled') {
        setTemplates(templatesResult.value)
      } else {
        setTemplates([])
      }

      const rejected = [slidesResult, templatesResult].find((result) => result.status === 'rejected')
      if (rejected && rejected.status === 'rejected') {
        setLibraryError(rejected.reason instanceof Error ? rejected.reason.message : String(rejected.reason))
      }
    } catch (error) {
      if (requestId !== requestSequenceRef.current) return
      setLibraryError(error instanceof Error ? error.message : String(error))
      setSlides([])
      setTemplates([])
    } finally {
      if (requestId === requestSequenceRef.current) {
        setLibraryLoading(false)
      }
    }
  }, [
    actor,
    allowRender,
    searchValue,
    setLibraryError,
    setLibraryLoading,
    setSlides,
    setTemplates,
  ])

  useEffect(() => {
    void refreshLibraryData()
  }, [refreshLibraryData])

  return { refreshLibraryData }
}
