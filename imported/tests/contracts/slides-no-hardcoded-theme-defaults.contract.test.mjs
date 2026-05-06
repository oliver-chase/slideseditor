import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const FILES = [
  join(ROOT, 'src', 'app', 'slides', 'page.tsx'),
  join(ROOT, 'src', 'components', 'slides', 'html-export.ts'),
]

const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}/g

test('slides theme/export defaults avoid hardcoded hex color literals', () => {
  for (const filePath of FILES) {
    const source = readFileSync(filePath, 'utf8')
    const matches = source.match(HEX_COLOR_REGEX) || []
    assert.equal(
      matches.length,
      0,
      `expected no hardcoded hex colors in ${filePath}; found: ${matches.join(', ')}`,
    )
  }
})
