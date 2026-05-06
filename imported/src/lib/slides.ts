import type {
  SlideActor,
  SlidePptxExportJob,
  SlidePptxExportObject,
  SlidePptxExportWarning,
  SlideRecord,
  SlideSaveInput,
  SlideSaveResponse,
  SlideTemplatePreview,
  SlideTemplateLayoutBlock,
  SlideTemplateRecord,
} from '@/components/slides/persistence-types'
import type { SlideDocument } from '@/components/slides/types'
import { createSlideDocument } from '@/components/slides/document'

const FORCE_LOCAL_MODE = process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === '1'
const LOCAL_STORAGE_KEY = 'oliver-slides-store-v1'
const LOCAL_ESCALATION_CHANNELS = ['in-app'] as const

interface LocalSlidesStore {
  slides: SlideRecord[]
  templates: SlideTemplateRecord[]
  pptxExportJobs: SlidePptxExportJob[]
}

const LOCAL_TELEMETRY_RETENTION_MAX = 200

interface PublishTemplateOptions {
  name?: string
  description?: string
  isShared?: boolean
}

interface UpdateTemplateOptions {
  name?: string
  description?: string
  isShared?: boolean
}

function getTemplatePreviewFingerprint(templateId: string, canvas: SlideTemplateRecord['canvas'], components: SlideTemplateRecord['components']): string {
  return [
    templateId,
    String(canvas.width || 0),
    String(canvas.height || 0),
    ...components
      .filter((component) => component.visible !== false)
      .map((component) => `${component.id}:${component.type}:${component.x}:${component.y}:${component.width}:${component.height}:${component.content}`),
  ].join('|')
}

function buildTemplatePreview(template: {
  id: string
  canvas: SlideTemplateRecord['canvas']
  components: SlideTemplateRecord['components']
  preview?: SlideTemplateRecord['preview'] | null
}, actorUserId: string): SlideTemplatePreview {
  const visibleComponentCount = template.components.filter((component) => component.visible !== false).length
  const version = Math.max(1, Number(template.preview?.version || 0) + 1)
  const fingerprint = getTemplatePreviewFingerprint(template.id, template.canvas, template.components)
  const assetKey = `template-preview:${template.id}:v${version}`
  return {
    asset_key: assetKey,
    asset_url: `/api/slides/template-preview/${encodeURIComponent(template.id)}?v=${version}`,
    fingerprint,
    generated_at: nowIso(),
    generated_by_user_id: actorUserId,
    status: visibleComponentCount > 0 ? 'ready' : 'missing',
    version,
    visible_component_count: visibleComponentCount,
  }
}

function deriveTemplateStructure(components: SlideTemplateRecord['components']): {
  lockedElementIds: string[]
  editableZoneIds: string[]
  layoutBlocks: SlideTemplateLayoutBlock[]
} {
  const visibleComponents = Array.isArray(components)
    ? components.filter((component) => component.visible !== false)
    : []
  const lockedElementIds = visibleComponents.filter((component) => component.locked).map((component) => component.id)
  const editableZoneIds = visibleComponents.filter((component) => !component.locked).map((component) => component.id)
  const layoutBlocks = visibleComponents.map((component) => ({
    id: `block-${component.id}`,
    label: component.sourceLabel || component.type,
    component_ids: [component.id],
  }))

  return {
    lockedElementIds,
    editableZoneIds,
    layoutBlocks,
  }
}

export interface SlidePptxExportQueryOptions {
  limit?: number
  offset?: number
  status?: SlidePptxExportJob['status'] | 'all'
}

export interface SlidePptxExportJobRequest {
  slideIds: string[]
  slides: Array<{
    id: string
    title: string
    canvas: SlideRecord['canvas']
    components: SlideRecord['components']
    document?: SlideDocument
  }>
  filenamePrefix?: string
  includeHidden?: boolean
  idempotencyKey?: string
  maxAttempts?: number
}

type SlideFailureClass =
  | 'validation_error'
  | 'unauthenticated'
  | 'unauthorized'
  | 'not_found'
  | 'timeout'
  | 'conflict'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'upstream_runtime'
  | 'server_error'
  | 'request_error'
  | 'network_error'

interface SlideApiErrorDetail {
  status: number
  method: string
  path: string
  failureClass: SlideFailureClass
  retryable: boolean
  correlationId: string | null
  rayId: string | null
}

export class SlideApiError extends Error {
  status: number
  method: string
  path: string
  failureClass: SlideFailureClass
  retryable: boolean
  correlationId: string | null
  rayId: string | null

  constructor(message: string, detail: SlideApiErrorDetail | number) {
    super(message)
    this.name = 'SlideApiError'
    const resolvedDetail: SlideApiErrorDetail = typeof detail === 'number'
      ? {
          status: detail,
          method: 'GET',
          path: '/api/slides',
          failureClass: classifySlideFailure(detail, message),
          retryable: isRetryableSlideFailure(detail, classifySlideFailure(detail, message)),
          correlationId: null,
          rayId: null,
        }
      : detail
    this.status = resolvedDetail.status
    this.method = resolvedDetail.method
    this.path = resolvedDetail.path
    this.failureClass = resolvedDetail.failureClass
    this.retryable = resolvedDetail.retryable
    this.correlationId = resolvedDetail.correlationId
    this.rayId = resolvedDetail.rayId
  }
}

