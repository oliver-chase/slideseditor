import test from 'node:test'
import assert from 'node:assert/strict'

import { onRequestGet, onRequestPost } from '../../functions/api/slides.js'

const BASE_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SLIDES_TRUST_CLIENT_IDENTITY: '1',
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

test('slides API contract: request-pptx-export-job returns succeeded job payload with warnings summary', { concurrency: false }, async () => {
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
        title: 'Contract Slide',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 2,
        source: 'import',
        source_template_id: null,
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
          title: 'Contract Slide',
          canvas: { width: 1920, height: 1080 },
          components: [
            { id: 'cmp-1', type: 'heading', x: 100, y: 120, width: 800, content: 'Hello', style: {} },
            { id: 'cmp-2', type: 'unknown-widget', x: 120, y: 200, width: 400, content: 'Unsupported', style: {} },
          ],
        }],
        filename_prefix: 'contract-export',
        idempotency_key: 'contract-idempotency-1',
        max_attempts: 3,
      }),
    })

    const response = await onRequestPost({ request, env: { ...BASE_ENV } })
    const body = await response.json()

    assert.equal(response.status, 201)
    assert.equal(body.job?.status, 'succeeded')
    assert.equal(body.job?.slide_ids?.[0], 'slide-1')
    assert.equal(body.job?.warning_count > 0, true)
    assert.equal(Array.isArray(body.job?.native_objects), true)
    assert.equal(body.job?.artifact?.file_name?.endsWith('.pptx'), true)
  })
})

test('slides API contract: pptx-export-jobs listing and download enforce actor access', { concurrency: false }, async () => {
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
        id: 'slide-2',
        owner_user_id: 'admin-1',
        title: 'Stored Slide',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
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
    const createReq = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'request-pptx-export-job',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        slide_ids: ['slide-2'],
        slides: [{
          id: 'slide-2',
          title: 'Stored Slide',
          canvas: { width: 1920, height: 1080 },
          components: [{ id: 'cmp-3', type: 'text', x: 90, y: 90, width: 500, content: 'Text', style: {} }],
        }],
      }),
    })
    const createRes = await onRequestPost({ request: createReq, env: { ...BASE_ENV } })
    const createBody = await createRes.json()
    const jobId = createBody.job?.id

    assert.equal(createRes.status, 201)
    assert.equal(typeof jobId, 'string')

    const listReq = new Request('https://oliver-app.local/api/slides?resource=pptx-export-jobs&user_id=admin-1&user_email=admin%40example.com')
    const listRes = await onRequestGet({ request: listReq, env: { ...BASE_ENV } })
    const listBody = await listRes.json()
    assert.equal(listRes.status, 200)
    assert.equal(Array.isArray(listBody.items), true)
    assert.equal(listBody.items.some((job) => job.id === jobId), true)

    const downloadReq = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'download-pptx-export-job',
        actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
        job_id: jobId,
      }),
    })
    const downloadRes = await onRequestPost({ request: downloadReq, env: { ...BASE_ENV } })
    const downloadBody = await downloadRes.json()
    assert.equal(downloadRes.status, 200)
    assert.equal(downloadBody.job?.id, jobId)
    assert.equal(downloadBody.job?.status, 'succeeded')
  })
})

