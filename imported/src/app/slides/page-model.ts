import type { CSSProperties } from 'react'
import type {
  SlideComponent,
  SlideComponentType,
  SlideImportResult,
  SlideLayoutConstraint,
  SlideTheme,
} from '@/components/slides/types'
import type {
  SlideRecord,
  SlideTemplateRecord,
} from '@/components/slides/persistence-types'
import {
  SlideApiError,
  SlideConflictError,
} from '@/lib/slides'
import type { SlidesImportDiagnostics } from '@/app/slides/hooks/use-slides-editor-persistence'
import { getThemeColorCssVar, getThemeColorInputValue } from '@/lib/theme-tokens'

export const AUTOSAVE_DELAY_MS = 5000
export const AUTOSAVE_RETRY_BASE_DELAY_MS = 2000
export const AUTOSAVE_RETRY_MAX_DELAY_MS = 60000
export const AUTOSAVE_RETRY_MAX_ATTEMPTS = 5
export const DRAFT_RECOVERY_KEY_PREFIX = 'oliver-slide-draft-v2'
export const UNSAVED_CHANGES_CONFIRM_TEXT = 'You have unsaved slide changes. Discard them and continue?'

export type ParseStatus = 'idle' | 'parsing' | 'completed' | 'canceled' | 'failed'
export type SaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'queued' | 'error' | 'conflict'
export type WorkspaceTab = 'import' | 'my-slides' | 'templates'

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

export interface CanvasEditorNotice {
  tone: 'info' | 'error'
  text: string
}

export interface CanvasSnapGuides {
  x: number | null
  y: number | null
}

export interface RankedTemplateEntry {
  template: SlideTemplateRecord
  searchScore: number
  matchSignals: string[]
  pendingApprovals: number
  isBestMatch: boolean
  governanceStatus: TemplateGovernanceStatus
  tags: string[]
  collaboratorCount: number
}

export interface ArchivedTemplateUndoState {
  templateId: string
  templateName: string
  expiresAt: number
}

export type MySlidesItemType = 'slide' | 'deck'
export type MySlidesStatus = 'clean' | 'dirty' | 'queued' | 'error' | 'conflict'

export interface MySlidesRow {
  id: string
  itemType: MySlidesItemType
  title: string
  deckTitle: string | null
  owner: string
  visibility: string
  status: MySlidesStatus
  updatedAt: string
  tags: string[]
  slideIds: string[]
}

export const TEMPLATE_PREVIEW_COMPONENT_LIMIT = 10
export const TEMPLATE_LIBRARY_PREVIEW_SKELETON_COUNT = 4
export const TEMPLATE_ARCHIVE_UNDO_WINDOW_MS = 10_000
export type ThemeScope = 'slide' | 'deck'
export type TemplateGovernanceStatus = 'pending' | 'approved' | 'draft' | 'rejected'
export type TemplateLibraryTab = 'all' | 'pending' | 'approved' | 'draft' | 'rejected'
export type TemplateSortOption = 'updated-desc' | 'updated-asc' | 'title-asc' | 'title-desc'
export const DEFAULT_LAYOUT_CONSTRAINT: SlideLayoutConstraint = {
  type: 'stack',
  alignment: 'left',
  gap: 16,
  columns: 2,
}
export const EMPTY_IMPORT_DIAGNOSTICS: SlidesImportDiagnostics = {
  source: 'unknown',
  fileName: null,
  fileSizeBytes: null,
  rawHtmlChars: 0,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastDurationMs: null,
  lastOutcome: 'idle',
  lastComponentCount: null,
  lastWarningCount: null,
  lastErrorCode: null,
  lastErrorMessage: null,
}

export function buildDefaultSlidesTheme(): SlideTheme {
  return {
    fonts: {
      heading: 'Aptos Display, Arial, sans-serif',
      body: 'Aptos, Arial, sans-serif',
    },
    colors: {
      primary: getThemeColorInputValue('--color-text-primary'),
      secondary: getThemeColorInputValue('--color-text-secondary'),
      background: getThemeColorInputValue('--color-bg-page'),
      accent: getThemeColorInputValue('--color-brand-pink'),
    },
    spacingScale: {
      xs: 8,
      sm: 16,
      md: 24,
      lg: 32,
    },
  }
}

