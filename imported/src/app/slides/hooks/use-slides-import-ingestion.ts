import { useCallback } from 'react'
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'
import type { SlideImportFailure } from '@/components/slides/import-validation'
import type { SlidesImportDiagnostics } from '@/app/slides/hooks/use-slides-editor-persistence'
import { classifyImportError, validateHtmlImportInput, validateImportFile } from '@/components/slides/import-validation'
import {
  inlineCompanionStylesheets,
  selectImportFiles,
} from '@/components/slides/import-file-bundle'

const RAW_HTML_EDITOR_PREVIEW_MAX_CHARS = 250_000
const IMPORT_WARNING_FILE_LIST_PREVIEW_LIMIT = 3

function formatFileListPreview(values: string[]): string {
  if (values.length === 0) return ''
  const trimmed = values.map((value) => value.trim()).filter(Boolean)
  if (trimmed.length === 0) return ''
  const listed = trimmed.slice(0, IMPORT_WARNING_FILE_LIST_PREVIEW_LIMIT)
  const remaining = Math.max(0, trimmed.length - listed.length)
  const joined = listed.join(', ')
  if (remaining > 0) {
    return `${joined} (+${remaining} more)`
  }
  return joined
}

interface UseSlidesImportIngestionOptions {
  fileInputRef: RefObject<HTMLInputElement | null>
  runParseWithProgress: (html: string, source?: SlidesImportDiagnostics['source']) => Promise<void>
  pendingImportWarningsRef: { current: string[] }
  setImportError: Dispatch<SetStateAction<SlideImportFailure | null>>
  setParseStatus: Dispatch<SetStateAction<'idle' | 'parsing' | 'completed' | 'canceled' | 'failed'>>
  setParseProgress: Dispatch<SetStateAction<number>>
  setParseMessage: Dispatch<SetStateAction<string>>
  setRawHtml: Dispatch<SetStateAction<string>>
  setImportDiagnostics: Dispatch<SetStateAction<SlidesImportDiagnostics>>
}

interface UseSlidesImportIngestionResult {
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  openFilePicker: () => void
}

export function useSlidesImportIngestion({
  fileInputRef,
  runParseWithProgress,
  pendingImportWarningsRef,
  setImportError,
  setParseStatus,
  setParseProgress,
  setParseMessage,
  setRawHtml,
  setImportDiagnostics,
}: UseSlidesImportIngestionOptions): UseSlidesImportIngestionResult {
  const onFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    try {
      const selectedFiles = Array.from(input.files || [])
      if (selectedFiles.length === 0) return

      const selection = selectImportFiles(selectedFiles)
      if (!selection.htmlFile) {
        const message = 'Select an .html file. Optional companion .css files can be selected together for higher-fidelity import.'
        setImportError({
          code: 'invalid_file_type',
          message,
        })
        setParseStatus('failed')
        setParseProgress(0)
        setParseMessage(message)
        return
      }
      const htmlFile = selection.htmlFile

      setImportDiagnostics((previous) => ({
        ...previous,
        source: 'file-picker',
        fileName: htmlFile.name,
        fileSizeBytes: htmlFile.size,
      }))

      const fileValidation = validateImportFile(htmlFile)
      if (fileValidation) {
        setImportError(fileValidation)
        setParseStatus('failed')
        setParseProgress(0)
        setParseMessage(fileValidation.message)
        return
      }

      const text = await htmlFile.text()
      if (!text.trim()) {
        const failure: SlideImportFailure = {
          code: 'empty_input',
          message: `Import file "${htmlFile.name}" is empty. Paste HTML or choose a non-empty file before parsing.`,
        }
        setImportError(failure)
        setParseStatus('failed')
        setParseProgress(0)
        setParseMessage(failure.message)
        setRawHtml('')
        return
      }
      const inlineResult = await inlineCompanionStylesheets(text, selection.cssFiles)
      const htmlLength = inlineResult.html.length
      if (htmlLength > RAW_HTML_EDITOR_PREVIEW_MAX_CHARS) {
        const truncated = inlineResult.html.slice(0, RAW_HTML_EDITOR_PREVIEW_MAX_CHARS)
        setRawHtml(
          `${truncated}\n\n<!-- Raw HTML preview truncated in editor (${htmlLength.toLocaleString()} chars). Parse uses full file contents. -->`,
        )
      } else {
        setRawHtml(inlineResult.html)
      }
      setImportError(null)
      setParseStatus('idle')
      setParseProgress(0)
      setParseMessage(`Loaded ${htmlFile.name}. Validating import…`)
      const contentValidation = validateHtmlImportInput(inlineResult.html)
      if (contentValidation) {
        setImportError(contentValidation)
        setParseStatus('failed')
        setParseProgress(0)
        setParseMessage(contentValidation.message)
        return
      }

      const importWarnings: string[] = []
      if (inlineResult.inlinedHrefs.length > 0) {
        importWarnings.push(
          `Inlined ${inlineResult.inlinedHrefs.length} companion stylesheet${inlineResult.inlinedHrefs.length === 1 ? '' : 's'} from selected files.`,
        )
      }
      if (inlineResult.unresolvedHrefs.length > 0) {
        const unresolvedPreview = formatFileListPreview(inlineResult.unresolvedHrefs)
        importWarnings.push(
          `Could not match ${inlineResult.unresolvedHrefs.length} linked stylesheet${inlineResult.unresolvedHrefs.length === 1 ? '' : 's'} to selected CSS files${unresolvedPreview ? ` (${unresolvedPreview})` : ''}.`,
        )
      }
      if (inlineResult.ignoredCssFiles.length > 0) {
        const ignoredPreview = formatFileListPreview(inlineResult.ignoredCssFiles)
        importWarnings.push(
          `Ignored ${inlineResult.ignoredCssFiles.length} oversized CSS companion file${inlineResult.ignoredCssFiles.length === 1 ? '' : 's'}${ignoredPreview ? ` (${ignoredPreview})` : ''}.`,
        )
      }
      if (htmlLength > RAW_HTML_EDITOR_PREVIEW_MAX_CHARS) {
        importWarnings.push(
          `Raw HTML editor preview was truncated for performance (${htmlLength.toLocaleString()} chars); parsing still used full file contents.`,
        )
      }

      pendingImportWarningsRef.current = importWarnings
      await runParseWithProgress(inlineResult.html, 'file-picker')
    } catch (error) {
      pendingImportWarningsRef.current = []
      const failure = classifyImportError(error)
      setImportError(failure)
      setParseStatus('failed')
      setParseProgress(0)
      setParseMessage(failure.message)
    } finally {
      input.value = ''
    }
  }, [
    pendingImportWarningsRef,
    runParseWithProgress,
    setImportDiagnostics,
    setImportError,
    setParseMessage,
    setParseProgress,
    setParseStatus,
    setRawHtml,
  ])

  const openFilePicker = useCallback(() => {
    const input = fileInputRef.current
    if (!input) return
    input.value = ''
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker()
        return
      }
    } catch {
      // Ignore and fallback to click; some browsers gate showPicker behind stricter policies.
    }
    input.click()
  }, [fileInputRef])

  return {
    onFileChange,
    openFilePicker,
  }
}
