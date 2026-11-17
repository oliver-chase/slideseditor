// Loads the engine for the tests by bundling engine/*.ts from source, so a test never runs against a stale slideeditor.html.
import vm from 'node:vm'
import { buildEngineBundle } from '../scripts/build-bundle.mjs'

export function loadEngine() {
  const sandbox = { window: {}, console, TextEncoder, TextDecoder, Blob, URL, atob, btoa }
  sandbox.self = sandbox.window
  vm.createContext(sandbox)
  vm.runInContext(buildEngineBundle(), sandbox)
  return sandbox.window.SlideEngine
}