export function getTemplatePreviewFingerprint(template: SlideTemplateRecord): string {
  return [
    template.id,
    String(template.canvas?.width || 0),
    String(template.canvas?.height || 0),
    ...template.components
    .filter((component) => component.visible !== false)
    .map((component) => `${component.id}:${component.type}:${component.x}:${component.y}:${component.width}:${component.height}:${component.content || ''}`),
  ]
    .join('|')
}

export function getTemplateStructureSummary(template: SlideTemplateRecord): string {
  const lockedCount = template.locked_element_ids?.length ?? template.components.filter((component) => component.locked).length
  const editableCount = template.editable_zone_ids?.length ?? template.components.filter((component) => !component.locked && component.visible !== false).length
  const blockCount = template.layout_blocks?.length ?? template.components.filter((component) => component.visible !== false).length
  return `${lockedCount} locked · ${editableCount} editable zones · ${blockCount} blocks`
}

export function getTemplatePreviewScale(
  canvas: { width: number; height: number },
  maxWidth: number,
  maxHeight: number,
): number {
  const width = canvas.width > 0 ? canvas.width : 1
  const height = canvas.height > 0 ? canvas.height : 1
  return Math.min(maxWidth / width, maxHeight / height)
}

export function normalizeTemplateSearchText(value: string | null | undefined): string {
  return (value || '').toLowerCase().trim()
}

export function coerceTemplateTags(template: SlideTemplateRecord): string[] {
  const metadata = template.metadata || {}
  const value = metadata.tags
  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean)
  }
  return []
}

export function resolveTemplateGovernanceStatus(
  template: SlideTemplateRecord,
  pendingApprovals: number,
): TemplateGovernanceStatus {
  if (pendingApprovals > 0) return 'pending'
  const metadata = template.metadata || {}
  const directStatus = metadata.status
  const governanceStatus = metadata.governance_status
  const raw = (typeof directStatus === 'string' ? directStatus : (typeof governanceStatus === 'string' ? governanceStatus : '')).toLowerCase()
  if (raw === 'pending' || raw === 'pending-approval') return 'pending'
  if (raw === 'rejected') return 'rejected'
  if (raw === 'draft') return 'draft'
  if (raw === 'approved') return 'approved'
  return template.is_shared ? 'approved' : 'draft'
}

export function formatTemplateGovernanceStatus(status: TemplateGovernanceStatus): string {
  if (status === 'pending') return 'Pending Approval'
  if (status === 'approved') return 'Approved'
  if (status === 'draft') return 'Draft'
  return 'Rejected'
}

export function buildTemplateContentSearchCorpus(template: SlideTemplateRecord): string {
  return template.components
    .slice(0, 24)
    .map((component) => {
      const plainContent = (component.content || '').replace(/<[^>]+>/g, ' ')
      return [component.type, component.sourceLabel || '', plainContent].join(' ')
    })
    .join(' ')
    .toLowerCase()
}

