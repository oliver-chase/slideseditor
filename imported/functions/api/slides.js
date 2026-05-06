// /api/slides — slide persistence, template library, and audit operations.
//
// GET /api/slides?resource=slides|templates|audits|audit-presets|audit-export-jobs|pptx-export-jobs|template-collaborators|template-approvals&search=&limit=&offset=
// POST /api/slides { action, actor, ...payload }

import { jsonResponse } from './_shared/ai.js';
import { buildGetResourceHandlers, buildPostActionHandlers } from './slides/route-handler-groups.js';

const MAX_COMPONENTS_PER_SLIDE = 400;
const MAX_TITLE_LENGTH = 160;
const MAX_TEMPLATE_DESCRIPTION_LENGTH = 400;
const DEFAULT_OWNER_EMAILS = [];
const ALL_PAGE_PERMISSIONS = ['accounts', 'hr', 'sdr', 'crm', 'slides', 'reviews', 'campaigns'];
const TEMPLATE_COLLABORATOR_ROLES = ['editor', 'reviewer', 'viewer'];
const TEMPLATE_APPROVAL_TYPES = ['transfer-template', 'upsert-collaborator', 'remove-collaborator'];
const TEMPLATE_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];
const MAX_APPROVAL_ESCALATION_REASON_LENGTH = 280;
const DEFAULT_ESCALATION_CHANNELS = ['in-app'];
const SUPPORTED_ESCALATION_CHANNELS = ['in-app', 'email', 'slack'];
const AUDIT_PRESET_SCOPES = ['personal', 'shared'];
const AUDIT_EXPORT_JOB_STATUSES = ['queued', 'running', 'completed', 'failed'];
const PPTX_EXPORT_JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed'];
const MAX_AUDIT_EXPORT_ROWS = 10000;
const MAX_PPTX_EXPORT_SLIDES = 50;
const MAX_PPTX_EXPORT_WARNINGS = 500;
const MAX_PPTX_EXPORT_ATTEMPTS = 5;
const PPTX_EXPORT_ARTIFACT_TTL_MINUTES = 30;
const PPTX_NATIVE_TEXT_COMPONENT_TYPES = new Set(['heading', 'subheading', 'tag-line', 'text']);
const PPTX_NATIVE_SHAPE_COMPONENT_TYPES = new Set(['shape', 'card', 'button', 'panel', 'row', 'stat']);
const PPTX_IMAGE_COMPONENT_TYPES = new Set(['image', 'logo']);
const SLIDES_SWEEP_HEARTBEAT_ENTITY_ID = 'approval-sla-sweep';
const DEFAULT_SWEEP_MIN_INTERVAL_MINUTES = 60;
const AUDIT_ACTIONS = [
  'save',
  'autosave',
  'delete',
  'duplicate',
  'rename',
  'publish-template',
  'transfer-template',
  'upsert-collaborator',
  'remove-collaborator',
  'submit-approval',
  'escalate-approval',
  'approve-approval',
  'reject-approval',
  'export-html',
  'export-pdf',
  'export-pptx',
];
const AUDIT_OUTCOMES = ['success', 'failure'];
const AUDIT_ENTITY_TYPES = ['slide', 'template'];
const MAX_ERROR_MESSAGE_LENGTH = 320;
const pptxExportJobsById = new Map();
const pptxExportJobIdsByRequestedAt = [];
const PPTX_FLEX_JUSTIFY_VALUES = new Set(['flex-start', 'flex-end', 'center', 'space-between', 'space-around']);
const PPTX_FLEX_ALIGN_VALUES = new Set(['flex-start', 'flex-end', 'center', 'stretch']);
const PPTX_FLEX_DIRECTION_VALUES = new Set(['row', 'row-reverse', 'column', 'column-reverse']);
const SLIDES_TELEMETRY_EVENT_TYPES = ['unsaved-prompt', 'confirm-leave', 'cancel-leave', 'autosave-retry', 'discard-draft'];
const SLIDES_TELEMETRY_WORKSPACE_TABS = ['import', 'my-slides', 'templates', 'activity'];
const SLIDES_TELEMETRY_SAVE_STATUSES = ['clean', 'dirty', 'saving', 'saved', 'queued', 'error', 'conflict'];
const SLIDES_TELEMETRY_TRIGGER_SOURCES = ['nav', 'browser-back', 'reload', 'close', 'manual', 'autosave'];
const SLIDES_TELEMETRY_RETENTION_MAX = 500;
const unsavedTelemetryEvents = [];
const SLIDES_IMPORT_TRACE_PHASES = ['parse-start', 'parse-end', 'parse-error', 'parse-canceled', 'parse-fallback'];
const SLIDES_IMPORT_TRACE_RETENTION_MAX = 300;

function generateCorrelationId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `slides-${Date.now().toString(36)}-${random}`;
}

function extractCloudflareRayId(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/ray id[:\s-]*([a-z0-9]+)/i);
  return match && match[1] ? match[1] : null;
}

function summarizeFailureMessage(rawMessage) {
  const text = typeof rawMessage === 'string' ? rawMessage.trim() : String(rawMessage || '').trim();
  if (!text) return 'Slides request failed.';

  if (/<!doctype html/i.test(text) || /<html/i.test(text)) {
    const rayId = extractCloudflareRayId(text);
    return rayId
      ? `Slides upstream runtime exception (Cloudflare Ray ID ${rayId}).`
      : 'Slides upstream runtime exception.';
  }

  const compact = text.replace(/\s+/g, ' ');
  if (compact.length <= MAX_ERROR_MESSAGE_LENGTH) return compact;
  return compact.slice(0, MAX_ERROR_MESSAGE_LENGTH) + '...';
}

function classifyFailureClass(status, message) {
  if (status === 400) return 'validation_error';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 408) return 'timeout';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status === 502 || status === 503 || status === 504) return 'upstream_unavailable';
  if (status >= 500) return 'server_error';
  if (/runtime exception/i.test(message)) return 'upstream_runtime';
  return 'request_error';
}

function isRetryableFailure(status, failureClass) {
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;
  return failureClass === 'upstream_unavailable' || failureClass === 'upstream_runtime' || failureClass === 'timeout';
}

function buildFailureEnvelope(message, status = 500, options = {}) {
  const safeMessage = summarizeFailureMessage(message);
  const correlationId = typeof options.correlation_id === 'string' && options.correlation_id
    ? options.correlation_id
    : generateCorrelationId();
  const rayId = options.ray_id || extractCloudflareRayId(safeMessage) || null;
  const failureClass = options.failure_class || classifyFailureClass(status, safeMessage);
  const retryable = typeof options.retryable === 'boolean'
    ? options.retryable
    : isRetryableFailure(status, failureClass);

  const errorDetail = {
    code: options.code || 'slides_api_error',
    status,
    failure_class: failureClass,
    retryable,
    correlation_id: correlationId,
    ray_id: rayId,
    endpoint: '/api/slides',
    method: options.method || null,
    actor_user_id: options.actor_user_id || null,
    actor_email: options.actor_email || null,
    timestamp: new Date().toISOString(),
  };

  const logPayload = {
    level: status >= 500 ? 'error' : 'warn',
    message: safeMessage,
    ...errorDetail,
  };
  if (status >= 500) {
    console.error('[slides-api-failure]', JSON.stringify(logPayload));
  } else {
    console.warn('[slides-api-failure]', JSON.stringify(logPayload));
  }

  return {
    ok: false,
    error: safeMessage,
    error_detail: errorDetail,
  };
}

function errorResponse(message, status = 500, options = {}) {
  const envelope = buildFailureEnvelope(message, status, options);
  return new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'x-slides-correlation-id': envelope.error_detail.correlation_id,
    },
  });
}

function resolveServiceKey(env) {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || null;
}

function resolveSupabaseUrl(env) {
  return env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || null;
}

function serviceHeaders(env) {
  const key = resolveServiceKey(env);
  return {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
  };
}

function assertSupabaseConfigured(env) {
  if (!resolveSupabaseUrl(env)) {
    return errorResponse('Supabase URL not configured for /api/slides. Set SUPABASE_URL (preferred) or NEXT_PUBLIC_SUPABASE_URL.', 503);
  }
  if (!resolveServiceKey(env)) {
    return errorResponse('Supabase admin key not configured for /api/slides. Set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_SERVICE_KEY.', 503);
  }
  return null;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizeUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseOwnerPolicy(env) {
  const ownerEmails = new Set(
    [...DEFAULT_OWNER_EMAILS, ...(env.OWNER_EMAILS || '').split(',')]
      .map((item) => normalizeEmail(item))
      .filter(Boolean),
  );
  const ownerUserIds = new Set(
    (env.OWNER_USER_IDS || '')
      .split(',')
      .map((item) => normalizeUserId(item))
      .filter(Boolean),
  );
  return { ownerEmails, ownerUserIds };
}

function isOwnerIdentity(identity, ownerPolicy) {
  if (!identity || !ownerPolicy) return false;
  const email = normalizeEmail(identity.email || '');
  const userId = normalizeUserId(identity.userId || '');
  if (email && ownerPolicy.ownerEmails.has(email)) return true;
  if (userId && ownerPolicy.ownerUserIds.has(userId)) return true;
  return false;
}

function enforceOwnerInvariant(appUser, identity, ownerPolicy) {
  const owner = isOwnerIdentity({
    email: appUser?.email || identity?.email || '',
    userId: appUser?.user_id || identity?.userId || '',
  }, ownerPolicy);

  if (!owner) return appUser || null;

  const userId = normalizeUserId(appUser?.user_id || identity?.userId || 'owner');
  const email = normalizeEmail(appUser?.email || identity?.email || '');
  return {
    ...(appUser || {}),
    user_id: userId || 'owner',
    email,
    role: 'admin',
    page_permissions: [...ALL_PAGE_PERMISSIONS],
  };
}

function normalizeActorBody(raw) {
  const actor = raw && typeof raw === 'object' ? raw : {};
  return {
    user_id: typeof actor.user_id === 'string' ? actor.user_id.trim() : '',
    user_email: normalizeEmail(actor.user_email || ''),
  };
}

function shouldTrustClientIdentity(env) {
  if (env.SLIDES_TRUST_CLIENT_IDENTITY === '1') return true;
  if (env.SLIDES_TRUST_CLIENT_IDENTITY === '0') return false;
  if (env.USERS_TRUST_CLIENT_IDENTITY === '1') return true;
  if (env.USERS_TRUST_CLIENT_IDENTITY === '0') return false;
  // Default to trusted app-provided actor identity for slides to avoid
  // hard module dead-ends when CF Access headers are unavailable.
  return true;
}

function resolveActorIdentity(request, body, env) {
  const cfAccessEmail = normalizeEmail(request.headers.get('cf-access-authenticated-user-email') || '');
  if (cfAccessEmail) {
    return { source: 'cf-access', userId: '', email: cfAccessEmail };
  }

  const trustClientIdentity = shouldTrustClientIdentity(env);
  if (!trustClientIdentity) return null;

  const bodyActor = normalizeActorBody(body?.actor || body || {});
  const userId = bodyActor.user_id
    || (typeof body?.user_id === 'string' ? body.user_id.trim() : '')
    || (typeof body?.actor_user_id === 'string' ? body.actor_user_id.trim() : '')
    || (request.headers.get('x-user-id') || '').trim();
  const userEmail = bodyActor.user_email
    || normalizeEmail(body?.user_email || '')
    || normalizeEmail(body?.actor_email || '')
    || normalizeEmail(request.headers.get('x-user-email') || '');

  if (!userId && !userEmail) return null;
  return { source: 'client', userId, email: userEmail };
}

function resolveActorIdentityFromQuery(request, env) {
  const cfAccessEmail = normalizeEmail(request.headers.get('cf-access-authenticated-user-email') || '');
  if (cfAccessEmail) {
    return { source: 'cf-access', userId: '', email: cfAccessEmail };
  }

  const trustClientIdentity = shouldTrustClientIdentity(env);
  if (!trustClientIdentity) return null;

  const url = new URL(request.url);
  const userId = (
    request.headers.get('x-user-id')
    || url.searchParams.get('user_id')
    || url.searchParams.get('actor_user_id')
    || ''
  ).trim();
  const userEmail = normalizeEmail(
    request.headers.get('x-user-email')
    || url.searchParams.get('user_email')
    || url.searchParams.get('actor_email')
    || '',
  );

  if (!userId && !userEmail) return null;
  return { source: 'client', userId, email: userEmail };
}

async function fetchActorAppUser(env, identity) {
  const supabaseUrl = resolveSupabaseUrl(env);
  let path = '';

  if (identity.email && identity.userId) {
    path = '/rest/v1/app_users?or=(email.eq.' + encodeURIComponent(identity.email) + ',user_id.eq.' + encodeURIComponent(identity.userId) + ')&select=user_id,email,role,page_permissions&limit=1';
  } else if (identity.email) {
    path = '/rest/v1/app_users?email=eq.' + encodeURIComponent(identity.email) + '&select=user_id,email,role,page_permissions&limit=1';
  } else if (identity.userId) {
    path = '/rest/v1/app_users?user_id=eq.' + encodeURIComponent(identity.userId) + '&select=user_id,email,role,page_permissions&limit=1';
  } else {
    return { ok: false, status: 401, error: 'Missing actor identity for slide operation.' };
  }

  const response = await fetch(supabaseUrl + path, { headers: serviceHeaders(env) });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, status: response.status, error: 'Actor lookup failed: ' + text };
  }

  const rows = await response.json().catch(() => []);
  return { ok: true, row: rows[0] || null };
}

async function readAppUserByIdentifier(env, userId, email) {
  const trimmedUserId = typeof userId === 'string' ? userId.trim() : '';
  const normalizedEmail = normalizeEmail(email || '');
  if (!trimmedUserId && !normalizedEmail) return null;

  const lookup = await fetchActorAppUser(env, {
    userId: trimmedUserId,
    email: normalizedEmail,
  });
  if (!lookup.ok) throw new Error(lookup.error || 'Target user lookup failed');
  return lookup.row || null;
}

function isAuthorizedSlidesActor(appUser) {
  if (!appUser) return false;
  if (appUser.role === 'admin') return true;
  if (!Array.isArray(appUser.page_permissions)) return false;
  return appUser.page_permissions.some((permission) => typeof permission === 'string' && permission.toLowerCase() === 'slides');
}

async function authorizeActor(request, body, env) {
  const identity = resolveActorIdentity(request, body, env);
  if (!identity) return { ok: false, status: 401, error: 'Unauthorized slide write request. Missing verified actor identity.' };
  const ownerPolicy = parseOwnerPolicy(env);

  const actorLookup = await fetchActorAppUser(env, identity);
  if (!actorLookup.ok) return actorLookup;
  const actor = enforceOwnerInvariant(actorLookup.row, identity, ownerPolicy);

  if (!isAuthorizedSlidesActor(actor)) {
    return { ok: false, status: 403, error: 'Forbidden. Slides permission required.' };
  }

  return { ok: true, actor };
}

async function authorizeActorForRead(request, env) {
  const identity = resolveActorIdentityFromQuery(request, env);
  if (!identity) return { ok: false, status: 401, error: 'Unauthorized slide read request. Missing verified actor identity.' };
  const ownerPolicy = parseOwnerPolicy(env);

  const actorLookup = await fetchActorAppUser(env, identity);
  if (!actorLookup.ok) return actorLookup;
  const actor = enforceOwnerInvariant(actorLookup.row, identity, ownerPolicy);

  if (!isAuthorizedSlidesActor(actor)) {
    return { ok: false, status: 403, error: 'Forbidden. Slides permission required.' };
  }

  return { ok: true, actor };
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeCanvas(rawCanvas) {
  if (!isObject(rawCanvas)) return null;
  const width = Number(rawCanvas.width);
  const height = Number(rawCanvas.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  const rawBackground = typeof rawCanvas.background === 'string' ? rawCanvas.background.trim() : '';
  const background = rawBackground && rawBackground.length <= 512 ? rawBackground : null;
  return {
    width,
    height,
    ...(background ? { background } : {}),
  };
}

function sanitizeComponents(rawComponents) {
  if (!Array.isArray(rawComponents)) return null;
  if (rawComponents.length > MAX_COMPONENTS_PER_SLIDE) return null;
  return rawComponents;
}

function sanitizeTitle(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_TITLE_LENGTH) return null;
  return trimmed;
}

function sanitizeTemplateDescription(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEMPLATE_DESCRIPTION_LENGTH) return null;
  return trimmed || fallback;
}

function sanitizeCollaboratorRole(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!TEMPLATE_COLLABORATOR_ROLES.includes(trimmed)) return null;
  return trimmed;
}

function sanitizeApprovalType(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!TEMPLATE_APPROVAL_TYPES.includes(trimmed)) return null;
  return trimmed;
}

function sanitizeApprovalStatus(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!TEMPLATE_APPROVAL_STATUSES.includes(trimmed)) return null;
  return trimmed;
}

function sanitizeEscalationReason(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length > MAX_APPROVAL_ESCALATION_REASON_LENGTH) return null;
  return trimmed;
}

function parseCsvList(value, normalizeItem) {
  if (typeof value !== 'string') return [];
  const parsed = value
    .split(',')
    .map((item) => normalizeItem(item))
    .filter(Boolean);
  return Array.from(new Set(parsed));
}

function resolveEscalationChannels(env) {
  const configured = parseCsvList(
    env.SLIDES_APPROVAL_ESCALATION_CHANNELS || env.SLIDES_ESCALATION_CHANNELS || '',
    (item) => String(item || '').trim().toLowerCase(),
  ).filter((channel) => SUPPORTED_ESCALATION_CHANNELS.includes(channel));
  if (configured.length > 0) return configured;
  return [...DEFAULT_ESCALATION_CHANNELS];
}

function resolveEscalationTargets(env, ownerPolicy) {
  const configuredUserIds = parseCsvList(
    env.SLIDES_APPROVAL_ESCALATION_TARGET_USER_IDS || '',
    (item) => normalizeUserId(item),
  );
  const configuredEmails = parseCsvList(
    env.SLIDES_APPROVAL_ESCALATION_TARGET_EMAILS || '',
    (item) => normalizeEmail(item),
  );

  const targetKeys = new Set();
  const targets = [];
  const pushTarget = (userId, email) => {
    const normalizedUserId = normalizeUserId(userId || '');
    const normalizedEmail = normalizeEmail(email || '');
    if (!normalizedUserId && !normalizedEmail) return;
    const key = `${normalizedUserId}::${normalizedEmail}`;
    if (targetKeys.has(key)) return;
    targetKeys.add(key);
    targets.push({
      user_id: normalizedUserId || null,
      user_email: normalizedEmail || null,
    });
  };

  for (const userId of configuredUserIds) pushTarget(userId, '');
  for (const email of configuredEmails) pushTarget('', email);

  if (targets.length === 0 && ownerPolicy) {
    for (const ownerUserId of ownerPolicy.ownerUserIds || []) {
      pushTarget(ownerUserId, '');
    }
    for (const ownerEmail of ownerPolicy.ownerEmails || []) {
      pushTarget('', ownerEmail);
    }
  }

  return targets;
}