test('slides API contract: request-pptx-export-job maps expanded native component types and warning codes', { concurrency: false }, async () => {
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
        id: 'slide-3',
        owner_user_id: 'admin-1',
        title: 'Extended Types',
        canvas: { width: 1920, height: 1080, background: 'linear-gradient(120deg, #111827 0%, #2563eb 100%)' },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
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
        slide_ids: ['slide-3'],
        slides: [{
          id: 'slide-3',
          title: 'Extended Types',
          canvas: { width: 1920, height: 1080, background: 'linear-gradient(120deg, #111827 0%, #2563eb 100%)' },
          components: [
            { id: 'cmp-subheading', type: 'subheading', x: 80, y: 90, width: 900, content: 'Subheading', style: {} },
            { id: 'cmp-panel', type: 'panel', x: 90, y: 180, width: 700, height: 260, content: 'Panel body', style: {} },
            { id: 'cmp-row', type: 'row', x: 100, y: 460, width: 900, height: 120, content: 'Row body', style: {} },
            { id: 'cmp-stat', type: 'stat', x: 1050, y: 220, width: 300, height: 220, content: '92%', style: {} },
            { id: 'cmp-logo', type: 'logo', x: 120, y: 40, width: 160, height: 60, content: '', style: {} },
            { id: 'cmp-unsupported', type: 'odd-widget', x: 220, y: 620, width: 360, height: 100, content: 'Unsupported', style: {} },
          ],
        }],
      }),
    })

    const response = await onRequestPost({ request, env: { ...BASE_ENV } })
    const body = await response.json()

    assert.equal(response.status, 201)
    assert.equal(body.job?.status, 'succeeded')

    const nativeObjects = Array.isArray(body.job?.native_objects) ? body.job.native_objects : []
    const nativeById = new Map(nativeObjects.map((entry) => [entry.component_id, entry]))
    assert.equal(nativeById.get('cmp-subheading')?.native_kind, 'text')
    assert.equal(nativeById.get('cmp-panel')?.native_kind, 'shape')
    assert.equal(nativeById.get('cmp-row')?.native_kind, 'shape')
    assert.equal(nativeById.get('cmp-stat')?.native_kind, 'shape')
    assert.equal(nativeById.get('cmp-subheading')?.editable, true)
    assert.equal(nativeById.get('cmp-panel')?.editable, true)
    assert.equal(nativeById.get('cmp-row')?.editable, true)
    assert.equal(nativeById.get('cmp-stat')?.editable, true)
    assert.equal(nativeById.get('cmp-logo')?.native_kind, 'image')
    assert.equal(nativeById.get('cmp-logo')?.editable, false)
    assert.equal(body.job?.warning_summary?.editable_object_count, 4)
    assert.equal(body.job?.warning_summary?.fallback_object_count, 1)
    assert.equal(body.job?.warning_summary?.image_fallback_count, 1)

    const warnings = Array.isArray(body.job?.warnings) ? body.job.warnings : []
    const warningCodes = warnings.map((warning) => warning.code)
    assert.equal(warningCodes.includes('image_rasterized'), true)
    assert.equal(warningCodes.includes('unsupported_component'), true)
  })
})

test('slides API contract: computed-style projection is deterministic and emits transform warnings', { concurrency: false }, async () => {
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
        id: 'slide-style-1',
        owner_user_id: 'admin-1',
        title: 'Style Projection',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
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
    const payload = {
      action: 'request-pptx-export-job',
      actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
      slide_ids: ['slide-style-1'],
      slides: [{
        id: 'slide-style-1',
        title: 'Style Projection',
        canvas: { width: 1920, height: 1080 },
        components: [
          {
            id: 'cmp-style-main',
            type: 'heading',
            x: 120,
            y: 160,
            width: 800,
            content: 'Computed style text',
            style: {
              color: '#111827',
              fontWeight: 700,
            },
            computed_style: {
              fontSize: '56px',
              lineHeight: '64px',
              transform: 'rotate(8deg)',
              fontFamily: 'Inter, sans-serif',
            },
          },
        ],
      }],
    }

    const reqOne = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, idempotency_key: 'style-det-a' }),
    })
    const resOne = await onRequestPost({ request: reqOne, env: { ...BASE_ENV } })
    const bodyOne = await resOne.json()
    assert.equal(resOne.status, 201)

    const reqTwo = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, idempotency_key: 'style-det-b' }),
    })
    const resTwo = await onRequestPost({ request: reqTwo, env: { ...BASE_ENV } })
    const bodyTwo = await resTwo.json()
    assert.equal(resTwo.status, 201)

    const objectsOne = Array.isArray(bodyOne.job?.native_objects) ? bodyOne.job.native_objects : []
    const objectsTwo = Array.isArray(bodyTwo.job?.native_objects) ? bodyTwo.job.native_objects : []
    assert.deepEqual(objectsOne, objectsTwo)

    const primary = objectsOne.find((entry) => entry.component_id === 'cmp-style-main')
    assert.equal(primary?.style_projection?.font_size_px, 56)
    assert.equal(primary?.style_projection?.line_height_px, 64)
    assert.equal(primary?.style_projection?.font_family, 'Inter, sans-serif')

    const warnings = Array.isArray(bodyOne.job?.warnings) ? bodyOne.job.warnings : []
    assert.equal(warnings.some((warning) => warning.code === 'unsupported_transform' && warning.component_id === 'cmp-style-main'), true)
  })
})