export function rankTemplateForSearch(template: SlideTemplateRecord, query: string): {
  score: number
  matchSignals: string[]
} {
  const normalizedQuery = normalizeTemplateSearchText(query)
  if (!normalizedQuery) return { score: 0, matchSignals: [] }

  const name = normalizeTemplateSearchText(template.name)
  const description = normalizeTemplateSearchText(template.description)
  const owner = normalizeTemplateSearchText(template.owner_user_id)
  const contentCorpus = buildTemplateContentSearchCorpus(template)

  const signals = new Set<string>()
  let score = 0

  if (name === normalizedQuery) {
    score += 200
    signals.add('Exact Name')
  } else if (name.startsWith(normalizedQuery)) {
    score += 140
    signals.add('Name Prefix')
  } else if (name.includes(normalizedQuery)) {
    score += 110
    signals.add('Name')
  }

  if (description.includes(normalizedQuery)) {
    score += 80
    signals.add('Description')
  }

  if (owner.includes(normalizedQuery)) {
    score += 40
    signals.add('Owner')
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  let tokenHitCount = 0
  for (const token of tokens) {
    let tokenMatched = false
    if (name.includes(token)) {
      score += 24
      tokenMatched = true
      signals.add('Name')
    }
    if (description.includes(token)) {
      score += 14
      tokenMatched = true
      signals.add('Description')
    }
    if (owner.includes(token)) {
      score += 8
      tokenMatched = true
      signals.add('Owner')
    }
    if (contentCorpus.includes(token)) {
      score += 6
      tokenMatched = true
      signals.add('Content')
    }
    if (tokenMatched) tokenHitCount += 1
  }

  if (tokens.length > 1 && tokenHitCount === tokens.length) {
    score += 30
    signals.add('All Tokens')
  }

  return {
    score,
    matchSignals: Array.from(signals),
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'n/a'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return date.toLocaleString()
}

export function normalizeMySlidesStatus(status: unknown): MySlidesStatus {
  if (status === 'dirty' || status === 'queued' || status === 'error' || status === 'conflict') return status
  return 'clean'
}

export function formatMySlidesStatus(status: MySlidesStatus): string {
  if (status === 'clean') return 'Clean'
  if (status === 'dirty') return 'Dirty'
  if (status === 'queued') return 'Queued'
  if (status === 'error') return 'Error'
  if (status === 'conflict') return 'Conflict'
  return 'Clean'
}

export function isAutosaveRetryableError(error: unknown): boolean {
  if (error instanceof SlideConflictError) return false
  if (error instanceof SlideApiError) return error.retryable
  if (error instanceof TypeError) return true
  return true
}

export function getSlideErrorSummary(error: unknown): {
  message: string
  correlationId: string | null
  rayId: string | null
  endpoint: string
} {
  if (error instanceof SlideApiError) {
    return {
      message: error.message,
      correlationId: error.correlationId,
      rayId: error.rayId,
      endpoint: error.path || '/api/slides',
    }
  }
  return {
    message: error instanceof Error ? error.message : String(error),
    correlationId: null,
    rayId: null,
    endpoint: '/api/slides',
  }
}

export function summarizeWarnings(warnings: string[]) {
  const byMessage = new Map<string, number>()
  for (const warning of warnings) {
    byMessage.set(warning, (byMessage.get(warning) || 0) + 1)
  }

  const groups = new Map<string, Array<{ text: string; count: number }>>()
  for (const [text, count] of byMessage.entries()) {
    const lowered = text.toLowerCase()
    const group = lowered.includes('canvas')
      ? 'Canvas'
      : lowered.includes('transform')
        ? 'Transforms'
        : lowered.includes('unit')
          ? 'Units'
          : lowered.includes('left/top') || lowered.includes('position')
            ? 'Positioning'
            : 'General'

    const bucket = groups.get(group) || []
    bucket.push({ text, count })
    groups.set(group, bucket)
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

export const CANVAS_DEFAULT_WIDTH = 1920
export const CANVAS_DEFAULT_HEIGHT = 1080
export const CANVAS_SIZE_PRESETS = [
  { id: '16-9', label: '16:9', width: 1920, height: 1080 },
  { id: '4-3', label: '4:3', width: 1600, height: 1200 },
  { id: '1-1', label: '1:1', width: 1080, height: 1080 },
] as const
export const MIN_COMPONENT_WIDTH = 48
export const MIN_COMPONENT_HEIGHT = 32
export const MIN_TEXT_AUTOSIZE_HEIGHT = 40
export const MIN_FONT_SIZE = 14
export const SNAP_TOLERANCE_PX = 8
export const MAX_HISTORY_ENTRIES = 80
export const AUDIT_PAGE_SIZE = 20

export const EDITABLE_COMPONENT_TYPES = new Set<SlideComponentType>([
  'text',
  'heading',
  'subheading',
  'card',
  'row',
  'stat',
  'tag-line',
  'panel',
])

export function supportsTextAutoSize(component: SlideComponent): boolean {
  return EDITABLE_COMPONENT_TYPES.has(component.type)
}

export function measureTextAutoSizeHeight(component: SlideComponent, width: number): number {
  if (typeof document === 'undefined') {
    return Math.max(MIN_TEXT_AUTOSIZE_HEIGHT, component.height || MIN_COMPONENT_HEIGHT)
  }

  const measureNode = document.createElement('div')
  measureNode.style.position = 'absolute'
  measureNode.style.left = '-100000px'
  measureNode.style.top = '-100000px'
  measureNode.style.width = `${Math.max(MIN_COMPONENT_WIDTH, width)}px`
  measureNode.style.padding = '8px'
  measureNode.style.border = '0'
  measureNode.style.boxSizing = 'border-box'
  measureNode.style.visibility = 'hidden'
  measureNode.style.pointerEvents = 'none'
  measureNode.style.whiteSpace = 'normal'
  measureNode.style.wordBreak = 'break-word'
  measureNode.style.overflowWrap = 'anywhere'
  measureNode.style.backgroundColor = component.style.backgroundColor || getThemeColorCssVar('--color-bg-card')
  if (component.style.backgroundFill) {
    measureNode.style.background = component.style.backgroundFill
  }
  if (component.style.borderColor) measureNode.style.borderColor = component.style.borderColor
  if (component.style.borderStyle) measureNode.style.borderStyle = component.style.borderStyle
  if (typeof component.style.borderWidth === 'number' && component.style.borderWidth > 0) {
    measureNode.style.borderWidth = `${component.style.borderWidth}px`
    if (!component.style.borderStyle) measureNode.style.borderStyle = 'solid'
  }
  if (typeof component.style.borderRadius === 'number' && component.style.borderRadius > 0) {
    measureNode.style.borderRadius = `${component.style.borderRadius}px`
  }
  if (component.style.boxShadow) measureNode.style.boxShadow = component.style.boxShadow
  measureNode.style.color = component.style.color || getThemeColorCssVar('--color-text-primary')
  measureNode.style.fontSize = `${Math.max(MIN_FONT_SIZE, component.style.fontSize || MIN_FONT_SIZE)}px`
  measureNode.style.fontWeight = String(component.style.fontWeight || 400)
  if (component.style.fontFamily) measureNode.style.fontFamily = component.style.fontFamily
  measureNode.style.fontStyle = component.style.fontStyle || 'normal'
  measureNode.style.lineHeight = component.style.lineHeight
    ? `${component.style.lineHeight}px`
    : '1.35'
  measureNode.style.textAlign = component.style.textAlign || 'left'
  measureNode.innerHTML = sanitizeHtmlContent(component.content || '')

  document.body.appendChild(measureNode)
  const measuredHeight = Math.ceil(measureNode.scrollHeight)
  document.body.removeChild(measureNode)

  return Math.max(MIN_TEXT_AUTOSIZE_HEIGHT, measuredHeight)
}

export function sanitizeHtmlContent(content: string): string {
  return content
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, '')
    .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, '')
}

export function parseRgbToHex(value: string): string | undefined {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed.startsWith('rgb(') && !trimmed.startsWith('rgba(')) return undefined

  const raw = trimmed.replace(/^rgba?\(/, '').replace(/\)$/, '')
  const parts = raw.split(',').map((part) => part.trim())
  if (parts.length < 3) return undefined

  const red = Number.parseInt(parts[0], 10)
  const green = Number.parseInt(parts[1], 10)
  const blue = Number.parseInt(parts[2], 10)

  if (![red, green, blue].every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)) {
    return undefined
  }

  if (parts[3] !== undefined) {
    const alpha = Number.parseFloat(parts[3])
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return undefined
    if (alpha === 0) return undefined
  }

  const toHex = (channel: number) => channel.toString(16).toUpperCase().padStart(2, '0')
  const HASH = String.fromCharCode(35)
  return `${HASH}${toHex(red)}${toHex(green)}${toHex(blue)}`
}

