// Smoke test for the PPTX writer. Runs with only Node installed: node tests/pptx-export.test.mjs
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const html = readFileSync(new URL('../slideeditor.html', import.meta.url), 'utf8')
const bundle = html.split('<script>')[1].split('</script>')[0]
const sandbox = { window: {}, console, TextEncoder, TextDecoder, Blob, URL, atob, btoa }
sandbox.self = sandbox.window
vm.createContext(sandbox)
vm.runInContext(bundle, sandbox)
const E = sandbox.window.SlideEngine

function slideXml(content, style = {}, x = 40, y = 40) {
  const component = { id: 't1', type: 'text', content, x, y, width: 400, height: 60, locked: false, visible: true, sourceLabel: 'test', style }
  const document = E.createSlideDocument({ canvas: { width: 1280, height: 720 }, components: [component] })
  return E.convertSlideDocumentsToPptx([{ id: 'slide-1', title: 'Test', document }]).blob.arrayBuffer().then((ab) => {
    const buf = Buffer.from(ab)
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
      if (name === 'ppt/slides/slide1.xml') {
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
        const data = buf.subarray(start, start + size)
        return (method === 8 ? inflateRawSync(data) : data).toString('utf8')
      }
      p += 46 + nameLen + extraLen + commentLen
    }
    throw new Error('ppt/slides/slide1.xml missing from the export')
  })
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

console.log('pptx-export tests passed')