function extractCloudflareRayId(payload: string): string | null {
  const match = payload.match(/Ray ID[:\s-]*([A-Za-z0-9]+)/i)
  return match && match[1] ? match[1] : null
}

function summarizeHttpFailurePayload(payload: string): { message: string; rayId: string | null } {
  const trimmed = payload.trim()
  if (!trimmed) return { message: '', rayId: null }

  if (/<!doctype html/i.test(trimmed) || /<html/i.test(trimmed)) {
    const rayId = extractCloudflareRayId(trimmed)
    return {
      message: rayId
        ? `Upstream runtime exception (Cloudflare Ray ID ${rayId}).`
        : 'Upstream runtime exception.',
      rayId: rayId || null,
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: unknown
      message?: unknown
      error_detail?: {
        ray_id?: unknown
      }
    }
    const rayId =
      (typeof parsed.error_detail?.ray_id === 'string' && parsed.error_detail.ray_id.trim()) ||
      extractCloudflareRayId(trimmed)
    if (typeof parsed.error === 'string' && parsed.error.trim()) return { message: parsed.error.trim(), rayId: rayId || null }
    if (typeof parsed.message === 'string' && parsed.message.trim()) return { message: parsed.message.trim(), rayId: rayId || null }
  } catch {
    // Non-JSON payload.
  }

  const compact = trimmed.replace(/\s+/g, ' ')
  return {
    message: compact.length > 320 ? `${compact.slice(0, 320)}...` : compact,
    rayId: extractCloudflareRayId(trimmed),
  }
}

function classifySlideFailure(status: number, summaryMessage: string): SlideFailureClass {
  if (status === 400) return 'validation_error'
  if (status === 401) return 'unauthenticated'
  if (status === 403) return 'unauthorized'
  if (status === 404) return 'not_found'
  if (status === 408) return 'timeout'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rate_limited'
  if (status === 502 || status === 503 || status === 504) return 'upstream_unavailable'
  if (status >= 500) return 'server_error'
  if (/runtime exception/i.test(summaryMessage)) return 'upstream_runtime'
  return 'request_error'
}

function isRetryableSlideFailure(status: number, failureClass: SlideFailureClass): boolean {
  if (status === 408 || status === 429) return true
  if (status >= 500) return true
  return failureClass === 'upstream_unavailable' || failureClass === 'upstream_runtime' || failureClass === 'timeout'
}

function parseSlideErrorPayload(method: string, path: string, status: number, payload: string): SlideApiError {
  const trimmed = payload.trim()
  let correlationId: string | null = null
  let explicitRayId: string | null = null
  let explicitFailureClass: SlideFailureClass | null = null
  let explicitRetryable: boolean | null = null

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: unknown
        message?: unknown
        error_detail?: {
          correlation_id?: unknown
          ray_id?: unknown
          failure_class?: unknown
          retryable?: unknown
        }
      }
      if (typeof parsed.error_detail?.correlation_id === 'string' && parsed.error_detail.correlation_id.trim()) {
        correlationId = parsed.error_detail.correlation_id.trim()
      }
      if (typeof parsed.error_detail?.ray_id === 'string' && parsed.error_detail.ray_id.trim()) {
        explicitRayId = parsed.error_detail.ray_id.trim()
      }
      if (typeof parsed.error_detail?.failure_class === 'string' && parsed.error_detail.failure_class.trim()) {
        explicitFailureClass = parsed.error_detail.failure_class.trim() as SlideFailureClass
      }
      if (typeof parsed.error_detail?.retryable === 'boolean') {
        explicitRetryable = parsed.error_detail.retryable
      }
    } catch {
      // Ignore JSON parse errors for non-JSON payloads.
    }
  }

  const summary = summarizeHttpFailurePayload(trimmed)
  const summaryMessage = summary.message
  const failureClass = explicitFailureClass || classifySlideFailure(status, summaryMessage)
  const retryable = explicitRetryable ?? isRetryableSlideFailure(status, failureClass)
  const rayId = explicitRayId || summary.rayId || null

  const detailSuffix = [
    correlationId ? `Correlation ${correlationId}` : '',
    rayId ? `Ray ${rayId}` : '',
  ]
    .filter(Boolean)
    .join(', ')
  const decoratedSummary = detailSuffix
    ? `${summaryMessage || 'Request failed.'} (${detailSuffix})`
    : summaryMessage || 'Request failed.'

  return new SlideApiError(
    `${method} ${path} failed: ${status}${decoratedSummary ? ` ${decoratedSummary}` : ''}`,
    {
      status,
      method,
      path,
      failureClass,
      retryable,
      correlationId,
      rayId,
    },
  )
}

