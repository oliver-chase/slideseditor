import test from 'node:test'
import assert from 'node:assert/strict'

import { onRequestGet, onRequestPost } from '../../functions/api/slides.js'

const BASE_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function withMockedFetch(mockFetch, run) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch
  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.fetch = originalFetch
    })
}

test('slides API contract: missing identity returns structured 401 envelope', { concurrency: false }, async () => {
  await withMockedFetch(async () => {
    throw new Error('fetch should not be called when actor identity is missing')
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides?resource=slides')
    const response = await onRequestGet({ request, env: { ...BASE_ENV } })
    const body = await response.json()

    assert.equal(response.status, 401)
    assert.equal(body.ok, false)
    assert.match(String(body.error || ''), /missing verified actor identity/i)
    assert.match(String(body.error_detail?.correlation_id || ''), /^slides-/)
    assert.equal(body.error_detail?.failure_class, 'unauthenticated')
    assert.equal(typeof body.error_detail?.retryable, 'boolean')
  })
})

test('slides API contract: upstream HTML failure is sanitized with ray + correlation metadata', { concurrency: false }, async () => {
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slides' && method === 'GET') {
      return new Response('<!doctype html><html><body>Worker exception. Ray ID: abc123xyz</body></html>', {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request(
      'https://oliver-app.local/api/slides?resource=slides&user_id=admin-1&user_email=admin%40example.com',
    )
    const response = await onRequestGet({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 500)
    assert.equal(body.ok, false)
    assert.match(String(body.error || ''), /runtime exception/i)
    assert.equal(String(body.error || '').includes('<html'), false)
    assert.match(String(body.error_detail?.correlation_id || ''), /^slides-/)
    assert.equal(body.error_detail?.ray_id, 'abc123xyz')
    assert.equal(body.error_detail?.endpoint, '/api/slides')
  })
})

test('slides API contract: save write returns normalized slide payload for authorized actor', { concurrency: false }, async () => {
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slides' && method === 'POST') {
      return jsonResponse([{
        id: 'slide-1',
        owner_user_id: 'admin-1',
        title: 'Contract Save',
        canvas: { width: 1920, height: 1080 },
        components_json: [{ id: 'cmp-1', type: 'heading', x: 100, y: 100, width: 600, content: 'Hello', style: {} }],
        metadata: { warning_count: 0 },
        revision: 1,
        source: 'import',
        source_template_id: null,
        deleted_at: null,
        created_at: '2026-04-26T00:00:00.000Z',
        updated_at: '2026-04-26T00:00:00.000Z',
        last_edited_at: '2026-04-26T00:00:00.000Z',
      }], 201)
    }

    if (url.pathname === '/rest/v1/slide_audit_events' && method === 'POST') {
      return jsonResponse([], 201)
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        slide: {
          title: 'Contract Save',
          canvas: { width: 1920, height: 1080 },
          components: [{ id: 'cmp-1', type: 'heading', x: 100, y: 100, width: 600, content: 'Hello', style: {} }],
          metadata: { warning_count: 0 },
        },
      }),
    })

    const response = await onRequestPost({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 201)
    assert.equal(typeof body.slide?.id, 'string')
    assert.equal(body.slide?.title, 'Contract Save')
    assert.equal(body.slide?.owner_user_id, 'admin-1')
    assert.equal(Array.isArray(body.slide?.components), true)
  })
})

