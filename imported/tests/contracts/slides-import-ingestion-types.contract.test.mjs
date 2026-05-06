import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = readFileSync(
  join(process.cwd(), 'src', 'app', 'slides', 'hooks', 'use-slides-import-ingestion.ts'),
  'utf8',
)

test('slides import ingestion contract: ignoredCssFiles preview uses string list directly', () => {
  assert.equal(
    SOURCE.includes('inlineResult.ignoredCssFiles.map((file) => file.name)'),
    false,
    'ignoredCssFiles is string[], so preview must not map .name',
  )
  assert.match(SOURCE, /formatFileListPreview\(inlineResult\.ignoredCssFiles\)/)
})
