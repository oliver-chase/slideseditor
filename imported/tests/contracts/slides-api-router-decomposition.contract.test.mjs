import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = readFileSync(join(process.cwd(), 'functions', 'api', 'slides.js'), 'utf8')
const ROUTE_GROUP_SOURCE = readFileSync(join(process.cwd(), 'functions', 'api', 'slides', 'route-handler-groups.js'), 'utf8')
const MATRIX_SOURCE = readFileSync(
  join(process.cwd(), '.github', 'oliver-app', 'modules', 'slides-module', 'SLIDES-ACTION-TABLE-RLS-MATRIX.md'),
  'utf8',
)

function extractQuotedKeys(source, objectName) {
  const match = source.match(new RegExp(`const ${objectName} = \\{([\\s\\S]*?)\\n  \\};`))
  assert.ok(match, `${objectName} object should exist`)
  return Array.from(match[1].matchAll(/'([^']+)':/g)).map((entry) => entry[1])
}

test('slides api decomposition contract: GET uses explicit resource dispatch map', () => {
  assert.match(SOURCE, /buildGetResourceHandlers/)
  assert.match(SOURCE, /const GET_RESOURCE_HANDLERS = buildGetResourceHandlers\(/)
  assert.match(SOURCE, /const resourceHandler = GET_RESOURCE_HANDLERS\[resource\]/)
  assert.match(SOURCE, /return await resourceHandler\(\{/)
})

test('slides api decomposition contract: POST uses explicit action dispatch map', () => {
  assert.match(SOURCE, /buildPostActionHandlers/)
  assert.match(SOURCE, /const POST_ACTION_HANDLERS = buildPostActionHandlers\(/)
  assert.match(SOURCE, /const actionHandler = POST_ACTION_HANDLERS\[action\]/)
})

test('slides api governance matrix covers every GET resource dispatch key', () => {
  const resources = [
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'slidesResources'),
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'governanceResources'),
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'auditResources'),
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'exportResources'),
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'telemetryResources'),
  ]

  for (const resource of resources) {
    assert.match(MATRIX_SOURCE, new RegExp(`\\| \`${resource}\` \\|`), `matrix missing GET resource ${resource}`)
  }
})

test('slides api governance matrix covers every POST action dispatch key', () => {
  const actions = [
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'slidesActions'),
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'templateActions'),
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'governanceActions'),
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'auditActions'),
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'exportActions'),
    ...extractQuotedKeys(ROUTE_GROUP_SOURCE, 'telemetryActions'),
  ]

  for (const action of actions) {
    assert.match(MATRIX_SOURCE, new RegExp(`\\| \`${action}\` \\|`), `matrix missing POST action ${action}`)
  }
})