function resolveEscalationRoutingConfig(env) {
  const ownerPolicy = parseOwnerPolicy(env);
  const channels = resolveEscalationChannels(env);
  const targets = resolveEscalationTargets(env, ownerPolicy);
  const emailFrom = normalizeEmail(env.SLIDES_APPROVAL_ESCALATION_EMAIL_FROM || '');
  const slackWebhook = typeof env.SLIDES_APPROVAL_ESCALATION_SLACK_WEBHOOK_URL === 'string'
    ? env.SLIDES_APPROVAL_ESCALATION_SLACK_WEBHOOK_URL.trim()
    : '';

  return {
    channels,
    targets,
    adapters: {
      in_app_enabled: channels.includes('in-app'),
      email_enabled: channels.includes('email'),
      email_from: emailFrom || null,
      slack_enabled: channels.includes('slack'),
      slack_webhook_configured: !!slackWebhook,
    },
  };
}

function sanitizeAuditPresetScope(value, fallback = 'personal') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().toLowerCase();
  if (!AUDIT_PRESET_SCOPES.includes(trimmed)) return fallback;
  return trimmed;
}

function sanitizeAuditExportStatus(value, fallback = 'all') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'all') return 'all';
  if (!AUDIT_EXPORT_JOB_STATUSES.includes(trimmed)) return fallback;
  return trimmed;
}

function sanitizeAuditPresetName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 120) return null;
  return trimmed;
}

function hasValidSlidesJobToken(request, env) {
  const configuredToken = typeof env.SLIDES_JOB_TOKEN === 'string' ? env.SLIDES_JOB_TOKEN.trim() : '';
  if (!configuredToken) return false;
  const headerToken = (request.headers.get('x-slides-job-token') || '').trim();
  if (!headerToken) return false;
  return headerToken === configuredToken;
}

function resolveSlidesAutomationActor(env) {
  const userId = normalizeUserId(env.SLIDES_AUTOMATION_ACTOR_USER_ID || '') || 'slides-automation';
  const email = normalizeEmail(env.SLIDES_AUTOMATION_ACTOR_EMAIL || '') || null;
  return {
    user_id: userId,
    email,
    role: 'admin',
    page_permissions: [...ALL_PAGE_PERMISSIONS],
  };
}

function resolveSweepMinIntervalMinutes(env) {
  const raw = Number.parseInt(String(env.SLIDES_APPROVAL_SWEEP_MIN_INTERVAL_MINUTES || DEFAULT_SWEEP_MIN_INTERVAL_MINUTES), 10);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_SWEEP_MIN_INTERVAL_MINUTES;
  return Math.max(5, Math.min(raw, 24 * 60));
}

function normalizeMetadata(rawMetadata) {
  if (!isObject(rawMetadata)) return {};
  return rawMetadata;
}

function getTemplatePreviewFingerprint(templateId, canvas, components) {
  const safeCanvas = canvas && typeof canvas === 'object' ? canvas : { width: 1920, height: 1080 };
  const safeComponents = Array.isArray(components) ? components : [];
  return [
    templateId,
    String(safeCanvas.width || 0),
    String(safeCanvas.height || 0),
    ...safeComponents
      .filter((component) => component && component.visible !== false)
      .map((component) => `${component.id}:${component.type}:${component.x}:${component.y}:${component.width}:${component.height}:${component.content || ''}`),
  ].join('|');
}

function normalizeTemplatePreview(rawPreview) {
  if (!rawPreview || typeof rawPreview !== 'object') return null;
  const version = Number.parseInt(String(rawPreview.version || 0), 10);
  const visibleComponentCount = Number.parseInt(String(rawPreview.visible_component_count || 0), 10);
  if (rawPreview.status !== 'ready' && rawPreview.status !== 'missing') return null;
  return {
    asset_key: typeof rawPreview.asset_key === 'string' ? rawPreview.asset_key : '',
    asset_url: typeof rawPreview.asset_url === 'string' ? rawPreview.asset_url : '',
    fingerprint: typeof rawPreview.fingerprint === 'string' ? rawPreview.fingerprint : '',
    generated_at: typeof rawPreview.generated_at === 'string' ? rawPreview.generated_at : null,
    generated_by_user_id: typeof rawPreview.generated_by_user_id === 'string' ? rawPreview.generated_by_user_id : null,
    status: rawPreview.status,
    version: Number.isFinite(version) && version > 0 ? version : 1,
    visible_component_count: Number.isFinite(visibleComponentCount) && visibleComponentCount >= 0 ? visibleComponentCount : 0,
  };
}

function deriveTemplateStructureFromComponents(components) {
  const visibleComponents = Array.isArray(components)
    ? components.filter((component) => component && component.visible !== false)
    : [];
  const lockedElementIds = visibleComponents
    .filter((component) => component.locked === true)
    .map((component) => component.id)
    .filter(Boolean);
  const editableZoneIds = visibleComponents
    .filter((component) => component.locked !== true)
    .map((component) => component.id)
    .filter(Boolean);
  const layoutBlocks = visibleComponents.map((component) => ({
    id: `block-${component.id}`,
    label: component.sourceLabel || component.type,
    component_ids: [component.id],
  }));

  return {
    locked_element_ids: lockedElementIds,
    editable_zone_ids: editableZoneIds,
    layout_blocks: layoutBlocks,
  };
}

function buildTemplatePreviewSnapshot(template, actorUserId, previousPreview = null) {
  const safeComponents = Array.isArray(template.components_json) ? template.components_json : [];
  const visibleComponentCount = safeComponents.filter((component) => component && component.visible !== false).length;
  const priorPreview = normalizeTemplatePreview(previousPreview);
  const version = Math.max(1, (priorPreview?.version || 0) + 1);
  return {
    asset_key: `template-preview:${template.id}:v${version}`,
    asset_url: `/api/slides/template-preview/${encodeURIComponent(template.id)}?v=${version}`,
    fingerprint: getTemplatePreviewFingerprint(template.id, template.canvas, safeComponents),
    generated_at: new Date().toISOString(),
    generated_by_user_id: actorUserId || null,
    status: visibleComponentCount > 0 ? 'ready' : 'missing',
    version,
    visible_component_count: visibleComponentCount,
  };
}

function normalizeSlideRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    title: row.title,
    canvas: row.canvas || { width: 1920, height: 1080 },
    components: Array.isArray(row.components_json) ? row.components_json : [],
    metadata: row.metadata || {},
    revision: row.revision || 1,
    source: row.source || 'manual',
    source_template_id: row.source_template_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_edited_at: row.last_edited_at,
  };
}

function normalizeTemplateRow(row) {
  if (!row || typeof row !== 'object') return null;
  const metadata = row.metadata || {};
  const structure = deriveTemplateStructureFromComponents(row.components_json || metadata.components_json || []);
  return {
    id: row.id,
    owner_user_id: row.owner_user_id || null,
    name: row.name,
    description: row.description || '',
    is_shared: !!row.is_shared,
    is_archived: row.is_archived === true,
    canvas: row.canvas || { width: 1920, height: 1080 },
    components: Array.isArray(row.components_json) ? row.components_json : [],
    locked_element_ids: Array.isArray(metadata.locked_element_ids) ? metadata.locked_element_ids : structure.locked_element_ids,
    editable_zone_ids: Array.isArray(metadata.editable_zone_ids) ? metadata.editable_zone_ids : structure.editable_zone_ids,
    layout_blocks: Array.isArray(metadata.layout_blocks) ? metadata.layout_blocks : structure.layout_blocks,
    preview: normalizeTemplatePreview(metadata.preview),
    metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeTemplateCollaboratorRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    template_id: row.template_id,
    user_id: row.user_id,
    user_email: row.user_email || null,
    role: row.role,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeTemplateApprovalRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    template_id: row.template_id,
    requested_by_user_id: row.requested_by_user_id,
    requested_by_email: row.requested_by_email || null,
    approval_type: row.approval_type,
    payload: row.payload || {},
    status: row.status,
    review_note: row.review_note || null,
    reviewed_by_user_id: row.reviewed_by_user_id || null,
    reviewed_at: row.reviewed_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeImportSessionTraceRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: typeof row.id === 'string' ? row.id : '',
    correlation_id: typeof row.correlation_id === 'string' ? row.correlation_id : '',
    actor_user_id: typeof row.actor_user_id === 'string' ? row.actor_user_id : '',
    actor_email: typeof row.actor_email === 'string' ? row.actor_email : null,
    phase: typeof row.phase === 'string' ? row.phase : 'parse-end',
    source: typeof row.source === 'string' ? row.source : 'unknown',
    taxonomy_buckets: isObject(row.taxonomy_buckets) ? row.taxonomy_buckets : {},
    counters: isObject(row.counters) ? row.counters : {},
    duration_ms: Number.isFinite(row.duration_ms) ? Number(row.duration_ms) : null,
    error_code: typeof row.error_code === 'string' ? row.error_code : null,
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

function normalizeAuditPresetRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    name: row.name,
    scope: sanitizeAuditPresetScope(row.scope || 'personal'),
    search: typeof row.search === 'string' ? row.search : '',
    action: typeof row.action_filter === 'string' ? row.action_filter : 'all',
    outcome: typeof row.outcome_filter === 'string' ? row.outcome_filter : 'all',
    entity_type: typeof row.entity_type_filter === 'string' ? row.entity_type_filter : 'all',
    date_from: typeof row.date_from === 'string' ? row.date_from : '',
    date_to: typeof row.date_to === 'string' ? row.date_to : '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeAuditExportJobRow(row) {
  if (!row || typeof row !== 'object') return null;
  const rawFilters = isObject(row.filters) ? row.filters : {};
  const search = typeof rawFilters.search === 'string' ? rawFilters.search : '';
  const action = typeof rawFilters.action === 'string' && (rawFilters.action === 'all' || AUDIT_ACTIONS.includes(rawFilters.action))
    ? rawFilters.action
    : 'all';
  const outcome = typeof rawFilters.outcome === 'string' && (rawFilters.outcome === 'all' || AUDIT_OUTCOMES.includes(rawFilters.outcome))
    ? rawFilters.outcome
    : 'all';
  const entityType = typeof rawFilters.entity_type === 'string' && (rawFilters.entity_type === 'all' || AUDIT_ENTITY_TYPES.includes(rawFilters.entity_type))
    ? rawFilters.entity_type
    : 'all';
  const dateFrom = typeof rawFilters.date_from === 'string' ? rawFilters.date_from : '';
  const dateTo = typeof rawFilters.date_to === 'string' ? rawFilters.date_to : '';

  return {
    id: row.id,
    requested_by_user_id: row.requested_by_user_id,
    requested_by_email: row.requested_by_email || null,
    status: sanitizeAuditExportStatus(row.status, 'queued'),
    filters: {
      search,
      action,
      outcome,
      entity_type: entityType,
      date_from: dateFrom,
      date_to: dateTo,
    },
    row_count: Number.isFinite(row.row_count) ? Math.max(0, Number(row.row_count)) : 0,
    file_name: typeof row.file_name === 'string' && row.file_name.trim() ? row.file_name : null,
    csv_content: typeof row.csv_content === 'string' ? row.csv_content : null,
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    requested_at: row.requested_at || row.created_at || null,
    started_at: row.started_at || null,
    completed_at: row.completed_at || null,
    updated_at: row.updated_at || row.created_at || null,
  };
}

function normalizePptxExportStatus(value, fallback = 'queued') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().toLowerCase();
  if (!PPTX_EXPORT_JOB_STATUSES.includes(trimmed)) return fallback;
  return trimmed;
}

function sanitizePptxExportSlides(rawSlides) {
  if (!Array.isArray(rawSlides) || rawSlides.length === 0) return null;
  if (rawSlides.length > MAX_PPTX_EXPORT_SLIDES) return null;

  const sanitized = [];
  for (const entry of rawSlides) {
    if (!isObject(entry)) return null;
    const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null;
    const title = typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : 'Untitled Slide';
    const canvas = sanitizeCanvas(entry.canvas);
    const components = sanitizeComponents(entry.components);
    const document = sanitizeSlideDocument(entry.document);
    const fontFaces = sanitizePptxFontFaces(entry.font_faces);
    if (!id || !canvas || !components) return null;
    sanitized.push({ id, title, canvas, components, document, font_faces: fontFaces });
  }
  return sanitized;
}

function sanitizePptxFontFaces(rawFontFaces) {
  if (!Array.isArray(rawFontFaces)) return [];
  const sanitized = [];
  for (const entry of rawFontFaces) {
    if (!isObject(entry)) continue;
    const family = typeof entry.family === 'string' && entry.family.trim() ? entry.family.trim() : '';
    const srcUrl = typeof entry.src_url === 'string' && entry.src_url.trim() ? entry.src_url.trim() : '';
    if (!family || !srcUrl) continue;
    const weightRaw = Number.parseInt(String(entry.weight ?? 400), 10);
    const weight = Number.isFinite(weightRaw) ? Math.max(100, Math.min(900, weightRaw)) : 400;
    const styleRaw = typeof entry.style === 'string' ? entry.style.trim().toLowerCase() : 'normal';
    const style = styleRaw === 'italic' ? 'italic' : 'normal';
    sanitized.push({
      family,
      weight,
      style,
      src_url: srcUrl,
      embed_allowed: entry.embed_allowed !== false,
    });
  }
  return sanitized.slice(0, 100);
}

function sanitizeSlideDocument(rawDocument) {
  if (!isObject(rawDocument) || !isObject(rawDocument.deck)) return null;
  const version = Number.isFinite(rawDocument.version) ? Math.max(1, Number(rawDocument.version)) : 1;
  const width = Number.isFinite(rawDocument.deck.width) ? Math.max(1, Number(rawDocument.deck.width)) : null;
  const height = Number.isFinite(rawDocument.deck.height) ? Math.max(1, Number(rawDocument.deck.height)) : null;
  const deckId = typeof rawDocument.deck.id === 'string' && rawDocument.deck.id.trim() ? rawDocument.deck.id.trim() : 'deck-1';
  if (!width || !height || !Array.isArray(rawDocument.deck.slides) || rawDocument.deck.slides.length === 0) return null;

  const slides = [];
  for (const slide of rawDocument.deck.slides.slice(0, MAX_PPTX_EXPORT_SLIDES)) {
    if (!isObject(slide)) return null;
    const id = typeof slide.id === 'string' && slide.id.trim() ? slide.id.trim() : null;
    const elements = sanitizeComponents(slide.elements);
    if (!id || !elements) return null;
    const backgroundFill = isObject(slide.background) && typeof slide.background.fill === 'string' && slide.background.fill.trim()
      ? slide.background.fill.trim()
      : null;
    slides.push({
      id,
      elements,
      ...(backgroundFill ? { background: { fill: backgroundFill } } : {}),
    });
  }

  const warnings = Array.isArray(rawDocument.warnings)
    ? rawDocument.warnings.filter((entry) => typeof entry === 'string').slice(0, MAX_PPTX_EXPORT_WARNINGS)
    : [];

  return {
    version,
    deck: {
      id: deckId,
      width,
      height,
      slides,
    },
    warnings,
  };
}

function sanitizePptxSlideIds(rawSlideIds) {
  if (!Array.isArray(rawSlideIds)) return [];
  const ids = rawSlideIds
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(ids)).slice(0, MAX_PPTX_EXPORT_SLIDES);
}

function sanitizePptxFilenamePrefix(value) {
  if (typeof value !== 'string') return 'slides-export';
  const trimmed = value.trim();
  if (!trimmed) return 'slides-export';
  return trimmed.slice(0, 120);
}

function sanitizePptxIdempotencyKey(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 160);
}

function sanitizePptxMaxAttempts(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return Math.max(1, Math.min(parsed, MAX_PPTX_EXPORT_ATTEMPTS));
}

function sanitizePptxAnimationProfile(value) {
  if (typeof value !== 'string') return 'default';
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'default' || trimmed === 'conservative' || trimmed === 'disabled') return trimmed;
  return 'default';
}

function inferDashboardSurface(component) {
  const content = typeof component?.content === 'string' ? component.content.toLowerCase() : '';
  const sourceLabel = typeof component?.sourceLabel === 'string' ? component.sourceLabel.toLowerCase() : '';
  const componentType = typeof component?.type === 'string' ? component.type.toLowerCase() : '';

  if (content.includes('<table') || sourceLabel.includes('table')) return 'table';
  if (content.includes('<canvas') || sourceLabel.includes('canvas')) return 'canvas';
  if (content.includes('echarts') || content.includes('chart.js') || content.includes('chartjs')) return 'canvas-chart';
  if (sourceLabel.includes('chart')) return 'canvas';
  if (componentType === 'logo' && content.includes('data:image/svg+xml')) return 'svg';
  if (content.includes('<svg') || content.includes('data:image/svg+xml') || sourceLabel.includes('svg')) return 'svg';
  return null;
}

function normalizeCssTextToken(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function sanitizeTelemetryEventType(value) {
  return SLIDES_TELEMETRY_EVENT_TYPES.includes(value) ? value : null;
}

function sanitizeTelemetryWorkspaceTab(value) {
  return SLIDES_TELEMETRY_WORKSPACE_TABS.includes(value) ? value : null;
}

function sanitizeTelemetrySaveStatus(value) {
  return SLIDES_TELEMETRY_SAVE_STATUSES.includes(value) ? value : null;
}

function sanitizeTelemetryTriggerSource(value) {
  return SLIDES_TELEMETRY_TRIGGER_SOURCES.includes(value) ? value : null;
}

function sanitizeImportTracePhase(value) {
  return SLIDES_IMPORT_TRACE_PHASES.includes(value) ? value : null;
}

function buildTelemetrySummary(events, from, to, env) {
  const discardCount = events.filter((event) => event.event_type === 'discard-draft' || event.event_type === 'confirm-leave').length;
  const retryCount = events.filter((event) => event.event_type === 'autosave-retry').length;
  const promptCount = events.filter((event) => event.event_type === 'unsaved-prompt').length;
  const promptCancelCount = events.filter((event) => event.event_type === 'cancel-leave').length;
  const safePromptBase = promptCount || 1;
  const totalEvents = events.length;
  return {
    totals: {
      events: totalEvents,
      discard_count: discardCount,
      retry_count: retryCount,
      prompt_count: promptCount,
      prompt_cancel_count: promptCancelCount,
    },
    rates: {
      discard_rate: Number((discardCount / safePromptBase).toFixed(4)),
      retry_rate: Number((retryCount / Math.max(totalEvents, 1)).toFixed(4)),
      prompt_cancel_rate: Number((promptCancelCount / safePromptBase).toFixed(4)),
    },
    window: { from, to },
    thresholds: {
      discard_rate_alert: Number.parseFloat((env?.SLIDES_DISCARD_RATE_ALERT_THRESHOLD || '0.2')),
      retry_rate_alert: Number.parseFloat((env?.SLIDES_RETRY_RATE_ALERT_THRESHOLD || '0.15')),
    },
    privacy: {
      actor_email: 'optional',
      actor_user_id: 'required',
      slide_id: 'optional',
    },
    retention: {
      local_max_events: SLIDES_TELEMETRY_RETENTION_MAX,
      policy: 'Unsaved telemetry excludes raw HTML/content payloads and retains bounded recent event history.',
    },
  };
}

function extractStyleBag(component) {
  const style = isObject(component?.style) ? component.style : {};
  const computed = isObject(component?.computed_style) ? component.computed_style : {};
  return {
    ...computed,
    ...style,
  };
}

function readStyleValue(styleBag, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(styleBag, key)) {
      const value = styleBag[key];
      if (value !== null && value !== undefined) return value;
    }
  }
  return undefined;
}

function parseCssNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^-?\d*\.?\d+/);
  if (!match) return fallback;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitCssArgs(value) {
  if (typeof value !== 'string') return [];
  const tokens = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      tokens.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  tokens.push(value.slice(start).trim());
  return tokens.filter(Boolean);
}

function parseCssColor(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return { hex: raw.slice(1).toUpperCase(), alpha: 1 };
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const [, r, g, b] = raw;
    return { hex: `${r}${r}${g}${g}${b}${b}`.toUpperCase(), alpha: 1 };
  }
  if (/^#[0-9a-f]{8}$/i.test(raw)) {
    const rgb = raw.slice(1, 7).toUpperCase();
    const alpha = Number.parseInt(raw.slice(7), 16) / 255;
    return {
      hex: rgb,
      alpha: Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1,
    };
  }
  const rgbMatch = raw.match(/^rgba?\(([^,]+),\s*([^,]+),\s*([^,\)]+)(?:,\s*([^\)]+))?\)$/i);
  if (!rgbMatch) return null;
  const channels = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((item) => Number.parseInt(item.trim(), 10));
  if (!channels.every((entry) => Number.isFinite(entry) && entry >= 0 && entry <= 255)) return null;
  const alphaRaw = rgbMatch[4] ? Number.parseFloat(rgbMatch[4].trim()) : 1;
  if (!Number.isFinite(alphaRaw)) return null;
  return {
    hex: channels.map((entry) => entry.toString(16).padStart(2, '0')).join('').toUpperCase(),
    alpha: Math.max(0, Math.min(1, alphaRaw)),
  };
}

function parseGradientStops(rawStops) {
  const stops = [];
  for (let index = 0; index < rawStops.length; index += 1) {
    const token = rawStops[index];
    const posMatch = token.match(/(-?\d*\.?\d+)%\s*$/);
    const colorToken = posMatch ? token.slice(0, posMatch.index).trim() : token.trim();
    const color = parseCssColor(colorToken);
    if (!color) continue;
    const inferredPos = rawStops.length <= 1 ? 0 : Math.round((index / (rawStops.length - 1)) * 100);
    const explicitPos = posMatch ? Math.max(0, Math.min(100, Math.round(Number.parseFloat(posMatch[1])))) : inferredPos;
    stops.push({ color: color.hex, alpha: color.alpha, position_percent: explicitPos });
  }
  return stops.length >= 2 ? stops : null;
}

function parseGradientFill(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const linear = trimmed.match(/^linear-gradient\(([\s\S]+)\)$/i);
  if (linear) {
    const args = splitCssArgs(linear[1] || '');
    if (args.length < 2) return null;
    let angleDeg = 180;
    let stopStart = 0;
    const first = normalizeCssTextToken(args[0]);
    if (/^-?\d*\.?\d+deg$/.test(first)) {
      angleDeg = Number.parseFloat(first.replace('deg', ''));
      stopStart = 1;
    }
    const stops = parseGradientStops(args.slice(stopStart));
    if (!stops) return null;
    return {
      type: 'linear',
      angle_deg: Number.isFinite(angleDeg) ? angleDeg : 180,
      stops,
    };
  }

  const radial = trimmed.match(/^radial-gradient\(([\s\S]+)\)$/i);
  if (radial) {
    const args = splitCssArgs(radial[1] || '');
    if (args.length < 2) return null;
    let stopStart = 0;
    const first = normalizeCssTextToken(args[0]);
    if (/^(circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|at )/.test(first)) {
      stopStart = 1;
    }
    const stops = parseGradientStops(args.slice(stopStart));
    if (!stops) return null;
    return {
      type: 'radial',
      stops,
    };
  }
  return null;
}

function parseShadow(value) {
  if (typeof value !== 'string') return null;
  const parts = splitCssArgs(value);
  if (parts.length > 1) return { unsupported: true, reason: 'multiple-shadows' };
  const candidate = parts[0] || '';
  if (!candidate || /\binset\b/i.test(candidate)) {
    return candidate ? { unsupported: true, reason: 'inset-shadow' } : null;
  }
  const colorMatch = candidate.match(/(rgba?\([^\)]*\)|#[0-9a-fA-F]{3,8})/);
  const color = parseCssColor(colorMatch?.[1] || '');
  if (!color) return { unsupported: true, reason: 'invalid-shadow-color' };
  const clean = candidate.replace(colorMatch?.[1] || '', ' ');
  const lengths = clean.match(/-?\d*\.?\d+px/g) || [];
  if (lengths.length < 2) return { unsupported: true, reason: 'invalid-shadow-lengths' };
  const x = parseCssNumber(lengths[0], 0);
  const y = parseCssNumber(lengths[1], 0);
  const blur = lengths[2] ? Math.max(0, parseCssNumber(lengths[2], 0)) : 0;
  return {
    x_px: x,
    y_px: y,
    blur_px: blur,
    color: color.hex,
    alpha: color.alpha,
  };
}

function parseBorderRadiusValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/%/.test(trimmed)) return { unsupported: true, reason: 'percent-radius' };
  const parsed = parseCssNumber(trimmed, NaN);
  if (!Number.isFinite(parsed)) return { unsupported: true, reason: 'invalid-radius' };
  return Math.max(0, parsed);
}

function normalizeComponentOrder(components) {
  return [...components].sort((left, right) => {
    const yDelta = parseCssNumber(left?.y, 0) - parseCssNumber(right?.y, 0);
    if (Math.abs(yDelta) > 0.01) return yDelta;
    const xDelta = parseCssNumber(left?.x, 0) - parseCssNumber(right?.x, 0);
    if (Math.abs(xDelta) > 0.01) return xDelta;
    const leftId = typeof left?.id === 'string' ? left.id : '';
    const rightId = typeof right?.id === 'string' ? right.id : '';
    return leftId.localeCompare(rightId);
  });
}

function mapLayoutProjection(component, styleBag) {
  const display = normalizeCssTextToken(String(readStyleValue(styleBag, ['display']) || ''));
  const isFlex = display === 'flex' || display === 'inline-flex';
  const layout = {
    x: parseCssNumber(component?.x, 0),
    y: parseCssNumber(component?.y, 0),
    width: Math.max(0, parseCssNumber(component?.width, 0)),
    height: Math.max(0, parseCssNumber(component?.height, 0)),
    order_index: Number.parseInt(String(component?.order_index ?? component?.order ?? 0), 10) || 0,
    display: isFlex ? 'flex' : 'absolute',
  };
  if (!isFlex) {
    return { layout, warnings: [] };
  }

  const justifyRaw = normalizeCssTextToken(String(
    readStyleValue(styleBag, ['justifyContent', 'justify-content']) || 'flex-start',
  ));
  const alignRaw = normalizeCssTextToken(String(
    readStyleValue(styleBag, ['alignItems', 'align-items']) || 'stretch',
  ));
  const directionRaw = normalizeCssTextToken(String(
    readStyleValue(styleBag, ['flexDirection', 'flex-direction']) || 'row',
  ));
  const wrapRaw = normalizeCssTextToken(String(
    readStyleValue(styleBag, ['flexWrap', 'flex-wrap']) || 'nowrap',
  ));
  const gap = Math.max(0, parseCssNumber(readStyleValue(styleBag, ['gap', 'columnGap', 'column-gap']), 0));
  const warnings = [];

  if (!PPTX_FLEX_JUSTIFY_VALUES.has(justifyRaw)) {
    warnings.push({ code: 'unsupported_flex_behavior', reason: `justify-content=${justifyRaw || 'unknown'}` });
  }
  if (!PPTX_FLEX_ALIGN_VALUES.has(alignRaw)) {
    warnings.push({ code: 'unsupported_flex_behavior', reason: `align-items=${alignRaw || 'unknown'}` });
  }
  if (!PPTX_FLEX_DIRECTION_VALUES.has(directionRaw)) {
    warnings.push({ code: 'unsupported_flex_behavior', reason: `flex-direction=${directionRaw || 'unknown'}` });
  }
  if (wrapRaw && wrapRaw !== 'nowrap') {
    warnings.push({ code: 'unsupported_flex_behavior', reason: `flex-wrap=${wrapRaw}` });
  }

  layout.flex = {
    justify_content: PPTX_FLEX_JUSTIFY_VALUES.has(justifyRaw) ? justifyRaw : 'flex-start',
    align_items: PPTX_FLEX_ALIGN_VALUES.has(alignRaw) ? alignRaw : 'stretch',
    direction: PPTX_FLEX_DIRECTION_VALUES.has(directionRaw) ? directionRaw : 'row',
    gap_px: gap,
    wrap: wrapRaw || 'nowrap',
  };
  return { layout, warnings };
}

function mapStyleProjection(component, styleBag) {
  const content = typeof component?.content === 'string' ? component.content : '';
  const fontSize = Math.max(0, parseCssNumber(readStyleValue(styleBag, ['fontSize', 'font-size']), 0));
  const fontWeight = Math.max(0, parseCssNumber(readStyleValue(styleBag, ['fontWeight', 'font-weight']), 400));
  const lineHeight = Math.max(0, parseCssNumber(readStyleValue(styleBag, ['lineHeight', 'line-height']), 0));
  const color = parseCssColor(String(readStyleValue(styleBag, ['color']) || ''));
  const background = String(readStyleValue(styleBag, ['backgroundFill', 'background', 'backgroundColor', 'background-color']) || '');
  const gradient = parseGradientFill(background);
  const solidBackground = gradient ? null : parseCssColor(background);
  const shadowValue = String(readStyleValue(styleBag, ['boxShadow', 'box-shadow']) || '');
  const shadow = parseShadow(shadowValue);
  const borderRadiusRaw = readStyleValue(styleBag, ['borderRadius', 'border-radius']);
  const borderRadius = parseBorderRadiusValue(borderRadiusRaw);
  const transform = normalizeCssTextToken(String(readStyleValue(styleBag, ['transform']) || ''));

  const warnings = [];
  const effects = {};
  if (gradient) {
    effects.fill = gradient;
  } else if (solidBackground) {
    effects.fill = {
      type: 'solid',
      color: solidBackground.hex,
      alpha: solidBackground.alpha,
    };
  } else if (background && /gradient\(/i.test(background)) {
    warnings.push({ code: 'unsupported_effect_combo', reason: 'gradient-syntax' });
  }

  if (shadow && shadow.unsupported) {
    warnings.push({ code: 'unsupported_effect_combo', reason: shadow.reason || 'shadow' });
  } else if (shadow) {
    effects.shadow = shadow;
  }

  if (borderRadius && borderRadius.unsupported) {
    warnings.push({ code: 'unsupported_effect_combo', reason: borderRadius.reason || 'border-radius' });
  } else if (typeof borderRadius === 'number' && Number.isFinite(borderRadius)) {
    effects.border_radius_px = borderRadius;
  }

  if (transform && transform !== 'none') {
    const supportedTransform = /^matrix\([^\)]*\)$|^translate[xy]?\([^\)]*\)$/.test(transform);
    if (!supportedTransform) {
      warnings.push({ code: 'unsupported_transform', reason: transform });
    }
  }

  return {
    projection: {
      text_length: content.length,
      font_size_px: fontSize,
      font_weight: fontWeight,
      line_height_px: lineHeight,
      color: color ? color.hex : null,
      text_align: normalizeCssTextToken(String(readStyleValue(styleBag, ['textAlign', 'text-align']) || 'left')),
      font_family: String(readStyleValue(styleBag, ['fontFamily', 'font-family']) || '').trim() || null,
      effects,
    },
    warnings,
  };
}

function mapComponentToPptxNativeObject(slideId, component) {
  const componentType = typeof component?.type === 'string' ? component.type : 'unknown';
  const componentId = typeof component?.id === 'string' && component.id.trim() ? component.id.trim() : 'unknown-component';
  const styleBag = extractStyleBag(component);
  const layoutProjection = mapLayoutProjection(component, styleBag);
  const styleProjection = mapStyleProjection(component, styleBag);
  const base = {
    slide_id: slideId,
    component_id: componentId,
    component_type: componentType,
  };
  const warnings = [];
  for (const warning of layoutProjection.warnings) {
    warnings.push({
      ...base,
      code: warning.code,
      message: `Flex behavior "${warning.reason}" is not fully supported and may drift in PPTX output.`,
    });
  }
  for (const warning of styleProjection.warnings) {
    warnings.push({
      ...base,
      code: warning.code,
      message: `Style mapping "${warning.reason}" is not fully supported for component "${componentId}".`,
    });
  }

  if (PPTX_NATIVE_TEXT_COMPONENT_TYPES.has(componentType)) {
    return {
      object: {
        ...base,
        native_kind: 'text',
        editable: true,
        layout: layoutProjection.layout,
        style_projection: styleProjection.projection,
      },
      warnings,
    };
  }

  if (PPTX_NATIVE_SHAPE_COMPONENT_TYPES.has(componentType)) {
    return {
      object: {
        ...base,
        native_kind: 'shape',
        editable: true,
        layout: layoutProjection.layout,
        style_projection: styleProjection.projection,
      },
      warnings,
    };
  }

  if (PPTX_IMAGE_COMPONENT_TYPES.has(componentType)) {
    warnings.push({
      ...base,
      code: 'image_rasterized',
      message: `Component "${componentId}" was exported as an image fallback.`,
    });
    return {
      object: {
        ...base,
        native_kind: 'image',
        editable: false,
        layout: layoutProjection.layout,
        style_projection: styleProjection.projection,
      },
      warnings,
    };
  }

  warnings.push({
    ...base,
    code: 'unsupported_component',
    message: `Component type "${componentType}" is not natively supported and was skipped.`,
  });
  return {
    object: null,
    warnings,
  };
}

function resolveFragmentOrder(component) {
  const direct = Number.parseInt(String(component?.fragment_index ?? component?.fragmentIndex ?? component?.reveal_order ?? ''), 10);
  if (Number.isFinite(direct)) return Math.max(0, direct);
  const styleBag = extractStyleBag(component);
  const styleOrder = Number.parseInt(String(readStyleValue(styleBag, ['fragmentIndex', 'fragment_index', 'revealOrder', 'reveal_order']) ?? ''), 10);
  if (Number.isFinite(styleOrder)) return Math.max(0, styleOrder);
  const datasetOrder = Number.parseInt(String(component?.dataset?.fragmentIndex ?? component?.dataset?.fragment_index ?? ''), 10);
  if (Number.isFinite(datasetOrder)) return Math.max(0, datasetOrder);
  return null;
}

function resolveAnimationIntent(component) {
  const styleBag = extractStyleBag(component);
  const raw = String(
    component?.animation
      || component?.animation_type
      || readStyleValue(styleBag, ['animationType', 'animation_type', 'animationName', 'animation-name', 'animation', 'dataAnimation', 'data-animation'])
      || '',
  ).trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('fade')) return 'fade';
  if (raw.includes('fly') || raw.includes('slide')) return 'fly-in';
  if (raw.includes('appear') || raw.includes('reveal') || raw.includes('fragment')) return 'appear';
  return raw;
}

function resolvePptxAnimationManifest(slides, nativeObjects, existingWarnings, animationProfile = 'default') {
  const warnings = [];
  const warningKeys = new Set(existingWarnings.map((warning) => `${warning?.slide_id || ''}|${warning?.component_id || ''}|${warning?.code || ''}|${warning?.message || ''}`));
  if (animationProfile === 'disabled') {
    return {
      profile: animationProfile,
      animations: [],
      warnings,
    };
  }

  const objectById = new Map(nativeObjects.map((entry) => [entry.component_id, entry]));
  const animations = [];
  for (const slide of slides) {
    const primaryDocumentSlide = slide.document && slide.document.deck && Array.isArray(slide.document.deck.slides)
      ? slide.document.deck.slides[0]
      : null;
    const components = normalizeComponentOrder(
      Array.isArray(primaryDocumentSlide?.elements)
        ? primaryDocumentSlide.elements
        : (Array.isArray(slide.components) ? slide.components : []),
    );
    const fragmentCandidates = [];
    for (const component of components) {
      const fragmentOrder = resolveFragmentOrder(component);
      const animationIntent = resolveAnimationIntent(component);
      if (fragmentOrder === null && !animationIntent) continue;
      fragmentCandidates.push({ component, fragmentOrder, animationIntent });
    }

    fragmentCandidates.sort((left, right) => {
      const orderDelta = (left.fragmentOrder ?? Number.MAX_SAFE_INTEGER) - (right.fragmentOrder ?? Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) return orderDelta;
      const leftObject = objectById.get(left.component.id);
      const rightObject = objectById.get(right.component.id);
      const yDelta = (leftObject?.layout?.y ?? 0) - (rightObject?.layout?.y ?? 0);
      if (Math.abs(yDelta) > 0.01) return yDelta;
      const xDelta = (leftObject?.layout?.x ?? 0) - (rightObject?.layout?.x ?? 0);
      if (Math.abs(xDelta) > 0.01) return xDelta;
      return String(left.component.id || '').localeCompare(String(right.component.id || ''));
    });

    let sequence = 1;
    for (const candidate of fragmentCandidates) {
      const mappedObject = objectById.get(candidate.component.id);
      if (!mappedObject) {
        const warning = {
          slide_id: slide.id,
          component_id: candidate.component.id,
          component_type: candidate.component.type || 'unknown',
          code: 'unsupported_animation_target',
          message: `Animation target "${candidate.component.id}" could not be mapped to a native PPTX object and was exported statically.`,
        };
        const key = `${warning.slide_id}|${warning.component_id}|${warning.code}|${warning.message}`;
        if (!warningKeys.has(key)) {
          warningKeys.add(key);
          warnings.push(warning);
        }
        continue;
      }

      const intent = candidate.animationIntent || 'fragment';
      if (intent !== 'fade' && intent !== 'fly-in' && intent !== 'appear' && intent !== 'fragment') {
        const warning = {
          slide_id: slide.id,
          component_id: candidate.component.id,
          component_type: candidate.component.type || 'unknown',
          code: 'unsupported_animation_semantic',
          message: `Animation semantic "${intent}" is not supported and was exported as static content for component "${candidate.component.id}".`,
        };
        const key = `${warning.slide_id}|${warning.component_id}|${warning.code}|${warning.message}`;
        if (!warningKeys.has(key)) {
          warningKeys.add(key);
          warnings.push(warning);
        }
        continue;
      }

      const effect = animationProfile === 'conservative'
        ? 'appear'
        : (intent === 'fragment' || intent === 'appear' ? 'fade' : intent);
      animations.push({
        slide_id: slide.id,
        component_id: candidate.component.id,
        component_type: candidate.component.type || 'unknown',
        native_kind: mappedObject.native_kind,
        sequence,
        fragment_order: candidate.fragmentOrder ?? sequence,
        effect,
      });
      sequence += 1;
    }
  }

  return {
    profile: animationProfile,
    animations,
    warnings,
  };
}