export class SlideConflictError extends Error {
  serverSlide: SlideRecord

  constructor(message: string, serverSlide: SlideRecord) {
    super(message)
    this.name = 'SlideConflictError'
    this.serverSlide = serverSlide
  }
}

export interface SlidesRuntimeFailure {
  message: string
  method: string
  endpoint: string
  status: number | null
  failureClass: SlideFailureClass
  retryable: boolean
  correlationId: string | null
  rayId: string | null
  occurredAt: string
}

export interface SlidesRuntimeHealthState {
  mode: 'normal' | 'degraded'
  lastFailure: SlidesRuntimeFailure | null
}

let runtimeHealthState: SlidesRuntimeHealthState = {
  mode: 'normal',
  lastFailure: null,
}

const runtimeHealthListeners = new Set<(state: SlidesRuntimeHealthState) => void>()

function emitRuntimeHealthState() {
  const snapshot: SlidesRuntimeHealthState = {
    mode: runtimeHealthState.mode,
    lastFailure: runtimeHealthState.lastFailure ? { ...runtimeHealthState.lastFailure } : null,
  }
  for (const listener of runtimeHealthListeners) {
    listener(snapshot)
  }
}

function markRuntimeDegraded(error: unknown, fallbackMethod = 'GET', fallbackPath = '/api/slides') {
  const failure: SlidesRuntimeFailure = error instanceof SlideApiError
    ? {
        message: error.message,
        method: error.method,
        endpoint: error.path,
        status: error.status,
        failureClass: error.failureClass,
        retryable: error.retryable,
        correlationId: error.correlationId,
        rayId: error.rayId,
        occurredAt: nowIso(),
      }
    : error instanceof TypeError
      ? {
          message: error.message || 'Network error',
          method: fallbackMethod,
          endpoint: fallbackPath,
          status: null,
          failureClass: 'network_error',
          retryable: true,
          correlationId: null,
          rayId: null,
          occurredAt: nowIso(),
        }
      : {
          message: error instanceof Error ? error.message : String(error),
          method: fallbackMethod,
          endpoint: fallbackPath,
          status: null,
          failureClass: 'request_error',
          retryable: true,
          correlationId: null,
          rayId: null,
          occurredAt: nowIso(),
        }

  runtimeHealthState = {
    mode: 'degraded',
    lastFailure: failure,
  }
  emitRuntimeHealthState()
}

function markRuntimeRecovered() {
  if (runtimeHealthState.mode === 'normal' && runtimeHealthState.lastFailure === null) return
  runtimeHealthState = {
    mode: 'normal',
    lastFailure: null,
  }
  emitRuntimeHealthState()
}

export function getSlidesRuntimeHealth(): SlidesRuntimeHealthState {
  return {
    mode: runtimeHealthState.mode,
    lastFailure: runtimeHealthState.lastFailure ? { ...runtimeHealthState.lastFailure } : null,
  }
}