test('slides API contract: publish-template persists preview metadata with cache-safe versioning', { concurrency: false }, async () => {
  let insertedTemplatePayload = null
  let patchedTemplatePayload = null

  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slides' && method === 'GET') {
      return jsonResponse([{
        id: 'slide-1',
        owner_user_id: 'admin-1',
        title: 'Preview Source',
        canvas: { width: 1920, height: 1080 },
        components_json: [{ id: 'cmp-1', type: 'heading', x: 120, y: 140, width: 800, height: 80, content: 'Preview Source', style: {}, visible: true }],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
        deleted_at: null,
        created_at: '2026-04-26T00:00:00.000Z',
        updated_at: '2026-04-26T00:00:00.000Z',
        last_edited_at: '2026-04-26T00:00:00.000Z',
      }])
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'POST') {
      insertedTemplatePayload = init.body ? JSON.parse(String(init.body)) : null
      return jsonResponse([{
        id: 'template-1',
        owner_user_id: 'admin-1',
        name: 'Preview Template',
        description: 'Published from My Slides',
        is_shared: true,
        is_archived: false,
        canvas: { width: 1920, height: 1080 },
        components_json: insertedTemplatePayload?.components_json || [],
        metadata: insertedTemplatePayload?.metadata || {},
        created_at: '2026-04-26T00:00:00.000Z',
        updated_at: '2026-04-26T00:00:00.000Z',
      }], 201)
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'PATCH') {
      patchedTemplatePayload = init.body ? JSON.parse(String(init.body)) : null
      return jsonResponse([{
        id: 'template-1',
        owner_user_id: 'admin-1',
        name: 'Preview Template',
        description: 'Published from My Slides',
        is_shared: true,
        is_archived: false,
        canvas: { width: 1920, height: 1080 },
        components_json: insertedTemplatePayload?.components_json || [],
        metadata: patchedTemplatePayload?.metadata || {},
        created_at: '2026-04-26T00:00:00.000Z',
        updated_at: '2026-04-26T00:01:00.000Z',
      }])
    }

    if (url.pathname === '/rest/v1/slide_audit_events' && method === 'POST') {
      return jsonResponse([], 201)
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'publish-template',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        slide_id: 'slide-1',
        name: 'Preview Template',
        is_shared: true,
      }),
    })

    const response = await onRequestPost({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 201)
    assert.equal(insertedTemplatePayload?.metadata?.preview?.status, 'ready')
    assert.match(String(insertedTemplatePayload?.metadata?.preview?.asset_key || ''), /^template-preview:/)
    assert.deepEqual(insertedTemplatePayload?.metadata?.locked_element_ids, [])
    assert.deepEqual(insertedTemplatePayload?.metadata?.editable_zone_ids, ['cmp-1'])
    assert.equal(Array.isArray(insertedTemplatePayload?.metadata?.layout_blocks), true)
    assert.equal(body.template?.preview?.status, 'ready')
    assert.equal(body.template?.preview?.version, 2)
    assert.match(String(body.template?.preview?.asset_url || ''), /\/api\/slides\/template-preview\/template-1\?v=2$/)
    assert.deepEqual(body.template?.locked_element_ids, [])
    assert.deepEqual(body.template?.editable_zone_ids, ['cmp-1'])
    assert.equal(body.template?.layout_blocks?.[0]?.component_ids?.[0], 'cmp-1')
    assert.equal(patchedTemplatePayload?.metadata?.preview?.version, 2)
  })
})