function resolvePptxDashboardSurfaceManifest(slides, nativeObjects, existingWarnings) {
  const warnings = [];
  const warningKeys = new Set(existingWarnings.map((warning) => `${warning?.slide_id || ''}|${warning?.component_id || ''}|${warning?.code || ''}|${warning?.message || ''}`));
  const surfaceEntries = [];
  const nativeObjectById = new Map(nativeObjects.map((entry) => [entry.component_id, entry]));

  for (const slide of slides) {
    const primaryDocumentSlide = slide.document && slide.document.deck && Array.isArray(slide.document.deck.slides)
      ? slide.document.deck.slides[0]
      : null;
    const components = normalizeComponentOrder(
      Array.isArray(primaryDocumentSlide?.elements)
        ? primaryDocumentSlide.elements
        : (Array.isArray(slide.components) ? slide.components : []),
    );
    for (const component of components) {
      const surfaceType = inferDashboardSurface(component);
      if (!surfaceType) continue;
      const mappedObject = nativeObjectById.get(component.id) || null;
      let exportStrategy = 'static-fallback';
      let editable = false;

      if (surfaceType === 'svg') {
        exportStrategy = 'vector-image';
        editable = false;
      } else if (surfaceType === 'table') {
        exportStrategy = 'native-table';
        editable = true;
      } else if (surfaceType === 'canvas' || surfaceType === 'canvas-chart') {
        exportStrategy = 'raster-image';
        editable = false;
      }

      surfaceEntries.push({
        slide_id: slide.id,
        component_id: component.id,
        component_type: component.type || 'unknown',
        surface_type: surfaceType,
        native_kind: mappedObject?.native_kind || null,
        export_strategy: exportStrategy,
        editable,
      });

      if (surfaceType === 'canvas' || surfaceType === 'canvas-chart') {
        const message = surfaceType === 'canvas-chart'
          ? `Dashboard chart surface "${component.id}" was exported as deterministic raster fallback with documented editability limits.`
          : `Canvas surface "${component.id}" was exported as deterministic raster fallback with documented editability limits.`;
        const warning = {
          slide_id: slide.id,
          component_id: component.id,
          component_type: component.type || 'unknown',
          code: 'dashboard_surface_rasterized',
          message,
        };
        const key = `${warning.slide_id}|${warning.component_id}|${warning.code}|${warning.message}`;
        if (!warningKeys.has(key)) {
          warningKeys.add(key);
          warnings.push(warning);
        }
      }
    }
  }

  return {
    surfaces: surfaceEntries,
    warnings,
  };
}

function normalizeFontFamilyName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
}

function pickPrimaryFontFamily(fontFamilyValue) {
  if (typeof fontFamilyValue !== 'string' || !fontFamilyValue.trim()) return null;
  const first = fontFamilyValue.split(',')[0] || '';
  const normalized = first.trim().replace(/^['"]|['"]$/g, '');
  return normalized || null;
}

function resolvePptxFontManifest(slides, nativeObjects, existingWarnings, requestFontFaces = []) {
  const declaredFonts = [];
  const seenDeclared = new Set();
  for (const font of Array.isArray(requestFontFaces) ? requestFontFaces : []) {
    const key = `${normalizeFontFamilyName(font?.family)}|${font?.weight || 400}|${font?.style || 'normal'}|${font?.src_url || ''}`;
    if (!key || seenDeclared.has(key)) continue;
    seenDeclared.add(key);
    declaredFonts.push(font);
  }
  for (const slide of slides) {
    for (const font of Array.isArray(slide?.font_faces) ? slide.font_faces : []) {
      const key = `${normalizeFontFamilyName(font?.family)}|${font?.weight || 400}|${font?.style || 'normal'}|${font?.src_url || ''}`;
      if (!key || seenDeclared.has(key)) continue;
      seenDeclared.add(key);
      declaredFonts.push(font);
    }
  }

  const embeddedFonts = [];
  const usedFonts = [];
  const embeddedKeys = new Set();
  const warningKeys = new Set(existingWarnings.map((warning) => `${warning?.slide_id || ''}|${warning?.component_id || ''}|${warning?.code || ''}|${warning?.message || ''}`));
  const warnings = [];

  for (const object of nativeObjects) {
    if (!object?.editable) continue;
    const family = pickPrimaryFontFamily(object?.style_projection?.font_family);
    if (!family) continue;
    const weight = Number.isFinite(object?.style_projection?.font_weight) ? Math.max(100, Math.min(900, Number(object.style_projection.font_weight))) : 400;
    const style = /italic/i.test(String(object?.style_projection?.font_style || '')) ? 'italic' : 'normal';
    const normalizedFamily = normalizeFontFamilyName(family);
    const candidates = declaredFonts.filter((font) => normalizeFontFamilyName(font.family) === normalizedFamily);
    const usedKey = `${normalizedFamily}|${weight}|${style}`;
    if (!usedFonts.some((font) => font.key === usedKey)) {
      usedFonts.push({ key: usedKey, family, weight, style });
    }
    const exact = candidates.find((font) => font.weight === weight && font.style === style);
    const fallback = exact
      || candidates.find((font) => font.style === style)
      || candidates[0]
      || null;

    if (fallback && fallback.embed_allowed !== false && fallback.src_url) {
      const embeddedKey = `${normalizedFamily}|${fallback.weight}|${fallback.style}|${fallback.src_url}`;
      if (!embeddedKeys.has(embeddedKey)) {
        embeddedKeys.add(embeddedKey);
        embeddedFonts.push({
          family: fallback.family,
          weight: fallback.weight,
          style: fallback.style,
          src_url: fallback.src_url,
        });
      }
      continue;
    }

    const message = fallback
      ? `Font "${family}" could not be embedded and will fall back deterministically in PPTX output.`
      : `Font "${family}" was used without a resolvable embeddable asset and will fall back deterministically in PPTX output.`;
    const warning = {
      slide_id: object.slide_id,
      component_id: object.component_id,
      component_type: object.component_type,
      code: 'font_embed_unavailable',
      message,
    };
    const warningKey = `${warning.slide_id}|${warning.component_id}|${warning.code}|${warning.message}`;
    if (!warningKeys.has(warningKey)) {
      warningKeys.add(warningKey);
      warnings.push(warning);
    }
  }

  return {
    embedded_fonts: embeddedFonts,
    used_fonts: usedFonts.map(({ key, ...font }) => font),
    warnings,
  };
}

function buildPptxNativeProjection(slides, options = {}) {
  const warnings = [];
  const nativeObjects = [];

  for (const slide of slides) {
    const primaryDocumentSlide = slide.document && slide.document.deck && Array.isArray(slide.document.deck.slides)
      ? slide.document.deck.slides[0]
      : null;
    const components = normalizeComponentOrder(
      Array.isArray(primaryDocumentSlide?.elements)
        ? primaryDocumentSlide.elements
        : (Array.isArray(slide.components) ? slide.components : []),
    );
    for (const component of components) {
      const mapped = mapComponentToPptxNativeObject(slide.id, component);
      if (mapped.object) nativeObjects.push(mapped.object);
      if (Array.isArray(mapped.warnings)) {
        for (const warning of mapped.warnings) {
          warnings.push(warning);
          if (warnings.length >= MAX_PPTX_EXPORT_WARNINGS) break;
        }
      }
      if (warnings.length >= MAX_PPTX_EXPORT_WARNINGS) break;
    }
    if (warnings.length >= MAX_PPTX_EXPORT_WARNINGS) break;
  }

  const editableObjectCount = nativeObjects.filter((entry) => entry?.editable === true).length;
  const fallbackObjectCount = nativeObjects.filter((entry) => entry?.editable === false).length;
  const fontManifest = resolvePptxFontManifest(slides, nativeObjects, warnings, options.font_faces);
  for (const warning of fontManifest.warnings) {
    warnings.push(warning);
    if (warnings.length >= MAX_PPTX_EXPORT_WARNINGS) break;
  }
  const animationManifest = resolvePptxAnimationManifest(slides, nativeObjects, warnings, options.animation_profile);
  for (const warning of animationManifest.warnings) {
    warnings.push(warning);
    if (warnings.length >= MAX_PPTX_EXPORT_WARNINGS) break;
  }
  const dashboardSurfaceManifest = resolvePptxDashboardSurfaceManifest(slides, nativeObjects, warnings);
  for (const warning of dashboardSurfaceManifest.warnings) {
    warnings.push(warning);
    if (warnings.length >= MAX_PPTX_EXPORT_WARNINGS) break;
  }

  return {
    warnings,
    native_objects: nativeObjects,
    font_manifest: {
      embedded_fonts: fontManifest.embedded_fonts,
      used_fonts: fontManifest.used_fonts,
    },
    animation_manifest: {
      profile: animationManifest.profile,
      animations: animationManifest.animations,
    },
    dashboard_surface_manifest: {
      surfaces: dashboardSurfaceManifest.surfaces,
    },
    warning_summary: {
      total_warnings: warnings.length,
      editable_object_count: editableObjectCount,
      fallback_object_count: fallbackObjectCount,
      unsupported_component_count: warnings.filter((warning) => warning.code === 'unsupported_component').length,
      image_fallback_count: warnings.filter((warning) => warning.code === 'image_rasterized').length,
    },
  };
}

function storePptxExportJob(job) {
  if (!job || typeof job.id !== 'string') return;
  if (!pptxExportJobsById.has(job.id)) {
    pptxExportJobIdsByRequestedAt.unshift(job.id);
  }
  pptxExportJobsById.set(job.id, job);
  if (pptxExportJobIdsByRequestedAt.length > 500) {
    const removed = pptxExportJobIdsByRequestedAt.pop();
    if (removed) pptxExportJobsById.delete(removed);
  }
}

function getPptxExportJobById(jobId) {
  if (typeof jobId !== 'string' || !jobId.trim()) return null;
  return pptxExportJobsById.get(jobId.trim()) || null;
}

function findExistingPptxJobByIdempotency(actor, idempotencyKey) {
  if (!idempotencyKey) return null;
  for (const jobId of pptxExportJobIdsByRequestedAt) {
    const job = pptxExportJobsById.get(jobId);
    if (!job) continue;
    if (job.requested_by_user_id !== actor.user_id) continue;
    if (job.idempotency_key !== idempotencyKey) continue;
    if (job.status === 'queued' || job.status === 'running' || job.status === 'succeeded') return job;
  }
  return null;
}

function listPptxExportJobsForActor(actor, status, offset, limit) {
  const items = [];
  for (const jobId of pptxExportJobIdsByRequestedAt) {
    const job = pptxExportJobsById.get(jobId);
    if (!job) continue;
    if (actor.role !== 'admin' && job.requested_by_user_id !== actor.user_id) continue;
    if (status !== 'all' && job.status !== status) continue;
    items.push(job);
  }
  return items.slice(offset, offset + limit);
}

function normalizePptxExportJobRow(row) {
  if (!row || typeof row !== 'object') return null;
  const slideIds = Array.isArray(row.slide_ids)
    ? row.slide_ids.map((value) => (typeof value === 'string' ? value : '')).filter(Boolean)
    : [];
  const options = isObject(row.options) ? row.options : {};
  const artifact = isObject(row.artifact) ? row.artifact : null;
  const warnings = Array.isArray(row.warnings) ? row.warnings.filter((warning) => isObject(warning)).slice(0, MAX_PPTX_EXPORT_WARNINGS) : [];
  const nativeObjects = Array.isArray(row.native_objects) ? row.native_objects.filter((entry) => isObject(entry)) : [];
  const fontManifest = isObject(row.font_manifest) ? row.font_manifest : {};
  const animationManifest = isObject(row.animation_manifest) ? row.animation_manifest : {};
  const dashboardSurfaceManifest = isObject(row.dashboard_surface_manifest) ? row.dashboard_surface_manifest : {};
  return {
    id: row.id,
    requested_by_user_id: row.requested_by_user_id,
    requested_by_email: row.requested_by_email || null,
    status: normalizePptxExportStatus(row.status, 'queued'),
    slide_ids: slideIds,
    options: {
      filename_prefix: typeof options.filename_prefix === 'string' && options.filename_prefix.trim()
        ? options.filename_prefix
        : 'slides-export',
      include_hidden: options.include_hidden === true,
    },
    attempts: Number.isFinite(row.attempts) ? Math.max(0, Number(row.attempts)) : 0,
    max_attempts: Number.isFinite(row.max_attempts) ? Math.max(1, Number(row.max_attempts)) : 3,
    warning_count: Number.isFinite(row.warning_count) ? Math.max(0, Number(row.warning_count)) : warnings.length,
    warnings,
    warning_summary: isObject(row.warning_summary)
      ? row.warning_summary
      : {
          total_warnings: warnings.length,
          editable_object_count: nativeObjects.filter((entry) => entry?.editable === true).length,
          fallback_object_count: nativeObjects.filter((entry) => entry?.editable === false).length,
          unsupported_component_count: warnings.filter((warning) => warning.code === 'unsupported_component').length,
          image_fallback_count: warnings.filter((warning) => warning.code === 'image_rasterized').length,
        },
    native_objects: nativeObjects,
    font_manifest: {
      embedded_fonts: Array.isArray(fontManifest.embedded_fonts) ? fontManifest.embedded_fonts.filter((entry) => isObject(entry)) : [],
      used_fonts: Array.isArray(fontManifest.used_fonts) ? fontManifest.used_fonts.filter((entry) => isObject(entry)) : [],
    },
    animation_manifest: {
      profile: sanitizePptxAnimationProfile(animationManifest.profile),
      animations: Array.isArray(animationManifest.animations) ? animationManifest.animations.filter((entry) => isObject(entry)) : [],
    },
    dashboard_surface_manifest: {
      surfaces: Array.isArray(dashboardSurfaceManifest.surfaces) ? dashboardSurfaceManifest.surfaces.filter((entry) => isObject(entry)) : [],
    },
    artifact: artifact
      ? {
          file_name: typeof artifact.file_name === 'string' ? artifact.file_name : null,
          expires_at: typeof artifact.expires_at === 'string' ? artifact.expires_at : null,
          download_token: typeof artifact.download_token === 'string' ? artifact.download_token : null,
        }
      : null,
    requested_at: row.requested_at || row.created_at || null,
    started_at: row.started_at || null,
    completed_at: row.completed_at || null,
    updated_at: row.updated_at || row.created_at || null,
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    idempotency_key: typeof row.idempotency_key === 'string' ? row.idempotency_key : null,
    payload: isObject(row.payload) ? row.payload : {},
  };
}

async function supabaseFetch(env, path, init = {}) {
  const supabaseUrl = resolveSupabaseUrl(env);
  const method = (init.method || 'GET').toUpperCase();
  const response = await fetch(supabaseUrl + path, {
    ...init,
    headers: {
      ...serviceHeaders(env),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`${method} ${path} failed: ${response.status} ${text}`);
    error.status = response.status;
    error.method = method;
    error.path = path;
    error.responseText = text;
    error.rayId = response.headers.get('cf-ray') || extractCloudflareRayId(text) || null;
    throw error;
  }

  return response;
}

async function readSlideById(env, slideId) {
  const response = await supabaseFetch(
    env,
    '/rest/v1/slides?id=eq.' + encodeURIComponent(slideId) + '&select=*&limit=1',
  );
  const rows = await response.json().catch(() => []);
  return rows[0] || null;
}

async function readTemplateById(env, templateId, options = {}) {
  const includeArchived = options.includeArchived === true;
  const archivedOnly = options.archivedOnly === true;
  let path = '/rest/v1/slide_templates?id=eq.' + encodeURIComponent(templateId);
  if (archivedOnly) {
    path += '&is_archived=eq.true';
  } else if (!includeArchived) {
    path += '&is_archived=eq.false';
  }
  path += '&select=*&limit=1';

  const response = await supabaseFetch(env, path);
  const rows = await response.json().catch(() => []);
  return rows[0] || null;
}

async function readTemplateCollaborators(env, templateId) {
  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_template_collaborators?template_id=eq.' + encodeURIComponent(templateId) + '&select=template_id,user_id,role,created_at,updated_at',
  );
  const rows = await response.json().catch(() => []);
  return rows.map(normalizeTemplateCollaboratorRow).filter(Boolean);
}

async function readActorTemplateRole(env, templateId, actorUserId) {
  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_template_collaborators?template_id=eq.' +
      encodeURIComponent(templateId) +
      '&user_id=eq.' +
      encodeURIComponent(actorUserId) +
      '&select=role&limit=1',
  );
  const rows = await response.json().catch(() => []);
  const row = rows[0] || null;
  return row?.role || null;
}

async function readTemplateIdsByCollaborator(env, actorUserId) {
  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_template_collaborators?user_id=eq.' + encodeURIComponent(actorUserId) + '&select=template_id',
  );
  const rows = await response.json().catch(() => []);
  return Array.from(new Set(rows.map((row) => row?.template_id).filter((value) => typeof value === 'string' && value)));
}

async function readAppUsersByIds(env, userIds) {
  const unique = Array.from(new Set(userIds.filter((value) => typeof value === 'string' && value.trim())));
  if (unique.length === 0) return new Map();
  const map = new Map();
  const rows = await Promise.all(unique.map(async (userId) => readAppUserByIdentifier(env, userId, '')));
  for (const row of rows) {
    if (row && typeof row.user_id === 'string' && !map.has(row.user_id)) {
      map.set(row.user_id, row.email || null);
    }
  }
  return map;
}

async function readTemplateApprovalById(env, approvalId) {
  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_template_approvals?id=eq.' + encodeURIComponent(approvalId) + '&select=*&limit=1',
  );
  const rows = await response.json().catch(() => []);
  return rows[0] || null;
}

async function readAuditPresetById(env, presetId) {
  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_audit_filter_presets?id=eq.' + encodeURIComponent(presetId) + '&is_archived=eq.false&select=*&limit=1',
  );
  const rows = await response.json().catch(() => []);
  return rows[0] || null;
}

async function readAuditExportJobById(env, jobId) {
  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_audit_export_jobs?id=eq.' +
      encodeURIComponent(jobId) +
      '&select=id,requested_by_user_id,requested_by_email,status,filters,row_count,file_name,csv_content,error_message,requested_at,started_at,completed_at,updated_at&limit=1',
  );
  const rows = await response.json().catch(() => []);
  return rows[0] || null;
}

async function isTemplateGovernanceManager(env, actor, template) {
  if (actor.role === 'admin') return true;
  if (!template) return false;
  return template.owner_user_id === actor.user_id;
}