export function subscribeSlidesRuntimeHealth(listener: (state: SlidesRuntimeHealthState) => void): () => void {
  runtimeHealthListeners.add(listener)
  listener(getSlidesRuntimeHealth())
  return () => {
    runtimeHealthListeners.delete(listener)
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function safeRandomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
}

function normalizeActor(actor: SlideActor): SlideActor {
  return {
    user_id: actor.user_id || 'unknown-user',
    user_email: actor.user_email || '',
    role: actor.role || 'admin',
  }
}

function resolveLocalEscalationRouting(payload: Record<string, unknown>) {
  const targetUserId = typeof payload.target_user_id === 'string' ? payload.target_user_id.trim() : ''
  const targetUserEmail = typeof payload.target_user_email === 'string' ? payload.target_user_email.trim().toLowerCase() : ''
  const targets = targetUserId || targetUserEmail
    ? [{ user_id: targetUserId || null, user_email: targetUserEmail || null }]
    : []
  return {
    channels: [...LOCAL_ESCALATION_CHANNELS],
    targets,
    adapters: {
      in_app_enabled: true,
      email_enabled: false,
      email_from: null,
      slack_enabled: false,
      slack_webhook_configured: false,
    },
  }
}

function initialTemplates(actor: SlideActor): SlideTemplateRecord[] {
  const timestamp = nowIso()
  return [
    {
      id: 'template-hero-metric',
      owner_user_id: actor.user_id,
      name: 'Hero + Metric Row',
      description: 'Headline with supporting metrics.',
      is_shared: true,
      canvas: { width: 1920, height: 1080 },
      components: [
        {
          id: 't-hero-1',
          type: 'heading',
          sourceLabel: '.hero-title',
          x: 120,
          y: 120,
          width: 1200,
          content: 'Quarterly Growth Plan',
          style: { fontSize: 72, fontWeight: 700, color: '#0f172a' },
          locked: false,
          visible: true,
        },
        {
          id: 't-hero-2',
          type: 'text',
          sourceLabel: '.hero-subtitle',
          x: 120,
          y: 230,
          width: 900,
          content: 'Key priorities, timing, and owner accountability.',
          style: { fontSize: 32, color: '#334155' },
          locked: false,
          visible: true,
        },
      ],
      locked_element_ids: [],
      editable_zone_ids: ['t-hero-1', 't-hero-2'],
      layout_blocks: [
        { id: 'block-t-hero-1', label: '.hero-title', component_ids: ['t-hero-1'] },
        { id: 'block-t-hero-2', label: '.hero-subtitle', component_ids: ['t-hero-2'] },
      ],
      metadata: { category: 'default' },
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: 'template-kpi-grid',
      owner_user_id: actor.user_id,
      name: 'KPI Grid',
      description: 'Four KPI cards with heading and labels.',
      is_shared: true,
      canvas: { width: 1920, height: 1080 },
      components: [
        {
          id: 't-kpi-1',
          type: 'heading',
          sourceLabel: '.kpi-title',
          x: 120,
          y: 100,
          width: 600,
          content: 'Sales Performance',
          style: { fontSize: 58, fontWeight: 700, color: '#111827' },
          locked: false,
          visible: true,
        },
        {
          id: 't-kpi-2',
          type: 'card',
          sourceLabel: '.kpi-card-1',
          x: 120,
          y: 260,
          width: 380,
          height: 260,
          content: '<h3>Revenue</h3><p>$4.2M</p>',
          style: { backgroundColor: '#f8fafc' },
          locked: false,
          visible: true,
        },
      ],
      locked_element_ids: [],
      editable_zone_ids: ['t-kpi-1', 't-kpi-2'],
      layout_blocks: [
        { id: 'block-t-kpi-1', label: '.kpi-title', component_ids: ['t-kpi-1'] },
        { id: 'block-t-kpi-2', label: '.kpi-card-1', component_ids: ['t-kpi-2'] },
      ],
      metadata: { category: 'default' },
      created_at: timestamp,
      updated_at: timestamp,
    },
  ]
}

function readLocalStore(actor: SlideActor): LocalSlidesStore {
  if (typeof window === 'undefined') {
    return {
      slides: [],
      templates: initialTemplates(actor),
      pptxExportJobs: [],
    }
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!raw) {
    const store: LocalSlidesStore = {
      slides: [],
      templates: initialTemplates(actor),
      pptxExportJobs: [],
    }
    writeLocalStore(store)
    return store
  }

  try {
    const parsed = JSON.parse(raw) as LocalSlidesStore
    if (!Array.isArray(parsed.templates) || parsed.templates.length === 0) {
      parsed.templates = initialTemplates(actor)
    }
    if (!Array.isArray(parsed.slides)) parsed.slides = []
    if (!Array.isArray(parsed.pptxExportJobs)) parsed.pptxExportJobs = []
    return parsed
  } catch {
    const store: LocalSlidesStore = {
      slides: [],
      templates: initialTemplates(actor),
      pptxExportJobs: [],
    }
    writeLocalStore(store)
    return store
  }
}

function writeLocalStore(store: LocalSlidesStore): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store))
}

function makeAuditEvent(..._args: unknown[]): void {
  return
}

function applySearch<T extends { title?: string; name?: string }>(rows: T[], search: string): T[] {
  const query = search.trim().toLowerCase()
  if (!query) return rows
  return rows.filter((row) => {
    const text = (row.title || row.name || '').toLowerCase()
    return text.includes(query)
  })
}

function normalizePptxExportStatus(
  value: string | undefined,
): SlidePptxExportJob['status'] | 'all' {
  if (value === 'queued' || value === 'running' || value === 'succeeded' || value === 'failed') return value
  return 'all'
}

function normalizePresetDateValue(value: string | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : ''
}

function mapComponentToLocalPptxObject(
  slideId: string,
  component: SlideRecord['components'][number],
): { object: SlidePptxExportObject | null; warning: SlidePptxExportWarning | null } {
  const componentType = String(component.type || 'unknown')
  const base = {
    slide_id: slideId,
    component_id: component.id || 'unknown-component',
    component_type: componentType,
  }

  if (['heading', 'subheading', 'tag-line', 'text'].includes(componentType)) {
    return {
      object: { ...base, native_kind: 'text', editable: true },
      warning: null,
    }
  }
  if (['shape', 'button', 'card', 'panel', 'row', 'stat'].includes(componentType)) {
    return {
      object: { ...base, native_kind: 'shape', editable: true },
      warning: null,
    }
  }
  if (componentType === 'image' || componentType === 'logo') {
    return {
      object: { ...base, native_kind: 'image', editable: false },
      warning: {
        code: 'image_rasterized',
        message: `Component "${component.id}" was exported as an image fallback.`,
        ...base,
      },
    }
  }

  return {
    object: null,
    warning: {
      code: 'unsupported_component',
      message: `Component type "${componentType}" is not natively supported and was skipped.`,
      ...base,
    },
  }
}