test('slides API contract: duplicate-template preserves structural metadata on the derived slide', { concurrency: false }, async () => {
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'GET') {
      return jsonResponse([{
        id: 'template-1',
        owner_user_id: 'admin-1',
        name: 'Reusable Template',
        description: 'Contract template',
        is_shared: true,
        is_archived: false,
        canvas: { width: 1920, height: 1080 },
        components_json: [{
          id: 'cmp-template-1',
          type: 'heading',
          sourceLabel: '.heading',
          x: 120,
          y: 120,
          width: 800,
          height: 84,
          content: 'Reusable Template',
          style: {},
          locked: true,
          visible: true,
        }],
        metadata: {
          locked_element_ids: ['cmp-template-1'],
          editable_zone_ids: [],
          layout_blocks: [{ id: 'block-cmp-template-1', label: '.heading', component_ids: ['cmp-template-1'] }],
          preview: {
            asset_key: 'template-preview:template-1:v1',
            asset_url: '/api/slides/template-preview/template-1?v=1',
            fingerprint: 'template-1|1920|1080|cmp-template-1',
            generated_at: '2026-04-26T00:00:00.000Z',
            generated_by_user_id: 'admin-1',
            status: 'ready',
            version: 1,
            visible_component_count: 1,
          },
        },
        created_at: '2026-04-26T00:00:00.000Z',
        updated_at: '2026-04-26T00:00:00.000Z',
      }])
    }

    if (url.pathname === '/rest/v1/slides' && method === 'POST') {
      return jsonResponse([{
        id: 'slide-copy-1',
        owner_user_id: 'admin-1',
        title: 'Reusable Template (Copy)',
        canvas: { width: 1920, height: 1080 },
        components_json: [{
          id: 'cmp-template-1',
          type: 'heading',
          sourceLabel: '.heading',
          x: 120,
          y: 120,
          width: 800,
          height: 84,
          content: 'Reusable Template',
          style: {},
          locked: true,
          visible: true,
        }],
        metadata: {
          source_template_id: 'template-1',
          locked_element_ids: ['cmp-template-1'],
          editable_zone_ids: [],
          layout_blocks: [{ id: 'block-cmp-template-1', label: '.heading', component_ids: ['cmp-template-1'] }],
        },
        revision: 1,
        source: 'template',
        source_template_id: 'template-1',
        deleted_at: null,
        created_at: '2026-04-26T00:00:00.000Z',
        updated_at: '2026-04-26T00:00:00.000Z',
        last_edited_at: '2026-04-26T00:00:00.000Z',
      }], 201)
    }

    if (url.pathname === '/rest/v1/slide_audit_events' && method === 'POST') {
      return jsonResponse([], 201)
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'duplicate-template',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        template_id: 'template-1',
      }),
    })

    const response = await onRequestPost({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 201)
    assert.equal(body.slide?.source, 'template')
    assert.equal(body.slide?.source_template_id, 'template-1')
    assert.deepEqual(body.slide?.metadata?.locked_element_ids, ['cmp-template-1'])
    assert.equal(body.slide?.metadata?.layout_blocks?.[0]?.component_ids?.[0], 'cmp-template-1')
  })
})

test('slides API contract: request-pptx-export-job accepts canonical slide documents and returns mapped warnings', { concurrency: false }, async () => {
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slides' && method === 'GET') {
      return jsonResponse([{
        id: 'slide-1',
        owner_user_id: 'admin-1',
        title: 'Canonical Export Slide',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
        deleted_at: null,
        created_at: '2026-04-26T00:00:00.000Z',
        updated_at: '2026-04-26T00:00:00.000Z',
        last_edited_at: '2026-04-26T00:00:00.000Z',
      }])
    }

    if (url.pathname === '/rest/v1/slide_audit_events' && method === 'POST') {
      return jsonResponse([], 201)
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request-pptx-export-job',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        slide_ids: ['slide-1'],
        slides: [{
          id: 'slide-1',
          title: 'Canonical Export Slide',
          canvas: { width: 1920, height: 1080 },
          components: [],
          document: {
            version: 1,
            deck: {
              id: 'deck-1',
              width: 1920,
              height: 1080,
              slides: [{
                id: 'slide-1',
                elements: [{
                  id: 'cmp-logo-1',
                  type: 'logo',
                  sourceLabel: '.brand-logo',
                  x: 40,
                  y: 40,
                  width: 180,
                  height: 72,
                  content: '<img alt="Brand" src="https://example.com/logo.png" />',
                  style: {},
                  locked: false,
                  visible: true,
                }],
                background: { fill: '#ffffff' },
              }],
            },
            warnings: [],
          },
        }],
        filename_prefix: 'canonical-export',
        include_hidden: true,
      }),
    })

    const response = await onRequestPost({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 201)
    assert.equal(body.job?.status, 'succeeded')
    assert.equal(body.job?.warning_count, 1)
    assert.match(body.job?.warnings?.[0]?.message || '', /image fallback/i)
    assert.equal(body.job?.native_objects?.[0]?.component_type, 'logo')
  })
})