async function insertAudit(env, payload) {
  try {
    await supabaseFetch(env, '/rest/v1/slide_audit_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // Do not block product flows if audit logging write fails.
  }
}

async function readLatestScheduledSweepHeartbeat(env) {
  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_audit_events?entity_type=eq.template&entity_id=eq.' +
      encodeURIComponent(SLIDES_SWEEP_HEARTBEAT_ENTITY_ID) +
      '&action=eq.escalate-approval&select=created_at,details&order=created_at.desc&limit=10',
  );
  const rows = await response.json().catch(() => []);
  for (const row of Array.isArray(rows) ? rows : []) {
    const details = isObject(row?.details) ? row.details : {};
    if (details.sweep_heartbeat === true && details.sweep_source === 'scheduled') {
      return {
        created_at: typeof row.created_at === 'string' ? row.created_at : null,
      };
    }
  }
  return null;
}

async function executeApprovalEscalationSweep(env, actor, options = {}) {
  const dryRun = options?.dryRun === true;
  const force = options?.force === true;
  const sweepSource = options?.sweepSource === 'scheduled' ? 'scheduled' : 'manual';
  const escalationRouting = resolveEscalationRoutingConfig(env);
  const nowMs = Date.now();
  const overdueThresholdMs = 48 * 60 * 60 * 1000;
  const escalationCooldownMs = 24 * 60 * 60 * 1000;
  const overdueBefore = new Date(nowMs - overdueThresholdMs).toISOString();

  if (!dryRun && !force && sweepSource === 'scheduled') {
    const lastHeartbeat = await readLatestScheduledSweepHeartbeat(env).catch(() => null);
    const minIntervalMs = resolveSweepMinIntervalMinutes(env) * 60 * 1000;
    const lastRunMs = lastHeartbeat?.created_at ? Date.parse(lastHeartbeat.created_at) : NaN;
    if (Number.isFinite(lastRunMs) && nowMs - lastRunMs < minIntervalMs) {
      return {
        processed: 0,
        escalated: 0,
        skipped: 0,
        dry_run: false,
        throttled: true,
        sweep_source: sweepSource,
      };
    }
  }

  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_template_approvals?status=eq.pending&created_at=lte.' + encodeURIComponent(overdueBefore) + '&select=*&order=created_at.asc&limit=200',
  );
  const rows = await response.json().catch(() => []);
  const pending = Array.isArray(rows) ? rows : [];

  let escalated = 0;
  let skipped = 0;

  for (const approval of pending) {
    const payload = isObject(approval.payload) ? approval.payload : {};
    const priorEscalations = Array.isArray(payload.escalations) ? payload.escalations : [];
    const explicitLast = typeof payload.last_escalated_at === 'string' ? payload.last_escalated_at : '';
    const lastEscalationEntry = priorEscalations[priorEscalations.length - 1] || null;
    const derivedLast = lastEscalationEntry && typeof lastEscalationEntry.created_at === 'string'
      ? lastEscalationEntry.created_at
      : '';
    const lastEscalatedAt = explicitLast || derivedLast;
    const lastEscalatedAtMs = lastEscalatedAt ? Date.parse(lastEscalatedAt) : NaN;
    if (Number.isFinite(lastEscalatedAtMs) && nowMs - lastEscalatedAtMs < escalationCooldownMs) {
      skipped += 1;
      continue;
    }

    const now = new Date().toISOString();
    const escalationRecord = {
      escalated_by_user_id: actor.user_id,
      escalated_by_email: actor.email || null,
      reason: 'SLA overdue escalation sweep',
      automated: true,
      sweep_source: sweepSource,
      routing: escalationRouting,
      created_at: now,
    };

    if (!dryRun) {
      await supabaseFetch(
        env,
        '/rest/v1/slide_template_approvals?id=eq.' + encodeURIComponent(approval.id),
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            payload: {
              ...payload,
              escalations: [...priorEscalations, escalationRecord],
              escalation_count: priorEscalations.length + 1,
              last_escalated_at: now,
            },
            updated_at: now,
          }),
        },
      );

      await insertAudit(env, {
        actor_user_id: actor.user_id,
        actor_email: actor.email || null,
        entity_type: 'template',
        entity_id: approval.template_id,
        action: 'escalate-approval',
        outcome: 'success',
        details: {
          approval_id: approval.id,
          approval_type: approval.approval_type,
          escalation_count: priorEscalations.length + 1,
          automated: true,
          sweep_source: sweepSource,
          routing_channels: escalationRouting.channels,
          routing_targets: escalationRouting.targets,
        },
      });
    }

    escalated += 1;
  }

  if (!dryRun && sweepSource === 'scheduled') {
    await insertAudit(env, {
      actor_user_id: actor.user_id,
      actor_email: actor.email || null,
      entity_type: 'template',
      entity_id: SLIDES_SWEEP_HEARTBEAT_ENTITY_ID,
      action: 'escalate-approval',
      outcome: 'success',
      details: {
        automated: true,
        sweep_source: sweepSource,
        sweep_heartbeat: true,
        processed: pending.length,
        escalated,
        skipped,
        routing_channels: escalationRouting.channels,
        routing_target_count: escalationRouting.targets.length,
      },
    });
  }

  return {
    processed: pending.length,
    escalated,
    skipped,
    dry_run: dryRun,
    throttled: false,
    sweep_source: sweepSource,
  };
}

async function isTemplateVisibleToActor(env, template, actor) {
  if (!template) return false;
  if (actor.role === 'admin') return true;
  if (template.is_shared) return true;
  if (template.owner_user_id === actor.user_id) return true;
  const role = await readActorTemplateRole(env, template.id, actor.user_id);
  return typeof role === 'string' && TEMPLATE_COLLABORATOR_ROLES.includes(role);
}

async function handleSaveAction(env, actor, body) {
  const source = isObject(body.slide) ? body.slide : {};
  const title = sanitizeTitle(source.title);
  const canvas = sanitizeCanvas(source.canvas);
  const components = sanitizeComponents(source.components);
  const metadata = normalizeMetadata(source.metadata);

  if (!title) return errorResponse('Invalid title for slide save.', 400);
  if (!canvas) return errorResponse('Invalid canvas payload for slide save.', 400);
  if (!components) return errorResponse('Invalid components payload for slide save.', 400);

  const autosave = source.autosave === true;
  const overwrite = source.overwrite === true;
  const expectedRevision = Number.isFinite(source.revision) ? Number(source.revision) : null;

  const timestamp = new Date().toISOString();

  if (typeof source.id === 'string' && source.id.trim()) {
    const existing = await readSlideById(env, source.id.trim());
    if (!existing || existing.deleted_at) {
      return errorResponse('Slide not found for update.', 404);
    }

    const actorIsAdmin = actor.role === 'admin';
    if (!actorIsAdmin && existing.owner_user_id !== actor.user_id) {
      return errorResponse('Forbidden. You do not own this slide.', 403);
    }

    if (!overwrite && expectedRevision !== null && expectedRevision !== existing.revision) {
      const serverSlide = normalizeSlideRow(existing);
      await insertAudit(env, {
        actor_user_id: actor.user_id,
        actor_email: actor.email || null,
        entity_type: 'slide',
        entity_id: existing.id,
        action: autosave ? 'autosave' : 'save',
        outcome: 'failure',
        error_class: 'revision_conflict',
        details: { expected_revision: expectedRevision, actual_revision: existing.revision },
      });
      const envelope = buildFailureEnvelope('Revision conflict. Reload or overwrite.', 409, {
        code: 'revision_conflict',
        failure_class: 'conflict',
        retryable: false,
        method: 'POST',
        actor_user_id: actor.user_id,
        actor_email: actor.email || null,
      });
      return jsonResponse({
        ...envelope,
        message: 'Revision conflict. Reload or overwrite.',
        server_slide: serverSlide,
      }, 409);
    }

    const updatePayload = {
      title,
      canvas,
      components_json: components,
      metadata,
      revision: existing.revision + 1,
      updated_by: actor.user_id,
      updated_at: timestamp,
      last_edited_at: timestamp,
    };

    const patchResponse = await supabaseFetch(
      env,
      '/rest/v1/slides?id=eq.' + encodeURIComponent(existing.id),
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(updatePayload),
      },
    );

    const rows = await patchResponse.json().catch(() => []);
    const next = normalizeSlideRow(rows[0] || null);

    await insertAudit(env, {
      actor_user_id: actor.user_id,
      actor_email: actor.email || null,
      entity_type: 'slide',
      entity_id: existing.id,
      action: autosave ? 'autosave' : 'save',
      outcome: 'success',
      details: { revision: next?.revision || updatePayload.revision },
    });

    return jsonResponse({ slide: next });
  }

  const insertPayload = {
    owner_user_id: actor.user_id,
    title,
    canvas,
    components_json: components,
    metadata,
    revision: 1,
    source: 'import',
    source_template_id: null,
    created_by: actor.user_id,
    updated_by: actor.user_id,
    last_edited_at: timestamp,
  };

  const insertResponse = await supabaseFetch(env, '/rest/v1/slides', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(insertPayload),
  });

  const rows = await insertResponse.json().catch(() => []);
  const created = normalizeSlideRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'slide',
    entity_id: created?.id || '',
    action: autosave ? 'autosave' : 'save',
    outcome: 'success',
    details: { revision: 1 },
  });

  return jsonResponse({ slide: created }, 201);
}

async function handleDuplicateSlideAction(env, actor, body) {
  const slideId = typeof body.slide_id === 'string' ? body.slide_id.trim() : '';
  if (!slideId) return errorResponse('slide_id required for duplicate-slide.', 400);

  const source = await readSlideById(env, slideId);
  if (!source || source.deleted_at) return errorResponse('Slide not found for duplicate.', 404);

  const actorIsAdmin = actor.role === 'admin';
  if (!actorIsAdmin && source.owner_user_id !== actor.user_id) {
    return errorResponse('Forbidden. You do not own this slide.', 403);
  }

  const timestamp = new Date().toISOString();
  const payload = {
    owner_user_id: actor.user_id,
    title: `${source.title} (Copy)`,
    canvas: source.canvas || { width: 1920, height: 1080 },
    components_json: Array.isArray(source.components_json) ? source.components_json : [],
    metadata: source.metadata || {},
    revision: 1,
    source: source.source || 'manual',
    source_template_id: source.source_template_id || null,
    created_by: actor.user_id,
    updated_by: actor.user_id,
    last_edited_at: timestamp,
  };

  const response = await supabaseFetch(env, '/rest/v1/slides', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  const rows = await response.json().catch(() => []);
  const created = normalizeSlideRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'slide',
    entity_id: created?.id || '',
    action: 'duplicate',
    outcome: 'success',
    details: { source_slide_id: slideId },
  });

  return jsonResponse({ slide: created }, 201);
}

async function handleDuplicateTemplateAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for duplicate-template.', 400);

  const template = await readTemplateById(env, templateId);
  if (!template) return errorResponse('Template not found for duplicate.', 404);

  const visibleToActor = await isTemplateVisibleToActor(env, template, actor);
  if (!visibleToActor) {
    return errorResponse('Forbidden. Template is not visible to this user.', 403);
  }

  const timestamp = new Date().toISOString();
  const payload = {
    owner_user_id: actor.user_id,
    title: `${template.name} (Copy)`,
    canvas: template.canvas || { width: 1920, height: 1080 },
    components_json: Array.isArray(template.components_json) ? template.components_json : [],
    metadata: {
      source_template_id: template.id,
      ...(template.metadata || {}),
      locked_element_ids: template.metadata?.locked_element_ids || [],
      editable_zone_ids: template.metadata?.editable_zone_ids || [],
      layout_blocks: template.metadata?.layout_blocks || [],
    },
    revision: 1,
    source: 'template',
    source_template_id: template.id,
    created_by: actor.user_id,
    updated_by: actor.user_id,
    last_edited_at: timestamp,
  };

  const response = await supabaseFetch(env, '/rest/v1/slides', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  const rows = await response.json().catch(() => []);
  const created = normalizeSlideRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template.id,
    action: 'duplicate',
    outcome: 'success',
    details: { slide_id: created?.id || '' },
  });

  return jsonResponse({ slide: created }, 201);
}

async function handleRenameSlideAction(env, actor, body) {
  const slideId = typeof body.slide_id === 'string' ? body.slide_id.trim() : '';
  const title = sanitizeTitle(body.title);
  if (!slideId) return errorResponse('slide_id required for rename-slide.', 400);
  if (!title) return errorResponse('title required for rename-slide.', 400);

  const existing = await readSlideById(env, slideId);
  if (!existing || existing.deleted_at) return errorResponse('Slide not found for rename.', 404);

  if (actor.role !== 'admin' && existing.owner_user_id !== actor.user_id) {
    return errorResponse('Forbidden. You do not own this slide.', 403);
  }

  const payload = {
    title,
    revision: existing.revision + 1,
    updated_by: actor.user_id,
    updated_at: new Date().toISOString(),
    last_edited_at: new Date().toISOString(),
  };

  const response = await supabaseFetch(
    env,
    '/rest/v1/slides?id=eq.' + encodeURIComponent(existing.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    },
  );

  const rows = await response.json().catch(() => []);
  const updated = normalizeSlideRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'slide',
    entity_id: existing.id,
    action: 'rename',
    outcome: 'success',
    details: { title },
  });

  return jsonResponse({ slide: updated });
}

async function handleDeleteSlideAction(env, actor, body) {
  const slideId = typeof body.slide_id === 'string' ? body.slide_id.trim() : '';
  if (!slideId) return errorResponse('slide_id required for delete-slide.', 400);

  const existing = await readSlideById(env, slideId);
  if (!existing || existing.deleted_at) return errorResponse('Slide not found for delete.', 404);

  if (actor.role !== 'admin' && existing.owner_user_id !== actor.user_id) {
    return errorResponse('Forbidden. You do not own this slide.', 403);
  }

  await supabaseFetch(
    env,
    '/rest/v1/slides?id=eq.' + encodeURIComponent(existing.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        deleted_at: new Date().toISOString(),
        revision: existing.revision + 1,
        updated_by: actor.user_id,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'slide',
    entity_id: existing.id,
    action: 'delete',
    outcome: 'success',
    details: {},
  });

  return jsonResponse({ ok: true });
}

async function handlePublishTemplateAction(env, actor, body) {
  const slideId = typeof body.slide_id === 'string' ? body.slide_id.trim() : '';
  const explicitName = typeof body.name === 'string' ? body.name.trim() : '';
  const explicitDescription = sanitizeTemplateDescription(body.description, 'Published from My Slides');
  const requestedShared = body.is_shared === true;
  if (!slideId) return errorResponse('slide_id required for publish-template.', 400);
  if (explicitDescription === null) return errorResponse('Invalid template description.', 400);

  const slide = await readSlideById(env, slideId);
  if (!slide || slide.deleted_at) return errorResponse('Slide not found for publish-template.', 404);

  if (actor.role !== 'admin' && slide.owner_user_id !== actor.user_id) {
    return errorResponse('Forbidden. You do not own this slide.', 403);
  }
  if (requestedShared && actor.role !== 'admin') {
    return errorResponse('Forbidden. Only admins can publish shared templates.', 403);
  }

  const templateName = sanitizeTitle(explicitName || `${slide.title} Template`);
  if (!templateName) return errorResponse('Invalid template name.', 400);
  const structure = deriveTemplateStructureFromComponents(slide.components_json || []);

  const payload = {
    owner_user_id: actor.user_id,
    name: templateName,
    description: explicitDescription,
    is_shared: requestedShared,
    canvas: slide.canvas || { width: 1920, height: 1080 },
    components_json: Array.isArray(slide.components_json) ? slide.components_json : [],
    metadata: {
      source_slide_id: slide.id,
      ...(slide.metadata || {}),
      locked_element_ids: structure.locked_element_ids,
      editable_zone_ids: structure.editable_zone_ids,
      layout_blocks: structure.layout_blocks,
    },
    created_by: actor.user_id,
    updated_by: actor.user_id,
  };
  payload.metadata.preview = buildTemplatePreviewSnapshot({
    id: 'pending-template-preview',
    canvas: payload.canvas,
    components_json: payload.components_json,
  }, actor.user_id);

  const response = await supabaseFetch(env, '/rest/v1/slide_templates', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });

  const rows = await response.json().catch(() => []);
  let createdRow = rows[0] || null;
  if (createdRow && createdRow.id) {
    const refreshedPreview = buildTemplatePreviewSnapshot(createdRow, actor.user_id, createdRow.metadata?.preview || null);
    const patchResponse = await supabaseFetch(
      env,
      '/rest/v1/slide_templates?id=eq.' + encodeURIComponent(createdRow.id),
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          metadata: {
            ...(createdRow.metadata || {}),
            locked_element_ids: structure.locked_element_ids,
            editable_zone_ids: structure.editable_zone_ids,
            layout_blocks: structure.layout_blocks,
            preview: refreshedPreview,
          },
          updated_by: actor.user_id,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    const patchedRows = await patchResponse.json().catch(() => []);
    createdRow = patchedRows[0] || createdRow;
  }
  const template = normalizeTemplateRow(createdRow);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template?.id || '',
    action: 'publish-template',
    outcome: 'success',
    details: { source_slide_id: slide.id },
  });

  return jsonResponse({ template }, 201);
}

async function handleRefreshTemplatePreviewAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for refresh-template-preview.', 400);

  const template = await readTemplateById(env, templateId);
  if (!template) return errorResponse('Template not found for preview refresh.', 404);
  const actorIsAdmin = actor.role === 'admin';
  const actorIsOwner = template.owner_user_id === actor.user_id;
  if (!actorIsAdmin && !actorIsOwner) {
    return errorResponse('Forbidden. Only owners/admins can refresh template previews.', 403);
  }

  const nextPreview = buildTemplatePreviewSnapshot(template, actor.user_id, template.metadata?.preview || null);
  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_templates?id=eq.' + encodeURIComponent(template.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        metadata: {
          ...(template.metadata || {}),
          preview: nextPreview,
        },
        updated_by: actor.user_id,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const rows = await response.json().catch(() => []);
  const updated = normalizeTemplateRow(rows[0] || null);
  return jsonResponse({ template: updated });
}

async function handleUpdateTemplateAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for update-template.', 400);

  const template = await readTemplateById(env, templateId);
  if (!template) return errorResponse('Template not found for update.', 404);

  const actorIsAdmin = actor.role === 'admin';
  const actorIsOwner = template.owner_user_id === actor.user_id;
  const actorRole = actorIsAdmin || actorIsOwner ? null : await readActorTemplateRole(env, template.id, actor.user_id);
  const canEditContent = actorIsAdmin || actorIsOwner || actorRole === 'editor';
  if (!canEditContent) {
    return errorResponse('Forbidden. You do not own this template.', 403);
  }

  const nextName = typeof body.name === 'string' ? sanitizeTitle(body.name) : null;
  if (typeof body.name === 'string' && !nextName) return errorResponse('Invalid template name.', 400);

  const nextDescription = Object.prototype.hasOwnProperty.call(body, 'description')
    ? sanitizeTemplateDescription(body.description, template.description || '')
    : undefined;
  if (nextDescription === null) return errorResponse('Invalid template description.', 400);

  const hasSharedInput = Object.prototype.hasOwnProperty.call(body, 'is_shared');
  const requestedShared = hasSharedInput ? body.is_shared === true : undefined;
  if (typeof requestedShared === 'boolean' && !actorIsAdmin && !actorIsOwner) {
    return errorResponse('Forbidden. Only owners/admins can change template visibility.', 403);
  }
  if (requestedShared === true && !actorIsAdmin) {
    return errorResponse('Forbidden. Only admins can set template visibility to shared.', 403);
  }

  const updatePayload = {
    ...(nextName ? { name: nextName } : {}),
    ...(typeof nextDescription === 'string' ? { description: nextDescription } : {}),
    ...(typeof requestedShared === 'boolean' ? { is_shared: requestedShared } : {}),
    updated_by: actor.user_id,
    updated_at: new Date().toISOString(),
  };

  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_templates?id=eq.' + encodeURIComponent(template.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(updatePayload),
    },
  );

  const rows = await response.json().catch(() => []);
  const updated = normalizeTemplateRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template.id,
    action: 'rename',
    outcome: 'success',
    details: {
      operation: 'update-template',
      changed_shared_visibility: typeof requestedShared === 'boolean',
    },
  });

  return jsonResponse({ template: updated });
}

