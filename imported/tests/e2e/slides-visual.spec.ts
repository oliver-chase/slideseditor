import { expect, test, type Page } from '@playwright/test'
import { gotoAndSettle } from './helpers/navigation'

async function gotoSlidesWorkspace(page: Page) {
  await gotoAndSettle(page, '/slides')
  await expect(page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /sign in to your account/i })).toHaveCount(0)
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

async function parseFixture(page: Page) {
  const html = `<div class="slide-canvas" style="width:1920px;height:1080px;">
    <h1 style="position:absolute;left:120px;top:110px;width:860px;">Q2 Planning</h1>
    <h2 style="position:absolute;left:120px;top:250px;width:780px;">Execution Priorities</h2>
    <div class="card" style="position:absolute;left:120px;top:390px;width:420px;height:260px;">Revenue Stream A</div>
    <div class="card" style="position:absolute;left:620px;top:390px;width:420px;height:260px;">Revenue Stream B</div>
  </div>`
  await page.locator('#slides-raw-html').fill(html)
  await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()
  await expect(page.getByText('Parse complete.')).toBeVisible()
  await expect(page.locator('[data-slide-canvas="1"]')).toBeVisible()
}

test.describe('slides visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedQaAuth(page)
    await page.setViewportSize({ width: 1600, height: 1200 })
  })

  test('canvas baseline render is stable', async ({ page }) => {
    await gotoSlidesWorkspace(page)
    await parseFixture(page)

    await expect(page.locator('.slides-canvas-preview')).toBeVisible()
    await expect(page.locator('.slides-canvas-component')).toHaveCount(4)
  })

  test('multi-select canvas state is stable', async ({ page }) => {
    await gotoSlidesWorkspace(page)
    await parseFixture(page)

    const cards = page.locator('.slides-canvas-component[data-component-type="card"]')
    await cards.nth(0).click()
    await cards.nth(1).click({ modifiers: ['Shift'] })
    await expect(page.locator('.slides-canvas-component[data-component-selected="true"]')).toHaveCount(2)

    await expect(page.locator('.slides-canvas-preview')).toBeVisible()
    await expect(page.locator('.slides-canvas-component[data-component-selected="true"]')).toHaveCount(2)
  })

  test('toolbar selected state is stable', async ({ page }) => {
    await gotoSlidesWorkspace(page)
    await parseFixture(page)

    const heading = page.locator('.slides-canvas-component[data-component-type="heading"]').first()
    await heading.click()
    await page.locator('#slides-style-font-size').fill('36')
    await page.getByRole('button', { name: 'Align Text Center' }).click()
    await expect(page.getByText(/Updated styles for 1/)).toBeVisible()

    await expect(page.locator('.slides-editor-toolbar')).toBeVisible()
    await expect(page.locator('#slides-style-font-size')).toHaveValue('36')
    await expect(page.locator('#slides-style-align')).toHaveValue('center')
  })
})