test('slides API contract: refresh-template-preview updates persisted preview metadata for owner/admin actions', { concurrency: false }, async () => {
  let patchedTemplatePayload = null

  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'GET') {
      return jsonResponse([{
        id: 'template-1',
        owner_user_id: 'admin-1',
        name: 'Preview Template',
        description: '',
        is_shared: false,
        is_archived: false,
        canvas: { width: 1920, height: 1080 },
        components_json: [{ id: 'cmp-1', type: 'panel', x: 100, y: 100, width: 600, height: 260, content: '<p>Preview</p>', style: {}, visible: true }],
        metadata: {
          preview: {
            asset_key: 'template-preview:template-1:v1',
            asset_url: '/api/slides/template-preview/template-1?v=1',
            fingerprint: 'old-fingerprint',
            generated_at: '2026-04-25T00:00:00.000Z',
            generated_by_user_id: 'admin-1',
            status: 'ready',
            version: 1,
            visible_component_count: 1,
          },
        },
        created_at: '2026-04-25T00:00:00.000Z',
        updated_at: '2026-04-26T00:00:00.000Z',
      }])
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'PATCH') {
      patchedTemplatePayload = init.body ? JSON.parse(String(init.body)) : null
      return jsonResponse([{
        id: 'template-1',
        owner_user_id: 'admin-1',
        name: 'Preview Template',
        description: '',
        is_shared: false,
        is_archived: false,
        canvas: { width: 1920, height: 1080 },
        components_json: [{ id: 'cmp-1', type: 'panel', x: 100, y: 100, width: 600, height: 260, content: '<p>Preview</p>', style: {}, visible: true }],
        metadata: patchedTemplatePayload?.metadata || {},
        created_at: '2026-04-25T00:00:00.000Z',
        updated_at: patchedTemplatePayload?.updated_at || '2026-04-26T00:00:00.000Z',
      }])
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refresh-template-preview',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        template_id: 'template-1',
      }),
    })

    const response = await onRequestPost({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(patchedTemplatePayload?.metadata?.preview?.version, 2)
    assert.equal(body.template?.preview?.version, 2)
    assert.equal(body.template?.preview?.visible_component_count, 1)
    assert.equal(body.template?.preview?.generated_by_user_id, 'admin-1')
  })
})

test('slides API contract: unsaved telemetry events validate schema and echo normalized payload', { concurrency: false }, async () => {
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()
    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }
    throw new Error(`Unhandled route ${method} ${url.pathname}${url.search}`)
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record-telemetry',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        event_type: 'cancel-leave',
        workspace_tab: 'import',
        slide_id: 'slide-1',
        save_status: 'dirty',
        trigger_source: 'nav',
        details: { journey: 'workspace-tab-switch' },
      }),
    })

    const response = await onRequestPost({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 201)
    assert.equal(body.event?.module_id, 'slides')
    assert.equal(body.event?.event_type, 'cancel-leave')
    assert.equal(body.event?.workspace_tab, 'import')
    assert.equal(body.event?.save_status, 'dirty')
    assert.equal(body.event?.trigger_source, 'nav')
  })
})

test('slides API contract: telemetry summary exposes discard and retry rates by window', { concurrency: false }, async () => {
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()
    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }
    throw new Error(`Unhandled route ${method} ${url.pathname}${url.search}`)
  }, async () => {
    const env = {
      ...BASE_ENV,
      SLIDES_TRUST_CLIENT_IDENTITY: '1',
    }

    for (const payload of [
      { event_type: 'unsaved-prompt', trigger_source: 'nav' },
      { event_type: 'cancel-leave', trigger_source: 'nav' },
      { event_type: 'autosave-retry', trigger_source: 'autosave' },
    ]) {
      const request = new Request('https://oliver-app.local/api/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-telemetry',
          actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
          workspace_tab: 'import',
          slide_id: 'slide-1',
          save_status: 'dirty',
          details: {},
          ...payload,
        }),
      })
      await onRequestPost({ request, env })
    }

    const response = await onRequestGet({
      request: new Request('https://oliver-app.local/api/slides?resource=telemetry-summary&user_id=admin-1&user_email=admin%40example.com&from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z'),
      env,
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.totals?.prompt_count >= 1, true)
    assert.equal(body.totals?.retry_count >= 1, true)
    assert.equal(body.rates?.prompt_cancel_rate > 0, true)
    assert.equal(body.privacy?.actor_email, 'optional')
    assert.equal(body.retention?.local_max_events > 0, true)
  })
})