async function handleArchiveTemplateAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for archive-template.', 400);

  const template = await readTemplateById(env, templateId, { includeArchived: true });
  if (!template) return errorResponse('Template not found for archive.', 404);
  if (template.is_archived === true) {
    return jsonResponse({ ok: true, already_archived: true });
  }

  const actorIsAdmin = actor.role === 'admin';
  if (!actorIsAdmin && template.owner_user_id !== actor.user_id) {
    return errorResponse('Forbidden. You do not own this template.', 403);
  }

  await supabaseFetch(
    env,
    '/rest/v1/slide_templates?id=eq.' + encodeURIComponent(template.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        is_archived: true,
        updated_by: actor.user_id,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template.id,
    action: 'delete',
    outcome: 'success',
    details: { operation: 'archive-template' },
  });

  return jsonResponse({ ok: true });
}

async function handleRestoreTemplateAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for restore-template.', 400);

  const template = await readTemplateById(env, templateId, { archivedOnly: true });
  if (!template) return errorResponse('Template not found for restore.', 404);

  const actorIsAdmin = actor.role === 'admin';
  if (!actorIsAdmin && template.owner_user_id !== actor.user_id) {
    return errorResponse('Forbidden. You do not own this template.', 403);
  }

  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_templates?id=eq.' + encodeURIComponent(template.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        is_archived: false,
        updated_by: actor.user_id,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const rows = await response.json().catch(() => []);
  const restored = normalizeTemplateRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template.id,
    action: 'delete',
    outcome: 'success',
    details: { operation: 'restore-template' },
  });

  return jsonResponse({ template: restored });
}

async function handlePermanentDeleteTemplateAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for permanent-delete-template.', 400);

  const template = await readTemplateById(env, templateId, { includeArchived: true });
  if (!template) return errorResponse('Template not found for permanent delete.', 404);
  if (template.is_archived !== true) {
    return errorResponse('Template must be archived before permanent delete.', 409);
  }

  const actorIsAdmin = actor.role === 'admin';
  if (!actorIsAdmin && template.owner_user_id !== actor.user_id) {
    return errorResponse('Forbidden. You do not own this template.', 403);
  }

  await supabaseFetch(
    env,
    '/rest/v1/slide_template_collaborators?template_id=eq.' + encodeURIComponent(template.id),
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  );

  await supabaseFetch(
    env,
    '/rest/v1/slide_templates?id=eq.' + encodeURIComponent(template.id),
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  );

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template.id,
    action: 'delete',
    outcome: 'success',
    details: { operation: 'permanent-delete-template' },
  });

  return jsonResponse({ ok: true });
}

async function handleTransferTemplateOwnershipAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for transfer-template-owner.', 400);

  const targetUserId = typeof body.target_user_id === 'string' ? body.target_user_id.trim() : '';
  const targetUserEmail = normalizeEmail(body.target_user_email || '');
  if (!targetUserId && !targetUserEmail) {
    return errorResponse('target_user_id or target_user_email is required for transfer-template-owner.', 400);
  }

  const template = await readTemplateById(env, templateId);
  if (!template) return errorResponse('Template not found for ownership transfer.', 404);

  const actorIsAdmin = actor.role === 'admin';
  if (!actorIsAdmin && template.owner_user_id !== actor.user_id) {
    return errorResponse('Forbidden. You do not own this template.', 403);
  }

  let targetUser;
  try {
    targetUser = await readAppUserByIdentifier(env, targetUserId, targetUserEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Target user lookup failed';
    return errorResponse(message, 502);
  }
  if (!targetUser) {
    return errorResponse('Target user not found for ownership transfer.', 404);
  }
  if (!isAuthorizedSlidesActor(targetUser)) {
    return errorResponse('Target user does not have slides access.', 403);
  }

  if (template.owner_user_id === targetUser.user_id) {
    return jsonResponse({ template: normalizeTemplateRow(template) });
  }

  await supabaseFetch(
    env,
    '/rest/v1/slide_template_collaborators?template_id=eq.' +
      encodeURIComponent(template.id) +
      '&user_id=eq.' +
      encodeURIComponent(targetUser.user_id),
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  );

  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_templates?id=eq.' + encodeURIComponent(template.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        owner_user_id: targetUser.user_id,
        updated_by: actor.user_id,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  const rows = await response.json().catch(() => []);
  const updated = normalizeTemplateRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template.id,
    action: 'transfer-template',
    outcome: 'success',
    details: {
      previous_owner_user_id: template.owner_user_id,
      next_owner_user_id: targetUser.user_id,
      next_owner_email: targetUser.email || null,
    },
  });

  return jsonResponse({ template: updated });
}

async function handleUpsertTemplateCollaboratorAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for upsert-template-collaborator.', 400);

  const template = await readTemplateById(env, templateId);
  if (!template) return errorResponse('Template not found for collaborator update.', 404);
  const actorIsAdmin = actor.role === 'admin';
  const actorIsOwner = template.owner_user_id === actor.user_id;
  if (!actorIsAdmin && !actorIsOwner) {
    return errorResponse('Forbidden. Only owners/admins can manage collaborators.', 403);
  }

  const role = sanitizeCollaboratorRole(body.role);
  if (!role) {
    return errorResponse('role is required and must be one of editor, reviewer, viewer.', 400);
  }

  const targetUserId = typeof body.target_user_id === 'string' ? body.target_user_id.trim() : '';
  const targetUserEmail = normalizeEmail(body.target_user_email || '');
  if (!targetUserId && !targetUserEmail) {
    return errorResponse('target_user_id or target_user_email is required for collaborator upsert.', 400);
  }

  let targetUser;
  try {
    targetUser = await readAppUserByIdentifier(env, targetUserId, targetUserEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Target user lookup failed';
    return errorResponse(message, 502);
  }
  if (!targetUser) return errorResponse('Target user not found for collaborator upsert.', 404);
  if (!isAuthorizedSlidesActor(targetUser)) return errorResponse('Target user does not have slides access.', 403);
  if (targetUser.user_id === template.owner_user_id) {
    return errorResponse('Template owner already has full access; collaborator role is not needed.', 400);
  }

  const response = await supabaseFetch(
    env,
    '/rest/v1/slide_template_collaborators',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        template_id: template.id,
        user_id: targetUser.user_id,
        role,
        created_by: actor.user_id,
        updated_by: actor.user_id,
      }),
    },
  );
  const rows = await response.json().catch(() => []);
  const collaborator = normalizeTemplateCollaboratorRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template.id,
    action: 'upsert-collaborator',
    outcome: 'success',
    details: {
      collaborator_user_id: targetUser.user_id,
      collaborator_email: targetUser.email || null,
      role,
    },
  });

  const usersById = await readAppUsersByIds(env, [targetUser.user_id]);
  return jsonResponse({
    collaborator: collaborator
      ? { ...collaborator, user_email: usersById.get(collaborator.user_id) || null }
      : null,
  });
}

async function handleRemoveTemplateCollaboratorAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for remove-template-collaborator.', 400);

  const template = await readTemplateById(env, templateId);
  if (!template) return errorResponse('Template not found for collaborator removal.', 404);
  const actorIsAdmin = actor.role === 'admin';
  const actorIsOwner = template.owner_user_id === actor.user_id;
  if (!actorIsAdmin && !actorIsOwner) {
    return errorResponse('Forbidden. Only owners/admins can manage collaborators.', 403);
  }

  const targetUserId = typeof body.target_user_id === 'string' ? body.target_user_id.trim() : '';
  const targetUserEmail = normalizeEmail(body.target_user_email || '');
  if (!targetUserId && !targetUserEmail) {
    return errorResponse('target_user_id or target_user_email is required for collaborator removal.', 400);
  }

  let targetUser;
  try {
    targetUser = await readAppUserByIdentifier(env, targetUserId, targetUserEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Target user lookup failed';
    return errorResponse(message, 502);
  }
  if (!targetUser) return errorResponse('Target user not found for collaborator removal.', 404);

  await supabaseFetch(
    env,
    '/rest/v1/slide_template_collaborators?template_id=eq.' +
      encodeURIComponent(template.id) +
      '&user_id=eq.' +
      encodeURIComponent(targetUser.user_id),
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  );

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template.id,
    action: 'remove-collaborator',
    outcome: 'success',
    details: {
      collaborator_user_id: targetUser.user_id,
      collaborator_email: targetUser.email || null,
    },
  });

  return jsonResponse({ ok: true });
}

async function applyTemplateApprovalOperation(env, actor, approvalType, templateId, payload) {
  if (approvalType === 'transfer-template') {
    return handleTransferTemplateOwnershipAction(env, actor, {
      template_id: templateId,
      target_user_id: payload.target_user_id || null,
      target_user_email: payload.target_user_email || null,
    });
  }
  if (approvalType === 'upsert-collaborator') {
    return handleUpsertTemplateCollaboratorAction(env, actor, {
      template_id: templateId,
      target_user_id: payload.target_user_id || null,
      target_user_email: payload.target_user_email || null,
      role: payload.role || null,
    });
  }
  if (approvalType === 'remove-collaborator') {
    return handleRemoveTemplateCollaboratorAction(env, actor, {
      template_id: templateId,
      target_user_id: payload.target_user_id || null,
      target_user_email: payload.target_user_email || null,
    });
  }
  return errorResponse('Unsupported approval operation.', 400);
}

async function handleSubmitTemplateApprovalAction(env, actor, body) {
  const templateId = typeof body.template_id === 'string' ? body.template_id.trim() : '';
  if (!templateId) return errorResponse('template_id required for submit-template-approval.', 400);

  const template = await readTemplateById(env, templateId);
  if (!template) return errorResponse('Template not found for approval submission.', 404);
  const canManage = await isTemplateGovernanceManager(env, actor, template);
  if (!canManage) return errorResponse('Forbidden. Only owners/admins can submit governance approvals.', 403);

  const approvalType = sanitizeApprovalType(body.approval_type);
  if (!approvalType) return errorResponse('approval_type must be transfer-template, upsert-collaborator, or remove-collaborator.', 400);

  const targetUserId = typeof body.target_user_id === 'string' ? body.target_user_id.trim() : '';
  const targetUserEmail = normalizeEmail(body.target_user_email || '');
  const role = sanitizeCollaboratorRole(body.role);

  if (!targetUserId && !targetUserEmail) {
    return errorResponse('target_user_id or target_user_email is required for approval submission.', 400);
  }
  if (approvalType === 'upsert-collaborator' && !role) {
    return errorResponse('role is required for upsert-collaborator approvals.', 400);
  }

  let targetUser;
  try {
    targetUser = await readAppUserByIdentifier(env, targetUserId, targetUserEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Target user lookup failed';
    return errorResponse(message, 502);
  }
  if (!targetUser) return errorResponse('Target user not found for approval submission.', 404);
  if (!isAuthorizedSlidesActor(targetUser)) return errorResponse('Target user does not have slides access.', 403);

  const payload = {
    target_user_id: targetUser.user_id,
    target_user_email: targetUser.email || null,
    ...(role ? { role } : {}),
  };

  const response = await supabaseFetch(env, '/rest/v1/slide_template_approvals', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      template_id: template.id,
      requested_by_user_id: actor.user_id,
      requested_by_email: actor.email || null,
      approval_type: approvalType,
      payload,
      status: 'pending',
    }),
  });
  const rows = await response.json().catch(() => []);
  const approval = normalizeTemplateApprovalRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: template.id,
    action: 'submit-approval',
    outcome: 'success',
    details: {
      approval_id: approval?.id || null,
      approval_type: approvalType,
      target_user_id: payload.target_user_id,
      target_user_email: payload.target_user_email,
      role: payload.role || null,
    },
  });

  return jsonResponse({ approval }, 201);
}

async function handleResolveTemplateApprovalAction(env, actor, body) {
  if (actor.role !== 'admin') {
    return errorResponse('Forbidden. Only admins can resolve template approvals.', 403);
  }

  const approvalId = typeof body.approval_id === 'string' ? body.approval_id.trim() : '';
  if (!approvalId) return errorResponse('approval_id required for resolve-template-approval.', 400);
  const decision = typeof body.decision === 'string' ? body.decision.trim().toLowerCase() : '';
  if (decision !== 'approve' && decision !== 'reject') {
    return errorResponse('decision must be approve or reject.', 400);
  }
  const reviewNote = typeof body.review_note === 'string' ? body.review_note.trim() : '';

  const approval = await readTemplateApprovalById(env, approvalId);
  if (!approval) return errorResponse('Approval not found for resolution.', 404);
  if (approval.status !== 'pending') return errorResponse('Approval is not pending and cannot be resolved.', 409);

  if (decision === 'reject') {
    const rejectResponse = await supabaseFetch(
      env,
      '/rest/v1/slide_template_approvals?id=eq.' + encodeURIComponent(approval.id),
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'rejected',
          reviewed_by_user_id: actor.user_id,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote || null,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    const rows = await rejectResponse.json().catch(() => []);
    const rejected = normalizeTemplateApprovalRow(rows[0] || null);

    await insertAudit(env, {
      actor_user_id: actor.user_id,
      actor_email: actor.email || null,
      entity_type: 'template',
      entity_id: approval.template_id,
      action: 'reject-approval',
      outcome: 'success',
      details: { approval_id: approval.id, approval_type: approval.approval_type, review_note: reviewNote || null },
    });

    return jsonResponse({ approval: rejected });
  }

  const payload = isObject(approval.payload) ? approval.payload : {};
  const operationResponse = await applyTemplateApprovalOperation(env, actor, approval.approval_type, approval.template_id, payload);
  if (!operationResponse.ok) {
    const text = await operationResponse.text().catch(() => 'Approval operation failed');
    return errorResponse(text || 'Approval operation failed', operationResponse.status || 500);
  }

  const approveResponse = await supabaseFetch(
    env,
    '/rest/v1/slide_template_approvals?id=eq.' + encodeURIComponent(approval.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'approved',
        reviewed_by_user_id: actor.user_id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote || null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const rows = await approveResponse.json().catch(() => []);
  const approved = normalizeTemplateApprovalRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: approval.template_id,
    action: 'approve-approval',
    outcome: 'success',
    details: { approval_id: approval.id, approval_type: approval.approval_type, review_note: reviewNote || null },
  });

  return jsonResponse({ approval: approved });
}

async function handleEscalateTemplateApprovalAction(env, actor, body) {
  const approvalId = typeof body.approval_id === 'string' ? body.approval_id.trim() : '';
  if (!approvalId) return errorResponse('approval_id required for escalate-template-approval.', 400);

  const reason = sanitizeEscalationReason(body.reason);
  if (reason === null) {
    return errorResponse('reason must be 280 characters or fewer for escalate-template-approval.', 400);
  }

  const approval = await readTemplateApprovalById(env, approvalId);
  if (!approval) return errorResponse('Approval not found for escalation.', 404);
  if (approval.status !== 'pending') return errorResponse('Approval is not pending and cannot be escalated.', 409);

  const template = await readTemplateById(env, approval.template_id);
  const isRequester = approval.requested_by_user_id === actor.user_id;
  const isTemplateOwner = !!template && template.owner_user_id === actor.user_id;
  const isAdmin = actor.role === 'admin';
  if (!isRequester && !isTemplateOwner && !isAdmin) {
    return errorResponse('Forbidden. Only requesters, owners, or admins can escalate approvals.', 403);
  }

  const payload = isObject(approval.payload) ? approval.payload : {};
  const priorEscalations = Array.isArray(payload.escalations) ? payload.escalations : [];
  const escalationRouting = resolveEscalationRoutingConfig(env);
  const now = new Date().toISOString();
  const escalationRecord = {
    escalated_by_user_id: actor.user_id,
    escalated_by_email: actor.email || null,
    reason: reason || null,
    routing: escalationRouting,
    created_at: now,
  };

  const patchResponse = await supabaseFetch(
    env,
    '/rest/v1/slide_template_approvals?id=eq.' + encodeURIComponent(approval.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        payload: {
          ...payload,
          escalations: [...priorEscalations, escalationRecord],
          escalation_count: priorEscalations.length + 1,
          last_escalated_at: now,
        },
        updated_at: now,
      }),
    },
  );
  const rows = await patchResponse.json().catch(() => []);
  const escalated = normalizeTemplateApprovalRow(rows[0] || null);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'template',
    entity_id: approval.template_id,
    action: 'escalate-approval',
    outcome: 'success',
    details: {
      approval_id: approval.id,
      approval_type: approval.approval_type,
      escalation_count: priorEscalations.length + 1,
      reason: reason || null,
      routing_channels: escalationRouting.channels,
      routing_targets: escalationRouting.targets,
    },
  });

  return jsonResponse({ approval: escalated });
}

async function handleRunApprovalEscalationSweepAction(env, actor, body) {
  if (actor.role !== 'admin') {
    return errorResponse('Forbidden. Only admins can run approval escalation sweeps.', 403);
  }

  const dryRun = body?.dry_run === true;
  const force = body?.force === true;
  const sweepSource = body?.sweep_source === 'scheduled' ? 'scheduled' : 'manual';
  const result = await executeApprovalEscalationSweep(env, actor, {
    dryRun,
    force,
    sweepSource,
  });

  return jsonResponse({
    sweep: result,
  });
}

