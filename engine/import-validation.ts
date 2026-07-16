import type { SlideImportResult } from './types'

export const MAX_IMPORT_FILE_SIZE_BYTES = 50_000_000

export type SlideImportFailureCode =
  | 'invalid_file_type'
  | 'file_too_large'
  | 'empty_input'
  | 'invalid_markup'
  | 'unsupported_layout'
  | 'generic_failure'

export interface SlideImportFailure {
  code: SlideImportFailureCode
  message: string
}

export function validateImportFile(file: File): SlideImportFailure | null {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  const looksHtml = name.endsWith('.html') || name.endsWith('.htm') || type.includes('text/html')

  if (!looksHtml) {
    return {
      code: 'invalid_file_type',
      message: 'Only .html and .htm files are supported for slide import.',
    }
  }

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    const maxSizeMb = Math.floor(MAX_IMPORT_FILE_SIZE_BYTES / 1_000_000)
    return {
      code: 'file_too_large',
      message: `Import file is too large. Maximum supported size is ${maxSizeMb} MB.`,
    }
  }

  return null
}

export function validateHtmlImportInput(html: string): SlideImportFailure | null {
  const trimmed = html.trim()
  if (!trimmed) {
    return {
      code: 'empty_input',
      message: 'HTML input is empty. Paste HTML or choose a file before parsing.',
    }
  }

  if (!/<[a-z][^>]*>/i.test(trimmed)) {
    return {
      code: 'invalid_markup',
      message: 'Input does not appear to contain valid HTML markup.',
    }
  }

  return null
}

export function validatePastedHtml(html: string): SlideImportFailure | null {
  return validateHtmlImportInput(html)
}

export function validateParsedResult(result: SlideImportResult): SlideImportFailure | null {
  if (result.components.length === 0) {
    return {
      code: 'unsupported_layout',
      message: 'No supported slide components were detected. Ensure elements are absolutely positioned with left/top coordinates.',
    }
  }
  return null
}

export function classifyImportError(error: unknown): SlideImportFailure {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      code: 'generic_failure',
      message: 'Import was canceled before parse completion.',
    }
  }

  const raw = error instanceof Error ? error.message : String(error)
  const message = raw.toLowerCase()

  if (message.includes('markup') || message.includes('html')) {
    return {
      code: 'invalid_markup',
      message: raw,
    }
  }

  if (message.includes('unsupported') || message.includes('slide root') || message.includes('positioned')) {
    return {
      code: 'unsupported_layout',
      message: raw,
    }
  }

  return {
    code: 'generic_failure',
    message: raw || 'Unexpected parser error.',
  }
}