export function toColorInputValue(color: string | undefined, fallback: string): string {
  if (typeof color !== 'string') return fallback
  const value = color.trim()
  const HASH = String.fromCharCode(35)
  const hexCandidate = value.startsWith(HASH) ? value.slice(1) : ''
  if (/^[0-9a-f]{3,8}$/i.test(hexCandidate)) return value
  const rgbValue = parseRgbToHex(value)
  if (rgbValue) return rgbValue
  return fallback
}

export function buildCanvasComponentStyle(component: SlideComponent): CSSProperties {
  const style: CSSProperties = {
    left: `${component.x}px`,
    top: `${component.y}px`,
    width: `${component.width}px`,
  }

  if (typeof component.height === 'number') style.height = `${component.height}px`
  if (component.style.fontSize) style.fontSize = `${component.style.fontSize}px`
  if (component.style.fontWeight) style.fontWeight = component.style.fontWeight
  if (component.style.fontFamily) style.fontFamily = component.style.fontFamily
  if (component.style.color) style.color = component.style.color
  if (component.style.backgroundFill) style.background = component.style.backgroundFill
  if (component.style.backgroundColor) style.backgroundColor = component.style.backgroundColor
  if (component.style.borderColor) style.borderColor = component.style.borderColor
  if (component.style.borderStyle) style.borderStyle = component.style.borderStyle
  if (typeof component.style.borderWidth === 'number' && component.style.borderWidth > 0) {
    style.borderWidth = `${component.style.borderWidth}px`
    if (!component.style.borderStyle) style.borderStyle = 'solid'
  }
  if (typeof component.style.borderRadius === 'number' && component.style.borderRadius > 0) {
    style.borderRadius = `${component.style.borderRadius}px`
  }
  if (component.style.boxShadow) style.boxShadow = component.style.boxShadow
  if (component.style.fontStyle) style.fontStyle = component.style.fontStyle
  if (component.style.lineHeight) style.lineHeight = `${component.style.lineHeight}px`
  if (component.style.textAlign) style.textAlign = component.style.textAlign

  return style
}

