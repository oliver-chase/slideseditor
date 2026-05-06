import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const COMMANDS_SOURCE = readFileSync(join(process.cwd(), 'src', 'app', 'slides', 'commands.ts'), 'utf8')
const FLOWS_SOURCE = readFileSync(join(process.cwd(), 'src', 'app', 'slides', 'flows.ts'), 'utf8')
const PATHS_SOURCE = readFileSync(join(process.cwd(), 'src', 'lib', 'chatbot-conversation-paths.ts'), 'utf8')
const INTENTS_SOURCE = readFileSync(join(process.cwd(), 'src', 'lib', 'chatbot-intents.ts'), 'utf8')

test('slides chatbot scope contract: conversation path label remains Slide Editor', () => {
  const slidesPathMatch = PATHS_SOURCE.match(/slides:\s*{[\s\S]*?label:\s*'([^']+)'[\s\S]*?}/)
  assert.ok(slidesPathMatch, 'expected slides conversation path definition')
  assert.equal(slidesPathMatch[1], 'Slide Editor')
})

test('slides chatbot scope contract: command aliases avoid campaign-specific GTM/marketing terms', () => {
  const aliasMatches = [...COMMANDS_SOURCE.matchAll(/aliases:\s*\[([^\]]+)\]/g)]
  assert.ok(aliasMatches.length > 0, 'expected slides command aliases')
  const aliasText = aliasMatches.map((match) => match[1]).join('\n').toLowerCase()
  assert.equal(/\b(gtm|marketing|campaign|campaigns)\b/.test(aliasText), false)
})

test('slides chatbot scope contract: flow aliases avoid campaign-specific GTM/marketing terms', () => {
  const aliasMatches = [...FLOWS_SOURCE.matchAll(/aliases:\s*\[([^\]]+)\]/g)]
  assert.ok(aliasMatches.length > 0, 'expected slides flow aliases')
  const aliasText = aliasMatches.map((match) => match[1]).join('\n').toLowerCase()
  assert.equal(/\b(gtm|marketing)\b/.test(aliasText), false)
})

test('chatbot intent contract: campaigns pattern includes marketing routing terms', () => {
  assert.match(INTENTS_SOURCE, /moduleId:\s*'campaigns'/)
  assert.match(INTENTS_SOURCE, /campaign report/i)
})