async function handleUpsertAuditPresetAction(env, actor, body) {
  const name = sanitizeAuditPresetName(body.name);
  if (!name) return errorResponse('Valid preset name is required for upsert-audit-preset.', 400);

  const scope = sanitizeAuditPresetScope(body.scope || 'personal');
  if (scope === 'shared' && actor.role !== 'admin') {
    return errorResponse('Forbidden. Only admins can save shared audit presets.', 403);
  }

  const search = typeof body.search === 'string' ? body.search.trim() : '';
  const actionFilter = typeof body.action_filter === 'string' && (body.action_filter === 'all' || AUDIT_ACTIONS.includes(body.action_filter))
    ? body.action_filter
    : 'all';
  const outcomeFilter = typeof body.outcome === 'string' && (body.outcome === 'all' || AUDIT_OUTCOMES.includes(body.outcome))
    ? body.outcome
    : 'all';
  const entityTypeFilter = typeof body.entity_type === 'string' && (body.entity_type === 'all' || AUDIT_ENTITY_TYPES.includes(body.entity_type))
    ? body.entity_type
    : 'all';
  const dateFrom = typeof body.date_from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date_from.trim())
    ? body.date_from.trim()
    : null;
  const dateTo = typeof body.date_to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date_to.trim())
    ? body.date_to.trim()
    : null;

  let existing = null;
  const explicitPresetId = typeof body.preset_id === 'string' ? body.preset_id.trim() : '';
  if (explicitPresetId) {
    existing = await readAuditPresetById(env, explicitPresetId);
    if (!existing) return errorResponse('Audit preset not found for update.', 404);
    if (actor.role !== 'admin' && existing.owner_user_id !== actor.user_id) {
      return errorResponse('Forbidden. You can only update your own audit presets.', 403);
    }
    if (existing.scope === 'shared' && actor.role !== 'admin') {
      return errorResponse('Forbidden. Only admins can update shared audit presets.', 403);
    }
  } else {
    const dedupePath = '/rest/v1/slide_audit_filter_presets?is_archived=eq.false&owner_user_id=eq.' +
      encodeURIComponent(actor.user_id) +
      '&scope=eq.' +
      encodeURIComponent(scope) +
      '&name=eq.' +
      encodeURIComponent(name) +
      '&select=*&limit=1';
    const dedupeResponse = await supabaseFetch(env, dedupePath);
    const dedupeRows = await dedupeResponse.json().catch(() => []);
    existing = dedupeRows[0] || null;
  }

  const timestamp = new Date().toISOString();
  if (existing) {
    const response = await supabaseFetch(
      env,
      '/rest/v1/slide_audit_filter_presets?id=eq.' + encodeURIComponent(existing.id),
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          name,
          scope,
          search,
          action_filter: actionFilter,
          outcome_filter: outcomeFilter,
          entity_type_filter: entityTypeFilter,
          date_from: dateFrom,
          date_to: dateTo,
          updated_by: actor.user_id,
          updated_at: timestamp,
        }),
      },
    );
    const rows = await response.json().catch(() => []);
    const preset = normalizeAuditPresetRow(rows[0] || null);
    return jsonResponse({ preset });
  }

  const response = await supabaseFetch(env, '/rest/v1/slide_audit_filter_presets', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_user_id: actor.user_id,
      name,
      scope,
      search,
      action_filter: actionFilter,
      outcome_filter: outcomeFilter,
      entity_type_filter: entityTypeFilter,
      date_from: dateFrom,
      date_to: dateTo,
      created_by: actor.user_id,
      updated_by: actor.user_id,
    }),
  });
  const rows = await response.json().catch(() => []);
  const preset = normalizeAuditPresetRow(rows[0] || null);
  return jsonResponse({ preset }, 201);
}

async function handleDeleteAuditPresetAction(env, actor, body) {
  const presetId = typeof body.preset_id === 'string' ? body.preset_id.trim() : '';
  if (!presetId) return errorResponse('preset_id required for delete-audit-preset.', 400);

  const preset = await readAuditPresetById(env, presetId);
  if (!preset) return errorResponse('Audit preset not found for delete.', 404);
  if (actor.role !== 'admin' && preset.owner_user_id !== actor.user_id) {
    return errorResponse('Forbidden. You can only delete your own audit presets.', 403);
  }
  if (preset.scope === 'shared' && actor.role !== 'admin') {
    return errorResponse('Forbidden. Only admins can delete shared audit presets.', 403);
  }

  await supabaseFetch(
    env,
    '/rest/v1/slide_audit_filter_presets?id=eq.' + encodeURIComponent(preset.id),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        is_archived: true,
        updated_by: actor.user_id,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  return jsonResponse({ ok: true });
}

async function handleRecordExportAction(env, actor, body) {
  const slideId = typeof body.slide_id === 'string' ? body.slide_id.trim() : '';
  const format = body.format === 'pdf' ? 'pdf' : body.format === 'pptx' ? 'pptx' : 'html';
  const outcome = body.outcome === 'failure' ? 'failure' : 'success';
  const errorClass = typeof body.error_class === 'string' ? body.error_class : null;

  if (!slideId) return errorResponse('slide_id required for record-export.', 400);

  await insertAudit(env, {
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    entity_type: 'slide',
    entity_id: slideId,
    action: format === 'pdf' ? 'export-pdf' : format === 'pptx' ? 'export-pptx' : 'export-html',
    outcome,
    error_class: errorClass,
    details: { format },
  });

  return jsonResponse({ ok: true });
}

function normalizeAuditExportFiltersFromBody(body) {
  const search = typeof body.search === 'string' ? body.search.trim() : '';
  const actionFilter = typeof body.action_filter === 'string' && (body.action_filter === 'all' || AUDIT_ACTIONS.includes(body.action_filter))
    ? body.action_filter
    : 'all';
  const outcomeFilter = typeof body.outcome === 'string' && (body.outcome === 'all' || AUDIT_OUTCOMES.includes(body.outcome))
    ? body.outcome
    : 'all';
  const entityTypeFilter = typeof body.entity_type === 'string' && (body.entity_type === 'all' || AUDIT_ENTITY_TYPES.includes(body.entity_type))
    ? body.entity_type
    : 'all';
  const dateFrom = typeof body.date_from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date_from.trim())
    ? body.date_from.trim()
    : '';
  const dateTo = typeof body.date_to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date_to.trim())
    ? body.date_to.trim()
    : '';

  return {
    search,
    action: actionFilter,
    outcome: outcomeFilter,
    entity_type: entityTypeFilter,
    date_from: dateFrom,
    date_to: dateTo,
  };
}

function escapeCsvCell(value) {
  return '"' + String(value || '').replace(/"/g, '""') + '"';
}

function buildAuditCsv(rows) {
  const header = 'created_at,action,entity_type,entity_id,outcome,actor_user_id,actor_email,error_class';
  const body = rows.map((event) =>
    [
      event.created_at || '',
      event.action || '',
      event.entity_type || '',
      event.entity_id || '',
      event.outcome || '',
      event.actor_user_id || '',
      event.actor_email || '',
      event.error_class || '',
    ].map((value) => escapeCsvCell(value)).join(','),
  );
  return [header, ...body].join('\n');
}

function buildAuditQueryPath(actor, filters, limit = MAX_AUDIT_EXPORT_ROWS, offset = 0) {
  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, MAX_AUDIT_EXPORT_ROWS) : 100;
  const resolvedOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  let path = '/rest/v1/slide_audit_events?select=*&order=created_at.desc&limit=' + String(resolvedLimit) + '&offset=' + String(resolvedOffset);

  if (actor.role !== 'admin') {
    path += '&actor_user_id=eq.' + encodeURIComponent(actor.user_id);
  }
  if (filters.action && filters.action !== 'all' && AUDIT_ACTIONS.includes(filters.action)) {
    path += '&action=eq.' + encodeURIComponent(filters.action);
  }
  if (filters.outcome && filters.outcome !== 'all' && AUDIT_OUTCOMES.includes(filters.outcome)) {
    path += '&outcome=eq.' + encodeURIComponent(filters.outcome);
  }
  if (filters.entity_type && filters.entity_type !== 'all' && AUDIT_ENTITY_TYPES.includes(filters.entity_type)) {
    path += '&entity_type=eq.' + encodeURIComponent(filters.entity_type);
  }
  if (filters.date_from && filters.date_to) {
    const dateClause = `(created_at.gte.${filters.date_from}T00:00:00.000Z,created_at.lte.${filters.date_to}T23:59:59.999Z)`;
    path += '&and=' + encodeURIComponent(dateClause);
  } else if (filters.date_from) {
    path += '&created_at=gte.' + encodeURIComponent(filters.date_from + 'T00:00:00.000Z');
  } else if (filters.date_to) {
    path += '&created_at=lte.' + encodeURIComponent(filters.date_to + 'T23:59:59.999Z');
  }
  path = addAuditSearch(path, filters.search || '');

  return path;
}

async function handleRequestAuditExportJobAction(env, actor, body) {
  const filters = normalizeAuditExportFiltersFromBody(body);
  const now = new Date().toISOString();

  let created = null;
  try {
    const createResponse = await supabaseFetch(env, '/rest/v1/slide_audit_export_jobs', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        requested_by_user_id: actor.user_id,
        requested_by_email: actor.email || null,
        status: 'running',
        filters,
        row_count: 0,
        file_name: null,
        csv_content: null,
        error_message: null,
        requested_at: now,
        started_at: now,
        completed_at: null,
        created_by: actor.user_id,
        updated_by: actor.user_id,
        updated_at: now,
      }),
    });
    const createRows = await createResponse.json().catch(() => []);
    created = createRows[0] || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create audit export job.';
    return errorResponse(message, 500);
  }
  if (!created || typeof created.id !== 'string') {
    return errorResponse('Failed to create audit export job.', 500);
  }

  try {
    const queryPath = buildAuditQueryPath(actor, filters, MAX_AUDIT_EXPORT_ROWS, 0);
    const auditResponse = await supabaseFetch(env, queryPath);
    const rows = await auditResponse.json().catch(() => []);
    const safeRows = Array.isArray(rows) ? rows : [];
    const rowCount = safeRows.length;
    const csv = buildAuditCsv(safeRows);
    const completedAt = new Date().toISOString();
    const safeStamp = completedAt.replace(/[:.]/g, '-');
    const fileName = `slide-audit-export-${safeStamp}.csv`;

    const patchResponse = await supabaseFetch(
      env,
      '/rest/v1/slide_audit_export_jobs?id=eq.' + encodeURIComponent(created.id),
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'completed',
          row_count: rowCount,
          file_name: fileName,
          csv_content: csv,
          error_message: null,
          completed_at: completedAt,
          updated_by: actor.user_id,
          updated_at: completedAt,
        }),
      },
    );
    const updatedRows = await patchResponse.json().catch(() => []);
    const job = normalizeAuditExportJobRow(updatedRows[0] || null);
    if (!job) return errorResponse('Failed to finalize audit export job.', 500);
    return jsonResponse({ job }, 201);
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Audit export job failed.';
    try {
      await supabaseFetch(
        env,
        '/rest/v1/slide_audit_export_jobs?id=eq.' + encodeURIComponent(created.id),
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'failed',
            error_message: message.slice(0, 500),
            completed_at: failedAt,
            updated_by: actor.user_id,
            updated_at: failedAt,
          }),
        },
      );
    } catch (_) {
      // Preserve original export error.
    }
    return errorResponse(message, 500);
  }
}

async function handleDownloadAuditExportJobAction(env, actor, body) {
  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  if (!jobId) return errorResponse('job_id required for download-audit-export-job.', 400);

  let jobRow = null;
  try {
    jobRow = await readAuditExportJobById(env, jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read audit export job.';
    return errorResponse(message, 500);
  }
  if (!jobRow) return errorResponse('Audit export job not found.', 404);
  if (actor.role !== 'admin' && jobRow.requested_by_user_id !== actor.user_id) {
    return errorResponse('Forbidden. Cannot access this audit export job.', 403);
  }
  if (jobRow.status !== 'completed' || typeof jobRow.csv_content !== 'string') {
    return errorResponse('Audit export job is not ready for download.', 409);
  }

  return jsonResponse({
    filename: typeof jobRow.file_name === 'string' && jobRow.file_name.trim() ? jobRow.file_name : 'slide-audit-export.csv',
    content: jobRow.csv_content,
  });
}

async function handleRequestPptxExportJobAction(env, actor, body) {
  const slides = sanitizePptxExportSlides(body?.slides);
  if (!slides) {
    return errorResponse('slides array is required for request-pptx-export-job and must contain valid slide payloads.', 400);
  }

  const slideIds = sanitizePptxSlideIds(body?.slide_ids);
  const filenamePrefix = sanitizePptxFilenamePrefix(body?.filename_prefix);
  const includeHidden = body?.include_hidden === true;
  const idempotencyKey = sanitizePptxIdempotencyKey(body?.idempotency_key);
  const maxAttempts = sanitizePptxMaxAttempts(body?.max_attempts);
  const requestFontFaces = sanitizePptxFontFaces(body?.font_faces);
  const animationProfile = sanitizePptxAnimationProfile(body?.animation_profile);

  for (const slideId of slideIds) {
    const persisted = await readSlideById(env, slideId);
    if (!persisted) {
      return errorResponse(`Slide ${slideId} not found for PPTX export.`, 404);
    }
    if (actor.role !== 'admin' && persisted.owner_user_id !== actor.user_id) {
      return errorResponse('Forbidden. Slide ownership is required for PPTX export.', 403);
    }
  }

  const existing = findExistingPptxJobByIdempotency(actor, idempotencyKey);
  if (existing) return jsonResponse({ job: normalizePptxExportJobRow(existing) }, 200);

  const requestedAt = new Date().toISOString();
  const baseJob = {
    id: 'pptx-job-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36),
    requested_by_user_id: actor.user_id,
    requested_by_email: actor.email || null,
    status: 'queued',
    slide_ids: slideIds,
    options: {
      filename_prefix: filenamePrefix,
      include_hidden: includeHidden,
      animation_profile: animationProfile,
    },
    attempts: 0,
    max_attempts: maxAttempts,
    warning_count: 0,
    warnings: [],
    warning_summary: {
      total_warnings: 0,
      editable_object_count: 0,
      fallback_object_count: 0,
      unsupported_component_count: 0,
      image_fallback_count: 0,
    },
    native_objects: [],
    font_manifest: {
      embedded_fonts: [],
      used_fonts: [],
    },
    animation_manifest: {
      profile: animationProfile,
      animations: [],
    },
    dashboard_surface_manifest: {
      surfaces: [],
    },
    artifact: null,
    requested_at: requestedAt,
    started_at: null,
    completed_at: null,
    updated_at: requestedAt,
    error_message: null,
    idempotency_key: idempotencyKey,
    payload: {
      requester: {
        user_id: actor.user_id,
        user_email: actor.email || null,
      },
      slide_ids: slideIds,
      options: {
        filename_prefix: filenamePrefix,
        include_hidden: includeHidden,
        animation_profile: animationProfile,
      },
      font_faces: requestFontFaces,
      slides: slides.map((slide) => ({ id: slide.id, title: slide.title })),
    },
  };
  storePptxExportJob(baseJob);

  let completedJob = null;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const startedAt = new Date().toISOString();
      const projection = buildPptxNativeProjection(slides, {
        font_faces: requestFontFaces,
        animation_profile: animationProfile,
      });
      const completedAt = new Date().toISOString();
      const artifactStamp = completedAt.replace(/[:.]/g, '-');
      const artifact = {
        file_name: `${filenamePrefix.replace(/\s+/g, '-').toLowerCase()}-${artifactStamp}.pptx`,
        expires_at: new Date(Date.now() + PPTX_EXPORT_ARTIFACT_TTL_MINUTES * 60 * 1000).toISOString(),
        download_token: 'pptx-download-' + Math.random().toString(36).slice(2, 12),
      };
      completedJob = {
        ...baseJob,
        status: 'succeeded',
        attempts: attempt,
        warning_count: projection.warnings.length,
        warnings: projection.warnings,
        warning_summary: projection.warning_summary,
        native_objects: projection.native_objects,
        font_manifest: projection.font_manifest,
        animation_manifest: projection.animation_manifest,
        dashboard_surface_manifest: projection.dashboard_surface_manifest,
        artifact,
        started_at: startedAt,
        completed_at: completedAt,
        updated_at: completedAt,
        error_message: null,
      };
      storePptxExportJob(completedJob);
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const failedAt = new Date().toISOString();
      const failedJob = {
        ...baseJob,
        status: 'failed',
        attempts: attempt,
        error_message: String(lastError || 'PPTX export generation failed.').slice(0, 320),
        completed_at: failedAt,
        updated_at: failedAt,
      };
      storePptxExportJob(failedJob);
      if (attempt >= maxAttempts) {
        completedJob = failedJob;
      }
    }
  }

  const outcome = completedJob?.status === 'succeeded' ? 'success' : 'failure';
  for (const slideId of slideIds) {
    try {
      await insertAuditEvent(env, {
        actor_user_id: actor.user_id,
        actor_email: actor.email || null,
        entity_type: 'slide',
        entity_id: slideId,
        action: 'export-pptx',
        outcome,
        error_class: outcome === 'failure' ? (completedJob?.error_message || lastError || 'pptx_export_failed') : null,
        details: {
          job_id: completedJob?.id || baseJob.id,
          warning_count: completedJob?.warning_count || 0,
        },
      });
    } catch (_) {
      // Export should not fail if audit insert is temporarily unavailable.
    }
  }

  if (!completedJob) return errorResponse('Failed to create PPTX export job.', 500);
  const normalized = normalizePptxExportJobRow(completedJob);
  if (!normalized) return errorResponse('Failed to normalize PPTX export job response.', 500);
  return jsonResponse({ job: normalized }, 201);
}

async function handleDownloadPptxExportJobAction(env, actor, body) {
  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  if (!jobId) return errorResponse('job_id required for download-pptx-export-job.', 400);

  const job = getPptxExportJobById(jobId);
  if (!job) return errorResponse('PPTX export job not found.', 404);
  if (actor.role !== 'admin' && job.requested_by_user_id !== actor.user_id) {
    return errorResponse('Forbidden. Cannot access this PPTX export job.', 403);
  }
  if (job.status !== 'succeeded') {
    return errorResponse('PPTX export job is not ready for download.', 409);
  }
  const expiresAt = job.artifact?.expires_at ? Date.parse(job.artifact.expires_at) : NaN;
  if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
    return errorResponse('PPTX export artifact has expired. Request a new export.', 410);
  }
  const normalized = normalizePptxExportJobRow(job);
  if (!normalized) return errorResponse('Failed to normalize PPTX export job.', 500);
  return jsonResponse({ job: normalized });
}

async function handleRecordTelemetryAction(actor, body) {
  const eventType = sanitizeTelemetryEventType(body?.event_type);
  const workspaceTab = sanitizeTelemetryWorkspaceTab(body?.workspace_tab);
  const saveStatus = sanitizeTelemetrySaveStatus(body?.save_status);
  const triggerSource = sanitizeTelemetryTriggerSource(body?.trigger_source);
  if (!eventType || !workspaceTab || !saveStatus || !triggerSource) {
    return errorResponse('Telemetry event_type, workspace_tab, save_status, and trigger_source must match the Slides telemetry schema.', 400);
  }

  const details = isObject(body?.details) ? body.details : {};
  const slideId = typeof body?.slide_id === 'string' && body.slide_id.trim() ? body.slide_id.trim() : null;
  const event = {
    id: 'slides-telemetry-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36),
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    actor_role: actor.role || null,
    module_id: 'slides',
    event_type: eventType,
    workspace_tab: workspaceTab,
    slide_id: slideId,
    save_status: saveStatus,
    trigger_source: triggerSource,
    details,
    created_at: new Date().toISOString(),
  };
  unsavedTelemetryEvents.unshift(event);
  if (unsavedTelemetryEvents.length > SLIDES_TELEMETRY_RETENTION_MAX) {
    unsavedTelemetryEvents.splice(SLIDES_TELEMETRY_RETENTION_MAX);
  }
  return jsonResponse({ event }, 201);
}

