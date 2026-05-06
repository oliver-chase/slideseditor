import { useCallback, useState } from 'react'
import type {
  SlideActor,
  SlideRecord,
  SlideTemplateRecord,
} from '@/components/slides/persistence-types'
import {
  publishTemplateFromSlide,
  updateTemplate,
} from '@/lib/slides'

interface EditorNotice {
  tone: 'info' | 'error'
  text: string
}

interface TemplatePublishDraft {
  slideId: string
  name: string
  description: string
  isShared: boolean
}

type RemovedTemplateDraft = null

export interface UseSlidesTemplateGovernanceOptions {
  actor: SlideActor
  isSlidesAdmin: boolean
  refreshLibraryData: () => Promise<void>
  setLibraryError: (message: string | null) => void
  setEditorNotice: (notice: EditorNotice | null) => void
}

export interface UseSlidesTemplateGovernanceResult {
  templatePublishDraft: TemplatePublishDraft | null
  templateTransferDraft: RemovedTemplateDraft
  templateCollaboratorDraft: RemovedTemplateDraft
  templateCollaboratorPanelId: string | null
  templateQuickPreviewId: string | null
  templatePreviewRefreshAtById: Record<string, number>
  templatePreviewFingerprintById: Record<string, string>
  templateCollaboratorsByTemplate: Record<string, never[]>
  templatePublishBusy: boolean
  templateActionBusyId: string | null
  templateApprovalBusyId: string | null
  setTemplatePublishDraft: (draft: TemplatePublishDraft | null | ((previous: TemplatePublishDraft | null) => TemplatePublishDraft | null)) => void
  setTemplateTransferDraft: () => void
  setTemplateCollaboratorDraft: () => void
  setTemplateCollaboratorPanelId: () => void
  setTemplateQuickPreviewId: (value: string | null) => void
  setTemplatePreviewRefreshAtById: (value: Record<string, number> | ((previous: Record<string, number>) => Record<string, number>)) => void
  setTemplatePreviewFingerprintById: (value: Record<string, string> | ((previous: Record<string, string>) => Record<string, string>)) => void
  handleRefreshTemplatePreview: () => Promise<void>
  openPublishTemplateDraft: (slide: SlideRecord) => void
  closePublishTemplateDraft: () => void
  handlePublishTemplate: () => Promise<void>
  handleTemplateVisibilityToggle: (template: SlideTemplateRecord) => Promise<void>
  openTransferTemplateDraft: () => void
  closeTransferTemplateDraft: () => void
  toggleTemplateCollaboratorPanel: () => Promise<void>
  handleUpsertTemplateCollaborator: () => Promise<void>
  handleRemoveTemplateCollaborator: () => Promise<void>
  handleTransferTemplateOwnership: () => Promise<void>
  handleArchiveTemplate: () => Promise<boolean>
  handleRestoreTemplate: () => Promise<void>
  handlePermanentDeleteTemplate: () => Promise<void>
  handleResolveTemplateApproval: () => Promise<void>
  handleEscalateTemplateApproval: () => Promise<void>
  handleRunApprovalEscalationSweep: () => Promise<void>
}