function buildLocalPptxProjection(
  slides: Array<{ id: string; components: SlideRecord['components'] }>,
): { warnings: SlidePptxExportWarning[]; nativeObjects: SlidePptxExportObject[] } {
  const warnings: SlidePptxExportWarning[] = []
  const nativeObjects: SlidePptxExportObject[] = []

  for (const slide of slides) {
    for (const component of slide.components || []) {
      const mapped = mapComponentToLocalPptxObject(slide.id, component)
      if (mapped.object) nativeObjects.push(mapped.object)
      if (mapped.warning) warnings.push(mapped.warning)
    }
  }

  return { warnings, nativeObjects }
}

function isLocalTemplateVisibleToActor(template: SlideTemplateRecord, actor: SlideActor): boolean {
  return template.is_shared || template.owner_user_id === actor.user_id || actor.role === 'admin'
}

function shouldFallbackToLocal(error: unknown): boolean {
  if (FORCE_LOCAL_MODE) return true
  if (error instanceof SlideConflictError) return false
  if (error instanceof SlideApiError) {
    if (error.status === 404 || error.status === 405) return true
    return error.retryable
  }
  if (error instanceof TypeError) return true
  return false
}

interface LocalFallbackOptions {
  suppressDegradedState?: boolean
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'Content-Type': 'application/json',
    },
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const errorPayload = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
    throw new SlideApiError(
      typeof errorPayload.error === 'string' ? errorPayload.error : 'Slides request failed.',
      response.status,
    )
  }

  return payload as T
}

async function withLocalFallback<T>(
  remoteCall: () => Promise<T>,
  localCall: () => Promise<T> | T,
  options: LocalFallbackOptions = {},
): Promise<T> {
  if (FORCE_LOCAL_MODE) {
    return Promise.resolve(localCall())
  }

  try {
    const response = await remoteCall()
    markRuntimeRecovered()
    return response
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      if (!options.suppressDegradedState) {
        markRuntimeDegraded(error)
      }
      return Promise.resolve(localCall())
    }
    throw error
  }
}

function toSlideRecordFromTemplate(template: SlideTemplateRecord, actor: SlideActor, title?: string): SlideRecord {
  const stamp = nowIso()
  return {
    id: safeRandomId('slide'),
    owner_user_id: actor.user_id,
    title: title || `${template.name} (Copy)`,
    canvas: template.canvas,
    components: template.components,
    metadata: {
      ...template.metadata,
      sourceTemplateId: template.id,
      template_locked_element_ids: template.locked_element_ids || [],
      template_editable_zone_ids: template.editable_zone_ids || [],
      template_layout_blocks: template.layout_blocks || [],
    },
    revision: 1,
    source: 'template',
    source_template_id: template.id,
    created_at: stamp,
    updated_at: stamp,
    last_edited_at: stamp,
  }
}

export async function listSlides(actorInput: SlideActor, search = ''): Promise<SlideRecord[]> {
  const actor = normalizeActor(actorInput)

  return withLocalFallback(
    async () => {
      const params = new URLSearchParams({
        resource: 'slides',
        search,
        user_id: actor.user_id,
      })
      if (actor.user_email) params.set('user_email', actor.user_email)
      const response = await requestJson<{ items: SlideRecord[] }>(`/api/slides?${params.toString()}`)
      return response.items || []
    },
    () => {
      const store = readLocalStore(actor)
      const rows = actor.role === 'admin'
        ? store.slides
        : store.slides.filter((slide) => slide.owner_user_id === actor.user_id)
      return applySearch(rows, search).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    },
    { suppressDegradedState: true },
  )
}

export async function listTemplates(actorInput: SlideActor, search = ''): Promise<SlideTemplateRecord[]> {
  const actor = normalizeActor(actorInput)

  return withLocalFallback(
    async () => {
      const params = new URLSearchParams({
        resource: 'templates',
        search,
        user_id: actor.user_id,
      })
      if (actor.user_email) params.set('user_email', actor.user_email)
      const response = await requestJson<{ items: SlideTemplateRecord[] }>(`/api/slides?${params.toString()}`)
      return response.items || []
    },
    () => {
      const store = readLocalStore(actor)
      const rows = store.templates.filter((template) => isLocalTemplateVisibleToActor(template, actor))
      return applySearch(rows, search).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    },
    { suppressDegradedState: true },
  )
}


