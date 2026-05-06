import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STORIES_DIR = path.join(ROOT, '.github', 'oliver-app', 'modules', 'slides-module')
const ALLOWED = new Set(['Planned', 'In Progress', 'Done'])

test('slides story status contract: only canonical status values are used', () => {
  const files = fs.readdirSync(STORIES_DIR).filter((name) => name.endsWith('.md'))
  const violations = []

  for (const file of files) {
    const abs = path.join(STORIES_DIR, file)
    const text = fs.readFileSync(abs, 'utf8')
    const match = text.match(/^Status:\s*(.+)$/m)
    if (!match) continue
    const status = match[1].trim()
    if (!ALLOWED.has(status)) {
      violations.push({ file, status })
    }
  }

  assert.equal(
    violations.length,
    0,
    `non-canonical Slides statuses found: ${violations.map((v) => `${v.file}=>${v.status}`).join(', ')}`,
  )
})