test('slides API contract: flex layout projection preserves key alignment fields and emits wrap warnings', { concurrency: false }, async () => {
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
        id: 'slide-flex-1',
        owner_user_id: 'admin-1',
        title: 'Flex Layout',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
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
        slide_ids: ['slide-flex-1'],
        slides: [{
          id: 'slide-flex-1',
          title: 'Flex Layout',
          canvas: { width: 1920, height: 1080 },
          components: [
            {
              id: 'cmp-flex-parent',
              type: 'panel',
              x: 100,
              y: 180,
              width: 1100,
              height: 280,
              content: 'Container',
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '24px',
                flexDirection: 'row',
                flexWrap: 'wrap',
              },
            },
            {
              id: 'cmp-flex-child',
              type: 'text',
              x: 130,
              y: 220,
              width: 260,
              height: 80,
              content: 'Nested child',
              style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                flexDirection: 'column',
              },
            },
          ],
        }],
      }),
    })

    const response = await onRequestPost({ request, env: { ...BASE_ENV } })
    const body = await response.json()
    assert.equal(response.status, 201)

    const nativeObjects = Array.isArray(body.job?.native_objects) ? body.job.native_objects : []
    const parent = nativeObjects.find((entry) => entry.component_id === 'cmp-flex-parent')
    const child = nativeObjects.find((entry) => entry.component_id === 'cmp-flex-child')

    assert.equal(parent?.layout?.display, 'flex')
    assert.equal(parent?.layout?.flex?.justify_content, 'space-between')
    assert.equal(parent?.layout?.flex?.align_items, 'center')
    assert.equal(parent?.layout?.flex?.gap_px, 24)
    assert.equal(parent?.layout?.flex?.direction, 'row')
    assert.equal(child?.layout?.display, 'flex')
    assert.equal(child?.layout?.flex?.direction, 'column')

    const warnings = Array.isArray(body.job?.warnings) ? body.job.warnings : []
    assert.equal(warnings.some((warning) => warning.code === 'unsupported_flex_behavior' && warning.component_id === 'cmp-flex-parent'), true)
  })
})

