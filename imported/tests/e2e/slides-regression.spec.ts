import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gotoAndSettle } from './helpers/navigation'

async function gotoSlidesWorkspace(page: Page) {
  await gotoAndSettle(page, '/slides')
  await expect(page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /sign in to your account/i })).toHaveCount(0)
}

async function openSlidesActivity(page: Page) {
  await page.locator('.app-sidebar').getByRole('button', { name: 'Activity', exact: true }).click()
}

function seedQaAuth(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('qa-auth-account', JSON.stringify({
      homeAccountId: 'qa-home-account',
      environment: 'qa.local',
      tenantId: 'qa-tenant',
      username: 'qa-admin@example.com',
      localAccountId: 'qa-local-account',
      name: 'QA Admin',
      idTokenClaims: {
        oid: 'qa-admin-user',
        sub: 'qa-admin-user',
      },
    }))

    window.localStorage.setItem('qa-app-user', JSON.stringify({
      user_id: 'qa-admin-user',
      email: 'qa-admin@example.com',
      name: 'QA Admin',
      role: 'admin',
      page_permissions: ['accounts', 'hr', 'sdr', 'crm', 'slides'],
      created_at: '2026-04-24T00:00:00.000Z',
      updated_at: '2026-04-24T00:00:00.000Z',
    }))
  })
}

