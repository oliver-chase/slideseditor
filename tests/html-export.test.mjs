// Tests for the HTML export. Runs with only Node installed: node tests/html-export.test.mjs
import assert from 'node:assert/strict'
import { loadEngine } from './load-engine.mjs'

const E = loadEngine()
const layer = (id, content, visible = true, y = 0) => ({ id, type: 'text', content, x: 0, y, width: 100, height: 20, style: {}, locked: false, visible })

// The HTML export leaves out hidden layers.
const hiddenHtml = E.convertSlideComponentsToHtml({
  canvas: { width: 800, height: 400 },
  components: [layer('a', 'Shown text'), layer('b', 'Hidden text', false, 30)],
})
assert.ok(hiddenHtml.includes('Shown text') && !hiddenHtml.includes('Hidden text'), 'hidden layers stay out of the HTML export')

// The canvas size is written as whole pixels, the same value the stylesheet uses.
const rounded = E.convertSlideComponentsToHtml({ canvas: { width: 1920, height: 18.5 }, components: [layer('a', 'x')] })
assert.ok(rounded.includes('width:1920px;height:19px;'), 'a fractional canvas height is rounded')
assert.ok(!rounded.includes('18.5px'), 'no fractional size reaches the output')

// Event-handler attributes in quoted form are removed from layer content.
const clean = E.convertSlideComponentsToHtml({
  canvas: { width: 800, height: 400 },
  components: [layer('a', '<img src="x" onerror="alert(1)">safe')],
})
assert.ok(!/onerror/i.test(clean) && clean.includes('safe'), 'a quoted onerror attribute is removed')

// The page starts with a doctype and carries a title.
assert.ok(hiddenHtml.startsWith('<!doctype html>'), 'the export starts with a doctype')

console.log('html-export tests passed')