test('slides API contract: nested flex utility layouts preserve child coordinates and deterministic ordering', { concurrency: false }, async () => {
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
        id: 'slide-flex-2',
        owner_user_id: 'admin-1',
        title: 'Nested Flex Layout',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
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
    const payload = {
      action: 'request-pptx-export-job',
      actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
      slide_ids: ['slide-flex-2'],
      slides: [{
        id: 'slide-flex-2',
        title: 'Nested Flex Layout',
        canvas: { width: 1920, height: 1080 },
        components: [
          {
            id: 'cmp-utility-child-right',
            type: 'text',
            x: 820,
            y: 184,
            width: 240,
            height: 80,
            order_index: 4,
            content: 'Right metric',
            computed_style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-end',
              gap: '8px',
            },
          },
          {
            id: 'cmp-utility-parent',
            type: 'panel',
            x: 120,
            y: 140,
            width: 1040,
            height: 220,
            order_index: 1,
            content: 'Utility parent',
            computed_style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '32px',
              flexDirection: 'row',
            },
          },
          {
            id: 'cmp-utility-child-left',
            type: 'text',
            x: 160,
            y: 184,
            width: 420,
            height: 96,
            order_index: 2,
            content: 'Left narrative',
            computed_style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: '12px',
              fontSize: '28px',
              lineHeight: '34px',
            },
          },
          {
            id: 'cmp-utility-stack',
            type: 'panel',
            x: 640,
            y: 172,
            width: 460,
            height: 120,
            order_index: 3,
            content: 'Nested stack',
            computed_style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'stretch',
              gap: '16px',
              flexWrap: 'wrap',
            },
          },
        ],
      }],
    }

    const reqOne = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, idempotency_key: 'flex-nested-a' }),
    })
    const resOne = await onRequestPost({ request: reqOne, env: { ...BASE_ENV } })
    const bodyOne = await resOne.json()
    assert.equal(resOne.status, 201)

    const reqTwo = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, idempotency_key: 'flex-nested-b' }),
    })
    const resTwo = await onRequestPost({ request: reqTwo, env: { ...BASE_ENV } })
    const bodyTwo = await resTwo.json()
    assert.equal(resTwo.status, 201)

    const objectsOne = Array.isArray(bodyOne.job?.native_objects) ? bodyOne.job.native_objects : []
    const objectsTwo = Array.isArray(bodyTwo.job?.native_objects) ? bodyTwo.job.native_objects : []
    assert.deepEqual(objectsOne, objectsTwo)
    assert.deepEqual(objectsOne.map((entry) => entry.component_id), [
      'cmp-utility-parent',
      'cmp-utility-stack',
      'cmp-utility-child-left',
      'cmp-utility-child-right',
    ])

    const stack = objectsOne.find((entry) => entry.component_id === 'cmp-utility-stack')
    const left = objectsOne.find((entry) => entry.component_id === 'cmp-utility-child-left')
    const right = objectsOne.find((entry) => entry.component_id === 'cmp-utility-child-right')

    assert.deepEqual(
      { x: stack?.layout?.x, y: stack?.layout?.y, width: stack?.layout?.width, height: stack?.layout?.height },
      { x: 640, y: 172, width: 460, height: 120 },
    )
    assert.deepEqual(
      { x: left?.layout?.x, y: left?.layout?.y, width: left?.layout?.width, height: left?.layout?.height },
      { x: 160, y: 184, width: 420, height: 96 },
    )
    assert.deepEqual(
      { x: right?.layout?.x, y: right?.layout?.y, width: right?.layout?.width, height: right?.layout?.height },
      { x: 820, y: 184, width: 240, height: 80 },
    )

    assert.equal(stack?.layout?.flex?.direction, 'column')
    assert.equal(stack?.layout?.flex?.gap_px, 16)
    assert.equal(left?.style_projection?.font_size_px, 28)
    assert.equal(left?.style_projection?.line_height_px, 34)

    const warnings = Array.isArray(bodyOne.job?.warnings) ? bodyOne.job.warnings : []
    assert.equal(warnings.some((warning) => warning.code === 'unsupported_flex_behavior' && warning.component_id === 'cmp-utility-stack'), true)
  })
})

