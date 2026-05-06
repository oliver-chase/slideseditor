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

test.describe('slides import large html regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedQaAuth(page)
  })

  test('large html file import initializes editor instead of empty state', async ({ page }) => {
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

  test('forced parser failure still initializes locked fallback layer with warnings', async ({ page }) => {
    await page.addInitScript(() => {
      const originalParse = DOMParser.prototype.parseFromString
      let invocationCount = 0
      DOMParser.prototype.parseFromString = function patchedParseFromString(...args: Parameters<DOMParser['parseFromString']>) {
        invocationCount += 1
        if (invocationCount === 1) {
          throw new Error('forced-parser-failure')
        }
        return originalParse.apply(this, args)
      }
    })

    await gotoSlidesWorkspace(page)
    await page.locator('#slides-raw-html').fill(
      '<div class="slide-canvas" style="width:1280px;height:720px;"><h1 style="position:absolute;left:80px;top:80px;width:800px;">Fallback Import</h1></div>',
    )
    await page.locator('#main-content').getByRole('button', { name: 'Parse Pasted HTML' }).click()

    await expect(page.getByText('Parse complete.')).toBeVisible()
    await expect(page.locator('[data-slide-canvas="1"]')).toBeVisible()
    await expect(page.getByTestId('slides-editor-empty-state')).toHaveCount(0)
    await expect(page.getByText(/Import parser fallback engaged/i)).toBeVisible()

    const selectedLayer = page.locator('.slides-canvas-component[data-component-selected="true"]').first()
    await expect(selectedLayer).toHaveAttribute('data-component-locked', 'true')
  })
})