export async function requestPptxExportJob(
  actorInput: SlideActor,
  input: SlidePptxExportJobRequest,
): Promise<SlidePptxExportJob> {
  const actor = normalizeActor(actorInput)
  const slideIds = Array.from(new Set((input.slideIds || []).map((value) => value.trim()).filter(Boolean)))
  const slides = Array.isArray(input.slides) ? input.slides : []
  if (slides.length === 0) throw new SlideApiError('At least one slide is required for PPTX export.', 400)

  const filenamePrefix = (input.filenamePrefix || 'slides-export').trim() || 'slides-export'
  const includeHidden = !!input.includeHidden
  const idempotencyKey = (input.idempotencyKey || '').trim() || null
  const maxAttempts = Number.isFinite(input.maxAttempts) ? Math.max(1, Math.min(5, Number(input.maxAttempts))) : 3

  return withLocalFallback(
    async () => {
      const response = await requestJson<{ job: SlidePptxExportJob }>('/api/slides', {
        method: 'POST',
        body: JSON.stringify({
          action: 'request-pptx-export-job',
          actor,
          slide_ids: slideIds,
          slides,
          filename_prefix: filenamePrefix,
          include_hidden: includeHidden,
          idempotency_key: idempotencyKey || undefined,
          max_attempts: maxAttempts,
        }),
      })
      if (!response.job) throw new SlideApiError('PPTX export job request failed.', 500)
      return response.job
    },
    () => {
      const store = readLocalStore(actor)
      if (idempotencyKey) {
        const existing = store.pptxExportJobs.find((entry) =>
          entry.requested_by_user_id === actor.user_id &&
          entry.idempotency_key === idempotencyKey &&
          (entry.status === 'queued' || entry.status === 'running' || entry.status === 'succeeded'),
        )
        if (existing) return existing
      }

      const stamp = nowIso()
      const safeStamp = stamp.replace(/[:.]/g, '-')
      const { warnings, nativeObjects } = buildLocalPptxProjection(
        slides.map((slide) => ({ id: slide.id, components: slide.components })),
      )
      const token = safeRandomId('pptx-download-token')
      const job: SlidePptxExportJob = {
        id: safeRandomId('pptx-export-job'),
        requested_by_user_id: actor.user_id,
        requested_by_email: actor.user_email || null,
        status: 'succeeded',
        slide_ids: slideIds,
        options: {
          filename_prefix: filenamePrefix,
          include_hidden: includeHidden,
        },
        attempts: 1,
        max_attempts: maxAttempts,
        warning_count: warnings.length,
        warnings,
        native_objects: nativeObjects,
        artifact: {
          file_name: `${filenamePrefix.replace(/\s+/g, '-').toLowerCase()}-${safeStamp}.pptx`,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          download_token: token,
        },
        requested_at: stamp,
        started_at: stamp,
        completed_at: stamp,
        updated_at: stamp,
        error_message: null,
        idempotency_key: idempotencyKey,
      }
      store.pptxExportJobs.unshift(job)
      if (store.pptxExportJobs.length > 100) {
        store.pptxExportJobs = store.pptxExportJobs.slice(0, 100)
      }
      for (const slideId of slideIds) {
        makeAuditEvent(store, actor, 'export-pptx', 'success', 'slide', slideId, {
          job_id: job.id,
          warning_count: warnings.length,
        })
      }
      writeLocalStore(store)
      return job
    },
  )
}

export async function downloadPptxExportJob(
  actorInput: SlideActor,
  jobId: string,
): Promise<SlidePptxExportJob> {
  const actor = normalizeActor(actorInput)
  const trimmedId = jobId.trim()
  if (!trimmedId) throw new SlideApiError('PPTX export job id is required.', 400)

  return withLocalFallback(
    async () => {
      const response = await requestJson<{ job: SlidePptxExportJob }>('/api/slides', {
        method: 'POST',
        body: JSON.stringify({
          action: 'download-pptx-export-job',
          actor,
          job_id: trimmedId,
        }),
      })
      if (!response.job) throw new SlideApiError('PPTX export job download failed.', 500)
      return response.job
    },
    () => {
      const store = readLocalStore(actor)
      const job = store.pptxExportJobs.find((entry) => entry.id === trimmedId)
      if (!job) throw new SlideApiError('PPTX export job not found.', 404)
      const canRead = actor.role === 'admin' || job.requested_by_user_id === actor.user_id
      if (!canRead) throw new SlideApiError('Forbidden. Cannot access this PPTX export job.', 403)
      if (job.status !== 'succeeded') {
        throw new SlideApiError('PPTX export job is not ready for download.', 409)
      }
      const expiresAt = job.artifact?.expires_at ? Date.parse(job.artifact.expires_at) : NaN
      if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
        throw new SlideApiError('PPTX export artifact has expired. Request a new export.', 410)
      }
      return job
    },
  )
}