test('slides API contract: effects projection maps gradients/shadows/radius and warns on unsupported combos', { concurrency: false }, async () => {
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
        id: 'slide-effects-1',
        owner_user_id: 'admin-1',
        title: 'Effects Fidelity',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
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
        slide_ids: ['slide-effects-1'],
        slides: [{
          id: 'slide-effects-1',
          title: 'Effects Fidelity',
          canvas: { width: 1920, height: 1080 },
          components: [
            {
              id: 'cmp-linear-shadow',
              type: 'card',
              x: 120,
              y: 180,
              width: 600,
              height: 300,
              content: 'Linear gradient + shadow',
              style: {
                backgroundFill: 'linear-gradient(135deg, #111827 0%, #2563eb 100%)',
                boxShadow: '0px 12px 30px rgba(17,24,39,0.35)',
                borderRadius: 24,
              },
            },
            {
              id: 'cmp-radial',
              type: 'panel',
              x: 780,
              y: 180,
              width: 520,
              height: 300,
              content: 'Radial gradient',
              style: {
                backgroundFill: 'radial-gradient(circle, #f59e0b 0%, #7c2d12 100%)',
                borderRadius: '18px',
              },
            },
            {
              id: 'cmp-unsupported-effects',
              type: 'row',
              x: 120,
              y: 540,
              width: 900,
              height: 180,
              content: 'Unsupported combo',
              style: {
                backgroundFill: 'conic-gradient(#111827, #2563eb)',
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.4)',
                borderRadius: '50%',
              },
            },
          ],
        }],
      }),
    })

    const response = await onRequestPost({ request, env: { ...BASE_ENV } })
    const body = await response.json()
    assert.equal(response.status, 201)

    const nativeObjects = Array.isArray(body.job?.native_objects) ? body.job.native_objects : []
    const linear = nativeObjects.find((entry) => entry.component_id === 'cmp-linear-shadow')
    const radial = nativeObjects.find((entry) => entry.component_id === 'cmp-radial')

    assert.equal(linear?.style_projection?.effects?.fill?.type, 'linear')
    assert.equal(linear?.style_projection?.effects?.fill?.angle_deg, 135)
    assert.deepEqual(
      linear?.style_projection?.effects?.fill?.stops?.map((stop) => `${stop.color}@${stop.position_percent}`),
      ['111827@0', '2563EB@100'],
    )
    assert.equal(linear?.style_projection?.effects?.shadow?.x_px, 0)
    assert.equal(linear?.style_projection?.effects?.shadow?.y_px, 12)
    assert.equal(linear?.style_projection?.effects?.shadow?.blur_px, 30)
    assert.equal(linear?.style_projection?.effects?.border_radius_px, 24)
    assert.equal(radial?.style_projection?.effects?.fill?.type, 'radial')
    assert.deepEqual(
      radial?.style_projection?.effects?.fill?.stops?.map((stop) => `${stop.color}@${stop.position_percent}`),
      ['F59E0B@0', '7C2D12@100'],
    )
    assert.equal(radial?.style_projection?.effects?.border_radius_px, 18)

    const warnings = Array.isArray(body.job?.warnings) ? body.job.warnings : []
    assert.equal(
      warnings.some((warning) => (
        warning.code === 'unsupported_effect_combo'
        && warning.slide_id === 'slide-effects-1'
        && warning.component_id === 'cmp-unsupported-effects'
      )),
      true,
    )
  })
})

test('slides API contract: font manifest embeds declared assets and warns on blocked fonts', { concurrency: false }, async () => {
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
        id: 'slide-fonts-1',
        owner_user_id: 'admin-1',
        title: 'Fonts',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
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
        slide_ids: ['slide-fonts-1'],
        font_faces: [
          {
            family: 'Inter',
            weight: 700,
            style: 'normal',
            src_url: 'https://cdn.example.com/fonts/inter-700.woff2',
            embed_allowed: true,
          },
          {
            family: 'Merriweather',
            weight: 400,
            style: 'normal',
            src_url: 'https://cdn.example.com/fonts/merriweather-400.woff2',
            embed_allowed: false,
          },
        ],
        slides: [{
          id: 'slide-fonts-1',
          title: 'Fonts',
          canvas: { width: 1920, height: 1080 },
          components: [
            {
              id: 'cmp-font-heading',
              type: 'heading',
              x: 120,
              y: 120,
              width: 800,
              content: 'Branded heading',
              computed_style: {
                fontFamily: 'Inter, sans-serif',
                fontWeight: '700',
                fontSize: '56px',
              },
            },
            {
              id: 'cmp-font-body',
              type: 'text',
              x: 120,
              y: 240,
              width: 700,
              content: 'Fallback body',
              computed_style: {
                fontFamily: 'Merriweather, serif',
                fontWeight: '400',
                fontSize: '28px',
              },
            },
          ],
        }],
      }),
    })

    const response = await onRequestPost({ request, env: { ...BASE_ENV } })
    const body = await response.json()
    assert.equal(response.status, 201)

    assert.deepEqual(body.job?.font_manifest?.embedded_fonts, [{
      family: 'Inter',
      weight: 700,
      style: 'normal',
      src_url: 'https://cdn.example.com/fonts/inter-700.woff2',
    }])
    assert.deepEqual(body.job?.font_manifest?.used_fonts, [
      { family: 'Inter', weight: 700, style: 'normal' },
      { family: 'Merriweather', weight: 400, style: 'normal' },
    ])

    const nativeObjects = Array.isArray(body.job?.native_objects) ? body.job.native_objects : []
    const heading = nativeObjects.find((entry) => entry.component_id === 'cmp-font-heading')
    assert.equal(heading?.style_projection?.font_family, 'Inter, sans-serif')

    const warnings = Array.isArray(body.job?.warnings) ? body.job.warnings : []
    assert.equal(
      warnings.some((warning) => (
        warning.code === 'font_embed_unavailable'
        && warning.component_id === 'cmp-font-body'
        && warning.slide_id === 'slide-fonts-1'
      )),
      true,
    )
    assert.equal(
      warnings.some((warning) => warning.code === 'font_embed_unavailable' && warning.component_id === 'cmp-font-heading'),
      false,
    )
  })
})

