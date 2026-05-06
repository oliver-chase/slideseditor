import { MAX_IMPORT_FILE_SIZE_BYTES } from '@/components/slides/import-validation'

const STYLESHEET_LINK_SELECTOR = 'link[rel~="stylesheet"][href]'

function isHtmlImportFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return name.endsWith('.html') || name.endsWith('.htm') || type.includes('text/html')
}

function isCssImportFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return name.endsWith('.css') || type.includes('text/css')
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function stylesheetLookupKey(rawHref: string): string {
  const normalized = rawHref.trim().replace(/\\/g, '/')
  const withoutHash = normalized.split('#')[0]
  const withoutQuery = withoutHash.split('?')[0]
  const parts = withoutQuery.split('/').filter(Boolean)
  const tail = parts[parts.length - 1] || withoutQuery
  return decodeSafe(tail).trim().toLowerCase()
}

function isRemoteStylesheetHref(rawHref: string): boolean {
  const value = rawHref.trim().toLowerCase()
  return value.startsWith('http://')
    || value.startsWith('https://')
    || value.startsWith('//')
    || value.startsWith('data:')
    || value.startsWith('blob:')
}

export interface SlideImportFileSelection {
  htmlFile: File | null
  cssFiles: File[]
}

export interface CompanionStylesheetInlineResult {
  html: string
  inlinedHrefs: string[]
  unresolvedHrefs: string[]
  ignoredCssFiles: string[]
}

export function selectImportFiles(files: File[]): SlideImportFileSelection {
  const htmlFile = files.find((file) => isHtmlImportFile(file)) || null
  const cssFiles = files.filter((file) => file !== htmlFile && isCssImportFile(file))
  return {
    htmlFile,
    cssFiles,
  }
}

export async function inlineCompanionStylesheets(
  html: string,
  cssFiles: File[],
): Promise<CompanionStylesheetInlineResult> {
  if (!cssFiles.length) {
    return {
      html,
      inlinedHrefs: [],
      unresolvedHrefs: [],
      ignoredCssFiles: [],
    }
  }

  const ignoredCssFiles: string[] = []
  const cssByName = new Map<string, string>()
  const loadableCssFiles = cssFiles.filter((file) => {
    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      ignoredCssFiles.push(file.name)
      return false
    }
    return true
  })

  for (const file of loadableCssFiles) {
    cssByName.set(file.name.toLowerCase(), await file.text())
  }

  if (cssByName.size === 0) {
    return {
      html,
      inlinedHrefs: [],
      unresolvedHrefs: [],
      ignoredCssFiles,
    }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const inlinedHrefs: string[] = []
  const unresolvedHrefs: string[] = []
  let hasChanges = false

  for (const link of Array.from(doc.querySelectorAll<HTMLLinkElement>(STYLESHEET_LINK_SELECTOR))) {
    const href = (link.getAttribute('href') || '').trim()
    if (!href || isRemoteStylesheetHref(href)) continue

    const lookupKey = stylesheetLookupKey(href)
    if (!lookupKey) continue

    const cssText = cssByName.get(lookupKey)
    if (!cssText) {
      unresolvedHrefs.push(href)
      continue
    }

    const styleElement = doc.createElement('style')
    styleElement.setAttribute('data-import-companion-href', href)
    styleElement.textContent = cssText
    link.replaceWith(styleElement)
    inlinedHrefs.push(href)
    hasChanges = true
  }

  return {
    html: hasChanges ? (doc.documentElement?.outerHTML || html) : html,
    inlinedHrefs: Array.from(new Set(inlinedHrefs)),
    unresolvedHrefs: Array.from(new Set(unresolvedHrefs)),
    ignoredCssFiles: Array.from(new Set(ignoredCssFiles)),
  }
}
