import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const SOURCE_PATH = join(ROOT, 'src', 'lib', 'slides.ts')
const DOCUMENT_PATH = join(ROOT, 'src', 'components', 'slides', 'document.ts')

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }
}

async function importSlidesRuntimeModule() {
  const tempDir = mkdtempSync(join(tmpdir(), 'slides-runtime-contract-'))
  const source = readFileSync(SOURCE_PATH, 'utf8')
  const rewritten = source.replace(
    "from '@/components/slides/document'",
    `from '${pathToFileURL(DOCUMENT_PATH).href}'`,
  )
  const rewrittenPath = join(tempDir, 'slides.runtime.contract.ts')
  writeFileSync(rewrittenPath, rewritten)
  const moduleUrl = `${pathToFileURL(rewrittenPath).href}?t=${Date.now()}`

  try {
    return await import(moduleUrl)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

const slidesRuntime = await importSlidesRuntimeModule()

const actor = {
  user_id: 'qa-contract-user',
  user_email: 'qa-contract@example.com',
  role: 'admin',
}

const slideSaveInput = {
  title: 'Runtime Health Contract Slide',
  canvas: { width: 1280, height: 720 },
  components: [],
  metadata: {},
}

async function forceRuntimeRecovery() {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => jsonResponse({ items: [] })
  try {
    await slidesRuntime.listSlides(actor, '')
  } finally {
    globalThis.fetch = previousFetch
  }
}

test('slides runtime health policy: non-critical reads fallback without degraded mode', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new TypeError('simulated list-slides network failure')
  }

  try {
    const rows = await slidesRuntime.listSlides(actor, '')
    assert.equal(Array.isArray(rows), true, 'listSlides should still return local fallback rows')

    const health = slidesRuntime.getSlidesRuntimeHealth()
    assert.equal(health.mode, 'normal', 'non-critical read fallback should suppress degraded state')
    assert.equal(health.lastFailure, null, 'non-critical read fallback should not persist runtime failure state')
  } finally {
    globalThis.fetch = previousFetch
    await forceRuntimeRecovery()
  }
})

test('slides runtime health policy: critical mutation fallback marks degraded mode with failure metadata', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new TypeError('simulated save network failure')
  }

  try {
    const response = await slidesRuntime.saveSlide(actor, slideSaveInput)
    assert.ok(response?.slide?.id, 'saveSlide should return a local fallback slide when remote save fails')

    const health = slidesRuntime.getSlidesRuntimeHealth()
    assert.equal(health.mode, 'degraded', 'critical mutation fallback should flip runtime state to degraded')
    assert.equal(health.lastFailure?.failureClass, 'network_error')
    assert.equal(health.lastFailure?.endpoint, '/api/slides')
    assert.equal(health.lastFailure?.retryable, true)
  } finally {
    globalThis.fetch = previousFetch
  }

  await forceRuntimeRecovery()
  const recoveredHealth = slidesRuntime.getSlidesRuntimeHealth()
  assert.equal(recoveredHealth.mode, 'normal', 'a successful follow-up call should recover runtime health state')
  assert.equal(recoveredHealth.lastFailure, null)
})
