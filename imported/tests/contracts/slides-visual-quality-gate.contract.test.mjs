import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

const slidesRegression = fs.readFileSync(path.join(ROOT, 'tests', 'e2e', 'slides-regression.spec.ts'), 'utf8')
const slidesVisual = fs.readFileSync(path.join(ROOT, 'tests', 'e2e', 'slides-visual.spec.ts'), 'utf8')
const mobileClickpaths = fs.readFileSync(path.join(ROOT, 'tests', 'e2e', 'mobile-clickpaths.spec.ts'), 'utf8')

test('slides visual quality gate: desktop core visual states are explicitly covered', () => {
  const requiredRegressionRefs = [
    'SLD-FE-616 surfaces parity state cards for import error and empty workspaces',
    'US-SLD-028 library and activity search show actionable empty states instead of dead-end messaging',
    'SLD-FE-617 template endpoint fallback does not trigger global degraded local-draft banner',
    'SLD-FE-500 exports current slide to PPTX and surfaces unsupported-component warnings',
  ]
  const requiredVisualRefs = [
    'canvas baseline render is stable',
    'multi-select canvas state is stable',
    'toolbar selected state is stable',
  ]

  for (const ref of requiredRegressionRefs) {
    assert.equal(
      slidesRegression.includes(ref),
      true,
      `missing required regression visual-quality ref: ${ref}`,
    )
  }

  for (const ref of requiredVisualRefs) {
    assert.equal(
      slidesVisual.includes(ref),
      true,
      `missing required visual snapshot ref: ${ref}`,
    )
  }
})

test('slides visual quality gate: mobile discoverability and overflow checks are explicitly covered', () => {
  const requiredMobileRefs = [
    'all primary routes render mobile-safe shells',
    'slides workspace tabs and chatbot flows remain mobile-safe',
    'overflows horizontally on mobile',
  ]

  for (const ref of requiredMobileRefs) {
    assert.equal(
      mobileClickpaths.includes(ref),
      true,
      `missing required mobile quality ref: ${ref}`,
    )
  }
})
