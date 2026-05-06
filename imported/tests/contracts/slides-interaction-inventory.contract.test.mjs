import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

const INVENTORY_PATH = path.join(
  ROOT,
  '.github',
  'oliver-app',
  'modules',
  'slides-module',
  'SLIDES-INTERACTION-INVENTORY.json',
)

const E2E_PATHS = [
  path.join(ROOT, 'tests', 'e2e', 'slides-regression.spec.ts'),
  path.join(ROOT, 'tests', 'e2e', 'slides-visual.spec.ts'),
  path.join(ROOT, 'tests', 'e2e', 'mobile-clickpaths.spec.ts'),
  path.join(ROOT, 'tests', 'e2e', 'frontend-smoke.spec.ts'),
]

test('slides interaction inventory contract: schema is complete for mapped controls', () => {
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'))
  assert.equal(inventory.module, 'slides')
  assert.equal(Array.isArray(inventory.entries), true)
  assert.equal(inventory.entries.length >= 12, true, 'inventory must enumerate core Slides interactions')

  for (const entry of inventory.entries) {
    assert.equal(typeof entry.id, 'string')
    assert.equal(typeof entry.family, 'string')
    assert.equal(typeof entry.control, 'string')
    assert.equal(typeof entry.frontend_handler, 'string')
    assert.equal(typeof entry.backend_contract, 'string')
    assert.equal(typeof entry.success_state, 'string')
    assert.equal(typeof entry.failure_state, 'string')
    assert.equal(Array.isArray(entry.test_refs), true)
    assert.equal(entry.test_refs.length >= 1, true, `missing test refs for ${entry.id}`)
  }
})

test('slides interaction inventory contract: every mapped test reference exists in Slides e2e suite', () => {
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'))
  const corpus = E2E_PATHS
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n')

  for (const entry of inventory.entries) {
    for (const ref of entry.test_refs) {
      assert.equal(
        corpus.includes(ref),
        true,
        `missing mapped test reference "${ref}" for inventory control "${entry.id}"`,
      )
    }
  }
})
