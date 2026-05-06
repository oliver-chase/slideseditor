import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

test('slides pptx export contract: dom-to-pptx dependency is declared in package.json', () => {
  const packageJsonPath = path.join(repoRoot, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const dependencies = packageJson.dependencies ?? {}

  assert.equal(
    typeof dependencies['@halobiron/dom-to-pptx'],
    'string',
    'Expected @halobiron/dom-to-pptx in package.json dependencies for Slides PPTX export.',
  )
})