test('slides API contract: fragment animation mapping respects profile and warns on unsupported semantics', { concurrency: false }, async () => {
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
        id: 'slide-anim-1',
        owner_user_id: 'admin-1',
        title: 'Animation',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
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
    const basePayload = {
      action: 'request-pptx-export-job',
      actor: { user_id: 'admin-1', user_email: 'admin@example.com' },
      slide_ids: ['slide-anim-1'],
      slides: [{
        id: 'slide-anim-1',
        title: 'Animation',
        canvas: { width: 1920, height: 1080 },
        components: [
          {
            id: 'cmp-fragment-heading',
            type: 'heading',
            x: 120,
            y: 100,
            width: 900,
            content: 'Opening',
            fragment_index: 0,
            animation: 'fade',
            style: {},
          },
          {
            id: 'cmp-fragment-card',
            type: 'card',
            x: 140,
            y: 260,
            width: 540,
            height: 220,
            content: 'Card reveal',
            fragment_index: 1,
            animation: 'fly-in',
            style: {},
          },
          {
            id: 'cmp-fragment-text',
            type: 'text',
            x: 760,
            y: 260,
            width: 420,
            content: 'Body reveal',
            fragment_index: 2,
            style: { animationName: 'fragment' },
          },
          {
            id: 'cmp-fragment-odd',
            type: 'text',
            x: 760,
            y: 560,
            width: 420,
            content: 'Unsupported semantic',
            fragment_index: 3,
            animation: 'spin-in',
            style: {},
          },
        ],
      }],
    }

    const defaultReq = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, animation_profile: 'default', idempotency_key: 'anim-default' }),
    })
    const defaultRes = await onRequestPost({ request: defaultReq, env: { ...BASE_ENV } })
    const defaultBody = await defaultRes.json()
    assert.equal(defaultRes.status, 201)

    assert.equal(defaultBody.job?.animation_manifest?.profile, 'default')
    assert.deepEqual(defaultBody.job?.animation_manifest?.animations, [
      {
        slide_id: 'slide-anim-1',
        component_id: 'cmp-fragment-heading',
        component_type: 'heading',
        native_kind: 'text',
        sequence: 1,
        fragment_order: 0,
        effect: 'fade',
      },
      {
        slide_id: 'slide-anim-1',
        component_id: 'cmp-fragment-card',
        component_type: 'card',
        native_kind: 'shape',
        sequence: 2,
        fragment_order: 1,
        effect: 'fly-in',
      },
      {
        slide_id: 'slide-anim-1',
        component_id: 'cmp-fragment-text',
        component_type: 'text',
        native_kind: 'text',
        sequence: 3,
        fragment_order: 2,
        effect: 'fade',
      },
    ])

    const defaultWarnings = Array.isArray(defaultBody.job?.warnings) ? defaultBody.job.warnings : []
    assert.equal(
      defaultWarnings.some((warning) => (
        warning.code === 'unsupported_animation_semantic'
        && warning.slide_id === 'slide-anim-1'
        && warning.component_id === 'cmp-fragment-odd'
      )),
      true,
    )

    const conservativeReq = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, animation_profile: 'conservative', idempotency_key: 'anim-conservative' }),
    })
    const conservativeRes = await onRequestPost({ request: conservativeReq, env: { ...BASE_ENV } })
    const conservativeBody = await conservativeRes.json()
    assert.equal(conservativeRes.status, 201)
    assert.equal(conservativeBody.job?.animation_manifest?.profile, 'conservative')
    assert.deepEqual(
      conservativeBody.job?.animation_manifest?.animations.map((entry) => entry.effect),
      ['appear', 'appear', 'appear'],
    )

    const disabledReq = new Request('https://oliver-app.local/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, animation_profile: 'disabled', idempotency_key: 'anim-disabled' }),
    })
    const disabledRes = await onRequestPost({ request: disabledReq, env: { ...BASE_ENV } })
    const disabledBody = await disabledRes.json()
    assert.equal(disabledRes.status, 201)
    assert.equal(disabledBody.job?.animation_manifest?.profile, 'disabled')
    assert.deepEqual(disabledBody.job?.animation_manifest?.animations, [])
  })
})