export async function saveSlide(actorInput: SlideActor, input: SlideSaveInput): Promise<SlideSaveResponse> {
  const actor = normalizeActor(actorInput)

  return withLocalFallback(
    async () => requestJson<SlideSaveResponse>('/api/slides', {
      method: 'POST',
      body: JSON.stringify({ action: 'save', actor, slide: input }),
    }),
    () => {
      const store = readLocalStore(actor)
      const timestamp = nowIso()
      const normalizedMetadata = {
        ...(input.metadata || {}),
        slide_document: input.document || createSlideDocument({
          id: input.id,
          canvas: input.canvas,
          components: input.components,
          warnings: Array.isArray(input.metadata?.warnings) ? input.metadata.warnings as string[] : [],
        }),
      }

      if (input.id) {
        const index = store.slides.findIndex((slide) => slide.id === input.id)
        if (index < 0) {
          throw new SlideApiError('Slide not found for update', 404)
        }

        const existing = store.slides[index]
        const expectedRevision = Number.isFinite(input.revision) ? input.revision as number : existing.revision

        if (!input.overwrite && expectedRevision !== existing.revision) {
          makeAuditEvent(
            store,
            actor,
            'conflict',
            'failure',
            'slide',
            existing.id,
            {
              expected_revision: expectedRevision,
              current_revision: existing.revision,
            },
            'revision_conflict',
          )
          writeLocalStore(store)
          throw new SlideConflictError('Slide revision conflict', existing)
        }

        const next: SlideRecord = {
          ...existing,
          title: input.title,
          canvas: input.canvas,
          components: input.components,
          metadata: normalizedMetadata,
          revision: existing.revision + 1,
          updated_at: timestamp,
          last_edited_at: timestamp,
        }

        store.slides[index] = next
        makeAuditEvent(
          store,
          actor,
          input.autosave ? 'autosave' : 'save',
          'success',
          'slide',
          next.id,
          { revision: next.revision },
        )
        writeLocalStore(store)
        return { slide: next }
      }

      const created: SlideRecord = {
        id: safeRandomId('slide'),
        owner_user_id: actor.user_id,
        title: input.title,
        canvas: input.canvas,
        components: input.components,
        metadata: normalizedMetadata,
        revision: 1,
        source: 'import',
        source_template_id: null,
        created_at: timestamp,
        updated_at: timestamp,
        last_edited_at: timestamp,
      }

      store.slides.unshift(created)
      makeAuditEvent(
        store,
        actor,
        input.autosave ? 'autosave' : 'save',
        'success',
        'slide',
        created.id,
        { revision: created.revision },
      )
      writeLocalStore(store)
      return { slide: created }
    },
  )
}

export async function duplicateSlide(actorInput: SlideActor, slideId: string): Promise<SlideRecord> {
  const actor = normalizeActor(actorInput)

  return withLocalFallback(
    async () => {
      const response = await requestJson<{ slide: SlideRecord }>('/api/slides', {
        method: 'POST',
        body: JSON.stringify({ action: 'duplicate-slide', actor, slide_id: slideId }),
      })
      return response.slide
    },
    () => {
      const store = readLocalStore(actor)
      const source = store.slides.find((slide) => slide.id === slideId)
      if (!source) throw new SlideApiError('Slide not found for duplicate', 404)
      const stamp = nowIso()
      const copy: SlideRecord = {
        ...source,
        id: safeRandomId('slide'),
        title: `${source.title} (Copy)`,
        revision: 1,
        created_at: stamp,
        updated_at: stamp,
        last_edited_at: stamp,
      }
      store.slides.unshift(copy)
      makeAuditEvent(store, actor, 'duplicate', 'success', 'slide', copy.id, { source_id: source.id })
      writeLocalStore(store)
      return copy
    },
  )
}

export async function duplicateTemplateAsSlide(actorInput: SlideActor, templateId: string): Promise<SlideRecord> {
  const actor = normalizeActor(actorInput)

  return withLocalFallback(
    async () => {
      const response = await requestJson<{ slide: SlideRecord }>('/api/slides', {
        method: 'POST',
        body: JSON.stringify({ action: 'duplicate-template', actor, template_id: templateId }),
      })
      return response.slide
    },
    () => {
      const store = readLocalStore(actor)
      const template = store.templates.find((row) => row.id === templateId)
      if (!template) throw new SlideApiError('Template not found for duplicate', 404)
      if (!isLocalTemplateVisibleToActor(template, actor)) {
        throw new SlideApiError('Forbidden. Template is not visible to this user.', 403)
      }
      const slide = toSlideRecordFromTemplate(template, actor)
      store.slides.unshift(slide)
      makeAuditEvent(store, actor, 'duplicate', 'success', 'template', template.id, { slide_id: slide.id })
      writeLocalStore(store)
      return slide
    },
  )
}

export async function renameSlide(actorInput: SlideActor, slideId: string, title: string): Promise<SlideRecord> {
  const actor = normalizeActor(actorInput)

  return withLocalFallback(
    async () => {
      const response = await requestJson<{ slide: SlideRecord }>('/api/slides', {
        method: 'POST',
        body: JSON.stringify({ action: 'rename-slide', actor, slide_id: slideId, title }),
      })
      return response.slide
    },
    () => {
      const store = readLocalStore(actor)
      const index = store.slides.findIndex((slide) => slide.id === slideId)
      if (index < 0) throw new SlideApiError('Slide not found for rename', 404)
      const existing = store.slides[index]
      const updated: SlideRecord = {
        ...existing,
        title,
        revision: existing.revision + 1,
        updated_at: nowIso(),
        last_edited_at: nowIso(),
      }
      store.slides[index] = updated
      makeAuditEvent(store, actor, 'rename', 'success', 'slide', slideId, { title })
      writeLocalStore(store)
      return updated
    },
  )
}

