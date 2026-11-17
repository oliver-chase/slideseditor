// Tests for the PPTX writer. Runs with only Node installed: node tests/pptx-export.test.mjs
import { inflateRawSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { loadEngine } from './load-engine.mjs'

const E = loadEngine()

function unzip(ab) {
  const buf = Buffer.from(ab)
  const parts = {}
  let eocd = buf.length - 22
  while (buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = buf.subarray(start, start + size)
    parts[name] = method === 8 ? inflateRawSync(data) : data
    p += 46 + nameLen + extraLen + commentLen
  }
  return parts
}

function exportParts(content, style = {}, x = 40, y = 40, background) {
  const component = { id: 't1', type: 'text', content, x, y, width: 400, height: 60, locked: false, visible: true, sourceLabel: 'test', style }
  const document = E.createSlideDocument({ canvas: { width: 1280, height: 720, ...(background ? { background } : {}) }, components: [component] })
  return E.convertSlideDocumentsToPptx([{ id: 'slide-1', title: 'Test', document }]).blob.arrayBuffer().then(unzip)
}

async function slideXml(content, style = {}, x = 40, y = 40, background) {
  const parts = await exportParts(content, style, x, y, background)
  assert.ok(parts['ppt/slides/slide1.xml'], 'ppt/slides/slide1.xml is in the export')
  return parts['ppt/slides/slide1.xml'].toString('utf8')
}

const plain = await slideXml('Hello deck')
assert.ok(plain.includes('Hello deck'), 'text survives export')

const dirty = await slideXml('Bad\u0001char\u000b\tkept')
assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(dirty), 'control characters are stripped')
assert.ok(dirty.includes('Badchar\tkept'), 'tab is kept')

const doubled = await slideXml('&amp;lt;')
assert.ok(doubled.includes('>&amp;lt;<'), 'escaped text is decoded once')

const plainSpacing = await slideXml('No spacing')
assert.ok(!plainSpacing.includes('<a:lnSpc>') && !plainSpacing.includes(' spc='), 'no spacing markup without spacing styles')

const spaced = await slideXml('Spaced out', { lineHeight: 60, letterSpacing: 5 })
assert.ok(spaced.includes('<a:lnSpc><a:spcPts val="4500"/></a:lnSpc>'), 'line-height 60px becomes 45pt line spacing')
assert.ok(spaced.includes(' spc="375"'), 'letter-spacing 5px becomes 3.75pt character spacing')

function exportImage(uri) {
  const component = { id: 'img1', type: 'text', content: `<img src="${uri}" />`, x: 10, y: 10, width: 100, height: 100, locked: false, visible: true, sourceLabel: 'test', style: {} }
  const document = E.createSlideDocument({ canvas: { width: 1280, height: 720 }, components: [component] })
  return E.convertSlideDocumentsToPptx([{ id: 'slide-1', title: 'Test', document }])
}

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const pngResult = exportImage(png)
assert.equal(pngResult.warnings.length, 0, 'a base64 PNG exports with no warning')

const svgResult = exportImage('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E')
assert.ok(svgResult.warnings.some((w) => w.includes('img1') && w.includes('image/svg+xml')), 'an SVG with a utf8 parameter is reported by component, not dropped silently')

const offCanvas = await slideXml('Off canvas', {}, -80, -30)
assert.ok(offCanvas.includes('<a:off x="-762000" y="-285750"/>'), 'a negative position is kept, not clamped to 0')

// A picture that carries text keeps both: the picture, plus a caption shape on top.
const captioned = await slideXml(`<img src="${png}" />Caption text`)
assert.equal((captioned.match(/<p:pic>/g) || []).length, 1, 'a captioned image exports one picture')
assert.ok(captioned.includes('Caption text'), 'the caption text is kept')

// A canvas background becomes a full-slide shape behind the components.
const withBackground = await slideXml('On a gradient', {}, 40, 40, 'linear-gradient(180deg, #112233, #445566)')
assert.ok(withBackground.includes('name="slide-background"') && withBackground.includes('<a:gradFill'), 'a gradient background exports as a background shape')

// Line spacing and dashed borders stay inside what PowerPoint accepts.
const tall = await slideXml('Tall', { lineHeight: 5000 })
assert.ok(/<a:spcPts val="(\d+)"/.test(tall) && Number(tall.match(/<a:spcPts val="(\d+)"/)[1]) <= 158400, 'line spacing stays at or under 158400')
const dashed = await slideXml('Dashed', { borderStyle: 'dashed', borderWidth: 2, borderColor: '#000000' })
assert.ok(dashed.includes('prstDash val="dash"'), 'a dashed border writes dash')
const dotted = await slideXml('Dotted', { borderStyle: 'dotted', borderWidth: 2, borderColor: '#000000' })
assert.ok(dotted.includes('prstDash val="sysDot"'), 'a dotted border writes sysDot')

// No part of the PPTX carries the maker's name, and neither does the HTML export.
const parts = await exportParts('Hello')
for (const [name, data] of Object.entries(parts)) {
  assert.ok(!/oliver/i.test(data.toString('latin1')), name + ' carries no owner name')
}
const neutralHtml = E.convertSlideComponentsToHtml({ canvas: { width: 800, height: 400 }, components: [] })
assert.ok(!/oliver/i.test(neutralHtml), 'the HTML export carries no owner name')

// A picture with no height keeps its own aspect ratio: a 4 by 2 image 400 wide is 200 high.
const wide = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGP4z8AARwzIHABvqgf5gNwAKAAAAABJRU5ErkJggg=='
const noHeight = { id: 'p1', type: 'logo', content: `<img src="${wide}" />`, x: 0, y: 0, width: 400, locked: false, visible: true, style: {} }
const noHeightDoc = E.createSlideDocument({ canvas: { width: 1280, height: 720 }, components: [noHeight] })
const noHeightParts = unzip(await E.convertSlideDocumentsToPptx([{ id: 's', title: 't', document: noHeightDoc }]).blob.arrayBuffer())
const picXml = noHeightParts['ppt/slides/slide1.xml'].toString('utf8')
const ext = picXml.match(/<p:pic>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/)
assert.equal(Number(ext[1]) / Number(ext[2]), 2, 'a picture with no height keeps a 2:1 aspect')

// Numeric character references in text become the character.
const entities = await slideXml('It&#x27;s &#39;fine&#39; &amp; &#65;')
assert.ok(entities.includes('It&apos;s &apos;fine&apos; &amp; A'), 'numeric entities decode, then the text is XML-escaped once')

console.log('pptx-export tests passed')