async function handleRecordImportSessionTraceAction(env, actor, body) {
  const correlationId = typeof body?.correlation_id === 'string' ? body.correlation_id.trim() : '';
  const phase = sanitizeImportTracePhase(body?.phase);
  if (!correlationId || !phase) {
    return errorResponse('Import trace correlation_id and phase are required.', 400);
  }

  const taxonomyBuckets = isObject(body?.taxonomy_buckets) ? body.taxonomy_buckets : {};
  const counters = isObject(body?.counters) ? body.counters : {};
  const payload = {
    correlation_id: correlationId,
    actor_user_id: actor.user_id,
    actor_email: actor.email || null,
    phase,
    source: typeof body?.source === 'string' && body.source.trim() ? body.source.trim().slice(0, 64) : 'unknown',
    taxonomy_buckets: taxonomyBuckets,
    counters,
    duration_ms: Number.isFinite(body?.duration_ms) ? Number(body.duration_ms) : null,
    error_code: typeof body?.error_code === 'string' ? body.error_code.slice(0, 120) : null,
    error_message: typeof body?.error_message === 'string' ? body.error_message.slice(0, 320) : null,
  };

  const response = await supabaseFetch(env, '/rest/v1/slide_import_session_traces', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const rows = await response.json().catch(() => []);
  const trace = normalizeImportSessionTraceRow(rows[0] || null);
  return jsonResponse({ trace }, 201);
}

function addSearch(path, field, query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return path;
  return path + '&' + field + '=ilike.*' + encodeURIComponent(trimmed) + '*';
}

function addAuditSearch(path, query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return path;
  const clause = `(action.ilike.*${trimmed}*,entity_id.ilike.*${trimmed}*,actor_email.ilike.*${trimmed}*,error_class.ilike.*${trimmed}*)`;
  return path + '&or=' + encodeURIComponent(clause);
}

function safeSlidesErrorResponse(error, fallbackMessage, context = {}) {
  const detail = error instanceof Error ? error.message : String(error || '');
  const message = detail
    ? `${fallbackMessage} ${detail}`
    : fallbackMessage;
  const status = Number.isFinite(error?.status) && Number(error.status) > 0
    ? Number(error.status)
    : 503;
  return errorResponse(message, status, {
    code: 'slides_service_unavailable',
    failure_class: classifyFailureClass(status, message),
    retryable: isRetryableFailure(status, classifyFailureClass(status, message)),
    ray_id: error?.rayId || null,
    method: context.method || null,
    actor_user_id: context.actor?.user_id || null,
    actor_email: context.actor?.email || null,
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const missing = assertSupabaseConfigured(env);
  if (missing) return missing;

  const authz = await authorizeActorForRead(request, env);
  if (!authz.ok) {
    const identity = resolveActorIdentityFromQuery(request, env);
    return errorResponse(authz.error, authz.status || 403, {
      method: request.method || 'GET',
      actor_user_id: identity?.userId || null,
      actor_email: identity?.email || null,
    });
  }

  const actor = authz.actor;
  const url = new URL(request.url);
  const resource = (url.searchParams.get('resource') || 'slides').toLowerCase();
  const search = url.searchParams.get('search') || '';
  const limitRaw = Number.parseInt(url.searchParams.get('limit') || '50', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
  const offsetRaw = Number.parseInt(url.searchParams.get('offset') || '0', 10);
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  try {
  const resourceHandler = GET_RESOURCE_HANDLERS[resource];
  if (!resourceHandler) {
    return errorResponse('Unsupported resource for /api/slides. Use slides, templates, archived-templates, audits, audit-presets, audit-export-jobs, pptx-export-jobs, telemetry-summary, import-session-traces, template-collaborators, or template-approvals.', 400);
  }
  return await resourceHandler({
    env,
    actor,
    url,
    search,
    limit,
    offset,
  });
  } catch (error) {
    return safeSlidesErrorResponse(error, 'Slides data service is temporarily unavailable.', {
      method: request.method || 'GET',
      actor,
    });
  }
}

async function handleGetSlidesResource(context) {
  const { env, actor, search, limit } = context;
  let path = '/rest/v1/slides?deleted_at=is.null&select=*&order=updated_at.desc&limit=' + String(limit);
  if (actor.role !== 'admin') {
    path += '&owner_user_id=eq.' + encodeURIComponent(actor.user_id);
  }
  path = addSearch(path, 'title', search);

  const response = await supabaseFetch(env, path);
  const rows = await response.json().catch(() => []);
  const items = rows.map(normalizeSlideRow).filter(Boolean);
  return jsonResponse({ items });
}

async function handleGetTemplatesResource(context) {
  const { env, actor, search, limit } = context;
  let path = '/rest/v1/slide_templates?is_archived=eq.false&select=*&order=updated_at.desc';
  if (actor.role !== 'admin') {
    path += '&or=' + encodeURIComponent(`(is_shared.eq.true,owner_user_id.eq.${actor.user_id})`);
  }
  path = addSearch(path, 'name', search);
  path += '&limit=' + String(limit);

  const response = await supabaseFetch(env, path);
  const baseRows = await response.json().catch(() => []);

  let combined = Array.isArray(baseRows) ? baseRows.slice() : [];
  if (actor.role !== 'admin') {
    const collaboratorTemplateIds = await readTemplateIdsByCollaborator(env, actor.user_id);
    if (collaboratorTemplateIds.length > 0) {
      const inClause = '(' + collaboratorTemplateIds.map((value) => `"${encodeURIComponent(value)}"`).join(',') + ')';
      let collabPath = '/rest/v1/slide_templates?is_archived=eq.false&id=in.' + inClause + '&select=*&order=updated_at.desc';
      collabPath = addSearch(collabPath, 'name', search);
      const collabResponse = await supabaseFetch(env, collabPath);
      const collabRows = await collabResponse.json().catch(() => []);
      combined = combined.concat(Array.isArray(collabRows) ? collabRows : []);
    }
  }

  const dedupedById = new Map();
  for (const row of combined) {
    if (row && typeof row.id === 'string') dedupedById.set(row.id, row);
  }

  const visible = Array.from(dedupedById.values());
  visible.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  const items = visible.slice(0, limit).map(normalizeTemplateRow).filter(Boolean);
  return jsonResponse({ items });
}

async function handleGetArchivedTemplatesResource(context) {
  const { env, actor, search, limit } = context;
  let path = '/rest/v1/slide_templates?is_archived=eq.true&select=*&order=updated_at.desc';
  if (actor.role !== 'admin') {
    path += '&owner_user_id=eq.' + encodeURIComponent(actor.user_id);
  }
  path = addSearch(path, 'name', search);
  path += '&limit=' + String(limit);

  const response = await supabaseFetch(env, path);
  const rows = await response.json().catch(() => []);
  const items = (Array.isArray(rows) ? rows : []).map(normalizeTemplateRow).filter(Boolean);
  return jsonResponse({ items });
}

async function handleGetTemplateCollaboratorsResource(context) {
  const { env, actor, url } = context;
  const templateId = (url.searchParams.get('template_id') || '').trim();
  if (!templateId) {
    return errorResponse('template_id is required for template-collaborators resource.', 400);
  }

  const template = await readTemplateById(env, templateId);
  if (!template) return errorResponse('Template not found for collaborator read.', 404);
  const visibleToActor = await isTemplateVisibleToActor(env, template, actor);
  if (!visibleToActor) return errorResponse('Forbidden. Template is not visible to this user.', 403);

  const collaborators = await readTemplateCollaborators(env, templateId);
  const usersById = await readAppUsersByIds(env, collaborators.map((entry) => entry.user_id));
  const items = collaborators.map((entry) => ({
    ...entry,
    user_email: usersById.get(entry.user_id) || null,
  }));
  return jsonResponse({ items });
}

async function handleGetTemplateApprovalsResource(context) {
  const { env, actor, url, limit, offset } = context;
  const templateId = (url.searchParams.get('template_id') || '').trim();
  const status = sanitizeApprovalStatus(url.searchParams.get('status') || 'pending');

  let path = '/rest/v1/slide_template_approvals?select=*&order=created_at.desc';
  if (templateId) {
    path += '&template_id=eq.' + encodeURIComponent(templateId);
  }
  if (status) {
    path += '&status=eq.' + encodeURIComponent(status);
  }
  if (actor.role !== 'admin') {
    path += '&requested_by_user_id=eq.' + encodeURIComponent(actor.user_id);
  }
  path += '&limit=' + String(limit) + '&offset=' + String(offset);

  let items = [];
  try {
    const response = await supabaseFetch(env, path);
    const rows = await response.json().catch(() => []);
    items = rows.map(normalizeTemplateApprovalRow).filter(Boolean);
  } catch (_) {
    items = [];
  }
  return jsonResponse({ items });
}

async function handleGetAuditPresetsResource(context) {
  const { env, actor } = context;
  let path = '/rest/v1/slide_audit_filter_presets?is_archived=eq.false&select=*&order=updated_at.desc&limit=100';
  path += '&or=' + encodeURIComponent(`(scope.eq.shared,owner_user_id.eq.${actor.user_id})`);

  let items = [];
  try {
    const response = await supabaseFetch(env, path);
    const rows = await response.json().catch(() => []);
    items = rows.map(normalizeAuditPresetRow).filter(Boolean);
  } catch (_) {
    items = [];
  }
  return jsonResponse({ items });
}

async function handleGetAuditExportJobsResource(context) {
  const { env, actor, url, limit, offset } = context;
  const status = sanitizeAuditExportStatus(url.searchParams.get('status') || 'all');
  let path =
    '/rest/v1/slide_audit_export_jobs?select=id,requested_by_user_id,requested_by_email,status,filters,row_count,file_name,error_message,requested_at,started_at,completed_at,updated_at&order=requested_at.desc&limit=' +
    String(limit) +
    '&offset=' +
    String(offset);
  if (actor.role !== 'admin') {
    path += '&requested_by_user_id=eq.' + encodeURIComponent(actor.user_id);
  }
  if (status !== 'all') {
    path += '&status=eq.' + encodeURIComponent(status);
  }

  let items = [];
  try {
    const response = await supabaseFetch(env, path);
    const rows = await response.json().catch(() => []);
    items = rows.map(normalizeAuditExportJobRow).filter(Boolean);
  } catch (_) {
    items = [];
  }
  return jsonResponse({ items });
}

async function handleGetPptxExportJobsResource(context) {
  const { actor, url, limit, offset } = context;
  const status = normalizePptxExportStatus(url.searchParams.get('status') || 'all', 'all');
  const items = listPptxExportJobsForActor(actor, status, offset, limit)
    .map(normalizePptxExportJobRow)
    .filter(Boolean);
  return jsonResponse({ items });
}

async function handleGetTelemetrySummaryResource(context) {
  const { env, actor, url } = context;
  const from = (url.searchParams.get('from') || '').trim();
  const to = (url.searchParams.get('to') || '').trim();
  const items = unsavedTelemetryEvents.filter((event) => {
    if (actor.role !== 'admin' && event.actor_user_id !== actor.user_id) return false;
    if (from && event.created_at < from) return false;
    if (to && event.created_at > to) return false;
    return true;
  });
  return jsonResponse(buildTelemetrySummary(items, from, to, env));
}

async function handleGetImportSessionTracesResource(context) {
  const { env, actor, url } = context;
  const correlationId = (url.searchParams.get('correlation_id') || '').trim();
  const maxRaw = Number.parseInt(url.searchParams.get('max') || '20', 10);
  const max = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.min(maxRaw, 100) : 20;

  let path = '/rest/v1/slide_import_session_traces?select=*&order=created_at.desc&limit=' + String(max);
  if (correlationId) {
    path += '&correlation_id=eq.' + encodeURIComponent(correlationId);
  }
  if (actor.role !== 'admin') {
    path += '&actor_user_id=eq.' + encodeURIComponent(actor.user_id);
  }

  let items = [];
  try {
    const response = await supabaseFetch(env, path);
    const rows = await response.json().catch(() => []);
    items = (Array.isArray(rows) ? rows : []).map(normalizeImportSessionTraceRow).filter(Boolean);
  } catch (_) {
    items = [];
  }

  return jsonResponse({
    items,
    retention: {
      max_events: SLIDES_IMPORT_TRACE_RETENTION_MAX,
      policy: 'Import session traces persist parse lifecycle counters and taxonomy metadata in Supabase; reads are capped per request.',
    },
  });
}

async function handleGetAuditsResource(context) {
  const { env, actor, url, search, limit, offset } = context;
  const action = (url.searchParams.get('action') || '').trim().toLowerCase();
  const outcome = (url.searchParams.get('outcome') || '').trim().toLowerCase();
  const entityType = (url.searchParams.get('entity_type') || '').trim().toLowerCase();
  const dateFrom = (url.searchParams.get('date_from') || '').trim();
  const dateTo = (url.searchParams.get('date_to') || '').trim();
  const path = buildAuditQueryPath(
    actor,
    {
      search,
      action: action || 'all',
      outcome: outcome || 'all',
      entity_type: entityType || 'all',
      date_from: dateFrom,
      date_to: dateTo,
    },
    limit + 1,
    offset,
  );

  let rows = [];
  try {
    const response = await supabaseFetch(env, path);
    rows = await response.json().catch(() => []);
  } catch (_) {
    rows = [];
  }
  const safeRows = Array.isArray(rows) ? rows : [];
  const hasMore = safeRows.length > limit;
  const items = hasMore ? safeRows.slice(0, limit) : safeRows;
  return jsonResponse({
    items,
    pagination: {
      offset,
      limit,
      has_more: hasMore,
      next_offset: offset + items.length,
    },
  });
}

const GET_RESOURCE_HANDLERS = buildGetResourceHandlers({
  handleGetSlidesResource: (context) => handleGetSlidesResource(context),
  handleGetTemplatesResource: (context) => handleGetTemplatesResource(context),
  handleGetArchivedTemplatesResource: (context) => handleGetArchivedTemplatesResource(context),
  handleGetTemplateCollaboratorsResource: (context) => handleGetTemplateCollaboratorsResource(context),
  handleGetTemplateApprovalsResource: (context) => handleGetTemplateApprovalsResource(context),
  handleGetAuditPresetsResource: (context) => handleGetAuditPresetsResource(context),
  handleGetAuditExportJobsResource: (context) => handleGetAuditExportJobsResource(context),
  handleGetPptxExportJobsResource: (context) => handleGetPptxExportJobsResource(context),
  handleGetTelemetrySummaryResource: (context) => handleGetTelemetrySummaryResource(context),
  handleGetImportSessionTracesResource: (context) => handleGetImportSessionTracesResource(context),
  handleGetAuditsResource: (context) => handleGetAuditsResource(context),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  const missing = assertSupabaseConfigured(env);
  if (missing) return missing;

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return errorResponse('Invalid JSON body', 400, {
      method: request.method || 'POST',
    });
  }

  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';
  const isScheduledSweepJob =
    action === 'run-approval-escalation-sweep'
    && body?.sweep_source === 'scheduled'
    && hasValidSlidesJobToken(request, env);

  let actor;
  if (isScheduledSweepJob) {
    actor = resolveSlidesAutomationActor(env);
  } else {
    const authz = await authorizeActor(request, body, env);
    if (!authz.ok) {
      const identity = resolveActorIdentity(request, body, env);
      return errorResponse(authz.error, authz.status || 403, {
        method: request.method || 'POST',
        actor_user_id: identity?.userId || null,
        actor_email: identity?.email || null,
      });
    }
    actor = authz.actor;
  }

  try {
  const actionHandler = POST_ACTION_HANDLERS[action];
  if (!actionHandler) return errorResponse('Unsupported action for /api/slides.', 400);
  return actionHandler(env, actor, body);
  } catch (error) {
    return safeSlidesErrorResponse(error, 'Slides write service is temporarily unavailable.', {
      method: request.method || 'POST',
      actor,
    });
  }
}

const POST_ACTION_HANDLERS = buildPostActionHandlers({
  handleSaveAction: (env, actor, body) => handleSaveAction(env, actor, body),
  handleDuplicateSlideAction: (env, actor, body) => handleDuplicateSlideAction(env, actor, body),
  handleDuplicateTemplateAction: (env, actor, body) => handleDuplicateTemplateAction(env, actor, body),
  handleRenameSlideAction: (env, actor, body) => handleRenameSlideAction(env, actor, body),
  handleDeleteSlideAction: (env, actor, body) => handleDeleteSlideAction(env, actor, body),
  handlePublishTemplateAction: (env, actor, body) => handlePublishTemplateAction(env, actor, body),
  handleRefreshTemplatePreviewAction: (env, actor, body) => handleRefreshTemplatePreviewAction(env, actor, body),
  handleUpdateTemplateAction: (env, actor, body) => handleUpdateTemplateAction(env, actor, body),
  handleArchiveTemplateAction: (env, actor, body) => handleArchiveTemplateAction(env, actor, body),
  handleRestoreTemplateAction: (env, actor, body) => handleRestoreTemplateAction(env, actor, body),
  handlePermanentDeleteTemplateAction: (env, actor, body) => handlePermanentDeleteTemplateAction(env, actor, body),
  handleTransferTemplateOwnershipAction: (env, actor, body) => handleTransferTemplateOwnershipAction(env, actor, body),
  handleUpsertTemplateCollaboratorAction: (env, actor, body) => handleUpsertTemplateCollaboratorAction(env, actor, body),
  handleRemoveTemplateCollaboratorAction: (env, actor, body) => handleRemoveTemplateCollaboratorAction(env, actor, body),
  handleSubmitTemplateApprovalAction: (env, actor, body) => handleSubmitTemplateApprovalAction(env, actor, body),
  handleResolveTemplateApprovalAction: (env, actor, body) => handleResolveTemplateApprovalAction(env, actor, body),
  handleEscalateTemplateApprovalAction: (env, actor, body) => handleEscalateTemplateApprovalAction(env, actor, body),
  handleRunApprovalEscalationSweepAction: (env, actor, body) => handleRunApprovalEscalationSweepAction(env, actor, body),
  handleUpsertAuditPresetAction: (env, actor, body) => handleUpsertAuditPresetAction(env, actor, body),
  handleDeleteAuditPresetAction: (env, actor, body) => handleDeleteAuditPresetAction(env, actor, body),
  handleRequestAuditExportJobAction: (env, actor, body) => handleRequestAuditExportJobAction(env, actor, body),
  handleDownloadAuditExportJobAction: (env, actor, body) => handleDownloadAuditExportJobAction(env, actor, body),
  handleRequestPptxExportJobAction: (env, actor, body) => handleRequestPptxExportJobAction(env, actor, body),
  handleDownloadPptxExportJobAction: (env, actor, body) => handleDownloadPptxExportJobAction(env, actor, body),
  handleRecordTelemetryAction: (_env, actor, body) => handleRecordTelemetryAction(actor, body),
  handleRecordImportSessionTraceAction: (env, actor, body) => handleRecordImportSessionTraceAction(env, actor, body),
  handleRecordExportAction: (env, actor, body) => handleRecordExportAction(env, actor, body),
});
