import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()
const commandsPath = join(repoRoot, 'src/app/slides/commands.ts')
const flowsPath = join(repoRoot, 'src/app/slides/flows.ts')

function normalizeAlias(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseSlidesEntries(sourceText) {
  const entries = []
  const regex = /{\s*id:\s*'(?<id>slides-[^']+)'.*?aliases:\s*\[(?<aliases>[^\]]*)\]/gs
  let match = regex.exec(sourceText)
  while (match) {
    const id = match.groups?.id || ''
    const rawAliases = match.groups?.aliases || ''
    const aliases = Array.from(rawAliases.matchAll(/'([^']+)'/g)).map((row) => row[1])
    entries.push({ id, aliases })
    match = regex.exec(sourceText)
  }
  return entries
}

test('slides chatbot contract: command ids and flow ids stay in sync', async () => {
  const commandsSource = readFileSync(commandsPath, 'utf8')
  const flowsSource = readFileSync(flowsPath, 'utf8')

  const commandEntries = parseSlidesEntries(commandsSource)
  const flowEntries = parseSlidesEntries(flowsSource)

  const commandIds = new Set(commandEntries.map((entry) => entry.id))
  const flowIds = new Set(flowEntries.map((entry) => entry.id))

  assert.deepEqual(
    Array.from(commandIds).sort(),
    Array.from(flowIds).sort(),
    'slides command ids and flow ids must stay aligned for fuzzy routing',
  )
})

test('slides chatbot contract: every command/flow defines robust alias coverage', async () => {
  const commandsSource = readFileSync(commandsPath, 'utf8')
  const flowsSource = readFileSync(flowsPath, 'utf8')

  const entries = [...parseSlidesEntries(commandsSource), ...parseSlidesEntries(flowsSource)]
  assert.ok(entries.length > 0, 'expected at least one slides command/flow entry')

  for (const entry of entries) {
    const normalizedAliases = entry.aliases
      .map(normalizeAlias)
      .filter(Boolean)
    const uniqueAliases = Array.from(new Set(normalizedAliases))

    assert.ok(
      uniqueAliases.length >= 3,
      `expected ${entry.id} to expose at least three fuzzy aliases`,
    )
  }
})

test('slides chatbot contract: critical workflow intents remain discoverable', async () => {
  const commandsSource = readFileSync(commandsPath, 'utf8')
  const commandIds = new Set(parseSlidesEntries(commandsSource).map((entry) => entry.id))

  const requiredIds = [
    'slides-import-file',
    'slides-parse-pasted',
    'slides-save-slide',
    'slides-download-html',
    'slides-download-pptx',
    'slides-open-import',
    'slides-open-my-slides',
    'slides-open-template-library',
    'slides-undo',
    'slides-redo',
    'slides-align-selection',
    'slides-distribute-selection',
    'slides-lock-selection',
    'slides-unlock-selection',
  ]

  for (const requiredId of requiredIds) {
    assert.equal(
      commandIds.has(requiredId),
      true,
      `missing slides chatbot capability: ${requiredId}`,
    )
  }

  assert.equal(
    commandIds.has('slides-open-operations'),
    false,
    'archived Operations/Activity command should not remain discoverable',
  )
})