test.describe('slides regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedQaAuth(page)
  })

  test('US-SLD-010 preflight validation blocks empty and recovers on next parse', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText(/(empty input|paste html before parsing)/i)).toBeVisible()

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Hello</h1></div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()

    await expect(page.getByText(/Parse complete\./)).toBeVisible()
    await expect(page.locator('.slides-summary').getByText(/Components:\s*1/)).toBeVisible()
    await expect(page.getByText(/Import failed/)).toHaveCount(0)
  })

  test('US-SLD-104 non-positioned html import never dead-ends with zero editable layers', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`
      <main>
        <h1>Fallback Import Heading</h1>
        <p>This source has flow layout with no absolute positioning.</p>
      </main>
    `)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()

    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect
      .poll(async () => page.locator('.slides-canvas-component').count())
      .toBeGreaterThan(0)
    await expect(page.getByText(/Import failed/i)).toHaveCount(0)
  })

  test('US-SLD-011 and US-SLD-012 show structured warnings and support parse cancellation', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const html = `<div class="slide-canvas" style="width:1280px;height:720px;">
      <div class="heading" style="position:absolute;left:10vw;top:72px;width:640px;transform:rotate(3deg)">Hello</div>
    </div>`
    await page.locator('#slides-raw-html').fill(html)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()

    await expect(page.getByRole('button', { name: 'Cancel Parse' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel Parse' }).click()
    await expect(page.getByText('Import canceled.')).toBeVisible()

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Transforms' })).toBeVisible()
    await expect
      .poll(async () => page.locator('.slides-component-grid-row').count())
      .toBeGreaterThanOrEqual(1)
    await expect(page.getByRole('button', { name: 'Copy Parsed JSON' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download JSON' })).toBeVisible()
  })

  test('US-SLD-013 fixture round-trip keeps component count and coordinate drift within tolerance', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const fixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'slides', 'hero-with-card.html'), 'utf8')
    await page.locator('#slides-raw-html').fill(fixture)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const initialDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const initial = initialDocument.deck.slides[0].elements

    await page.getByRole('button', { name: 'Generate HTML Export' }).click()
    const exported = await page.locator('#slides-export-html').inputValue()
    expect(exported).toContain('data-oliver-export-version="1"')
    expect(exported).toMatch(/data-oliver-slide-id="[^"]+"/)

    await page.locator('#slides-raw-html').fill(exported)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const secondDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const second = secondDocument.deck.slides[0].elements
    expect(second.length).toBe(initial.length)

    for (let index = 0; index < initial.length; index += 1) {
      const before = initial[index]
      const after = second[index]
      expect(Math.abs((before?.x || 0) - (after?.x || 0))).toBeLessThanOrEqual(1)
      expect(Math.abs((before?.y || 0) - (after?.y || 0))).toBeLessThanOrEqual(1)
      expect(Math.abs((before?.width || 0) - (after?.width || 0))).toBeLessThanOrEqual(1)
    }
  })

  test('US-SLD-020 renders scaled 16:9 canvas layers from component json and supports baseline inline edits', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <h1 style="position:absolute;left:100px;top:120px;width:800px;">Canvas Heading</h1>
      <div class="card" style="position:absolute;left:120px;top:320px;width:420px;height:220px;">Card Body</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-title').fill('Canvas Layer Slide')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await expect(page.locator('[data-slide-canvas="1"]')).toBeVisible()
    await expect(page.locator('.slides-canvas-component')).toHaveCount(2)
    await expect(page.getByText(/Scaled to viewport at \d+% while preserving coordinate integrity\./)).toBeVisible()
    await expect(page.locator('.slides-canvas-component[data-component-type="heading"][data-component-x="100"][data-component-y="120"][data-component-width="800"]')).toHaveCount(1)

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await headingLayer.dblclick()
    const headingContent = headingLayer.locator('.slides-canvas-component-content')
    await expect(headingContent).toHaveAttribute('contenteditable', 'true')
    await headingContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type('Canvas Edited Heading')
    await page.locator('#slides-title').click()
    await expect(page.getByText(/Save status: dirty/i)).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const parsed = parsedDocument.deck.slides[0].elements
    expect(String(parsed[0]?.content || '')).toContain('Canvas Edited Heading')
  })

  test('SLD-FE-300 imports class-based CSS layout, colors, and typography from HTML slides', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const fixture = readFileSync(
      join(process.cwd(), 'tests', 'fixtures', 'slides', 'class-css-coordinate-line-height.html'),
      'utf8',
    )
    await page.locator('#slides-raw-html').fill(fixture)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await expect(headingLayer).toHaveAttribute('data-component-x', '120')
    await expect(headingLayer).toHaveAttribute('data-component-y', '90')
    await expect(headingLayer).toHaveAttribute('data-component-width', '760')

    await expect.poll(async () => {
      const value = await headingLayer.evaluate((node) => window.getComputedStyle(node).fontSize)
      return Number.parseFloat(value)
    }).toBeGreaterThan(55)
    await expect.poll(async () => {
      const value = await headingLayer.evaluate((node) => window.getComputedStyle(node).fontSize)
      return Number.parseFloat(value)
    }).toBeLessThan(58)
    await expect.poll(async () => headingLayer.evaluate((node) => window.getComputedStyle(node).color)).toContain('15, 118, 110')
    await headingLayer.click()
    await expect(page.locator('#slides-style-color')).toHaveValue('#0f766e')

    const panelLayer = page.locator('.slides-canvas-component[data-component-type="panel"]').first()
    await expect.poll(async () => panelLayer.evaluate((node) => window.getComputedStyle(node).backgroundColor)).toContain('17, 24, 39')
  })

  test('SLD-FE-302 imports uploaded nested CSS layouts without collapsing layers to top-left', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const html = `<style>
      .slide-canvas { position: relative; width: 1280px; height: 720px; background: #0f172a; }
      .group { position: absolute; left: 220px; top: 160px; width: 700px; height: 360px; }
      .title { position: absolute; left: 40px; top: 32px; width: 520px; font-size: 54px; color: #f8fafc; }
      .panel { position: absolute; left: 80px; top: 150px; width: 360px; height: 150px; background: #14b8a6; color: #042f2e; }
    </style>
    <div class="slide-canvas">
      <section class="group">
        <h1 class="title">Uploaded CSS Layout</h1>
        <div class="panel">Panel should stay inside its parent offset.</div>
      </section>
    </div>`

    await page.locator('#slides-html-file').setInputFiles({
      name: 'nested-layout.html',
      mimeType: 'text/html',
      buffer: Buffer.from(html),
    })

    await expect(page.getByText('Parse complete.')).toBeVisible()
    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}')) as { deck: { slides: Array<{ elements: Array<{
      sourceLabel?: string
      x?: number
      y?: number
      style?: { backgroundColor?: string }
    }> }> } }
    const components = parsedDocument.deck.slides[0].elements
    const title = components.find((component) => String(component.sourceLabel || '').includes('.title'))
    const panel = components.find((component) => String(component.sourceLabel || '').includes('.panel'))

    expect(Number(title?.x || 0)).toBeGreaterThanOrEqual(250)
    expect(Number(title?.y || 0)).toBeGreaterThanOrEqual(180)
    expect(Number(panel?.x || 0)).toBeGreaterThanOrEqual(290)
    expect(Number(panel?.y || 0)).toBeGreaterThanOrEqual(300)
    expect(String(panel?.style?.backgroundColor || '')).toContain('20, 184, 166')
  })

  test('US-SLD-050 parsing HTML auto-selects an imported layer so editor fields are immediately editable', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="position:relative;width:1280px;height:720px;background:#ffffff;">
      <h1 style="position:absolute;left:120px;top:100px;width:700px;font-size:56px;color:#0f172a;">Immediate Edit Layer</h1>
      <p style="position:absolute;left:120px;top:190px;width:520px;font-size:28px;color:#334155;">Parse should select a layer automatically.</p>
    </div>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await expect(page.locator('.slides-canvas-component[data-component-selected="true"]')).toHaveCount(1)
    await expect(page.locator('#slides-style-font-size')).toBeEnabled()
  })

  test('US-SLD-159 records parse diagnostics correlation id that is queryable via import trace resource', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    let observedCorrelationId: string | null = null
    const observedPhasesByCorrelation = new Map<string, Set<string>>()
    await page.route('**/api/slides', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        const bodyText = request.postData() || ''
        try {
          const payload = JSON.parse(bodyText)
          if (payload?.action === 'record-import-session-trace' && typeof payload?.correlation_id === 'string') {
            const correlationId = payload.correlation_id.trim()
            if (correlationId) {
              observedCorrelationId = correlationId
              const current = observedPhasesByCorrelation.get(correlationId) || new Set<string>()
              current.add(String(payload?.phase || 'unknown'))
              observedPhasesByCorrelation.set(correlationId, current)
            }
          }
        } catch (_) {
          // Keep passthrough semantics for non-JSON payloads.
        }
      }
      await route.continue()
    })

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;">
      <h1 style="position:absolute;left:120px;top:120px;width:640px;">Trace Ready</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect.poll(() => observedCorrelationId).not.toBeNull()
    const correlationId = observedCorrelationId
    if (!correlationId) {
      throw new Error('Expected parse trace correlation id to be captured.')
    }
    const observedPhases = observedPhasesByCorrelation.get(correlationId) || new Set<string>()
    expect(observedPhases.has('parse-start')).toBe(true)
    expect(
      observedPhases.has('parse-end')
      || observedPhases.has('parse-fallback')
      || observedPhases.has('parse-error')
      || observedPhases.has('parse-canceled'),
    ).toBe(true)
  })

  test('SLD-FE-617 template endpoint fallback does not trigger global degraded local-draft banner', async ({ page }) => {
    await page.route('**/api/slides?*', async (route) => {
      const url = new URL(route.request().url())
      const resource = url.searchParams.get('resource') || ''
      if (resource === 'templates' || resource === 'archived-templates') {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Slides template service unavailable.',
            error_detail: {
              correlation_id: 'slides-test-template-failure',
              ray_id: 'test-ray-template-failure',
              failure_class: 'upstream_unavailable',
              retryable: true,
            },
          }),
        })
        return
      }
      await route.continue()
    })

    await gotoSlidesWorkspace(page)
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    await expect(page.getByText('Hero + Metric Row')).toBeVisible()
    await expect(page.getByText(/Degraded Mode: Local Draft/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Retry Slides Service' })).toHaveCount(0)
  })

  test('SLD-FE-512 preserves gradients, borders, shadows, and canvas background through parse and HTML export', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const fixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'slides', 'fidelity-gradient-shadow.html'), 'utf8')
    await page.locator('#slides-raw-html').fill(fixture)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const canvas = page.locator('[data-slide-canvas="1"]')
    await expect.poll(async () => canvas.evaluate((node) => window.getComputedStyle(node).backgroundImage)).toContain('linear-gradient')

    const panelLayer = page.locator('.slides-canvas-component[data-component-type="panel"]').first()
    await expect.poll(async () => panelLayer.evaluate((node) => window.getComputedStyle(node).backgroundImage)).toContain('linear-gradient')
    await expect.poll(async () => panelLayer.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).borderTopWidth))).toBeGreaterThanOrEqual(2)
    await expect.poll(async () => panelLayer.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).borderRadius))).toBeGreaterThanOrEqual(28)
    await expect.poll(async () => panelLayer.evaluate((node) => window.getComputedStyle(node).boxShadow)).not.toBe('none')

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}')) as { deck: { slides: Array<{ elements: Array<{
      type?: string
      style?: {
        backgroundFill?: string
        borderColor?: string
        borderWidth?: number
        borderRadius?: number
        boxShadow?: string
      }
    }> }> } }
    const parsed = parsedDocument.deck.slides[0].elements

    const parsedPanel = parsed.find((entry) => entry.type === 'panel')
    expect(String(parsedPanel?.style?.backgroundFill || '')).toContain('linear-gradient')
    expect(String(parsedPanel?.style?.borderColor || '')).toContain('148, 163, 184')
    expect(Number(parsedPanel?.style?.borderWidth || 0)).toBeGreaterThanOrEqual(2)
    expect(Number(parsedPanel?.style?.borderRadius || 0)).toBeGreaterThanOrEqual(28)
    expect(String(parsedPanel?.style?.boxShadow || '')).toContain('rgba')

    await page.getByRole('button', { name: 'Generate HTML Export' }).click()
    const exported = await page.locator('#slides-export-html').inputValue()
    expect(exported).toContain('linear-gradient(')
    expect(exported).toContain('box-shadow:')
    expect(exported).toContain('border-radius:28px')
  })

  test('SLD-FE-301 imports nested flow-layout HTML into multiple styled layers', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<style>
      .deck-root { width: 1280px; height: 720px; background: #e2e8f0; padding: 36px; }
      .slide-shell { display: grid; gap: 24px; border-radius: 24px; background: #f8fafc; padding: 48px; }
      .title { font-size: 56px; line-height: 64px; color: #0f172a; font-family: Georgia, serif; }
      .panel { width: 760px; border-radius: 20px; background: #1e293b; color: #f8fafc; padding: 28px; }
    </style>
    <div class="deck-root">
      <main class="slide-shell">
        <section>
          <h1 class="title">Flow Layout Title</h1>
        </section>
        <section>
          <div class="panel">Flow panel body copy</div>
        </section>
      </main>
    </div>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}')) as { deck: { slides: Array<{ elements: Array<{
      type?: string
      content?: string
      style?: { fontSize?: number; backgroundColor?: string }
    }> }> } }
    const parsed = parsedDocument.deck.slides[0].elements

    expect(parsed.length).toBeGreaterThanOrEqual(2)
    const heading = parsed.find((component) => component.type === 'heading')
    const panel = parsed.find((component) => component.type === 'panel')

    expect(heading).toBeTruthy()
    expect(String(heading?.content || '')).toContain('Flow Layout Title')
    expect(Number(heading?.style?.fontSize || 0)).toBeGreaterThan(40)

    expect(panel).toBeTruthy()
    expect(String(panel?.content || '')).toContain('Flow panel body copy')
    expect(String(panel?.style?.backgroundColor || '')).toContain('30, 41, 59')
  })

  test('SLD-FE-304 marks fallback-rendered imports as locked and clearly labeled', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;">
      <span><span>Fallback only inline text</span></span>
    </div>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.getByText(/imported top-level nodes as fallback/i)).toBeVisible()
    await expect(page.getByText(/fallback node.*locked layers/i)).toBeVisible()

    const layer = page.locator('.slides-canvas-component').first()
    await expect(layer).toHaveAttribute('data-component-locked', 'true')

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}')) as { deck: { slides: Array<{ elements: Array<{
      sourceLabel?: string
      locked?: boolean
    }> }> } }
    const parsed = parsedDocument.deck.slides[0].elements

    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.locked).toBe(true)
    expect(String(parsed[0]?.sourceLabel || '')).toContain('(fallback)')
  })

  test('US-SLD-050 skips layout-only wrappers and avoids parent-child text duplication', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="page" style="position:relative;width:1600px;height:900px;background:#f8fafc;">
      <div class="wrap" style="position:absolute;left:120px;top:120px;width:1240px;height:620px;">
        <div class="left" style="position:absolute;left:0;top:0;width:560px;height:520px;">
          <div class="art" style="position:absolute;left:0;top:0;width:520px;height:240px;background:#111827;border-radius:24px;">
            <h2 class="an" style="position:absolute;left:32px;top:28px;width:420px;color:#ffffff;">Artifact Title</h2>
            <p class="al" style="position:absolute;left:32px;top:96px;width:420px;color:#cbd5e1;">Artifact Label</p>
            <p class="ad" style="position:absolute;left:32px;top:148px;width:420px;color:#94a3b8;">Artifact Detail</p>
          </div>
        </div>
        <div class="right" style="position:absolute;left:660px;top:40px;width:520px;height:280px;">
          <h1 class="headline" style="position:absolute;left:0;top:0;width:460px;color:#0f172a;">Wrapper Free Heading</h1>
          <p class="deck-body" style="position:absolute;left:0;top:96px;width:440px;color:#334155;">Body copy stays on child layer only.</p>
        </div>
      </div>
    </div>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const components = parsedDocument.deck.slides[0].elements as Array<{
      type?: string
      sourceLabel?: string
      content?: string
      locked?: boolean
    }>

    expect(components.filter((component) => String(component.sourceLabel || '').includes('.wrap'))).toHaveLength(0)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.left'))).toHaveLength(0)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.right'))).toHaveLength(0)
    expect(components.filter((component) => component.type === 'card' && String(component.sourceLabel || '').includes('.art'))).toHaveLength(1)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.an') && String(component.content || '').includes('Artifact Title'))).toHaveLength(1)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.al') && String(component.content || '').includes('Artifact Label'))).toHaveLength(1)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.ad') && String(component.content || '').includes('Artifact Detail'))).toHaveLength(1)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.headline') && String(component.content || '').includes('Wrapper Free Heading'))).toHaveLength(1)
    expect(components.filter((component) => String(component.content || '').includes('Body copy stays on child layer only.'))).toHaveLength(1)
  })

  test('SLD-FE-305 prioritizes .page root detection over lower-priority slide containers', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<style>
      .slide-canvas { position: relative; width: 4000px; height: 2250px; background: #0f172a; }
      .slide-canvas .title { position: absolute; left: 500px; top: 360px; width: 1600px; font-size: 48px; color: #ef4444; }
      .page { position: relative; width: 1600px; height: 900px; background: #e2e8f0; }
      .page .title { position: absolute; left: 160px; top: 120px; width: 920px; font-size: 60px; color: #0f172a; }
    </style>
    <section class="slide-canvas">
      <h1 class="title">Decoy Slide Root</h1>
    </section>
    <section class="page">
      <h1 class="title">Priority Page Root</h1>
    </section>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}')) as { deck: { slides: Array<{ elements: Array<{
      content?: string
      x?: number
      style?: { color?: string }
    }> }> } }
    const parsed = parsedDocument.deck.slides[0].elements

    expect(parsed).toHaveLength(1)
    expect(String(parsed[0]?.content || '')).toContain('Priority Page Root')
    expect(String(parsed[0]?.content || '')).not.toContain('Decoy Slide Root')
    expect(Number(parsed[0]?.x || 0)).toBeGreaterThanOrEqual(150)
    expect(String(parsed[0]?.style?.color || '')).toContain('15, 23, 42')
  })

  test('SLD-FE-306 avoids tiny-text scaling when body bounds are much larger than imported layer bounds', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<style>
      body { position: relative; width: 6400px; height: 3600px; margin: 0; }
      .hero { position: absolute; left: 320px; top: 260px; width: 1200px; font-size: 96px; line-height: 104px; color: #0f172a; }
    </style>
    <h1 class="hero">Body Oversized Root</h1>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.getByText(/oversized root width/i)).toHaveCount(0)

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await expect.poll(async () => {
      const raw = await headingLayer.getAttribute('data-component-x')
      return Number(raw || '0')
    }).toBeGreaterThanOrEqual(0)
    await expect.poll(async () => {
      const value = await headingLayer.evaluate((node) => window.getComputedStyle(node).fontSize)
      return Number.parseFloat(value)
    }).toBeGreaterThan(90)
  })

  test('SLD-FE-307 surfaces warning taxonomy for pseudo-elements, animations, canvas, video, and unresolved stylesheets', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<!doctype html>
    <html>
      <head>
        <link rel="stylesheet" href="./missing-theme.css" />
        <style>
          @keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } }
          .slide-canvas { position: relative; width: 1600px; height: 900px; }
          .title { position: absolute; left: 120px; top: 110px; width: 840px; font-size: 64px; animation: pulse 3s infinite; }
          .title::before { content: ""; display: inline-block; width: 8px; height: 48px; background: #06b6d4; margin-right: 12px; }
        </style>
      </head>
      <body>
        <div class="slide-canvas">
          <h1 class="title">Warning Taxonomy</h1>
          <canvas width="320" height="160"></canvas>
          <video src="https://example.com/sample.mp4"></video>
        </div>
      </body>
    </html>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()

    await expect(page.getByText(/could not inline .*linked stylesheet/i)).toBeVisible()
    await expect(page.getByText(/(Pseudo-element selectors were detected|Extracted \d+ pseudo-element layer)/i)).toBeVisible()
    await expect(page.getByText(/css animations/i)).toBeVisible()
    await expect(page.getByText(/canvas elements/i)).toBeVisible()
    await expect(page.getByText(/video elements/i)).toBeVisible()
  })

  test('US-SLD-064 extracts pseudo-elements and nested @import styles during HTML import', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.route('**/base.css', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '@import "nested.css";\n.title { color: #0f172a; font-family: "BrandSans"; }\n.title::before { content: "•"; width: 20px; height: 20px; left: 4px; top: 12px; background: #0ea5e9; }',
      })
    })
    await page.route('**/nested.css', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '.title { font-size: 56px; line-height: 64px; }',
      })
    })

    await page.locator('#slides-raw-html').fill(`<!doctype html>
      <html>
        <head>
          <link rel="stylesheet" href="./base.css" />
        </head>
        <body>
          <div class="slide-canvas" style="width:1600px;height:900px;">
            <h1 class="title">Nested import</h1>
          </div>
        </body>
      </html>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText(/Inlined 1 .*import stylesheet/i)).toBeVisible()
    await expect(page.getByText(/Extracted 1 pseudo-element layer/)).toBeVisible()
    await expect(page.locator('li', { hasText: /font-family "BrandSans" normalized with fallback/i }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const components = parsedDocument.deck.slides[0].elements
    expect(Array.isArray(components)).toBe(true)
    expect(components.filter((component: { sourceLabel?: string }) => (component.sourceLabel || '').includes('::before'))).toHaveLength(1)
    const pseudo = components.find((component: { sourceLabel?: string }) => (component.sourceLabel || '').includes('::before'))
    expect(String(pseudo?.content || '')).toContain('•')
    expect(String(pseudo?.sourceLabel || '')).toMatch(/::before/)
  })

  test('US-SLD-064 imports inline SVG as image fallback when vector-native layer parsing is unavailable', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <h1 style="position:absolute;left:100px;top:120px;width:860px;font-size:62px;line-height:72px;color:#0f172a;">Slide Title</h1>
      <svg style="position:absolute;left:1160px;top:830px;width:160px;height:60px;" viewBox="0 0 160 60">
        <rect x="0" y="0" width="160" height="60" rx="8" fill="#0ea5e9"/>
        <text x="80" y="38" text-anchor="middle" font-size="28" fill="#fff">LOGO</text>
      </svg>
    </div>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.locator('.slides-canvas-component[data-component-type="logo"] img')).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const components = parsedDocument.deck.slides[0].elements
    const logo = components.find((component: { type?: string; content?: string }) => component.type === 'logo')
    expect(String(logo?.content || '')).toContain('data:image/svg+xml;utf8,%3Csvg')
    expect(String(logo?.type || '')).toBe('logo')
  })

  test('SLD-FE-303 imports HTML with companion CSS files selected together', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const html = `<!doctype html>
    <html>
      <head>
        <link rel="stylesheet" href="deck-theme.css" />
      </head>
      <body>
        <div class="slide-canvas">
          <h1 class="hero-title">Companion Stylesheet Heading</h1>
        </div>
      </body>
    </html>`
    const css = `
      body { margin: 0; }
      .slide-canvas { position: relative; width: 1600px; height: 900px; background: #f8fafc; }
      .hero-title {
        position: absolute;
        left: 120px;
        top: 96px;
        width: 820px;
        font-size: 58px;
        line-height: 66px;
        color: #14532d;
        font-family: "Times New Roman", serif;
      }
    `

    await page.setInputFiles('#slides-html-file', [
      {
        name: 'deck.html',
        mimeType: 'text/html',
        buffer: Buffer.from(html),
      },
      {
        name: 'deck-theme.css',
        mimeType: 'text/css',
        buffer: Buffer.from(css),
      },
    ])

    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.getByText('Inlined 1 companion stylesheet from selected files.')).toBeVisible()

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await expect.poll(async () => headingLayer.evaluate((node) => window.getComputedStyle(node).color)).toContain('20, 83, 45')
    await expect.poll(async () => headingLayer.evaluate((node) => window.getComputedStyle(node).fontFamily.toLowerCase())).toContain('times')
  })

  test('US-SLD-055 accepts .htm uploads and rejects empty or plain-text upload payloads', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.setInputFiles('#slides-html-file', {
      name: 'imported-deck.htm',
      mimeType: 'text/html',
      buffer: Buffer.from('<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:120px;top:120px;width:900px;">HTML Import</h1></div>'),
    })
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.locator('.slides-summary')).toContainText(/Components:\s*1/)
    await expect(page.locator('#slides-raw-html')).toContainText('HTML Import')
    await expect(page.getByText(/Save status:\s*dirty/i)).toBeVisible()

    await page.setInputFiles('#slides-html-file', {
      name: 'empty-import.html',
      mimeType: 'text/html',
      buffer: Buffer.from(''),
    })
    await expect(page.getByText(/Import failed \(empty input\): Import file "empty-import\.html" is empty\. Paste HTML or choose a non-empty file before parsing\./)).toBeVisible()
    await expect(page.locator('#slides-raw-html')).toHaveValue('')

    await page.setInputFiles('#slides-html-file', {
      name: 'plain-text-import.html',
      mimeType: 'text/html',
      buffer: Buffer.from('this is not html markup'),
    })
    await expect(page.getByText(/Import failed \(invalid markup\): Input does not appear to contain valid HTML markup\./)).toBeVisible()
    await expect(page.locator('#slides-raw-html')).toHaveValue('this is not html markup')
  })

  test('US-SLD-055 imports large HTML uploads without leaving editor empty state', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const repeatedCards = new Array(240).fill(0).map((_, index) => (
      `<div class="card card-${index}" style="position:absolute;left:${(index % 12) * 140 + 40}px;top:${Math.floor(index / 12) * 52 + 180}px;width:120px;height:40px;font-size:14px;color:#0f172a;">Card ${index + 1}</div>`
    )).join('\n')
    const largeHtml = `<div class="slide-canvas" style="position:relative;width:1920px;height:1080px;background:#f8fafc;">
      <h1 style="position:absolute;left:80px;top:80px;width:980px;font-size:56px;color:#0f172a;">Large Import Regression Guard</h1>
      ${repeatedCards}
    </div>`
    expect(Buffer.byteLength(largeHtml, 'utf8')).toBeGreaterThan(15 * 1024)

    await page.setInputFiles('#slides-html-file', {
      name: 'large-import.html',
      mimeType: 'text/html',
      buffer: Buffer.from(largeHtml, 'utf8'),
    })

    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.locator('[data-slide-canvas="1"]')).toBeVisible()
    await expect(page.getByTestId('slides-editor-empty-state')).toHaveCount(0)
  })

  test('US-SLD-055 accepts full-document and fragment paste input after validation', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<!doctype html>
      <html>
        <head>
          <title>Fragment Import</title>
        </head>
        <body>
          <div class="slide-canvas" style="width:1600px;height:900px;">
            <h1 style="position:absolute;left:120px;top:120px;width:900px;">Full Document Paste</h1>
          </div>
        </body>
      </html>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.locator('.slides-summary')).toContainText(/Components:\s*1/)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1600px;height:900px;">
      <h1 style="position:absolute;left:120px;top:120px;width:900px;">Partial Fragment Paste</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.locator('.slides-summary')).toContainText(/Components:\s*1/)

    await page.locator('#slides-raw-html').fill('plain text only')
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText(/Import failed \(invalid markup\): Input does not appear to contain valid HTML markup\./)).toBeVisible()
  })

  test('US-SLD-102 normalizes multi-root html input to first document root and warns clearly', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<!doctype html>
      <html>
        <body>
          <div class="slide-canvas" style="width:1600px;height:900px;">
            <h1 style="position:absolute;left:120px;top:120px;width:900px;">First Root Wins</h1>
          </div>
        </body>
      </html>
      <html>
        <body>
          <div class="slide-canvas" style="width:1600px;height:900px;">
            <h1 style="position:absolute;left:120px;top:120px;width:900px;">Second Root Ignored</h1>
          </div>
        </body>
      </html>`)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.getByText(/Detected 2 HTML root tags; imported the first document block only\./)).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const parsed = parsedDocument.deck.slides[0].elements
    const textBlob = parsed.map((entry: { content?: string }) => String(entry.content || '')).join(' ')
    expect(textBlob).toContain('First Root Wins')
    expect(textBlob).not.toContain('Second Root Ignored')
  })

  test('SLD-FE-310 preserves style declaration order across inline and linked CSS (SLD-TE-311)', async ({ page }) => {
    await page.route('**/ordered-theme.css', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: `
          .ordered-title {
            color: #2563eb;
            font-size: 30px;
          }
        `,
      })
    })

    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<!doctype html>
    <html>
      <head>
        <link rel="stylesheet" href="/ordered-theme.css">
        <style>
          .ordered-title {
            color: #dc2626;
            font-size: 48px;
            position: absolute;
            left: 100px;
            top: 100px;
            width: 840px;
          }
        </style>
      </head>
      <body>
        <div class="slide-canvas" style="width:1600px;height:900px;">
          <h1 class="ordered-title">Order Validation</h1>
        </div>
      </body>
    </html>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await expect.poll(async () => headingLayer.evaluate((node) => window.getComputedStyle(node).color)).toContain('220, 38, 38')
    await expect.poll(async () => headingLayer.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(45)
  })

  test('SLD-FE-302 toolbar controls use icon glyphs with tooltips and compact button modifier', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <h1 style="position:absolute;left:80px;top:90px;width:600px;">Toolbar Icons</h1>
      <div class="card" style="position:absolute;left:80px;top:260px;width:320px;height:180px;">Card 1</div>
      <div class="card" style="position:absolute;left:440px;top:260px;width:320px;height:180px;">Card 2</div>
      <div class="card" style="position:absolute;left:800px;top:260px;width:320px;height:180px;">Card 3</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const toolbarControls = [
      'Undo',
      'Redo',
      'Align Left',
      'Align Center',
      'Align Right',
      'Align Top',
      'Align Middle',
      'Align Bottom',
      'Distribute Horizontally',
      'Distribute Vertically',
    ] as const

    for (const label of toolbarControls) {
      const control = page.getByRole('button', { name: label })
      await expect(control).toHaveAttribute('title', label)
      await expect(control).toHaveClass(/btn--compact/)
    }

    const nonCompactButtons = await page.locator('#main-content button.btn').evaluateAll((buttons) => (
      buttons
        .filter((button) => !button.className.includes('btn--compact'))
        .map((button) => button.getAttribute('aria-label') || button.textContent || '<unnamed>')
    ))
    expect(nonCompactButtons).toEqual([])
  })

  test('US-SLD-115 supports PowerPoint-style text and page alignment buttons', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1000px;height:600px;">
      <h1 style="position:absolute;left:100px;top:80px;width:300px;">Align Text</h1>
      <div class="card" style="position:absolute;left:500px;top:260px;width:180px;height:100px;">Card</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const heading = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await heading.click()
    await expect(page.getByRole('button', { name: 'Align Left', exact: true })).toBeDisabled()
    await page.locator('#slides-style-align').selectOption('center')
    await expect(page.locator('#slides-style-align')).toHaveValue('center')
    await expect.poll(async () => heading.evaluate((node) => window.getComputedStyle(node).textAlign)).toBe('center')

    const card = page.locator('.slides-canvas-component[data-component-type="card"]').first()
    await card.click({ modifiers: ['Shift'] })
    await expect(page.getByRole('button', { name: 'Align Left', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Align Left', exact: true }).click()
    await expect(card).toHaveAttribute('data-component-x', '100')
    await expect(heading).toHaveAttribute('data-component-x', '100')
  })

  test('US-SLD-021 supports drag movement and keyboard nudge on selected canvas layers', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <h1 style="position:absolute;left:100px;top:120px;width:800px;">Nudge Me</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-title').fill('Nudge Slide')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await headingLayer.locator('.slides-canvas-component-type').click()
    await expect(headingLayer).toHaveAttribute('data-component-selected', 'true')

    const beforeDragX = Number(await headingLayer.getAttribute('data-component-x'))
    const beforeDragY = Number(await headingLayer.getAttribute('data-component-y'))
    const dragHandle = headingLayer.locator('.slides-canvas-component-type')
    const dragHandleBox = await dragHandle.boundingBox()
    if (!dragHandleBox) throw new Error('expected drag handle bounding box')

    await page.mouse.move(dragHandleBox.x + dragHandleBox.width / 2, dragHandleBox.y + dragHandleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(dragHandleBox.x + dragHandleBox.width / 2 + 40, dragHandleBox.y + dragHandleBox.height / 2 + 24)
    await page.mouse.up()

    const afterDragX = Number(await headingLayer.getAttribute('data-component-x'))
    const afterDragY = Number(await headingLayer.getAttribute('data-component-y'))
    expect(afterDragX).toBeGreaterThan(beforeDragX)
    expect(afterDragY).toBeGreaterThan(beforeDragY)
    await expect(headingLayer).toHaveAttribute('data-component-dragging', 'false')

    const canvas = page.locator('[data-slide-canvas="1"]')
    await canvas.focus()
    await canvas.press('ArrowRight')
    await canvas.press('Shift+ArrowDown')

    await expect(headingLayer).toHaveAttribute('data-component-x', String(afterDragX + 1))
    await expect(headingLayer).toHaveAttribute('data-component-y', String(afterDragY + 10))
  })

  test('US-SLD-021 supports resize handles with width and height guardrails', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <div class="card" style="position:absolute;left:120px;top:160px;width:280px;height:180px;">Resizable card</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const cardLayer = page.locator('.slides-canvas-component[data-component-type="card"]').first()
    await cardLayer.click()
    const beforeWidth = Number(await cardLayer.getAttribute('data-component-width'))
    const beforeHeight = Number(await cardLayer.getAttribute('data-component-height'))

    const resizeHandle = cardLayer.locator('.slides-canvas-resize-handle')
    const resizeBox = await resizeHandle.boundingBox()
    if (!resizeBox) throw new Error('expected resize handle bounding box')

    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 64, resizeBox.y + resizeBox.height / 2 + 52)
    await page.mouse.up()

    const enlargedWidth = Number(await cardLayer.getAttribute('data-component-width'))
    const enlargedHeight = Number(await cardLayer.getAttribute('data-component-height'))
    expect(enlargedWidth).toBeGreaterThan(beforeWidth)
    expect(enlargedHeight).toBeGreaterThan(beforeHeight)

    const resizedHandleBox = await resizeHandle.boundingBox()
    if (!resizedHandleBox) throw new Error('expected resized handle bounding box')
    await page.mouse.move(resizedHandleBox.x + resizedHandleBox.width / 2, resizedHandleBox.y + resizedHandleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(resizedHandleBox.x + resizedHandleBox.width / 2 - 1000, resizedHandleBox.y + resizedHandleBox.height / 2 - 1000)
    await page.mouse.up()

    const minWidth = Number(await cardLayer.getAttribute('data-component-width'))
    const minHeight = Number(await cardLayer.getAttribute('data-component-height'))
    expect(minWidth).toBeGreaterThanOrEqual(48)
    expect(minHeight).toBeGreaterThanOrEqual(32)
  })

  test('US-SLD-123 applies, rejects, and resets safe canvas crop rectangles', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;background:#f8fafc;">
      <h1 style="position:absolute;left:200px;top:180px;width:700px;">Crop Target</h1>
      <div class="card" style="position:absolute;left:1460px;top:860px;width:360px;height:180px;background:#14b8a6;">Preserved Outside</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-crop-x').fill('100')
    await page.locator('#slides-crop-y').fill('80')
    await page.locator('#slides-crop-width').fill('1200')
    await page.locator('#slides-crop-height').fill('700')
    await page.getByRole('button', { name: 'Apply Crop' }).click()

    await expect(page.getByText(/Applied crop 1200 × 700 from 100, 80/)).toBeVisible()
    await expect(page.locator('[data-slide-canvas="1"]')).toHaveCSS('width', '1200px')
    await expect(page.locator('[data-slide-canvas="1"]')).toHaveCSS('height', '700px')
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await expect(headingLayer).toHaveAttribute('data-component-x', '100')
    await expect(headingLayer).toHaveAttribute('data-component-y', '100')
    await expect(page.getByText(/remain outside the visible bounds/i)).toBeVisible()

    await page.locator('#slides-crop-x').fill('1199')
    await page.locator('#slides-crop-y').fill('0')
    await page.locator('#slides-crop-width').fill('20')
    await page.locator('#slides-crop-height').fill('100')
    await page.getByRole('button', { name: 'Apply Crop' }).click()

    await expect(page.getByText(/Enter a valid crop rectangle inside the current canvas/)).toBeVisible()
    await expect(page.locator('[data-slide-canvas="1"]')).toHaveCSS('width', '1200px')

    await page.getByRole('button', { name: 'Reset Crop' }).click()
    await expect(page.getByText(/Reset crop and restored the pre-crop canvas/)).toBeVisible()
    await expect(page.locator('[data-slide-canvas="1"]')).toHaveCSS('width', '1920px')
    await expect(page.locator('[data-slide-canvas="1"]')).toHaveCSS('height', '1080px')
    await expect(headingLayer).toHaveAttribute('data-component-x', '200')
    await expect(headingLayer).toHaveAttribute('data-component-y', '180')

    await page.locator('#slides-crop-x').fill('100')
    await page.locator('#slides-crop-y').fill('80')
    await page.locator('#slides-crop-width').fill('1200')
    await page.locator('#slides-crop-height').fill('700')
    await page.getByRole('button', { name: 'Apply Crop' }).click()
    await expect(page.getByText(/Applied crop 1200 × 700 from 100, 80/)).toBeVisible()

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1200px;height:700px;">
      <h1 style="position:absolute;left:80px;top:80px;width:640px;">Post Crop New Slide</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Import as New Slide' }).click()
    await expect(page.getByTestId('slides-deck-strip')).toContainText('2 slides in the working deck.')
    await expect(page.getByRole('button', { name: 'Reset Crop' })).toBeDisabled()
    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const postCropMutationDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    expect(postCropMutationDocument.deck.slides).toHaveLength(2)
    expect(postCropMutationDocument.deck.slides[1]?.elements?.[0]?.content).toContain('Post Crop New Slide')

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;">
      <h1 style="position:absolute;left:80px;top:80px;width:640px;">Fresh Deck</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Import as New Deck' }).click()
    await expect(page.locator('[data-slide-canvas="1"]')).toHaveCSS('width', '1280px')
    await expect(page.getByRole('button', { name: 'Reset Crop' })).toBeDisabled()
  })

  test('SLD-FE-340 shows snapping guides and snaps dragged layers to nearby targets', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <h1 style="position:absolute;left:100px;top:120px;width:640px;">Alignment Target</h1>
      <div class="card" style="position:absolute;left:680px;top:420px;width:280px;height:180px;">Snap Me</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    const cardLayer = page.locator('.slides-canvas-component[data-component-type="card"]').first()
    const sourceX = Number(await cardLayer.getAttribute('data-component-x'))
    const sourceY = Number(await cardLayer.getAttribute('data-component-y'))
    const targetX = Number(await headingLayer.getAttribute('data-component-x'))
    const targetY = Number(await headingLayer.getAttribute('data-component-y'))
    const cardHandle = cardLayer.locator('.slides-canvas-component-type')
    await cardHandle.click()
    await expect(cardLayer).toHaveAttribute('data-component-selected', 'true')
    const cardHandleBox = await cardHandle.boundingBox()
    if (!cardHandleBox) throw new Error('expected card handle bounding box')
    const canvasScale = await page.locator('[data-slide-canvas="1"]').evaluate((node) => {
      const transform = window.getComputedStyle(node).transform
      if (!transform || transform === 'none') return 1
      return new DOMMatrixReadOnly(transform).a || 1
    })

    const startX = cardHandleBox.x + (cardHandleBox.width / 2)
    const startY = cardHandleBox.y + (cardHandleBox.height / 2)
    const dragToX = startX + ((targetX - sourceX + 3) * canvasScale)
    const dragToY = startY + ((targetY - sourceY + 3) * canvasScale)

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(dragToX, dragToY, { steps: 6 })

    await page.mouse.up()
    await expect(page.locator('[data-snap-guide-axis="x"]')).toHaveCount(0)
    await expect(page.locator('[data-snap-guide-axis="y"]')).toHaveCount(0)
    await expect(cardLayer).toHaveAttribute('data-component-x', '100')
    await expect(cardLayer).toHaveAttribute('data-component-y', '120')
  })

  test('US-SLD-022 inline text editing and toolbar style controls update selected layers', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <h1 style="position:absolute;left:100px;top:120px;width:800px;">Toolbar Target</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await headingLayer.click()
    await page.locator('[data-slide-canvas="1"]').focus()
    await page.keyboard.press('Enter')

    const headingContent = headingLayer.locator('.slides-canvas-component-content')
    await expect(headingContent).toHaveAttribute('contenteditable', 'true')
    await headingContent.click()
    await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+A`)
    await page.keyboard.type('Toolbar Edited Heading')
    await headingContent.evaluate((node) => (node as HTMLElement).blur())
    await page.locator('#slides-style-font-size').click()
    await page.locator('#slides-style-font-size').fill('10')
    await page.locator('#slides-style-align').selectOption('center')

    await expect(page.getByText(/Save status: dirty/i)).toBeVisible()
    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const parsed = parsedDocument.deck.slides[0].elements
    const editedHeading = parsed.find((entry: { type?: string; content?: string }) => entry.type === 'heading')
    expect(String(editedHeading?.content || '')).toContain('Toolbar Edited Heading')
    expect(Number(editedHeading?.style?.fontSize)).toBe(14)
    expect(String(editedHeading?.style?.textAlign || '')).toBe('center')
  })

  test('US-O30 inspector bounds and text auto-size keep advanced layer editing deterministic', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <h1 style="position:absolute;left:100px;top:120px;width:360px;height:48px;">Auto Size Target</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await headingLayer.click()
    await expect(page.locator('#slides-style-x')).toHaveValue('100')
    await expect(page.locator('#slides-style-y')).toHaveValue('120')

    await page.locator('#slides-style-x').fill('160')
    await expect(headingLayer).toHaveAttribute('data-component-x', '160')

    const beforeKeyboardResizeWidth = Number(await headingLayer.getAttribute('data-component-width'))
    await page.locator('[data-slide-canvas="1"]').focus()
    await page.keyboard.press('Alt+ArrowRight')
    await expect(headingLayer).toHaveAttribute('data-component-width', String(beforeKeyboardResizeWidth + 1))

    await page.locator('#slides-style-width').fill('220')
    await expect(headingLayer).toHaveAttribute('data-component-width', '220')

    await page.locator('#slides-style-text-auto-size').check()
    await expect(headingLayer).toHaveAttribute('data-component-auto-size', 'true')
    await expect(page.locator('#slides-style-height')).toBeDisabled()

    const beforeAutoSizeHeight = Number(await headingLayer.getAttribute('data-component-height'))
    await headingLayer.dblclick()
    const headingContent = headingLayer.locator('.slides-canvas-component-content')
    await headingContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type('Auto-sizing should grow this layer height as this sentence wraps across multiple lines in the slide editor canvas. Auto-sizing should continue expanding when the content repeats with enough density to exceed the original heading bounds by a clear margin.')
    await page.locator('#slides-title').click()

    await expect.poll(async () => Number(await headingLayer.getAttribute('data-component-height'))).toBeGreaterThan(beforeAutoSizeHeight)

    await headingLayer.dblclick()
    await headingContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type('short')
    await page.locator('#slides-title').click()
    await expect.poll(async () => Number(await headingLayer.getAttribute('data-component-height'))).toBeGreaterThanOrEqual(40)
  })

  test('US-SLD-062 applies stack, grid, and pinned layout constraints from the editor inspector', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;background:#ffffff;">
      <h1 style="position:absolute;left:100px;top:100px;width:260px;">Constraint One</h1>
      <h2 style="position:absolute;left:520px;top:220px;width:220px;">Constraint Two</h2>
      <div style="position:absolute;left:860px;top:320px;width:240px;height:140px;background:#e2e8f0;">Constraint Three</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const layers = page.locator('.slides-canvas-component')
    await layers.nth(0).click()
    await layers.nth(1).click({ modifiers: ['Shift'] })
    await layers.nth(2).click({ modifiers: ['Shift'] })

    await page.locator('#slides-layout-constraint-type').selectOption('stack')
    await page.getByRole('button', { name: 'Align Layout Center' }).click()
    await page.locator('#slides-layout-constraint-gap').fill('20')
    await page.getByRole('button', { name: 'Apply Layout' }).click()
    await expect(page.getByText(/Applied stack constraint to 3 layer/)).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    let parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const stacked = parsedDocument.deck.slides[0].elements
    expect(stacked[0].layoutConstraint.type).toBe('stack')
    expect(stacked[1].y).toBe(stacked[0].y + stacked[0].height + 20)
    expect(stacked[2].y).toBe(stacked[1].y + stacked[1].height + 20)

    await page.locator('#slides-layout-constraint-type').selectOption('grid')
    await page.locator('#slides-layout-constraint-gap').fill('24')
    await page.locator('#slides-layout-constraint-columns').fill('2')
    await page.getByRole('button', { name: 'Apply Layout' }).click()
    await expect(page.getByText(/Applied grid constraint to 3 layer/)).toBeVisible()

    parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const gridded = parsedDocument.deck.slides[0].elements
    expect(gridded[0].layoutConstraint.type).toBe('grid')
    expect(gridded[1].x).toBeGreaterThan(gridded[0].x)
    expect(gridded[2].y).toBeGreaterThan(gridded[0].y)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;background:#ffffff;">
      <div style="position:absolute;left:1040px;top:620px;width:180px;height:60px;background:#e2e8f0;">Pinned Footer</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('.slides-canvas-component').first().click()
    await page.locator('#slides-layout-constraint-type').selectOption('pinned')
    await page.getByRole('button', { name: 'Apply Layout' }).click()

    parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const pinned = parsedDocument.deck.slides[0].elements.find((component: { content?: string }) => String(component.content || '').includes('Pinned Footer'))
    expect(pinned?.layoutConstraint?.type).toBe('pinned')
    expect(['left', 'center', 'right']).toContain(pinned?.layoutConstraint?.anchorX)
    expect(['top', 'center', 'bottom']).toContain(pinned?.layoutConstraint?.anchorY)
  })

  test('US-SLD-063 exports active slide HTML with canonical dimensions', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;background:#ffffff;">
      <h1 style="position:absolute;left:100px;top:90px;width:700px;">Reveal Intro</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;background:#e2e8f0;">
      <p style="position:absolute;left:120px;top:180px;width:520px;">Reveal Details</p>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Import as New Slide' }).click()
    await expect(page.getByText(/Imported HTML as a new slide in the current deck\./)).toBeVisible()

    await page.getByRole('button', { name: 'Generate HTML Export' }).click()
    const exportedHtml = await page.locator('#slides-export-html').inputValue()

    expect(exportedHtml).toContain('data-oliver-slide-id=')
    expect(exportedHtml).toContain('width:1280px')
    expect(exportedHtml).toContain('height:720px')
    expect(exportedHtml).toContain('Reveal Intro')
  })

  test('US-SLD-133 shows retry guidance when PDF export popup is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      window.open = () => null
    })

    await gotoSlidesWorkspace(page)
    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;background:#ffffff;">
      <h1 style="position:absolute;left:120px;top:100px;width:640px;">PDF Retry Guidance</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.getByRole('button', { name: 'Export PDF (Print)' }).click()
    await expect(page.getByText(/PDF export failed\./)).toBeVisible()
    await expect(page.getByText(/Retry after enabling pop-ups/)).toBeVisible()
    await expect(page.getByText(/use HTML export and browser print as fallback/i)).toBeVisible()
  })

  test('US-SLD-023 supports shift multi-select, group nudge, align, and distribution feedback', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <div class="card" style="position:absolute;left:100px;top:100px;width:240px;height:140px;">A</div>
      <div class="card" style="position:absolute;left:480px;top:220px;width:240px;height:140px;">B</div>
      <div class="card" style="position:absolute;left:900px;top:320px;width:240px;height:140px;">C</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const cards = page.locator('.slides-canvas-component[data-component-type="card"]')
    await cards.nth(0).evaluate((node) => (node as HTMLElement).click())
    await cards.nth(1).evaluate((node) => {
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    })
    await cards.nth(2).click({ modifiers: ['Shift'] })

    await expect(page.locator('.slides-canvas-component[data-component-selected="true"]')).toHaveCount(3)
    const beforeX = [
      Number(await cards.nth(0).getAttribute('data-component-x')),
      Number(await cards.nth(1).getAttribute('data-component-x')),
      Number(await cards.nth(2).getAttribute('data-component-x')),
    ]

    await page.locator('[data-slide-canvas="1"]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(cards.nth(0)).toHaveAttribute('data-component-x', String(beforeX[0] + 1))
    await expect(cards.nth(1)).toHaveAttribute('data-component-x', String(beforeX[1] + 1))
    await expect(cards.nth(2)).toHaveAttribute('data-component-x', String(beforeX[2] + 1))

    await page.getByRole('button', { name: 'Align Top' }).click()
    const yValues = [
      Number(await cards.nth(0).getAttribute('data-component-y')),
      Number(await cards.nth(1).getAttribute('data-component-y')),
      Number(await cards.nth(2).getAttribute('data-component-y')),
    ]
    expect(new Set(yValues).size).toBe(1)

    await page.getByRole('button', { name: 'Distribute Horizontally' }).click()
    const xAfterDistribution = [
      Number(await cards.nth(0).getAttribute('data-component-x')),
      Number(await cards.nth(1).getAttribute('data-component-x')),
      Number(await cards.nth(2).getAttribute('data-component-x')),
    ]
    const gapA = xAfterDistribution[1] - xAfterDistribution[0]
    const gapB = xAfterDistribution[2] - xAfterDistribution[1]
    expect(Math.abs(gapA - gapB)).toBeLessThanOrEqual(2)

    await cards.nth(0).click()
    await page.getByRole('button', { name: 'Distribute Vertically' }).click()
    await expect(page.getByText('Select at least three layers to distribute spacing.')).toBeVisible()
  })

  test('US-SLD-024 undo and redo work via controls and keyboard shortcuts', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <h1 style="position:absolute;left:100px;top:120px;width:800px;">Undo Redo</h1>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const layer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await layer.click()

    const undoButton = page.getByRole('button', { name: 'Undo' })
    const redoButton = page.getByRole('button', { name: 'Redo' })
    await expect(undoButton).toBeDisabled()
    await expect(redoButton).toBeDisabled()

    await page.locator('[data-slide-canvas="1"]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(undoButton).toBeEnabled()

    const movedX = Number(await layer.getAttribute('data-component-x'))
    await undoButton.click()
    await expect(layer).toHaveAttribute('data-component-x', String(movedX - 1))
    await expect(redoButton).toBeEnabled()

    await redoButton.click()
    await expect(layer).toHaveAttribute('data-component-x', String(movedX))

    await page.keyboard.press('ControlOrMeta+Z')
    await expect(layer).toHaveAttribute('data-component-x', String(movedX - 1))
    await page.keyboard.press('ControlOrMeta+Shift+Z')
    await expect(layer).toHaveAttribute('data-component-x', String(movedX))
  })

  test('US-SLD-065 provides layer stack ordering controls', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class=\"slide-canvas\" style=\"width:1920px;height:1080px;\">
      <div class=\"card\" style=\"position:absolute;left:120px;top:120px;width:360px;height:180px;\">Front</div>
      <div class=\"card\" style=\"position:absolute;left:160px;top:160px;width:360px;height:180px;\">Middle</div>
      <div class=\"card\" style=\"position:absolute;left:200px;top:200px;width:360px;height:180px;\">Back</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const cards = page.locator('.slides-canvas-component[data-component-type=\"card\"]')
    const targetCard = cards.filter({ hasText: 'Front' }).first()
    const targetId = await targetCard.getAttribute('data-component-id')
    expect(targetId).toBeTruthy()
    await targetCard.evaluate((node) => (node as HTMLElement).click())
    await expect(targetCard).toHaveAttribute('data-component-selected', 'true')

    await page.getByRole('button', { name: 'Bring to Front' }).click()
    const afterFront = await cards.evaluateAll((entries) => entries.map((entry) => entry.getAttribute('data-component-id')))
    expect(afterFront[afterFront.length - 1]).toBe(targetId)

    await page.getByRole('button', { name: 'Send to Back' }).click()
    const afterBack = await cards.evaluateAll((entries) => entries.map((entry) => entry.getAttribute('data-component-id')))
    expect(afterBack[0]).toBe(targetId)

  })

  test('US-SLD-114 enforces grouping, step z-order controls, and locked-group immutability', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class=\"slide-canvas\" style=\"width:1920px;height:1080px;\">
      <div class=\"card\" style=\"position:absolute;left:120px;top:120px;width:280px;height:160px;\">Group A</div>
      <div class=\"card\" style=\"position:absolute;left:480px;top:240px;width:280px;height:160px;\">Group B</div>
      <div class=\"card\" style=\"position:absolute;left:860px;top:320px;width:280px;height:160px;\">Other</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const cards = page.locator('.slides-canvas-component[data-component-type=\"card\"]')
    await cards.nth(0).click()
    await cards.nth(1).click({ modifiers: ['Shift'] })
    await page.getByRole('button', { name: 'Group Selection', exact: true }).click()
    await expect(page.getByText('Grouped 2 layer(s).')).toBeVisible()

    await cards.nth(0).click()
    await expect(page.locator('.slides-canvas-component[data-component-selected=\"true\"]')).toHaveCount(2)
    const groupedBefore = [
      Number(await cards.nth(0).getAttribute('data-component-x')),
      Number(await cards.nth(1).getAttribute('data-component-x')),
    ]
    await page.locator('[data-slide-canvas=\"1\"]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(cards.nth(0)).toHaveAttribute('data-component-x', String(groupedBefore[0] + 1))
    await expect(cards.nth(1)).toHaveAttribute('data-component-x', String(groupedBefore[1] + 1))

    await page.getByRole('button', { name: 'Lock Selection', exact: true }).click()
    await expect(page.getByText('Locked 2 layer(s).')).toBeVisible()
    const lockedBefore = Number(await cards.nth(0).getAttribute('data-component-x'))
    await page.locator('[data-slide-canvas=\"1\"]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(cards.nth(0)).toHaveAttribute('data-component-x', String(lockedBefore))

    await page.getByRole('button', { name: 'Unlock Selection', exact: true }).click()
    await expect(page.getByText('Unlocked 2 layer(s).')).toBeVisible()
    await page.getByRole('button', { name: 'Ungroup Selection', exact: true }).click()
    await expect(page.getByText('Ungrouped 1 group(s).')).toBeVisible()
    await cards.nth(0).click()
    await page.locator('[data-slide-canvas=\"1\"]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(cards.nth(0)).toHaveAttribute('data-component-x', String(lockedBefore + 1))
    await expect(cards.nth(1)).toHaveAttribute('data-component-x', String(groupedBefore[1] + 1))

    await cards.nth(2).click()
    const idsBefore = await cards.evaluateAll((entries) => entries.map((entry) => entry.getAttribute('data-component-id')))
    await page.getByRole('button', { name: 'Send Back' }).click()
    const idsAfterSendBack = await cards.evaluateAll((entries) => entries.map((entry) => entry.getAttribute('data-component-id')))
    const movedId = idsBefore[2]
    expect(idsAfterSendBack[1]).toBe(movedId)
    await page.getByRole('button', { name: 'Bring Forward' }).click()
    const idsAfterBringForward = await cards.evaluateAll((entries) => entries.map((entry) => entry.getAttribute('data-component-id')))
    expect(idsAfterBringForward[2]).toBe(movedId)
  })

  test('US-SLD-070 adapts constrained layouts intelligently across aspect-ratio changes', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;background:#ffffff;">
      <h1 style="position:absolute;left:120px;top:120px;width:240px;">Adaptive One</h1>
      <p style="position:absolute;left:140px;top:240px;width:220px;">Adaptive Two</p>
      <div style="position:absolute;left:1080px;top:620px;width:120px;height:40px;">Pinned Footer</div>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const layers = page.locator('.slides-canvas-component')
    await layers.nth(0).evaluate((node) => (node as HTMLElement).click())
    await layers.nth(1).evaluate((node) => {
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    })
    await page.locator('#slides-layout-constraint-type').selectOption('stack')
    await page.getByRole('button', { name: 'Align Layout Center' }).click()
    await page.locator('#slides-layout-constraint-gap').fill('24')
    await page.getByRole('button', { name: 'Apply Layout' }).click()

    await layers.nth(2).evaluate((node) => (node as HTMLElement).click())
    await page.locator('#slides-layout-constraint-type').selectOption('pinned')
    await page.getByRole('button', { name: 'Apply Layout' }).click()

    await page.locator('#slides-canvas-width').fill('1080')
    await page.locator('#slides-canvas-height').fill('1080')
    await page.getByRole('button', { name: 'Adapt Layout Responsively' }).click()
    await expect(page.getByText(/Adapted canvas to 1080 × 1080 with responsive layout constraints/)).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const elements = parsedDocument.deck.slides[0].elements
    const heading = elements.find((entry: { content?: string }) => String(entry.content || '').includes('Adaptive One'))
    const body = elements.find((entry: { content?: string }) => String(entry.content || '').includes('Adaptive Two'))
    const pinned = elements.find((entry: { content?: string }) => String(entry.content || '').includes('Pinned Footer'))

    expect(parsedDocument.deck.width).toBe(1080)
    expect(parsedDocument.deck.height).toBe(1080)
    expect(heading.layoutConstraint.type).toBe('stack')
    expect(body.y).toBe(heading.y + heading.height + 24)
    expect(pinned.layoutConstraint.type).toBe('pinned')
    expect(pinned.x).toBe(880)
    expect(pinned.y).toBe(980)
  })

  test('US-SLD-121 supports canvas presets, custom dimensions, and undoable resize actions', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1280px;height:720px;background:#ffffff;">
      <h1 style="position:absolute;left:120px;top:120px;width:240px;">Preset Story Title</h1>
      <p style="position:absolute;left:140px;top:240px;width:220px;">Body content persists</p>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const baseline = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const baselineTitle = baseline.deck.slides[0].elements.find((entry: { content?: string }) => String(entry.content || '').includes('Preset Story Title'))
    expect(baselineTitle).toBeTruthy()

    await page.getByRole('button', { name: '4:3' }).click()
    await expect(page.locator('#slides-canvas-width')).toHaveValue('1600')
    await expect(page.locator('#slides-canvas-height')).toHaveValue('1200')

    await page.getByRole('button', { name: '1:1' }).click()
    await expect(page.locator('#slides-canvas-width')).toHaveValue('1080')
    await expect(page.locator('#slides-canvas-height')).toHaveValue('1080')

    await page.locator('#slides-canvas-width').fill('1366')
    await page.locator('#slides-canvas-height').fill('768')
    await page.getByRole('button', { name: 'Resize Canvas Proportionally' }).click()
    await expect(page.getByText(/Resized canvas to 1366 × 768 with proportional layer scaling\./)).toBeVisible()
    if (await page.getByRole('button', { name: 'Show Raw JSON' }).isVisible()) {
      await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    }

    const resized = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    expect(resized.deck.width).toBe(1366)
    expect(resized.deck.height).toBe(768)
    expect(resized.deck.slides[0].elements).toHaveLength(2)
    const resizedTitle = resized.deck.slides[0].elements.find((entry: { content?: string }) => String(entry.content || '').includes('Preset Story Title'))
    expect(resizedTitle).toBeTruthy()
    expect(resizedTitle.x).not.toBe(baselineTitle.x)

    await page.getByRole('button', { name: 'Undo' }).click()
    const reverted = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    expect(reverted.deck.slides[0].elements).toHaveLength(2)
    const revertedTitle = reverted.deck.slides[0].elements.find((entry: { content?: string }) => String(entry.content || '').includes('Preset Story Title'))
    expect(revertedTitle).toBeTruthy()
    expect(revertedTitle.x).toBe(baselineTitle.x)
    expect(reverted.deck.width).toBe(1366)
    expect(reverted.deck.height).toBe(768)
  })

  test('US-SLD-025 exposes keyboard-first workflows, semantic canvas roles, and shortcut help', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;">
      <h1 style="position:absolute;left:100px;top:120px;width:800px;">Keyboard One</h1>
      <h2 style="position:absolute;left:140px;top:260px;width:760px;">Keyboard Two</h2>
    </div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const canvas = page.locator('[data-slide-canvas="1"]')
    await expect(canvas).toHaveAttribute('role', 'listbox')
    await expect(canvas).toHaveAttribute('aria-multiselectable', 'true')

    await page.locator('.slides-shortcuts summary').click()
    await expect(page.getByText(/Ctrl\/Cmd\+Z undo/)).toBeVisible()

    await canvas.focus()
    await page.keyboard.press('PageDown')
    const selectedLayer = page.locator('.slides-canvas-component[data-component-selected="true"]').first()
    await expect(selectedLayer).toBeVisible()

    await page.keyboard.press('Enter')
    const selectedContent = selectedLayer.locator('.slides-canvas-component-content')
    await expect(selectedContent).toHaveAttribute('contenteditable', 'true')
    await selectedContent.press('Escape')
    await expect(selectedContent).toHaveAttribute('contenteditable', 'false')
  })

  test('US-SLD-027 locked layers remain immutable across edit controls while unlocked layers still update', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [
          {
            id: 'locked-slide-1',
            owner_user_id: 'qa-admin-user',
            title: 'Locked Behavior',
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'locked-heading',
                type: 'heading',
                sourceLabel: '.locked-heading',
                x: 100,
                y: 120,
                width: 760,
                content: 'Locked Title',
                style: { fontSize: 36, fontWeight: 700, color: '#0f172a' },
                locked: true,
                visible: true,
              },
              {
                id: 'editable-card',
                type: 'card',
                sourceLabel: '.editable-card',
                x: 160,
                y: 360,
                width: 460,
                height: 220,
                content: 'Editable Body',
                style: { fontSize: 24, color: '#1f2937', backgroundColor: '#f8fafc' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            revision: 1,
            source: 'import',
            source_template_id: null,
            created_at: '2026-04-25T00:00:00.000Z',
            updated_at: '2026-04-25T00:00:00.000Z',
            last_edited_at: '2026-04-25T00:00:00.000Z',
          },
        ],
        templates: [],
        audits: [],
        nextAuditId: 1,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await page.getByText('Locked Behavior').first().waitFor()
    await page.getByRole('button', { name: 'Load', exact: true }).first().click()
    await expect(page.getByText(/Canvas: 1920 × 1080/)).toBeVisible()

    const lockedLayer = page.locator('.slides-canvas-component[data-component-id="locked-heading"]').first()
    const editableLayer = page.locator('.slides-canvas-component[data-component-id="editable-card"]').first()
    const canvas = page.locator('[data-slide-canvas="1"]')

    await lockedLayer.click()
    await expect(lockedLayer).toHaveAttribute('data-component-locked', 'true')
    await expect(lockedLayer.locator('.slides-canvas-resize-handle')).toHaveCount(0)
    await canvas.focus()
    await canvas.press('Enter')
    await expect(lockedLayer.locator('.slides-canvas-component-content')).toHaveAttribute('contenteditable', 'false')

    await lockedLayer.click()
    await editableLayer.click({ modifiers: ['Shift'] })
    await expect(page.locator('.slides-canvas-component[data-component-selected="true"]')).toHaveCount(2)

    const lockedBeforeX = Number(await lockedLayer.getAttribute('data-component-x'))
    const editableBeforeX = Number(await editableLayer.getAttribute('data-component-x'))

    await canvas.focus()
    await canvas.press('ArrowRight')
    await expect(lockedLayer).toHaveAttribute('data-component-x', String(lockedBeforeX))
    await expect(editableLayer).toHaveAttribute('data-component-x', String(editableBeforeX + 1))

    await page.locator('#slides-style-font-size').fill('50')
    await expect(page.getByText('Locked layers were skipped.')).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}')) as { deck: { slides: Array<{ elements: Array<{
      id: string
      style?: { fontSize?: number }
    }> }> } }
    const parsed = parsedDocument.deck.slides[0].elements
    const byId = new Map(parsed.map((entry) => [entry.id, entry] as const))
    expect(Number(byId.get('locked-heading')?.style?.fontSize)).toBe(36)
    expect(Number(byId.get('editable-card')?.style?.fontSize)).toBe(50)
  })

  test('US-SLD-031 and US-SLD-032 save workflow populates My Slides and template duplication', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Saved Slide</h1></div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-title').fill('Q2 Narrative')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await expect(page.getByText('Q2 Narrative')).toBeVisible()
    await page.getByRole('button', { name: 'Duplicate' }).first().click()
    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await expect(page.getByText(/Q2 Narrative \(Copy\)/)).toBeVisible()

    await page.getByRole('button', { name: 'Template Library', exact: true }).click()
    await expect(page.getByText('Hero + Metric Row')).toBeVisible()
    await page.getByRole('button', { name: 'Duplicate to My Slides' }).first().click()

    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await expect(page.locator('.slides-library-card')).toHaveCount(3)
  })

  test('US-SLD-060 publishes reusable templates with locked/editable structure and preserves template metadata on derived slides', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [
          {
            id: 'slide-template-source',
            owner_user_id: 'qa-admin-user',
            title: 'Template Source Slide',
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'template-locked-heading',
                type: 'heading',
                sourceLabel: '.template-locked-heading',
                x: 100,
                y: 120,
                width: 760,
                content: 'Locked Title',
                style: { fontSize: 36, fontWeight: 700, color: '#0f172a' },
                locked: true,
                visible: true,
              },
              {
                id: 'template-editable-body',
                type: 'body',
                sourceLabel: '.template-editable-body',
                x: 140,
                y: 320,
                width: 920,
                content: 'Editable narrative',
                style: { fontSize: 24, color: '#1f2937' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            revision: 1,
            source: 'import',
            source_template_id: null,
            created_at: '2026-04-27T00:00:00.000Z',
            updated_at: '2026-04-27T00:00:00.000Z',
            last_edited_at: '2026-04-27T00:00:00.000Z',
          },
        ],
        templates: [],
        audits: [],
        nextAuditId: 1,
      }))
    })

    await gotoSlidesWorkspace(page)

    const templateName = `Reusable Structured Template ${Date.now().toString(36)}`
    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await page.getByRole('button', { name: 'Publish Template' }).first().click()
    await page.locator('#slides-template-name').fill(templateName)
    await page.locator('#slides-template-description').fill('US-SLD-060 verification template')
    await page.getByRole('button', { name: 'Confirm Publish Template' }).click()

    await page.getByRole('button', { name: 'Template Library', exact: true }).click()
    const templateCard = page.locator('.slides-library-card', { hasText: templateName }).first()
    await expect(templateCard).toBeVisible()
    await expect(templateCard.getByText(/Template structure:\s*1 locked · 1 editable zones · 2 blocks/i)).toBeVisible()
    await templateCard.getByRole('button', { name: 'Duplicate to My Slides' }).click()

    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await expect(page.getByText(`${templateName} (Copy)`)).toBeVisible()

    const duplicatedStore = await page.evaluate(() => JSON.parse(window.localStorage.getItem('oliver-slides-store-v1') || '{}'))
    const derivedSlide = duplicatedStore.slides.find((slide: { title?: string }) => slide.title === `${templateName} (Copy)`)
    expect(derivedSlide?.source).toBe('template')
    expect(derivedSlide?.source_template_id).toBeTruthy()
    expect(derivedSlide?.metadata?.template_locked_element_ids).toEqual(['template-locked-heading'])
    expect(derivedSlide?.metadata?.template_editable_zone_ids).toEqual(['template-editable-body'])
    expect(derivedSlide?.metadata?.template_layout_blocks).toHaveLength(2)

    const copiedSlideCard = page.locator('.slides-library-card', { hasText: `${templateName} (Copy)` }).first()
    await copiedSlideCard.getByRole('button', { name: 'Load' }).click()
    await expect(page.getByText(/Canvas: 1920 × 1080/)).toBeVisible()

    const lockedLayer = page.locator('.slides-canvas-component[data-component-id="template-locked-heading"]').first()
    const editableLayer = page.locator('.slides-canvas-component[data-component-id="template-editable-body"]').first()
    const canvas = page.locator('[data-slide-canvas="1"]')

    await lockedLayer.click()
    await expect(lockedLayer).toHaveAttribute('data-component-locked', 'true')
    await expect(lockedLayer.locator('.slides-canvas-resize-handle')).toHaveCount(0)
    await canvas.focus()
    await canvas.press('Enter')
    await expect(lockedLayer.locator('.slides-canvas-component-content')).toHaveAttribute('contenteditable', 'false')

    await editableLayer.click()
    await page.locator('#slides-style-font-size').fill('44')
    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}')) as { deck: { slides: Array<{ elements: Array<{
      id: string
      style?: { fontSize?: number }
    }> }> } }
    const derivedElements = parsedDocument.deck.slides[0].elements
    const byId = new Map(derivedElements.map((entry) => [entry.id, entry] as const))
    expect(Number(byId.get('template-locked-heading')?.style?.fontSize)).toBe(36)
    expect(Number(byId.get('template-editable-body')?.style?.fontSize)).toBe(44)
  })

  test('US-SLD-061 applies brand themes to the current slide or full deck and only converts imported slides when requested', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('qa-auth-account', JSON.stringify({
        homeAccountId: 'qa-home-account',
        environment: 'qa.local',
        tenantId: 'qa-tenant',
        username: 'qa-admin@example.com',
        localAccountId: 'qa-local-account',
        name: 'QA Admin',
        idTokenClaims: {
          oid: 'qa-admin-user',
          sub: 'qa-admin-user',
        },
      }))
      window.localStorage.setItem('qa-app-user', JSON.stringify({
        user_id: 'qa-admin-user',
        email: 'qa-admin@example.com',
        name: 'QA Admin',
        role: 'admin',
        page_permissions: ['accounts', 'hr', 'sdr', 'crm', 'slides'],
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      }))
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [
          {
            id: 'slide-theme-source',
            owner_user_id: 'qa-admin-user',
            title: 'Theme Source Slide',
            canvas: { width: 1920, height: 1080, background: '#ffffff' },
            components: [
              {
                id: 'slide-theme-current-heading',
                type: 'heading',
                sourceLabel: '.current-heading',
                x: 120,
                y: 120,
                width: 820,
                height: 72,
                content: 'Current Slide Heading',
                style: { fontSize: 56, color: '#111827', fontFamily: 'Legacy Serif' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {
              slide_document: {
                version: 1,
                deck: {
                  id: 'deck-theme-1',
                  width: 1920,
                  height: 1080,
                  slides: [
                    {
                      id: 'deck-slide-1',
                      background: { fill: '#ffffff' },
                      elements: [
                        {
                          id: 'slide-theme-current-heading',
                          type: 'heading',
                          sourceLabel: '.current-heading',
                          x: 120,
                          y: 120,
                          width: 820,
                          height: 72,
                          content: 'Current Slide Heading',
                          style: { fontSize: 56, color: '#111827', fontFamily: 'Legacy Serif' },
                          locked: false,
                          visible: true,
                        },
                      ],
                    },
                    {
                      id: 'deck-slide-2',
                      background: { fill: '#ffffff' },
                      elements: [
                        {
                          id: 'slide-theme-second-heading',
                          type: 'heading',
                          sourceLabel: '.second-heading',
                          x: 120,
                          y: 120,
                          width: 820,
                          height: 72,
                          content: 'Second Slide Heading',
                          style: { fontSize: 56, color: '#111827', fontFamily: 'Legacy Serif' },
                          locked: false,
                          visible: true,
                        },
                      ],
                    },
                  ],
                },
                warnings: [],
              },
              active_document_slide_id: 'deck-slide-1',
            },
            revision: 1,
            source: 'import',
            source_template_id: null,
            created_at: '2026-04-27T00:00:00.000Z',
            updated_at: '2026-04-27T00:00:00.000Z',
            last_edited_at: '2026-04-27T00:00:00.000Z',
          },
        ],
        templates: [],
        audits: [],
        nextAuditId: 1,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await page.getByRole('button', { name: 'Load', exact: true }).first().click()
    await expect(page.getByText(/Canvas: 1920 × 1080/)).toBeVisible()

    await page.locator('#slides-theme-heading-font').fill('Brand Display')
    await page.locator('#slides-theme-body-font').fill('Brand Sans')
    await page.locator('#slides-theme-primary').fill('#7c3aed')
    await page.locator('#slides-theme-background').fill('#fef3c7')
    await page.locator('#slides-theme-scope').selectOption('slide')
    await page.getByRole('button', { name: 'Apply Theme' }).click()
    await expect(page.getByText(/Only already linked components were updated/i)).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    let parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    expect(String(parsedDocument.deck.slides[0].elements[0].style.fontFamily || '')).toContain('Legacy Serif')
    expect(String(parsedDocument.deck.slides[1].elements[0].style.fontFamily || '')).toContain('Legacy Serif')

    await page.locator('#slides-theme-convert-imported').check()
    await page.getByRole('button', { name: 'Apply Theme' }).click()
    await expect(page.getByText(/Imported components were converted to theme-linked styles/i)).toBeVisible()

    parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    expect(String(parsedDocument.theme.fonts.heading || '')).toContain('Brand Display')
    expect(String(parsedDocument.deck.slides[0].elements[0].style.fontFamily || '')).toContain('Brand Display')
    expect(String(parsedDocument.deck.slides[0].elements[0].style.color || '')).toContain('#7c3aed')
    expect(parsedDocument.deck.slides[0].elements[0].themeLinked).toBe(true)
    expect(String(parsedDocument.deck.slides[1].elements[0].style.fontFamily || '')).toContain('Legacy Serif')

    await page.getByTestId('slides-deck-tab-2').click()
    await page.locator('#slides-theme-primary').fill('#0ea5e9')
    await page.locator('#slides-theme-scope').selectOption('deck')
    await page.getByRole('button', { name: 'Apply Theme' }).click()
    await expect(page.getByText(/Applied theme to the full deck/i)).toBeVisible()

    parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    expect(String(parsedDocument.deck.slides[0].elements[0].style.color || '')).toContain('#0ea5e9')
    expect(String(parsedDocument.deck.slides[1].elements[0].style.fontFamily || '')).toContain('Brand Display')
    expect(String(parsedDocument.deck.slides[1].elements[0].style.color || '')).toContain('#0ea5e9')
    expect(parsedDocument.deck.slides[1].elements[0].themeLinked).toBe(true)
  })

  test('SLD-FE-210 template search ranks best matches and quick preview supports duplicate flow', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [
          {
            id: 'template-rank-1',
            owner_user_id: 'qa-admin-user',
            name: 'Executive QBR Narrative',
            description: 'Board-level quarterly narrative.',
            is_shared: true,
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'rank-1-heading',
                type: 'heading',
                sourceLabel: '.heading',
                x: 120,
                y: 120,
                width: 900,
                content: 'Executive QBR Narrative',
                style: { fontSize: 56, color: '#0f172a' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            created_at: '2026-04-25T10:00:00.000Z',
            updated_at: '2026-04-25T10:00:00.000Z',
          },
          {
            id: 'template-rank-2',
            owner_user_id: 'qa-admin-user',
            name: 'Executive QBR Outline',
            description: 'Executive QBR talking points and timeline.',
            is_shared: true,
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'rank-2-panel',
                type: 'panel',
                sourceLabel: '.panel',
                x: 180,
                y: 240,
                width: 760,
                height: 360,
                content: '<h3>Executive QBR</h3><p>Summary</p>',
                style: { fontSize: 28, color: '#111827', backgroundColor: '#f8fafc' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            created_at: '2026-04-24T10:00:00.000Z',
            updated_at: '2026-04-24T10:00:00.000Z',
          },
          {
            id: 'template-rank-3',
            owner_user_id: 'qa-admin-user',
            name: 'Hiring Kickoff',
            description: 'People planning and role kickoff.',
            is_shared: false,
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'rank-3-text',
                type: 'text',
                sourceLabel: '.text',
                x: 120,
                y: 140,
                width: 860,
                content: 'Hiring Kickoff Plan',
                style: { fontSize: 40, color: '#0f172a' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            created_at: '2026-04-23T10:00:00.000Z',
            updated_at: '2026-04-23T10:00:00.000Z',
          },
          {
            id: 'template-no-preview',
            owner_user_id: 'qa-admin-user',
            name: 'No Preview Template',
            description: 'Template missing visual content.',
            is_shared: true,
            canvas: { width: 1920, height: 1080 },
            components: [],
            metadata: {},
            created_at: '2026-04-22T10:00:00.000Z',
            updated_at: '2026-04-22T10:00:00.000Z',
          },
        ],
        collaborators: [],
        approvals: [],
        audits: [],
        auditPresets: [],
        nextAuditId: 1,
        nextApprovalId: 1,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    await page.locator('#slides-search').fill('executive qbr')
    await expect(page.getByText('Showing 2 template matches sorted by relevance.')).toBeVisible()

    const rankedCards = page.locator('.slides-library-card')
    await expect(rankedCards).toHaveCount(2)
    const bestMatchCard = page.locator('.slides-library-card', { hasText: 'Executive QBR Outline' }).first()
    await expect(bestMatchCard.getByText('Best match')).toBeVisible()

    await bestMatchCard.getByRole('button', { name: 'Quick Preview' }).click()
    const previewDialog = page.getByRole('dialog', { name: 'Quick Preview: Executive QBR Outline' })
    await expect(previewDialog).toBeVisible()
    await expect(previewDialog.getByText('Best match')).toBeVisible()

    await previewDialog.getByRole('button', { name: 'Duplicate to My Slides' }).click()
    await expect(page.locator('#slides-title')).toHaveValue('Executive QBR Outline (Copy)')

    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await expect(page.getByText('Executive QBR Outline (Copy)')).toBeVisible()

    await page.getByRole('button', { name: 'Template Library', exact: true }).click()
    await page.locator('#slides-search').fill('')
    const noPreviewCard = page.locator('.slides-library-card', { hasText: 'No Preview Template' }).first()
    await expect(noPreviewCard).toBeVisible()
    await expect(noPreviewCard.getByText('No preview components')).toBeVisible()
    await expect(noPreviewCard.getByText('Preview missing: no visible components captured.')).toBeVisible()
    await expect(noPreviewCard.getByRole('button', { name: 'Refresh Preview' })).toBeVisible()

    const outlineCard = page.locator('.slides-library-card', { hasText: 'Executive QBR Outline' }).first()
    await expect(outlineCard.getByText('Preview missing: backend snapshot has not been generated yet.')).toBeVisible()
    await outlineCard.getByRole('button', { name: 'Refresh Preview' }).click()
    await expect(outlineCard.getByText('Preview components: 1')).toBeVisible()
    await expect(outlineCard.getByRole('button', { name: 'Refresh Preview' })).toHaveCount(0)

    await noPreviewCard.getByRole('button', { name: 'Quick Preview' }).click()
    const noPreviewDialog = page.getByRole('dialog', { name: 'Quick Preview: No Preview Template' })
    await expect(noPreviewDialog).toBeVisible()
    await expect(noPreviewDialog.getByText('No preview components')).toBeVisible()
    await noPreviewDialog.getByRole('button', { name: 'Close Preview' }).click()
  })

  test('SLD-FE-400 and SLD-BE-400 support visibility controls and template ownership governance', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('oliver-slides-store-v1')
    })
    await gotoSlidesWorkspace(page)

    const unique = Date.now().toString(36)
    const templateName = `Governance Shared Template ${unique}`

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Template Governance</h1></div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-title').fill('Governance Slide')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await page.getByRole('button', { name: 'Publish Template' }).first().click()
    await page.locator('#slides-template-name').fill(templateName)
    await page.locator('#slides-template-description').fill('Governance test template')
    await page.locator('#slides-template-visibility').selectOption('shared')
    await page.getByRole('button', { name: 'Confirm Publish Template' }).click()

    await page.getByRole('button', { name: 'Template Library', exact: true }).click()
    const templateCard = page.locator('.slides-library-card', { hasText: templateName }).first()
    await expect(templateCard).toBeVisible()
    await expect(templateCard.locator('.slides-template-preview')).toBeVisible()
    await expect(templateCard.getByText(/Template structure:\s*0 locked · 1 editable zones · 1 blocks/i)).toBeVisible()
    await expect(templateCard.getByText(/Visibility:\s*Shared/i)).toBeVisible()
    await templateCard.getByRole('button', { name: 'Make Private' }).click()
    await expect(templateCard.getByText(/Visibility:\s*Private/i)).toBeVisible()

    const archiveCard = page.locator('.slides-library-card', { hasText: templateName }).first()
    await archiveCard.scrollIntoViewIfNeeded()
    await archiveCard.getByRole('button', { name: 'Make Shared' }).click()
    await expect(archiveCard.getByText(/Visibility:\s*Shared/i)).toBeVisible()

    await expect(archiveCard.getByRole('button', { name: 'Transfer Owner' })).toBeVisible()
    await expect(archiveCard.getByRole('button', { name: 'Manage Collaborators' })).toBeVisible()

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      await dialog.accept()
    })
    await archiveCard.getByRole('button', { name: 'Archive Template' }).click()
    await expect(page.getByText(new RegExp(`Archived \"${templateName}\"\\. Undo is available for 10 seconds\\.`))).toBeVisible()
    await expect(page.locator('.slides-library-card', { hasText: templateName }).getByRole('button', { name: 'Restore Template' })).toBeVisible()

    await page.getByRole('button', { name: 'Undo Archive' }).click()
    const restoredFromUndoCard = page.locator('.slides-library-card', { hasText: templateName }).first()
    await expect(restoredFromUndoCard).toBeVisible()

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      await dialog.accept()
    })
    await restoredFromUndoCard.getByRole('button', { name: 'Archive Template' }).click()
    const archivedSection = page.locator('.slides-template-draft', { hasText: 'Archived Templates' })
    await expect(archivedSection).toBeVisible()
    const archivedTemplateCard = page.locator('.slides-library-card', { hasText: templateName }).first()
    await expect(archivedTemplateCard.getByRole('button', { name: 'Restore Template' })).toBeVisible()

    await archivedTemplateCard.getByRole('button', { name: 'Restore Template' }).click()
    await expect(page.locator('.slides-library-card', { hasText: templateName }).first()).toBeVisible()

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      await dialog.accept()
    })
    await page.locator('.slides-library-card', { hasText: templateName }).first().getByRole('button', { name: 'Archive Template' }).click()
    const archivedAgainCard = page.locator('.slides-library-card', { hasText: templateName }).first()
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      await dialog.accept()
    })
    await archivedAgainCard.getByRole('button', { name: 'Delete Permanently' }).click()
    await expect(page.locator('.slides-library-card', { hasText: templateName })).toHaveCount(0)
  })

  test('SLD-FE-400 restricts shared-template publishing controls for non-admin users', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('oliver-slides-store-v1')
      window.localStorage.setItem('qa-app-user', JSON.stringify({
        user_id: 'qa-member-user',
        email: 'qa-member@example.com',
        name: 'QA Member',
        role: 'user',
        page_permissions: ['slides'],
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      }))
    })
    await gotoSlidesWorkspace(page)

    const unique = Date.now().toString(36)
    const templateName = `Member Private Template ${unique}`

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Member Template</h1></div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-title').fill('Member Slide')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await page.getByRole('button', { name: 'Publish Template' }).first().click()
    await expect(page.locator('#slides-template-visibility')).toBeDisabled()
    await expect(page.getByText(/Shared template publishing is restricted to admins/i)).toBeVisible()
    await page.locator('#slides-template-name').fill(templateName)
    await page.getByRole('button', { name: 'Confirm Publish Template' }).click()

    await page.getByRole('button', { name: 'Template Library', exact: true }).click()
    const templateCard = page.locator('.slides-library-card', { hasText: templateName }).first()
    await expect(templateCard).toBeVisible()
    await expect(templateCard.getByText(/Template structure:\s*0 locked · 1 editable zones · 1 blocks/i)).toBeVisible()
    await expect(templateCard.getByText(/Visibility:\s*Private/i)).toBeVisible()
    await expect(templateCard.getByRole('button', { name: 'Make Shared' })).toHaveCount(0)
  })

  test('SLD-FE-410 and SLD-BE-410 allow template ownership transfer with audit visibility', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [
          {
            id: 'template-transfer-1',
            owner_user_id: 'qa-admin-user',
            name: 'Transferable Template',
            description: 'Ownership handoff baseline.',
            is_shared: false,
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'component-1',
                type: 'text',
                sourceLabel: '.headline',
                x: 100,
                y: 120,
                width: 700,
                content: 'Template ownership transfer',
                style: { fontSize: 42, color: '#0f172a' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            created_at: '2026-04-24T10:00:00.000Z',
            updated_at: '2026-04-24T10:00:00.000Z',
          },
        ],
        audits: [],
        nextAuditId: 1,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    const templateCard = page.locator('.slides-library-card', { hasText: 'Transferable Template' }).first()
    await expect(templateCard.getByText(/Owner:\s*qa-admin-user/i)).toBeVisible()
    await templateCard.getByRole('button', { name: 'Transfer Owner' }).click()
    await templateCard.getByLabel('New Owner').fill('qa-new-owner@example.com')
    await templateCard.getByRole('button', { name: 'Confirm Transfer' }).click()
    await expect(templateCard.getByText(/Owner:\s*qa-new-owner@example.com/i)).toBeVisible()

    await openSlidesActivity(page)
    await page.locator('#slides-audit-action').selectOption('transfer-template')
    await expect(page.locator('.slides-library-card')).toHaveCount(1)
    await expect(page.locator('.slides-library-card h3')).toContainText('transfer-template')
  })

  test('SLD-FE-410 and SLD-BE-410 manage collaborator roles with audit events', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [
          {
            id: 'template-collab-1',
            owner_user_id: 'qa-admin-user',
            name: 'Collaborator Template',
            description: 'Collaborator management baseline.',
            is_shared: false,
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'component-1',
                type: 'text',
                sourceLabel: '.headline',
                x: 100,
                y: 120,
                width: 700,
                content: 'Collaborator workflow',
                style: { fontSize: 42, color: '#0f172a' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            created_at: '2026-04-24T10:00:00.000Z',
            updated_at: '2026-04-24T10:00:00.000Z',
          },
        ],
        collaborators: [],
        audits: [],
        nextAuditId: 1,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    const templateCard = page.locator('.slides-library-card', { hasText: 'Collaborator Template' }).first()
    await templateCard.getByRole('button', { name: 'Manage Collaborators' }).click()
    await templateCard.getByLabel('Collaborator').fill('qa-reviewer@example.com')
    await templateCard.getByLabel('Role').selectOption('reviewer')
    await templateCard.getByRole('button', { name: 'Save Collaborator' }).click()
    await expect(templateCard.getByText(/qa-reviewer@example.com · reviewer/i)).toBeVisible()

    await templateCard.getByRole('button', { name: 'Remove' }).click()
    await expect(templateCard.getByText(/No collaborators yet\./i)).toBeVisible()

    await openSlidesActivity(page)
    await page.locator('#slides-audit-action').selectOption('upsert-collaborator')
    await expect(page.locator('.slides-library-card')).toHaveCount(1)
    await page.locator('#slides-audit-action').selectOption('remove-collaborator')
    await expect(page.locator('.slides-library-card')).toHaveCount(1)
  })

  test('SLD-FE-410 and SLD-BE-410 route member ownership transfer through admin approvals', async ({ page }) => {
    await page.addInitScript(() => {
      const actor = window.localStorage.getItem('qa-test-actor') || 'user'
      if (actor === 'admin') {
        window.localStorage.setItem('qa-auth-account', JSON.stringify({
          homeAccountId: 'qa-home-account',
          environment: 'qa.local',
          tenantId: 'qa-tenant',
          username: 'qa-admin@example.com',
          localAccountId: 'qa-local-account',
          name: 'QA Admin',
          idTokenClaims: {
            oid: 'qa-admin-user',
            sub: 'qa-admin-user',
          },
        }))
        window.localStorage.setItem('qa-app-user', JSON.stringify({
          user_id: 'qa-admin-user',
          email: 'qa-admin@example.com',
          name: 'QA Admin',
          role: 'admin',
          page_permissions: ['accounts', 'hr', 'sdr', 'crm', 'slides'],
          created_at: '2026-04-24T00:00:00.000Z',
          updated_at: '2026-04-24T00:00:00.000Z',
        }))
        return
      }

      window.localStorage.setItem('qa-auth-account', JSON.stringify({
        homeAccountId: 'qa-member-home-account',
        environment: 'qa.local',
        tenantId: 'qa-tenant',
        username: 'qa-member@example.com',
        localAccountId: 'qa-member-local-account',
        name: 'QA Member',
        idTokenClaims: {
          oid: 'qa-member-user',
          sub: 'qa-member-user',
        },
      }))
      window.localStorage.setItem('qa-app-user', JSON.stringify({
        user_id: 'qa-member-user',
        email: 'qa-member@example.com',
        name: 'QA Member',
        role: 'user',
        page_permissions: ['slides'],
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.evaluate(() => {
      window.localStorage.setItem('qa-test-actor', 'member')
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [
          {
            id: 'template-transfer-approval-1',
            owner_user_id: 'qa-member-user',
            name: 'Member Owned Template',
            description: 'Transfer requires admin approval.',
            is_shared: false,
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'component-1',
                type: 'text',
                sourceLabel: '.headline',
                x: 100,
                y: 120,
                width: 700,
                content: 'Transfer approval workflow',
                style: { fontSize: 42, color: '#0f172a' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            created_at: '2026-04-24T10:00:00.000Z',
            updated_at: '2026-04-24T10:00:00.000Z',
          },
        ],
        collaborators: [],
        approvals: [],
        audits: [],
        nextAuditId: 1,
        nextApprovalId: 1,
      }))
    })
    await page.reload()
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    const templateCard = page.locator('.slides-library-card', {
      has: page.getByRole('heading', { name: 'Member Owned Template' }),
    }).first()
    await expect(templateCard.getByText(/Owner:\s*qa-member-user/i)).toBeVisible()
    await templateCard.getByRole('button', { name: 'Transfer Owner' }).click()
    await templateCard.getByLabel('New Owner').fill('qa-admin@example.com')
    await templateCard.getByRole('button', { name: 'Confirm Transfer' }).click()

    await expect(templateCard.getByText(/Owner:\s*qa-member-user/i)).toBeVisible()
    await expect(page.locator('.slides-template-draft .slides-library-card', { hasText: 'Transfer Template Ownership' })).toHaveCount(1)

    await page.evaluate(() => {
      window.localStorage.setItem('qa-test-actor', 'admin')
    })
    await page.reload()
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    const approvalCard = page.locator('.slides-template-draft .slides-library-card', { hasText: 'Transfer Template Ownership' }).first()
    await expect(approvalCard).toBeVisible()
    await approvalCard.getByRole('button', { name: 'Approve' }).click()
    await expect(templateCard.getByText(/Owner:\s*qa-admin@example.com/i)).toBeVisible()

    await openSlidesActivity(page)
    await page.locator('#slides-audit-action').selectOption('submit-approval')
    await expect(page.locator('.slides-library-card h3', { hasText: 'submit-approval' })).toHaveCount(1)
    await page.locator('#slides-audit-action').selectOption('approve-approval')
    await expect(page.locator('.slides-library-card h3', { hasText: 'approve-approval' })).toHaveCount(1)
  })

  test('SLD-FE-410 and SLD-BE-410 allow admins to reject collaborator approval requests', async ({ page }) => {
    await page.addInitScript(() => {
      const actor = window.localStorage.getItem('qa-test-actor') || 'user'
      if (actor === 'admin') {
        window.localStorage.setItem('qa-auth-account', JSON.stringify({
          homeAccountId: 'qa-home-account',
          environment: 'qa.local',
          tenantId: 'qa-tenant',
          username: 'qa-admin@example.com',
          localAccountId: 'qa-local-account',
          name: 'QA Admin',
          idTokenClaims: {
            oid: 'qa-admin-user',
            sub: 'qa-admin-user',
          },
        }))
        window.localStorage.setItem('qa-app-user', JSON.stringify({
          user_id: 'qa-admin-user',
          email: 'qa-admin@example.com',
          name: 'QA Admin',
          role: 'admin',
          page_permissions: ['accounts', 'hr', 'sdr', 'crm', 'slides'],
          created_at: '2026-04-24T00:00:00.000Z',
          updated_at: '2026-04-24T00:00:00.000Z',
        }))
        return
      }

      window.localStorage.setItem('qa-auth-account', JSON.stringify({
        homeAccountId: 'qa-member-home-account',
        environment: 'qa.local',
        tenantId: 'qa-tenant',
        username: 'qa-member@example.com',
        localAccountId: 'qa-member-local-account',
        name: 'QA Member',
        idTokenClaims: {
          oid: 'qa-member-user',
          sub: 'qa-member-user',
        },
      }))
      window.localStorage.setItem('qa-app-user', JSON.stringify({
        user_id: 'qa-member-user',
        email: 'qa-member@example.com',
        name: 'QA Member',
        role: 'user',
        page_permissions: ['slides'],
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.evaluate(() => {
      window.localStorage.setItem('qa-test-actor', 'member')
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [
          {
            id: 'template-collab-approval-1',
            owner_user_id: 'qa-member-user',
            name: 'Member Collaborator Template',
            description: 'Collaborator changes require approval.',
            is_shared: false,
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'component-1',
                type: 'text',
                sourceLabel: '.headline',
                x: 100,
                y: 120,
                width: 700,
                content: 'Collaborator approval workflow',
                style: { fontSize: 42, color: '#0f172a' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            created_at: '2026-04-24T10:00:00.000Z',
            updated_at: '2026-04-24T10:00:00.000Z',
          },
        ],
        collaborators: [
          {
            template_id: 'template-collab-approval-1',
            user_id: 'qa-reviewer-user',
            user_email: 'qa-reviewer@example.com',
            role: 'reviewer',
            created_at: '2026-04-24T10:00:00.000Z',
            updated_at: '2026-04-24T10:00:00.000Z',
          },
        ],
        approvals: [],
        audits: [],
        nextAuditId: 1,
        nextApprovalId: 1,
      }))
    })
    await page.reload()
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    const templateCard = page.locator('.slides-library-card', {
      has: page.getByRole('heading', { name: 'Member Collaborator Template' }),
    }).first()
    await templateCard.getByRole('button', { name: 'Manage Collaborators' }).click()
    await expect(templateCard.getByText(/qa-reviewer@example.com · reviewer/i)).toBeVisible()
    await templateCard.getByRole('button', { name: 'Remove' }).click()
    await expect(page.locator('.slides-template-draft .slides-library-card', { hasText: 'Remove Collaborator' })).toHaveCount(1)
    await expect(templateCard.getByText(/qa-reviewer@example.com · reviewer/i)).toBeVisible()

    await page.evaluate(() => {
      window.localStorage.setItem('qa-test-actor', 'admin')
    })
    await page.reload()
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    const approvalCard = page.locator('.slides-template-draft .slides-library-card', { hasText: 'Remove Collaborator' }).first()
    await expect(approvalCard).toBeVisible()
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm')
      await dialog.accept()
    })
    await approvalCard.getByRole('button', { name: 'Reject' }).click()

    await templateCard.getByRole('button', { name: 'Manage Collaborators' }).click()
    await expect(templateCard.getByText(/qa-reviewer@example.com · reviewer/i)).toBeVisible()

    await openSlidesActivity(page)
    await page.locator('#slides-audit-action').selectOption('reject-approval')
    await expect(page.locator('.slides-library-card h3', { hasText: 'reject-approval' })).toHaveCount(1)
  })

  test('SLD-FE-440 and SLD-BE-440 show SLA aging and support approval escalation reminders', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('qa-app-user', JSON.stringify({
        user_id: 'qa-member-user',
        email: 'qa-member@example.com',
        name: 'QA Member',
        role: 'user',
        page_permissions: ['slides'],
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      }))
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [
          {
            id: 'template-sla-escalation-1',
            owner_user_id: 'qa-member-user',
            name: 'Escalation Template',
            description: 'Pending review should be escalate-able.',
            is_shared: false,
            canvas: { width: 1920, height: 1080 },
            components: [],
            metadata: {},
            created_at: '2026-04-20T08:00:00.000Z',
            updated_at: '2026-04-20T08:00:00.000Z',
          },
        ],
        collaborators: [],
        approvals: [
          {
            id: 'approval-escalation-1',
            template_id: 'template-sla-escalation-1',
            requested_by_user_id: 'qa-member-user',
            requested_by_email: 'qa-member@example.com',
            approval_type: 'transfer-template',
            payload: {
              target_user_id: 'qa-admin-user',
              target_user_email: 'qa-admin@example.com',
            },
            status: 'pending',
            review_note: null,
            reviewed_by_user_id: null,
            reviewed_at: null,
            created_at: '2026-04-20T08:00:00.000Z',
            updated_at: '2026-04-20T08:00:00.000Z',
          },
        ],
        audits: [],
        nextAuditId: 1,
        nextApprovalId: 2,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    const approvalCard = page.locator('.slides-template-draft .slides-library-card', { hasText: 'Transfer Template Ownership' }).first()
    await expect(approvalCard).toContainText('SLA Overdue (48h+)')
    await expect(approvalCard).toContainText(/Age:\s*\d+d/i)

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt')
      await dialog.accept('Need review before customer handoff.')
    })
    await approvalCard.getByRole('button', { name: 'Escalate' }).click()

    await expect(approvalCard).toContainText('Escalations: 1')
    await expect(approvalCard.getByRole('button', { name: 'Escalate Again' })).toBeVisible()

    await openSlidesActivity(page)
    await page.locator('#slides-audit-action').selectOption('escalate-approval')
    await expect(page.locator('.slides-library-card h3')).toContainText('escalate-approval')
  })

  test('SLD-BE-440 admin escalation sweep escalates overdue approvals without manual prompts', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('qa-app-user', JSON.stringify({
        user_id: 'qa-admin-user',
        email: 'qa-admin@example.com',
        name: 'QA Admin',
        role: 'admin',
        page_permissions: ['accounts', 'hr', 'sdr', 'crm', 'slides'],
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      }))
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [
          {
            id: 'template-sla-sweep-1',
            owner_user_id: 'qa-member-user',
            name: 'Sweep Template',
            description: 'Overdue approvals should be swept.',
            is_shared: false,
            canvas: { width: 1920, height: 1080 },
            components: [],
            metadata: {},
            created_at: '2026-04-20T08:00:00.000Z',
            updated_at: '2026-04-20T08:00:00.000Z',
          },
        ],
        collaborators: [],
        approvals: [
          {
            id: 'approval-sweep-1',
            template_id: 'template-sla-sweep-1',
            requested_by_user_id: 'qa-member-user',
            requested_by_email: 'qa-member@example.com',
            approval_type: 'transfer-template',
            payload: {
              target_user_id: 'qa-admin-user',
              target_user_email: 'qa-admin@example.com',
            },
            status: 'pending',
            review_note: null,
            reviewed_by_user_id: null,
            reviewed_at: null,
            created_at: '2026-04-20T08:00:00.000Z',
            updated_at: '2026-04-20T08:00:00.000Z',
          },
        ],
        audits: [],
        nextAuditId: 1,
        nextApprovalId: 2,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()
    await expect(page.getByText(/Overdue approvals:\s*1/i)).toBeVisible()
    await page.getByRole('button', { name: 'Run SLA Escalation Sweep' }).click()

    const approvalCard = page.locator('.slides-template-draft .slides-library-card', { hasText: 'Transfer Template Ownership' }).first()
    await expect(approvalCard).toContainText('Escalations: 1')

    await openSlidesActivity(page)
    await page.locator('#slides-audit-action').selectOption('escalate-approval')
    await expect(page.locator('.slides-library-card h3')).toContainText('escalate-approval')
  })

  test('SLD-FE-410 collaborator visibility allows members to use private delegated templates', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('qa-app-user', JSON.stringify({
        user_id: 'qa-member-user',
        email: 'qa-member@example.com',
        name: 'QA Member',
        role: 'user',
        page_permissions: ['slides'],
        created_at: '2026-04-24T00:00:00.000Z',
        updated_at: '2026-04-24T00:00:00.000Z',
      }))

      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [
          {
            id: 'template-collab-2',
            owner_user_id: 'qa-owner-user',
            name: 'Delegated Private Template',
            description: 'Visible through collaborator role.',
            is_shared: false,
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'component-1',
                type: 'text',
                sourceLabel: '.headline',
                x: 100,
                y: 120,
                width: 700,
                content: 'Delegated access',
                style: { fontSize: 42, color: '#0f172a' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            created_at: '2026-04-24T10:00:00.000Z',
            updated_at: '2026-04-24T10:00:00.000Z',
          },
        ],
        collaborators: [
          {
            template_id: 'template-collab-2',
            user_id: 'qa-member-user',
            user_email: 'qa-member@example.com',
            role: 'viewer',
            created_at: '2026-04-24T10:00:00.000Z',
            updated_at: '2026-04-24T10:00:00.000Z',
          },
        ],
        audits: [],
        nextAuditId: 1,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByRole('button', { name: 'Template Library', exact: true }).click()

    const templateCard = page.locator('.slides-library-card', { hasText: 'Delegated Private Template' }).first()
    await expect(templateCard).toBeVisible()
    await templateCard.getByRole('button', { name: 'Duplicate to My Slides' }).click()
    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await expect(page.getByText('Delegated Private Template (Copy)')).toBeVisible()
  })

  test('SLD-FE-420 and SLD-BE-420 provide activity filtering, pagination, and csv export', async ({ page }) => {
    await page.addInitScript(() => {
      const audits = Array.from({ length: 25 }, (_, index) => ({
        id: index + 1,
        actor_user_id: 'qa-admin-user',
        actor_email: 'qa-admin@example.com',
        entity_type: index % 2 === 0 ? 'template' : 'slide',
        entity_id: `entity-${index + 1}`,
        action: index % 3 === 0 ? 'export-html' : index % 3 === 1 ? 'save' : 'publish-template',
        outcome: index % 4 === 0 ? 'failure' : 'success',
        error_class: index % 4 === 0 ? 'simulated_failure' : null,
        details: { index: index + 1 },
        created_at: `2026-04-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
      }))

      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [],
        audits,
        nextAuditId: 26,
      }))
    })

    await gotoSlidesWorkspace(page)
    await openSlidesActivity(page)
    const auditPagination = page.locator('.slides-audit-pagination')

    await expect(page.locator('.slides-library-card')).toHaveCount(20)
    await expect(page.getByText('Showing 1-20')).toBeVisible()

    await auditPagination.getByRole('button', { name: 'Next' }).click()
    await expect(page.locator('.slides-library-card')).toHaveCount(5)
    await expect(page.getByText('Showing 21-25')).toBeVisible()

    await auditPagination.getByRole('button', { name: 'Previous' }).click()
    await expect(page.locator('.slides-library-card')).toHaveCount(20)

    await page.locator('#slides-audit-action').selectOption('export-html')
    await expect(page.locator('.slides-library-card')).toHaveCount(9)

    await page.locator('#slides-audit-outcome').selectOption('failure')
    await expect(page.locator('.slides-library-card')).toHaveCount(3)

    await page.locator('#slides-audit-entity').selectOption('template')
    await expect(page.locator('.slides-library-card')).toHaveCount(3)

    await page.locator('#slides-audit-date-from').fill('2026-04-20')
    await page.locator('#slides-audit-date-to').fill('2026-04-25')
    await expect(page.locator('.slides-library-card')).toHaveCount(1)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export Current View CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('slide-audit-events.csv')

    await page.getByRole('button', { name: 'Reset Audit Filters' }).click()
    await expect(page.locator('#slides-audit-action')).toHaveValue('all')
    await expect(page.locator('#slides-audit-outcome')).toHaveValue('all')
    await expect(page.locator('#slides-audit-entity')).toHaveValue('all')
    await expect(page.locator('#slides-audit-date-from')).toHaveValue('')
    await expect(page.locator('#slides-audit-date-to')).toHaveValue('')
    await expect(page.locator('.slides-library-card')).toHaveCount(20)
  })

  test('SLD-FE-430 and SLD-BE-430 save, apply, and delete activity filter presets', async ({ page }) => {
    await page.addInitScript(() => {
      const audits = Array.from({ length: 25 }, (_, index) => ({
        id: index + 1,
        actor_user_id: 'qa-admin-user',
        actor_email: 'qa-admin@example.com',
        entity_type: index % 2 === 0 ? 'template' : 'slide',
        entity_id: `entity-${index + 1}`,
        action: index % 3 === 0 ? 'export-html' : index % 3 === 1 ? 'save' : 'publish-template',
        outcome: index % 4 === 0 ? 'failure' : 'success',
        error_class: index % 4 === 0 ? 'simulated_failure' : null,
        details: { index: index + 1 },
        created_at: `2026-04-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
      }))

      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [],
        templates: [],
        audits,
        nextAuditId: 26,
      }))
    })

    await gotoSlidesWorkspace(page)
    await openSlidesActivity(page)

    await page.locator('#slides-search').fill('entity-25')
    await page.locator('#slides-audit-action').selectOption('export-html')
    await page.locator('#slides-audit-outcome').selectOption('failure')
    await page.locator('#slides-audit-entity').selectOption('template')
    await page.locator('#slides-audit-date-from').fill('2026-04-20')
    await page.locator('#slides-audit-date-to').fill('2026-04-25')
    await expect(page.locator('.slides-library-card')).toHaveCount(1)

    await page.locator('#slides-audit-preset-name').fill('Failure Exports')
    await page.getByRole('button', { name: 'Save Preset' }).click()
    await expect(page.locator('#slides-audit-preset-select')).toContainText('Failure Exports')

    await page.locator('#slides-search').fill('')
    await page.getByRole('button', { name: 'Reset Audit Filters' }).click()
    await expect(page.locator('.slides-library-card')).toHaveCount(20)

    await page.locator('#slides-audit-preset-select').selectOption({ label: 'Failure Exports' })
    await page.getByRole('button', { name: 'Apply Preset' }).click()
    await expect(page.locator('#slides-search')).toHaveValue('entity-25')
    await expect(page.locator('#slides-audit-action')).toHaveValue('export-html')
    await expect(page.locator('#slides-audit-outcome')).toHaveValue('failure')
    await expect(page.locator('#slides-audit-entity')).toHaveValue('template')
    await expect(page.locator('#slides-audit-date-from')).toHaveValue('2026-04-20')
    await expect(page.locator('#slides-audit-date-to')).toHaveValue('2026-04-25')
    await expect(page.locator('.slides-library-card')).toHaveCount(1)

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete Preset' }).click()
    await expect(page.locator('#slides-audit-preset-select')).not.toContainText('Failure Exports')
  })

  test('SLD-FE-500 exports current slide to PPTX and surfaces unsupported-component warnings', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(
      `<div class=\"slide-canvas\" style=\"width:1920px;height:1080px;\"><img class=\"brand-logo\" alt=\"Company Logo\" src=\"https://example.com/logo.png\" style=\"position:absolute;left:40px;top:40px;width:200px;height:80px;\" /><h1 style=\"position:absolute;left:120px;top:180px;width:1100px;\">Q2 Executive Narrative</h1></div>`,
    )
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export PPTX (Current)' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pptx$/)

    await expect(page.getByText(/native logo\/image mapping not yet supported/i)).toBeVisible()

    const reportDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download PPTX Warning Report' }).click()
    const reportDownload = await reportDownloadPromise
    expect(reportDownload.suggestedFilename()).toMatch(/-pptx-warning-report\.json$/)
    await expect(page.getByText('Downloaded PPTX warning report.')).toBeVisible()
  })

  test('SLD-FE-500 exports selected My Slides rows to one PPTX', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [
          {
            id: 'slide-pptx-1',
            owner_user_id: 'qa-admin-user',
            title: 'PPTX One',
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'pptx1-heading',
                type: 'heading',
                sourceLabel: '.heading',
                x: 120,
                y: 140,
                width: 900,
                content: 'PPTX Slide One',
                style: { fontSize: 56, fontWeight: 700, color: '#0f172a' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            revision: 1,
            source: 'import',
            source_template_id: null,
            created_at: '2026-04-25T10:00:00.000Z',
            updated_at: '2026-04-25T10:00:00.000Z',
            last_edited_at: '2026-04-25T10:00:00.000Z',
          },
          {
            id: 'slide-pptx-2',
            owner_user_id: 'qa-admin-user',
            title: 'PPTX Two',
            canvas: { width: 1920, height: 1080 },
            components: [
              {
                id: 'pptx2-card',
                type: 'card',
                sourceLabel: '.card',
                x: 160,
                y: 220,
                width: 640,
                height: 260,
                content: '<h3>Pipeline</h3><p>$4.2M</p>',
                style: { fontSize: 28, color: '#111827', backgroundColor: '#f3f4f6' },
                locked: false,
                visible: true,
              },
            ],
            metadata: {},
            revision: 1,
            source: 'import',
            source_template_id: null,
            created_at: '2026-04-25T10:00:00.000Z',
            updated_at: '2026-04-25T10:00:00.000Z',
            last_edited_at: '2026-04-25T10:00:00.000Z',
          },
        ],
        templates: [],
        collaborators: [],
        approvals: [],
        audits: [],
        auditPresets: [],
        nextAuditId: 1,
        nextApprovalId: 1,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()

    await page.locator('#slides-pptx-select-slide-pptx-1').check()
    await page.locator('#slides-pptx-select-slide-pptx-2').check()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export Selected PPTX (2)' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pptx$/)

    await expect(page.getByRole('button', { name: 'Export Selected PPTX (2)' })).toBeEnabled()
  })

  test('SLD-FE-501 My Slides selection UX supports select-visible and hidden-selection warnings', async ({ page }) => {
    await page.addInitScript(() => {
      const slide = (id: string, title: string, y: number) => ({
        id,
        owner_user_id: 'qa-admin-user',
        title,
        canvas: { width: 1920, height: 1080 },
        components: [{
          id: `${id}-heading`,
          type: 'heading',
          sourceLabel: '.heading',
          x: 120,
          y,
          width: 900,
          content: title,
          style: { fontSize: 56, fontWeight: 700, color: '#0f172a' },
          locked: false,
          visible: true,
        }],
        metadata: {},
        revision: 1,
        source: 'import',
        source_template_id: null,
        created_at: '2026-04-25T10:00:00.000Z',
        updated_at: '2026-04-25T10:00:00.000Z',
        last_edited_at: '2026-04-25T10:00:00.000Z',
      })

      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify({
        slides: [
          slide('slide-sel-1', 'Alpha Launch', 140),
          slide('slide-sel-2', 'Beta Review', 220),
          slide('slide-sel-3', 'Gamma Plan', 300),
        ],
        templates: [],
        collaborators: [],
        approvals: [],
        audits: [],
        auditPresets: [],
        nextAuditId: 1,
        nextApprovalId: 1,
      }))
    })

    await gotoSlidesWorkspace(page)
    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()

    await page.getByRole('button', { name: 'Select Visible (3)' }).click()
    await expect(page.getByText('Selected for export: 3 visible / 3 total.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export Selected PPTX (3)' })).toBeEnabled()

    await page.locator('#slides-search').fill('Alpha')
    await expect(page.locator('.slides-library-card')).toHaveCount(1)
    await expect(page.getByText('Selected for export: 1 visible / 3 total.')).toBeVisible()
    await expect(page.getByText('2 selected slides are hidden by the current search filter.')).toBeVisible()
    await page.getByRole('button', { name: 'Keep Visible Only' }).click()
    await expect(page.getByText('Selected for export: 1 visible / 1 total.')).toBeVisible()
    await expect(page.getByText('selected slides are hidden by the current search filter.')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Export Selected PPTX (1)' })).toBeEnabled()

    await page.getByRole('button', { name: 'Clear Selection' }).click()
    await expect(page.getByText('Selected for export: 0 visible / 0 total.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export Selected PPTX (0)' })).toBeDisabled()
  })

  test('US-SLD-028 library and activity search show actionable empty states instead of dead-end messaging', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(`<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Search Test Slide</h1></div>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-title').fill('Library Search Smoke')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await expect(page.getByText('Library Search Smoke')).toBeVisible()

    await page.locator('#slides-search').fill('zz-no-slide-match')
    await expect(page.locator('.slides-library-card')).toHaveCount(0)
    await expect(page.getByText('No slides match "zz-no-slide-match". Clear or update search to continue.')).toBeVisible()

    await page.locator('#slides-search').fill('')
    await expect(page.getByText('Library Search Smoke')).toBeVisible()

    await page.getByRole('button', { name: 'Template Library', exact: true }).click()
    await expect(page.getByText('Hero + Metric Row')).toBeVisible()

    await page.locator('#slides-search').fill('zz-no-template-match')
    await expect(page.locator('.slides-library-card')).toHaveCount(0)
    await expect(page.getByText('No templates match "zz-no-template-match". Clear or update search to continue.')).toBeVisible()

    await page.locator('#slides-search').fill('')
    await expect(page.getByText('Hero + Metric Row')).toBeVisible()

    await openSlidesActivity(page)
    await expect(page.getByText('save').first()).toBeVisible()

    await page.locator('#slides-search').fill('zz-no-activity-match')
    await expect(page.locator('.slides-library-card')).toHaveCount(0)
    await expect(page.getByText('No activity events match "zz-no-activity-match". Clear or update search to continue.')).toBeVisible()

    await page.locator('#slides-search').fill('save')
    await expect(page.getByText('save').first()).toBeVisible()
  })

  test('SLD-FE-616 surfaces parity state cards for import error and empty workspaces', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByTestId('slides-import-error-state')).toBeVisible()
    await expect(page.getByTestId('slides-import-error-state')).toContainText('Import parse blocked')

    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await expect(page.getByTestId('slides-my-slides-empty-state')).toBeVisible()
    await expect(page.getByTestId('slides-my-slides-empty-state')).toContainText('My Slides is empty')

    await page.getByRole('button', { name: 'Template Library', exact: true }).click()
    await page.locator('#slides-search').fill('zz-no-template-match')
    await expect(page.getByTestId('slides-templates-empty-state')).toBeVisible()
    await expect(page.getByTestId('slides-templates-empty-state')).toContainText('Template Library is empty')
  })

  test('US-SLD-053 supports multi-slide deck create, import, duplicate, reorder, delete, and save persistence', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(
      `<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:120px;top:120px;width:900px;">Deck Alpha</h1></div>`,
    )
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.getByTestId('slides-deck-strip')).toContainText('1 slide in the working deck.')

    await page.locator('#slides-raw-html').fill(
      `<div class="slide-canvas" style="width:1920px;height:1080px;background:#0f172a;"><h1 style="position:absolute;left:120px;top:120px;width:900px;color:#ffffff;">Deck Beta</h1></div>`,
    )
    await page.locator('#main-content').getByRole('button', { name: 'Import as New Slide' }).click()
    await expect(page.getByTestId('slides-deck-strip')).toContainText('2 slides in the working deck.')
    await expect(page.getByTestId('slides-deck-tab-2')).toHaveClass(/btn-primary/)

    await page.locator('#main-content').getByRole('button', { name: 'Duplicate Slide' }).click()
    await expect(page.getByTestId('slides-deck-strip')).toContainText('3 slides in the working deck.')
    await expect(page.getByTestId('slides-deck-tab-3')).toHaveClass(/btn-primary/)

    await page.locator('#main-content').getByRole('button', { name: 'Move Up' }).click()
    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })
    await page.locator('#main-content').getByRole('button', { name: 'Delete Slide' }).click()
    await expect(page.getByTestId('slides-deck-strip')).toContainText('2 slides in the working deck.')

    await page.locator('#main-content').getByRole('button', { name: 'Show Raw JSON' }).click()
    const multiDeckDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    expect(multiDeckDocument.deck.slides).toHaveLength(2)
    expect(multiDeckDocument.deck.slides.map((slide: { elements?: Array<{ content?: string }> }) => slide.elements?.[0]?.content || '')).toEqual(
      expect.arrayContaining([expect.stringContaining('Deck Alpha'), expect.stringContaining('Deck Beta')]),
    )

    await page.locator('#slides-title').fill('Multi Deck Save')
    await page.locator('#main-content').getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    const persistedDeck = await page.evaluate(() => {
      const raw = window.localStorage.getItem('oliver-slides-store-v1')
      const parsed = raw ? JSON.parse(raw) : { slides: [] }
      const saved = parsed.slides.find((slide: { title?: string }) => slide.title === 'Multi Deck Save')
      return saved?.metadata?.slide_document || null
    })
    expect(persistedDeck.deck.slides).toHaveLength(2)

    await page.locator('#slides-raw-html').fill(
      `<div class="slide-canvas" style="width:1280px;height:720px;"><h1 style="position:absolute;left:80px;top:80px;width:640px;">Deck Reset</h1></div>`,
    )
    await page.locator('#main-content').getByRole('button', { name: 'Import as New Deck' }).click()
    await expect(page.getByTestId('slides-deck-strip')).toContainText('1 slide in the working deck.')
    const resetDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    expect(resetDocument.deck.slides).toHaveLength(1)
    expect(resetDocument.deck.slides[0]?.elements?.[0]?.content).toContain('Deck Reset')
  })

  test('US-SLD-054 resizes canvas proportionally without layout reflow drift', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    await page.locator('#slides-raw-html').fill(
      `<div class="slide-canvas" style="width:1920px;height:1080px;">
        <h1 style="position:absolute;left:120px;top:120px;width:900px;height:80px;">Resize Alpha</h1>
        <div style="position:absolute;left:960px;top:540px;width:480px;height:240px;background:#e5e7eb;">Resize Card</div>
      </div>`,
    )
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-canvas-width').fill('1280')
    await page.locator('#slides-canvas-height').fill('720')
    await page.locator('#main-content').getByRole('button', { name: 'Resize Canvas Proportionally' }).click()
    await expect(page.getByText('Resized canvas to 1280 × 720 with proportional layer scaling.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()

    await page.locator('#main-content').getByRole('button', { name: 'Show Raw JSON' }).click()
    const resizedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    expect(resizedDocument.deck.width).toBe(1280)
    expect(resizedDocument.deck.height).toBe(720)

    const resizedElements = resizedDocument.deck.slides[0].elements
    expect(resizedElements[0]?.x).toBe(80)
    expect(resizedElements[0]?.y).toBe(80)
    expect(resizedElements[0]?.width).toBe(600)
    expect(resizedElements[0]?.height).toBe(53)
    expect(resizedElements[1]?.x).toBe(640)
    expect(resizedElements[1]?.y).toBe(360)
    expect(resizedElements[1]?.width).toBe(320)
    expect(resizedElements[1]?.height).toBe(160)
  })

  test('US-SLD-103 companion stylesheet mismatch warning surfaces unresolved href names', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="theme-a.css" />
          <link rel="stylesheet" href="theme-b.css" />
        </head>
        <body>
          <div class="slide-canvas" style="width:1600px;height:900px;">
            <h1 style="position:absolute;left:120px;top:120px;width:840px;">Mismatch Warning</h1>
          </div>
        </body>
      </html>
    `

    await page.setInputFiles('#slides-html-file', [
      {
        name: 'deck.html',
        mimeType: 'text/html',
        buffer: Buffer.from(html),
      },
      {
        name: 'theme-a.css',
        mimeType: 'text/css',
        buffer: Buffer.from('.slide-canvas { background: #ffffff; }'),
      },
    ])

    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.getByText(/Could not match 1 linked stylesheet to selected CSS files \(theme-b\.css\)\./)).toBeVisible()
  })

  test('US-SLD-057 keeps imported layers editable while viewport scale stays visual-only', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60">
      <rect width="160" height="60" rx="10" fill="#22d3ee" />
      <text x="80" y="37" text-anchor="middle" font-size="24" font-family="Arial, sans-serif" fill="#0f172a">LOGO</text>
    </svg>`
    const logoDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg)}`

    await page.locator('#slides-raw-html').fill(`<!doctype html>
      <html>
        <body>
          <div class="slide-canvas" style="width:1920px;height:1080px;background:#0f172a;">
            <h1 style="position:absolute;left:120px;top:110px;width:760px;color:#ffffff;">Imported Heading</h1>
            <div class="card" style="position:absolute;left:120px;top:300px;width:360px;height:220px;background:#111827;color:#e5e7eb;border-radius:24px;padding:24px;">Imported Card</div>
            <img alt="Imported Logo" src="${logoDataUri}" style="position:absolute;left:1360px;top:840px;width:160px;height:60px;" />
          </div>
        </body>
      </html>`)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.getByText(/Scaled to viewport at \d+% while preserving coordinate integrity\./)).toBeVisible()

    const headingLayer = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    const cardLayer = page.locator('.slides-canvas-component[data-component-type="card"]').first()
    const logoLayer = page.locator('.slides-canvas-component[data-component-type="logo"]').first()

    await expect(page.locator('.slides-canvas-component')).toHaveCount(3)
    await headingLayer.dblclick()
    const headingContent = headingLayer.locator('.slides-canvas-component-content')
    await expect(headingContent).toHaveAttribute('contenteditable', 'true')
    await headingContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type('Edited Imported Heading')
    await page.locator('#slides-title').click()
    await expect(headingLayer).toContainText('Edited Imported Heading')

    await headingLayer.click()
    await logoLayer.click({ modifiers: ['Shift'] })
    await expect(page.locator('.slides-canvas-component[data-component-selected="true"]')).toHaveCount(2)

    const headingXBefore = Number(await headingLayer.getAttribute('data-component-x'))
    const logoXBefore = Number(await logoLayer.getAttribute('data-component-x'))
    await page.locator('[data-slide-canvas="1"]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(headingLayer).toHaveAttribute('data-component-x', String(headingXBefore + 1))
    await expect(logoLayer).toHaveAttribute('data-component-x', String(logoXBefore + 1))

    await cardLayer.click()
    const cardId = await cardLayer.getAttribute('data-component-id')
    const cardOrderBefore = await page.locator('.slides-canvas-component').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-component-id')),
    )
    await page.getByRole('button', { name: 'Bring Forward' }).click()
    const cardOrderAfter = await page.locator('.slides-canvas-component').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-component-id')),
    )
    expect(cardOrderAfter.indexOf(cardId)).toBeGreaterThan(cardOrderBefore.indexOf(cardId))

    const cardWidthBefore = Number(await cardLayer.getAttribute('data-component-width'))
    await page.locator('[data-slide-canvas="1"]').focus()
    await page.keyboard.press('Alt+ArrowRight')
    await expect(cardLayer).toHaveAttribute('data-component-width', String(cardWidthBefore + 1))

    await page.getByRole('button', { name: 'Duplicate Selection' }).click()
    await expect(page.locator('.slides-canvas-component[data-component-type="card"]')).toHaveCount(2)
    await page.getByRole('button', { name: 'Delete Selection' }).click()
    await expect(page.locator('.slides-canvas-component[data-component-type="card"]')).toHaveCount(1)

    await page.locator('#slides-title').fill('Imported Canonical Editability')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await page.getByRole('button', { name: 'Generate HTML Export' }).click()
    const exportedHtml = await page.locator('#slides-export-html').inputValue()
    expect(exportedHtml).toContain('Edited Imported Heading')
    expect(exportedHtml).toMatch(new RegExp(`left:\\s*${headingXBefore + 1}px`))
    expect(exportedHtml).toMatch(new RegExp(`left:\\s*${logoXBefore + 1}px`))

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const document = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const exportedComponents = document.deck.slides[0].elements
    const exportedHeading = exportedComponents.find((component: { type?: string }) => component.type === 'heading')
    const exportedLogo = exportedComponents.find((component: { type?: string }) => component.type === 'logo')
    expect(exportedHeading?.x).toBe(headingXBefore + 1)
    expect(exportedLogo?.x).toBe(logoXBefore + 1)
  })

  test('US-SLD-058 sample artifact fixture preserves parity signals and editable structure', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const fixture = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'slides', 'slide-10-artifacts.html'), 'utf8')
    await page.locator('#slides-raw-html').fill(fixture)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.getByRole('button', { name: 'Show Raw JSON' }).click()
    const parsedDocument = await page.locator('.slides-code').evaluate((el) => JSON.parse(el.textContent || '{}'))
    const slide = parsedDocument.deck.slides[0]
    const components = slide.elements as Array<{
      type?: string
      sourceLabel?: string
      content?: string
      x?: number
      y?: number
      width?: number
      height?: number
      locked?: boolean
    }>

    expect(parsedDocument.deck.width).toBe(1900)
    expect(parsedDocument.deck.height).toBe(1060)
    expect(String(slide.background?.fill || parsedDocument.deck.background || parsedDocument.canvas?.background || '')).toMatch(/linear-gradient\(135deg/)
    expect(components.filter((component) => component.type === 'card' && String(component.sourceLabel || '').includes('.art'))).toHaveLength(4)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.an'))).toHaveLength(4)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.al'))).toHaveLength(4)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.ad'))).toHaveLength(4)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.logo') && component.type === 'logo')).toHaveLength(1)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.metric') && String(component.content || '').includes('2-week'))).toHaveLength(1)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.headline') && String(component.content || '').includes('What We Leave Behind'))).toHaveLength(1)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.main-headline') && String(component.content || '').includes('What We Build Next'))).toHaveLength(1)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.delivery-cycle'))).toHaveLength(1)
    expect(components.filter((component) => String(component.sourceLabel || '').includes('.deck-body'))).toHaveLength(1)
    expect(components.some((component) => component.type === 'card' && (component.x || 0) > 600)).toBe(true)
    expect(components.some((component) => component.type === 'heading' && (component.x || 0) < 300)).toBe(true)
  })

  test('US-SLD-034, US-SLD-035, and US-SLD-036 draft recovery and activity feed surface save/export events', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const html = `<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Activity Slide</h1></div>`
    await page.locator('#slides-raw-html').fill(html)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.locator('#slides-title').fill('Audit Slide')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await page.getByRole('button', { name: 'Generate HTML Export' }).click()
    await page.getByRole('button', { name: 'Download HTML' }).click()
    await page.locator('#slides-raw-html').fill(`${html}\n<!-- unsaved draft marker -->`)

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Recovered draft available/)).toBeVisible()
    await page.getByRole('button', { name: 'Discard' }).click()

    await openSlidesActivity(page)
    await expect(page.getByText('save').first()).toBeVisible()
    await expect(page.getByText('export-html').first()).toBeVisible()
  })

  test('US-SLD-037 prompts before discarding unsaved changes during workspace navigation', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('oliver-slides-telemetry-enabled', '1')
    })

    await gotoSlidesWorkspace(page)

    const html = `<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Unsaved Changes</h1></div>`
    await page.locator('#slides-raw-html').fill(html)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    page.once('dialog', async (dialog) => {
      expect(['confirm', 'beforeunload']).toContain(dialog.type())
      await dialog.dismiss()
    })
    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()

    await expect(page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'My Slides' })).toHaveCount(0)

    page.once('dialog', async (dialog) => {
      expect(['confirm', 'beforeunload']).toContain(dialog.type())
      await dialog.accept()
    })
    await page.getByLabel('Slides workspace views').getByRole('button', { name: 'My Slides', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'My Slides', exact: true })).toBeVisible()
  })

  test('SLD-FE-142 browser back transitions respect unsaved-change guardrails', async ({ page }) => {
    await gotoAndSettle(page, '/')
    await gotoSlidesWorkspace(page)

    const html = `<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Route Guard</h1></div>`
    await page.locator('#slides-raw-html').fill(html)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    page.once('dialog', async (dialog) => {
      expect(['confirm', 'beforeunload']).toContain(dialog.type())
      await dialog.dismiss()
    })
    await page.evaluate(() => {
      window.history.back()
    })
    await expect(page).toHaveURL(/\/slides\/?$/)
    await expect(page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' })).toBeVisible()

    page.once('dialog', async (dialog) => {
      expect(['confirm', 'beforeunload']).toContain(dialog.type())
      await dialog.accept()
    })
    await page.evaluate(() => {
      window.history.back()
    })
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' })).toHaveCount(0)
  })

  test('US-SLD-038 draft recovery appears for unsaved work and clears after successful save', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const html = `<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Draft Lifecycle</h1></div>`
    await page.locator('#slides-raw-html').fill(html)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Recovered draft available/)).toBeVisible()

    await page.getByRole('button', { name: 'Restore Draft' }).click()
    await page.locator('#slides-title').fill('Draft Recovery Lifecycle')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Recovered draft available/)).toHaveCount(0)
  })

  test('US-SLD-039 autosave queues retry with backoff after API failure and recovers on retry', async ({ page }) => {
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem
      window.localStorage.setItem('oliver-slides-telemetry-enabled', '1')
      Object.defineProperty(window, '__slidesFailStoreWrites', {
        value: true,
        writable: true,
        configurable: true,
      })
      Storage.prototype.setItem = function setItemWithFailure(key: string, value: string) {
        if ((window as unknown as { __slidesFailStoreWrites?: boolean }).__slidesFailStoreWrites && key === 'oliver-slides-store-v1') {
          throw new Error('forced autosave failure')
        }
        return originalSetItem.call(this, key, value)
      }
    })

    await gotoSlidesWorkspace(page)

    const html = `<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Autosave Retry</h1></div>`
    await page.locator('#slides-raw-html').fill(html)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await expect(page.getByText(/Save status: queued/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Autosave retry queued/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry Autosave Now' })).toBeVisible()

    await page.evaluate(() => {
      ;(window as unknown as { __slidesFailStoreWrites?: boolean }).__slidesFailStoreWrites = false
    })
    await page.getByRole('button', { name: 'Retry Autosave Now' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Save status: saved/i)).toBeVisible({ timeout: 10000 })
  })

  test('US-O31 autosave enters degraded local-draft mode after retry budget is exhausted', async ({ page }) => {
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = function setItemWithFailure(key: string, value: string) {
        if (key === 'oliver-slides-store-v1') {
          throw new Error('forced autosave failure')
        }
        return originalSetItem.call(this, key, value)
      }
    })

    await gotoSlidesWorkspace(page)

    const html = `<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Degraded Mode</h1></div>`
    await page.locator('#slides-raw-html').fill(html)
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()

    await expect(page.getByText(/Autosave retry queued/i)).toBeVisible({ timeout: 15000 })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.getByRole('button', { name: 'Retry Autosave Now' }).click()
    }

    await expect(page.getByRole('alert').filter({ hasText: /Autosave paused after 5 failed attempts/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Degraded Mode: Local Draft/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry Slides Service' })).toBeVisible()
  })

  test('US-SLD-142 detects stale revision conflicts and supports reload + save-as-copy with activity audit visibility', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const html = `<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Conflict Base</h1></div>`
    await page.locator('#slides-raw-html').fill(html)
    await page.locator('#slides-title').fill('Conflict Lifecycle Slide')
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await page.evaluate(() => {
      const raw = window.localStorage.getItem('oliver-slides-store-v1')
      const parsed = raw ? JSON.parse(raw) : null
      if (!parsed || !Array.isArray(parsed.slides)) return
      const target = parsed.slides.find((slide: { title?: string }) => slide.title === 'Conflict Lifecycle Slide')
      if (!target) return
      target.title = 'Conflict Lifecycle Slide (Server)'
      target.revision = Number(target.revision || 1) + 1
      target.updated_at = new Date().toISOString()
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify(parsed))
    })

    await page.locator('#slides-title').fill('Conflict Lifecycle Slide (Local Draft)')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Conflict with server revision/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload Server Version' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Overwrite Server' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save as Copy' })).toBeVisible()

    await page.getByRole('button', { name: 'Reload Server Version' }).click()
    await expect(page.locator('#slides-title')).toHaveValue('Conflict Lifecycle Slide (Server)')
    await expect(page.getByText(/Conflict with server revision/i)).toHaveCount(0)

    await page.evaluate(() => {
      const raw = window.localStorage.getItem('oliver-slides-store-v1')
      const parsed = raw ? JSON.parse(raw) : null
      if (!parsed || !Array.isArray(parsed.slides)) return
      const target = parsed.slides.find((slide: { title?: string }) => slide.title === 'Conflict Lifecycle Slide (Server)')
      if (!target) return
      target.revision = Number(target.revision || 1) + 1
      target.updated_at = new Date().toISOString()
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify(parsed))
    })

    await page.locator('#slides-title').fill('Conflict Lifecycle Slide (Local Draft)')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Conflict with server revision/i)).toBeVisible()
    await page.getByRole('button', { name: 'Save as Copy' }).click()
    await expect(page.locator('#slides-title')).toHaveValue(/Conflict Lifecycle Slide \(Local Draft\) \(Copy\)/)
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await openSlidesActivity(page)
    await expect(page.getByText('conflict').first()).toBeVisible()
  })

  test('US-SLD-142 conflict workflow supports overwrite server resolution', async ({ page }) => {
    await gotoSlidesWorkspace(page)

    const html = `<div class="slide-canvas" style="width:1920px;height:1080px;"><h1 style="position:absolute;left:100px;top:120px;width:800px;">Conflict Overwrite Base</h1></div>`
    await page.locator('#slides-raw-html').fill(html)
    await page.locator('#slides-title').fill('Conflict Overwrite Slide')
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
    await expect(page.getByText('Parse complete.')).toBeVisible()
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()

    await page.evaluate(() => {
      const raw = window.localStorage.getItem('oliver-slides-store-v1')
      const parsed = raw ? JSON.parse(raw) : null
      if (!parsed || !Array.isArray(parsed.slides)) return
      const target = parsed.slides.find((slide: { title?: string }) => slide.title === 'Conflict Overwrite Slide')
      if (!target) return
      target.revision = Number(target.revision || 1) + 1
      target.updated_at = new Date().toISOString()
      window.localStorage.setItem('oliver-slides-store-v1', JSON.stringify(parsed))
    })

    await page.locator('#slides-title').fill('Conflict Overwrite Slide (Local)')
    await page.getByRole('button', { name: 'Save Slide' }).click()
    await expect(page.getByText(/Conflict with server revision/i)).toBeVisible()
    await page.getByRole('button', { name: 'Overwrite Server' }).click()
    await expect(page.getByText(/Save status: saved/i)).toBeVisible()
  })
})