test('slides API contract: import session traces record and query by correlation id', { concurrency: false }, async () => {
  const correlationId = 'slides-import-contract-1'
  let insertedTracePayload = null
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()
    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }
    if (url.pathname === '/rest/v1/slide_import_session_traces' && method === 'POST') {
      insertedTracePayload = init.body ? JSON.parse(String(init.body)) : null
      return jsonResponse([{
        id: 'trace-1',
        ...insertedTracePayload,
        created_at: '2026-05-03T18:00:00.000Z',
      }], 201)
    }
    if (url.pathname === '/rest/v1/slide_import_session_traces' && method === 'GET') {
      assert.equal(url.searchParams.get('correlation_id'), `eq.${correlationId}`)
      return jsonResponse([{
        id: 'trace-1',
        correlation_id: correlationId,
        actor_user_id: 'admin-1',
        actor_email: 'admin@example.com',
        phase: 'parse-end',
        source: 'pasted',
        taxonomy_buckets: { outcome: 'success' },
        counters: { component_count: 3, warning_count: 1 },
        duration_ms: 250,
        error_code: null,
        error_message: null,
        created_at: '2026-05-03T18:00:00.000Z',
      }])
    }
    throw new Error(`Unhandled route ${method} ${url.pathname}${url.search}`)
  }, async () => {
    const env = {
      ...BASE_ENV,
      SLIDES_TRUST_CLIENT_IDENTITY: '1',
    }
    const postResponse = await onRequestPost({
      request: new Request('https://oliver-app.local/api/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-import-session-trace',
          actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
          correlation_id: correlationId,
          phase: 'parse-end',
          source: 'pasted',
          taxonomy_buckets: { outcome: 'success' },
          counters: { component_count: 3, warning_count: 1 },
          duration_ms: 250,
        }),
      }),
      env,
    })
    assert.equal(postResponse.status, 201)
    const postBody = await postResponse.json()
    assert.equal(postBody.trace?.correlation_id, correlationId)
    assert.equal(postBody.trace?.phase, 'parse-end')
    assert.equal(insertedTracePayload?.source, 'pasted')
    assert.deepEqual(insertedTracePayload?.counters, { component_count: 3, warning_count: 1 })

    const getResponse = await onRequestGet({
      request: new Request(`https://oliver-app.local/api/slides?resource=import-session-traces&user_id=admin-1&user_email=admin%40example.com&correlation_id=${correlationId}`),
      env,
    })
    assert.equal(getResponse.status, 200)
    const getBody = await getResponse.json()
    assert.equal(Array.isArray(getBody.items), true)
    assert.equal(getBody.items.length >= 1, true)
    assert.equal(getBody.items[0]?.correlation_id, correlationId)
    assert.equal(getBody.retention?.max_events > 0, true)
  })
})

