import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CORPUS_PATH = join(ROOT, '.github', 'oliver-app', 'modules', 'slides-module', 'DOM-TO-PPTX-EDGE-CASE-CORPUS.json')
const TEMPLATE_PATH = join(ROOT, '.github', 'oliver-app', 'modules', 'slides-module', 'DOM-TO-PPTX-ISSUE-INTAKE-TEMPLATE.md')

test('slides pptx edge-case corpus: required intake and corpus mappings are present', () => {
  assert.equal(existsSync(TEMPLATE_PATH), true)
  assert.equal(existsSync(CORPUS_PATH), true)

  const template = readFileSync(TEMPLATE_PATH, 'utf8')
  assert.match(template, /Minimal repro HTML:/)
  assert.match(template, /Minimal repro CSS:/)
  assert.match(template, /Expected PPTX behavior:/)
  assert.match(template, /Actual PPTX behavior:/)

  const corpus = JSON.parse(readFileSync(CORPUS_PATH, 'utf8'))
  const requiredTags = Array.isArray(corpus.required_tags) ? corpus.required_tags : []
  const entries = Array.isArray(corpus.entries) ? corpus.entries : []

  assert.deepEqual(requiredTags, [
    'deep-flex',
    'unusual-gradients',
    'nested-transforms',
    'font-embedding',
    'dashboard-canvas',
  ])
  assert.equal(entries.length >= requiredTags.length, true)

  const seenTags = new Set()
  for (const entry of entries) {
    assert.equal(typeof entry.id, 'string')
    assert.equal(typeof entry.title, 'string')
    assert.equal(typeof entry.fixture_path, 'string')
    assert.equal(typeof entry.mapped_story_id, 'string')
    assert.equal(Array.isArray(entry.tags), true)
    assert.equal(Array.isArray(entry.regression_targets), true)
    assert.equal(entry.regression_targets.length > 0, true)

    const fixtureAbs = join(ROOT, entry.fixture_path)
    assert.equal(existsSync(fixtureAbs), true, `missing fixture: ${entry.fixture_path}`)
    const storyAbs = join(ROOT, '.github', 'oliver-app', 'modules', 'slides-module', `${entry.mapped_story_id}-${{
      'US-SLD-080': 'dom-to-pptx-computed-style-mapping-foundation',
      'US-SLD-081': 'flexbox-layout-resolution-parity-for-pptx',
      'US-SLD-082': 'gradient-shadow-radius-fidelity-in-pptx',
      'US-SLD-083': 'no-screenshot-fallback-and-editable-output-guardrails',
      'US-SLD-084': 'auto-font-embedding-for-pptx-export',
      'US-SLD-085': 'html-fragment-to-native-pptx-animation-mapping',
      'US-SLD-086': 'svg-table-canvas-dashboard-export-parity',
    }[entry.mapped_story_id] || ''}.md`)
    assert.equal(existsSync(storyAbs), true, `missing mapped story doc for ${entry.mapped_story_id}`)

    for (const tag of entry.tags) seenTags.add(tag)

    if (entry.waiver !== null) {
      assert.equal(typeof entry.waiver.owner, 'string')
      assert.equal(typeof entry.waiver.reason, 'string')
    }
  }

  for (const tag of requiredTags) {
    assert.equal(seenTags.has(tag), true, `missing required corpus tag: ${tag}`)
  }
})
