// Zero-dependency bundler for the Slides Editor local tool.
// Strips TypeScript types with node's built-in stripTypeScriptTypes (node >= 22.13),
// removes module import/export syntax, flat-concatenates the engine in dependency
// order, and inlines the result into a single self-contained slideeditor.html.
//
// There is no npm install, no bundler dependency, and no deploy step: the output
// is one local HTML file the user opens directly in a browser.
//
// Usage: node scripts/build-bundle.mjs

import { stripTypeScriptTypes } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const ENGINE_DIR = join(REPO, 'engine')

// Dependency order matters for the flat concat: a module's runtime dependencies
// (createSlideDocument, MAX_IMPORT_FILE_SIZE_BYTES) must be defined above it.
// `const` bindings do not hoist, so import-validation precedes import-file-bundle.
const ENGINE_FILES = [
  'types.ts',
  'persistence-types.ts',
  'document.ts',
  'import-validation.ts',
  'html-import.ts',
  'html-export.ts',
  'pptx-export.ts',
  'import-file-bundle.ts',
]

// Public entry points exposed on window.SlideEngine.
const PUBLIC_API = [
  'convertHtmlToSlideComponents',
  'convertSlideComponentsToHtml',
  'convertSlideDocumentToHtml',
  'convertSlideDocumentsToPptx',
  'createSlideDocument',
  'validateImportFile',
  'validateHtmlImportInput',
  'validatePastedHtml',
  'validateParsedResult',
  'classifyImportError',
  'selectImportFiles',
  'inlineCompanionStylesheets',
  'adaptComponentsToResponsiveCanvasWithWarnings',
]

function stripModuleSyntax(tsSource) {
  const stripped = stripTypeScriptTypes(tsSource, { mode: 'strip' })
  return stripped
    .split('\n')
    // Drop every ES import line; all cross-module deps resolve via flat scope.
    .filter((line) => !/^\s*import\s/.test(line))
    // `export function f` -> `function f`, `export const C` -> `const C`.
    .map((line) => line.replace(/^(\s*)export\s+(?=(async\s+)?function\b|const\b|class\b|let\b|var\b)/, '$1'))
    .join('\n')
}

export function buildEngineBundle() {
  const parts = []
  for (const file of ENGINE_FILES) {
    const src = readFileSync(join(ENGINE_DIR, file), 'utf8')
    const code = stripModuleSyntax(src).trim()
    if (!code) continue
    parts.push(`// ===== ${file} =====\n${code}`)
  }
  const body = parts.join('\n\n')
  const api = PUBLIC_API.map((name) => `    ${name},`).join('\n')
  return `(function (global) {
  'use strict';
${body}

  global.SlideEngine = {
${api}
  };
})(typeof window !== 'undefined' ? window : globalThis);
`
}

function buildHtml(engineJs) {
  const shellPath = join(REPO, 'src', 'shell.html')
  const shell = readFileSync(shellPath, 'utf8')
  const marker = '/* __SLIDE_ENGINE_BUNDLE__ */'
  if (!shell.includes(marker)) {
    throw new Error(`shell.html is missing the ${marker} injection marker`)
  }
  // The engine contains string literals with a literal "</script>" (reveal.js
  // export markup). Inside an inline <script> the HTML parser would treat that as
  // the closing tag and truncate the bundle. Break the token with a backslash,
  // which is inert in a JS string. Also avoid re-substituting the marker text if
  // it ever appears in the engine (use a function replacement, not a string).
  const safeEngine = engineJs.replace(/<\/(script)/gi, '<\\/$1')
  return shell.replace(marker, () => safeEngine)
}

// Run directly: emit slideeditor.html.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const engineJs = buildEngineBundle()
  const html = buildHtml(engineJs)
  const outPath = join(REPO, 'slideeditor.html')
  writeFileSync(outPath, html)
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1)
  console.log(`Wrote ${outPath} (${kb} KB)`)
}