export async function deleteSlide(actorInput: SlideActor, slideId: string): Promise<void> {
  const actor = normalizeActor(actorInput)

  return withLocalFallback(
    async () => {
      await requestJson<{ ok: true }>('/api/slides', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete-slide', actor, slide_id: slideId }),
      })
    },
    () => {
      const store = readLocalStore(actor)
      const nextSlides = store.slides.filter((slide) => slide.id !== slideId)
      if (nextSlides.length === store.slides.length) throw new SlideApiError('Slide not found for delete', 404)
      store.slides = nextSlides
      makeAuditEvent(store, actor, 'delete', 'success', 'slide', slideId)
      writeLocalStore(store)
    },
  )
}

export async function publishTemplateFromSlide(
  actorInput: SlideActor,
  slideId: string,
  optionsOrName?: string | PublishTemplateOptions,
): Promise<SlideTemplateRecord> {
  const actor = normalizeActor(actorInput)
  const options: PublishTemplateOptions =
    typeof optionsOrName === 'string' ? { name: optionsOrName } : (optionsOrName || {})
  const templateName = options.name?.trim()
  const templateDescription = options.description?.trim() || 'Published from My Slides'
  const isShared = options.isShared === true

  return withLocalFallback(
    async () => {
      const response = await requestJson<{ template: SlideTemplateRecord }>('/api/slides', {
        method: 'POST',
        body: JSON.stringify({
          action: 'publish-template',
          actor,
          slide_id: slideId,
          name: templateName || undefined,
          description: templateDescription,
          is_shared: isShared,
        }),
      })
      return response.template
    },
    () => {
      const store = readLocalStore(actor)
      const slide = store.slides.find((entry) => entry.id === slideId)
      if (!slide) throw new SlideApiError('Slide not found for template publish', 404)
      if (isShared && actor.role !== 'admin') {
        throw new SlideApiError('Forbidden. Only admins can publish shared templates.', 403)
      }
      const stamp = nowIso()
      const structure = deriveTemplateStructure(slide.components)
      const template: SlideTemplateRecord = {
        id: safeRandomId('template'),
        owner_user_id: actor.user_id,
        name: templateName || `${slide.title} Template`,
        description: templateDescription,
        is_shared: isShared,
        canvas: slide.canvas,
        components: slide.components,
        locked_element_ids: structure.lockedElementIds,
        editable_zone_ids: structure.editableZoneIds,
        layout_blocks: structure.layoutBlocks,
        preview: null,
        metadata: {
          source_slide_id: slide.id,
          ...(slide.metadata || {}),
          locked_element_ids: structure.lockedElementIds,
          editable_zone_ids: structure.editableZoneIds,
          layout_blocks: structure.layoutBlocks,
        },
        created_at: stamp,
        updated_at: stamp,
      }
      template.preview = buildTemplatePreview(template, actor.user_id)
      template.metadata = { ...template.metadata, preview: template.preview }
      store.templates.unshift(template)
      makeAuditEvent(store, actor, 'publish-template', 'success', 'template', template.id, { source_slide_id: slide.id })
      writeLocalStore(store)
      return template
    },
  )
}

export async function updateTemplate(
  actorInput: SlideActor,
  templateId: string,
  options: UpdateTemplateOptions,
): Promise<SlideTemplateRecord> {
  const actor = normalizeActor(actorInput)
  const name = options.name?.trim()
  const description = options.description?.trim()
  const isShared = typeof options.isShared === 'boolean' ? options.isShared : undefined

  return withLocalFallback(
    async () => {
      const response = await requestJson<{ template: SlideTemplateRecord }>('/api/slides', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update-template',
          actor,
          template_id: templateId,
          name,
          description,
          is_shared: isShared,
        }),
      })
      return response.template
    },
    () => {
      const store = readLocalStore(actor)
      const index = store.templates.findIndex((template) => template.id === templateId)
      if (index < 0) throw new SlideApiError('Template not found for update', 404)
      const existing = store.templates[index]
      const isOwner = existing.owner_user_id === actor.user_id
      const isAdmin = actor.role === 'admin'
      if (!(isOwner || isAdmin)) {
        throw new SlideApiError('Forbidden. You do not own this template.', 403)
      }
      if (typeof isShared === 'boolean' && !isOwner && !isAdmin) {
        throw new SlideApiError('Forbidden. Only owners/admins can change template visibility.', 403)
      }
      if (isShared === true && !isAdmin) {
        throw new SlideApiError('Forbidden. Only admins can set template visibility to shared.', 403)
      }

      const updated: SlideTemplateRecord = {
        ...existing,
        name: name || existing.name,
        description: description || existing.description,
        is_shared: isShared ?? existing.is_shared,
        updated_at: nowIso(),
      }

      store.templates[index] = updated
      makeAuditEvent(store, actor, 'rename', 'success', 'template', templateId, {
        operation: 'update-template',
        is_shared: updated.is_shared,
      })
      writeLocalStore(store)
      return updated
    },
  )
}

export async function recordExportEvent(
  ..._args: unknown[]
): Promise<void> {
  return
}