test('slides API contract: restore-template returns normalized template payload and audit metadata', { concurrency: false }, async () => {
  let auditInserted = false

  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'GET') {
      if (url.searchParams.get('id') === 'eq.template-restore-1' && url.searchParams.get('is_archived') === 'eq.true') {
        return jsonResponse([{
          id: 'template-restore-1',
          owner_user_id: 'admin-1',
          name: 'Archived Template',
          description: 'Template in archive',
          is_shared: false,
          is_archived: true,
          canvas: { width: 1920, height: 1080 },
          components_json: [],
          metadata: {},
          created_at: '2026-04-25T00:00:00.000Z',
          updated_at: '2026-04-25T00:00:00.000Z',
        }])
      }
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'PATCH') {
      return jsonResponse([{
        id: 'template-restore-1',
        owner_user_id: 'admin-1',
        name: 'Archived Template',
        description: 'Template in archive',
        is_shared: false,
        is_archived: false,
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        created_at: '2026-04-25T00:00:00.000Z',
        updated_at: '2026-04-26T00:00:00.000Z',
      }])
    }

    if (url.pathname === '/rest/v1/slide_audit_events' && method === 'POST') {
      auditInserted = true
      return jsonResponse([], 201)
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restore-template',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        template_id: 'template-restore-1',
      }),
    })

    const response = await onRequestPost({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.template?.id, 'template-restore-1')
    assert.equal(body.template?.is_archived, false)
    assert.equal(auditInserted, true)
  })
})

test('slides API contract: permanent-delete-template enforces archived prerequisite and writes audit trail', { concurrency: false }, async () => {
  let collaboratorDeleteCalled = false
  let templateDeleteCalled = false
  let auditInserted = false

  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'GET') {
      if (url.searchParams.get('id') === 'eq.template-delete-1') {
        return jsonResponse([{
          id: 'template-delete-1',
          owner_user_id: 'admin-1',
          name: 'Archived Template',
          description: 'Template in archive',
          is_shared: false,
          is_archived: true,
          canvas: { width: 1920, height: 1080 },
          components_json: [],
          metadata: {},
          created_at: '2026-04-25T00:00:00.000Z',
          updated_at: '2026-04-25T00:00:00.000Z',
        }])
      }
    }

    if (url.pathname === '/rest/v1/slide_template_collaborators' && method === 'DELETE') {
      collaboratorDeleteCalled = true
      return new Response(null, { status: 204 })
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'DELETE') {
      templateDeleteCalled = true
      return new Response(null, { status: 204 })
    }

    if (url.pathname === '/rest/v1/slide_audit_events' && method === 'POST') {
      auditInserted = true
      return jsonResponse([], 201)
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'permanent-delete-template',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        template_id: 'template-delete-1',
      }),
    })

    const response = await onRequestPost({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(collaboratorDeleteCalled, true)
    assert.equal(templateDeleteCalled, true)
    assert.equal(auditInserted, true)
  })
})