export function scaleNumeric(value: number | undefined, ratio: number, minimum = 0): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value
  return Math.max(minimum, Math.round(value * ratio))
}

export function scaleComponentProportionally(
  component: SlideComponent,
  widthRatio: number,
  heightRatio: number,
): SlideComponent {
  return {
    ...component,
    x: Math.round(component.x * widthRatio),
    y: Math.round(component.y * heightRatio),
    width: Math.max(MIN_COMPONENT_WIDTH, Math.round(component.width * widthRatio)),
    ...(typeof component.height === 'number'
      ? { height: Math.max(MIN_COMPONENT_HEIGHT, Math.round(component.height * heightRatio)) }
      : {}),
    style: {
      ...component.style,
      ...(typeof component.style.fontSize === 'number'
        ? { fontSize: Math.max(MIN_FONT_SIZE, Math.round(component.style.fontSize * heightRatio)) }
        : {}),
      ...(typeof component.style.lineHeight === 'number'
        ? { lineHeight: Math.max(MIN_FONT_SIZE, Math.round(component.style.lineHeight * heightRatio)) }
        : {}),
      ...(typeof component.style.borderWidth === 'number'
        ? { borderWidth: Math.max(1, Math.round(component.style.borderWidth * Math.min(widthRatio, heightRatio))) }
        : {}),
      ...(typeof component.style.borderRadius === 'number'
        ? { borderRadius: Math.max(0, Math.round(component.style.borderRadius * Math.min(widthRatio, heightRatio))) }
        : {}),
    },
  }
}

export function clampCanvasCoordinates(
  component: SlideComponent,
  canvas: { width: number; height: number },
  nextX: number,
  nextY: number,
) {
  const maxX = Math.max(0, canvas.width - component.width)
  const componentHeight = typeof component.height === 'number' ? component.height : 0
  const maxY = Math.max(0, canvas.height - componentHeight)
  return {
    x: Math.min(maxX, Math.max(0, nextX)),
    y: Math.min(maxY, Math.max(0, nextY)),
  }
}

export function resolveComponentHeight(component: SlideComponent): number {
  return typeof component.height === 'number' ? component.height : MIN_COMPONENT_HEIGHT
}

export function buildCanvasSnapTargets(
  components: SlideComponent[],
  excludedIds: Set<string>,
  canvas: { width: number; height: number },
): { x: number[]; y: number[] } {
  const xTargets = [0, canvas.width / 2, canvas.width]
  const yTargets = [0, canvas.height / 2, canvas.height]
  for (const component of components) {
    if (excludedIds.has(component.id) || component.visible === false) continue
    const height = resolveComponentHeight(component)
    xTargets.push(component.x, component.x + (component.width / 2), component.x + component.width)
    yTargets.push(component.y, component.y + (height / 2), component.y + height)
  }
  return { x: xTargets, y: yTargets }
}

export function findMoveSnap(
  start: number,
  size: number,
  targets: number[],
  tolerance: number,
): { delta: number; guide: number | null } {
  const points = [start, start + (size / 2), start + size]
  let bestDelta = 0
  let bestGuide: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const point of points) {
    for (const target of targets) {
      const delta = target - point
      const distance = Math.abs(delta)
      if (distance > tolerance) continue
      if (distance >= bestDistance) continue
      bestDelta = delta
      bestGuide = target
      bestDistance = distance
    }
  }

  return {
    delta: bestGuide === null ? 0 : bestDelta,
    guide: bestGuide,
  }
}

export function findEndSnap(
  end: number,
  targets: number[],
  tolerance: number,
): { delta: number; guide: number | null } {
  let bestDelta = 0
  let bestGuide: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const target of targets) {
    const delta = target - end
    const distance = Math.abs(delta)
    if (distance > tolerance) continue
    if (distance >= bestDistance) continue
    bestDelta = delta
    bestGuide = target
    bestDistance = distance
  }

  return {
    delta: bestGuide === null ? 0 : bestDelta,
    guide: bestGuide,
  }
}