test('slides API contract: dashboard surface manifest covers svg table and canvas fallbacks deterministically', { concurrency: false }, async () => {
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
        id: 'slide-dashboard-1',
        owner_user_id: 'admin-1',
        title: 'Dashboard',
        canvas: { width: 1920, height: 1080 },
        components_json: [],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
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
        slide_ids: ['slide-dashboard-1'],
        slides: [{
          id: 'slide-dashboard-1',
          title: 'Dashboard',
          canvas: { width: 1920, height: 1080 },
          components: [
            {
              id: 'cmp-dashboard-svg',
              type: 'logo',
              x: 60,
              y: 40,
              width: 160,
              height: 60,
              sourceLabel: 'Revenue SVG',
              content: '<img alt="Revenue SVG" src="data:image/svg+xml;utf8,%3Csvg%20viewBox%3D%220%200%20160%2060%22%3E%3C/svg%3E" />',
              style: {},
            },
            {
              id: 'cmp-dashboard-table',
              type: 'panel',
              x: 120,
              y: 180,
              width: 820,
              height: 280,
              sourceLabel: 'KPI table',
              content: '<table><tr><th>Region</th><th>ARR</th></tr><tr><td>NA</td><td>$2.4M</td></tr></table>',
              style: {},
            },
            {
              id: 'cmp-dashboard-canvas',
              type: 'panel',
              x: 980,
              y: 180,
              width: 700,
              height: 320,
              sourceLabel: 'Chart canvas',
              content: '<canvas data-chart-library="chart.js"></canvas>',
              style: {},
            },
            {
              id: 'cmp-dashboard-echarts',
              type: 'panel',
              x: 980,
              y: 540,
              width: 700,
              height: 320,
              sourceLabel: 'ECharts panel',
              content: '<div class="echarts-host">echarts</div>',
              style: {},
            },
          ],
        }],
      }),
    })

    const response = await onRequestPost({ request, env: { ...BASE_ENV } })
    const body = await response.json()
    assert.equal(response.status, 201)

    assert.deepEqual(body.job?.dashboard_surface_manifest?.surfaces, [
      {
        slide_id: 'slide-dashboard-1',
        component_id: 'cmp-dashboard-svg',
        component_type: 'logo',
        surface_type: 'svg',
        native_kind: 'image',
        export_strategy: 'vector-image',
        editable: false,
      },
      {
        slide_id: 'slide-dashboard-1',
        component_id: 'cmp-dashboard-table',
        component_type: 'panel',
        surface_type: 'table',
        native_kind: 'shape',
        export_strategy: 'native-table',
        editable: true,
      },
      {
        slide_id: 'slide-dashboard-1',
        component_id: 'cmp-dashboard-canvas',
        component_type: 'panel',
        surface_type: 'canvas',
        native_kind: 'shape',
        export_strategy: 'raster-image',
        editable: false,
      },
      {
        slide_id: 'slide-dashboard-1',
        component_id: 'cmp-dashboard-echarts',
        component_type: 'panel',
        surface_type: 'canvas-chart',
        native_kind: 'shape',
        export_strategy: 'raster-image',
        editable: false,
      },
    ])

    const warnings = Array.isArray(body.job?.warnings) ? body.job.warnings : []
    assert.equal(
      warnings.some((warning) => warning.code === 'dashboard_surface_rasterized' && warning.component_id === 'cmp-dashboard-canvas'),
      true,
    )
    assert.equal(
      warnings.some((warning) => warning.code === 'dashboard_surface_rasterized' && warning.component_id === 'cmp-dashboard-echarts'),
      true,
    )
  })
})