test('slides API contract: approval escalation includes configured routing channels and targets', { concurrency: false }, async () => {
  let patchedApprovalPayload = null
  let escalationAuditDetails = null

  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slide_template_approvals' && method === 'GET') {
      return jsonResponse([{
        id: 'approval-1',
        template_id: 'template-1',
        requested_by_user_id: 'member-1',
        requested_by_email: 'member@example.com',
        approval_type: 'transfer-template',
        payload: {
          target_user_id: 'admin-1',
          target_user_email: 'admin@example.com',
        },
        status: 'pending',
        review_note: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: '2026-04-20T00:00:00.000Z',
        updated_at: '2026-04-20T00:00:00.000Z',
      }])
    }

    if (url.pathname === '/rest/v1/slide_templates' && method === 'GET') {
      return jsonResponse([{
        id: 'template-1',
        owner_user_id: 'member-1',
        name: 'Escalation Template',
        description: '',
        is_shared: false,
        is_archived: false,
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        created_at: '2026-04-20T00:00:00.000Z',
        updated_at: '2026-04-20T00:00:00.000Z',
      }])
    }

    if (url.pathname === '/rest/v1/slide_template_approvals' && method === 'PATCH') {
      const body = init.body ? JSON.parse(String(init.body)) : {}
      patchedApprovalPayload = body
      return jsonResponse([{
        id: 'approval-1',
        template_id: 'template-1',
        requested_by_user_id: 'member-1',
        requested_by_email: 'member@example.com',
        approval_type: 'transfer-template',
        payload: body.payload || {},
        status: 'pending',
        review_note: null,
        reviewed_by_user_id: null,
        reviewed_at: null,
        created_at: '2026-04-20T00:00:00.000Z',
        updated_at: body.updated_at || '2026-04-26T00:00:00.000Z',
      }])
    }

    if (url.pathname === '/rest/v1/slide_audit_events' && method === 'POST') {
      const body = init.body ? JSON.parse(String(init.body)) : {}
      escalationAuditDetails = body.details || null
      return jsonResponse([], 201)
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'escalate-template-approval',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        approval_id: 'approval-1',
        reason: 'Escalate with configured channels.',
      }),
    })

    const response = await onRequestPost({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
        SLIDES_APPROVAL_ESCALATION_CHANNELS: 'email,slack,in-app',
        SLIDES_APPROVAL_ESCALATION_TARGET_USER_IDS: 'admin-1,admin-2',
        SLIDES_APPROVAL_ESCALATION_TARGET_EMAILS: 'ops@example.com',
        SLIDES_APPROVAL_ESCALATION_EMAIL_FROM: 'slides-alerts@example.com',
        SLIDES_APPROVAL_ESCALATION_SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test/path',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(Array.isArray(body.approval?.payload?.escalations), true)
    assert.equal(Array.isArray(patchedApprovalPayload?.payload?.escalations), true)

    const escalation = body.approval.payload.escalations[0] || {}
    assert.deepEqual(escalation.routing?.channels, ['email', 'slack', 'in-app'])
    assert.equal(Array.isArray(escalation.routing?.targets), true)
    assert.equal(escalation.routing?.targets.length, 3)
    assert.equal(escalation.routing?.adapters?.email_enabled, true)
    assert.equal(escalation.routing?.adapters?.slack_enabled, true)
    assert.equal(escalation.routing?.adapters?.slack_webhook_configured, true)
    assert.equal(escalation.routing?.adapters?.email_from, 'slides-alerts@example.com')

    assert.equal(Array.isArray(escalationAuditDetails?.routing_channels), true)
    assert.equal(Array.isArray(escalationAuditDetails?.routing_targets), true)
    assert.equal(escalationAuditDetails?.routing_channels?.includes('slack'), true)
    assert.equal(escalationAuditDetails?.routing_targets?.length, 3)
  })
})

test('slides API contract: audits read supports high-volume pagination envelope', { concurrency: false }, async () => {
  await withMockedFetch(async (input, init = {}) => {
    const url = new URL(String(input))
    const method = (init.method || 'GET').toUpperCase()

    if (url.pathname === '/rest/v1/app_users' && method === 'GET') {
      return jsonResponse([{
        user_id: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
        page_permissions: ['slides'],
      }])
    }

    if (url.pathname === '/rest/v1/slide_audit_events' && method === 'GET') {
      const rows = Array.from({ length: 201 }, (_, index) => ({
        id: `audit-${index + 1}`,
        entity_type: 'slide',
        entity_id: `slide-${index + 1}`,
        action: 'save',
        outcome: 'success',
        actor_user_id: 'admin-1',
        actor_email: 'admin@example.com',
        details: {},
        created_at: `2026-04-26T00:${String(index % 60).padStart(2, '0')}:00.000Z`,
      }))
      return jsonResponse(rows)
    }

    return new Response(`Unhandled route ${method} ${url.pathname}${url.search}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }, async () => {
    const request = new Request(
      'https://oliver-app.local/api/slides?resource=audits&limit=200&offset=0&user_id=admin-1&user_email=admin%40example.com',
    )
    const response = await onRequestGet({
      request,
      env: {
        ...BASE_ENV,
        SLIDES_TRUST_CLIENT_IDENTITY: '1',
      },
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(Array.isArray(body.items), true)
    assert.equal(body.items.length, 200)
    assert.equal(body.pagination?.offset, 0)
    assert.equal(body.pagination?.limit, 200)
    assert.equal(body.pagination?.has_more, true)
    assert.equal(body.pagination?.next_offset, 200)
  })
})