export function useSlidesTemplateGovernance({
  actor,
  isSlidesAdmin,
  refreshLibraryData,
  setLibraryError,
  setEditorNotice,
}: UseSlidesTemplateGovernanceOptions): UseSlidesTemplateGovernanceResult {
  const [templatePublishDraft, setTemplatePublishDraft] = useState<TemplatePublishDraft | null>(null)
  const [templateQuickPreviewId, setTemplateQuickPreviewId] = useState<string | null>(null)
  const [templatePreviewRefreshAtById, setTemplatePreviewRefreshAtById] = useState<Record<string, number>>({})
  const [templatePreviewFingerprintById, setTemplatePreviewFingerprintById] = useState<Record<string, string>>({})
  const [templatePublishBusy, setTemplatePublishBusy] = useState(false)
  const [templateActionBusyId, setTemplateActionBusyId] = useState<string | null>(null)

  const openPublishTemplateDraft = useCallback((slide: SlideRecord) => {
    setTemplatePublishDraft({
      slideId: slide.id,
      name: `${slide.title || 'Untitled Slide'} Template`,
      description: typeof slide.metadata?.description === 'string' ? slide.metadata.description : 'Published from My Slides',
      isShared: false,
    })
  }, [])

  const closePublishTemplateDraft = useCallback(() => {
    setTemplatePublishDraft(null)
  }, [])

  const handlePublishTemplate = useCallback(async () => {
    if (!templatePublishDraft || templatePublishBusy) return

    const name = templatePublishDraft.name.trim()
    if (!name) {
      setLibraryError('Template name is required.')
      return
    }

    setTemplatePublishBusy(true)
    setLibraryError(null)

    try {
      await publishTemplateFromSlide(actor, templatePublishDraft.slideId, {
        name,
        description: templatePublishDraft.description.trim(),
        isShared: isSlidesAdmin ? templatePublishDraft.isShared : false,
      })
      setTemplatePublishDraft(null)
      await refreshLibraryData()
      setEditorNotice({
        tone: 'info',
        text: `Published "${name}" to the template library.`,
      })
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : String(error))
    } finally {
      setTemplatePublishBusy(false)
    }
  }, [actor, isSlidesAdmin, refreshLibraryData, setEditorNotice, setLibraryError, templatePublishBusy, templatePublishDraft])

  const handleTemplateVisibilityToggle = useCallback(async (template: SlideTemplateRecord) => {
    if (!isSlidesAdmin && template.owner_user_id !== actor.user_id) return
    if (templateActionBusyId === template.id) return

    setTemplateActionBusyId(template.id)
    setLibraryError(null)

    try {
      await updateTemplate(actor, template.id, {
        isShared: !template.is_shared,
      })
      await refreshLibraryData()
      setEditorNotice({
        tone: 'info',
        text: `"${template.name}" is now ${template.is_shared ? 'private' : 'shared'}.`,
      })
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : String(error))
    } finally {
      setTemplateActionBusyId(null)
    }
  }, [actor, isSlidesAdmin, refreshLibraryData, setEditorNotice, setLibraryError, templateActionBusyId])

  const unavailable = useCallback(async () => {
    setEditorNotice({
      tone: 'info',
      text: 'Template governance actions have been removed from this simplified library workflow.',
    })
  }, [setEditorNotice])

  return {
    templatePublishDraft,
    templateTransferDraft: null,
    templateCollaboratorDraft: null,
    templateCollaboratorPanelId: null,
    templateQuickPreviewId,
    templatePreviewRefreshAtById,
    templatePreviewFingerprintById,
    templateCollaboratorsByTemplate: {},
    templatePublishBusy,
    templateActionBusyId,
    templateApprovalBusyId: null,
    setTemplatePublishDraft,
    setTemplateTransferDraft: () => {},
    setTemplateCollaboratorDraft: () => {},
    setTemplateCollaboratorPanelId: () => {},
    setTemplateQuickPreviewId,
    setTemplatePreviewRefreshAtById,
    setTemplatePreviewFingerprintById,
    handleRefreshTemplatePreview: unavailable,
    openPublishTemplateDraft,
    closePublishTemplateDraft,
    handlePublishTemplate,
    handleTemplateVisibilityToggle,
    openTransferTemplateDraft: () => {},
    closeTransferTemplateDraft: () => {},
    toggleTemplateCollaboratorPanel: unavailable,
    handleUpsertTemplateCollaborator: unavailable,
    handleRemoveTemplateCollaborator: unavailable,
    handleTransferTemplateOwnership: unavailable,
    handleArchiveTemplate: async () => false,
    handleRestoreTemplate: unavailable,
    handlePermanentDeleteTemplate: unavailable,
    handleResolveTemplateApproval: unavailable,
    handleEscalateTemplateApproval: unavailable,
    handleRunApprovalEscalationSweep: unavailable,
  }
}
