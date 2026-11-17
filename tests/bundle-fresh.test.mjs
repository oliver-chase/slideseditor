// Fails when slideeditor.html is not the build of the current source. Fix: node scripts/build-bundle.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { buildEngineBundle, buildHtml } from '../scripts/build-bundle.mjs'

const built = readFileSync(new URL('../slideeditor.html', import.meta.url), 'utf8')
assert.equal(built, buildHtml(buildEngineBundle()), 'slideeditor.html is stale: run node scripts/build-bundle.mjs')
console.log('bundle-fresh test passed')
