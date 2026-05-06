import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const pagePath = join(process.cwd(), 'src', 'app', 'slides', 'page.tsx')
const pageSource = readFileSync(pagePath, 'utf8')
const persistenceHookPath = join(process.cwd(), 'src', 'app', 'slides', 'hooks', 'use-slides-editor-persistence.ts')
const persistenceHookSource = readFileSync(persistenceHookPath, 'utf8')
const libraryDataHookPath = join(process.cwd(), 'src', 'app', 'slides', 'hooks', 'use-slides-library-data.ts')
const libraryDataHookSource = readFileSync(libraryDataHookPath, 'utf8')
const exportHookPath = join(process.cwd(), 'src', 'app', 'slides', 'hooks', 'use-slides-html-pdf-export.ts')
const exportHookSource = readFileSync(exportHookPath, 'utf8')

const REQUIRED_HOOK_IMPORTS = [
  'useSlidesImportIngestion',
  'useSlidesEditorToolbarMutations',
  'useSlidesCanvasInteractions',
  'useSlidesEditorPersistence',
  'useSlidesLibraryData',
  'useSlidesTemplateGovernance',
  'useSlidesAuditState',
  'useSlidesAuditActions',
  'useSlidesHtmlPdfExport',
  'useSlidesPptxExport',
  'useSlidesWorkspaceGuard',
]

test('slides decomposition contract: page orchestrator imports bounded feature hooks', () => {
  for (const hookName of REQUIRED_HOOK_IMPORTS) {
    assert.match(
      pageSource,
      new RegExp(`\\b${hookName}\\b`),
      `expected slides page to reference ${hookName}`,
    )
  }
})

test('slides decomposition contract: bounded hook files exist for each orchestrator concern', () => {
  const hookFiles = [
    'use-slides-import-ingestion.ts',
    'use-slides-editor-toolbar-mutations.ts',
    'use-slides-canvas-interactions.ts',
    'use-slides-editor-persistence.ts',
    'use-slides-library-data.ts',
    'use-slides-template-governance.ts',
    'use-slides-audit-state.ts',
    'use-slides-audit-actions.ts',
    'use-slides-html-pdf-export.ts',
    'use-slides-pptx-export.ts',
    'use-slides-workspace-guard.ts',
  ]

  for (const fileName of hookFiles) {
    const fullPath = join(process.cwd(), 'src', 'app', 'slides', 'hooks', fileName)
    assert.equal(existsSync(fullPath), true, `missing hook file ${fileName}`)
  }
})

test('slides decomposition contract: topbar exposes persistent sync indicator lifecycle', () => {
  assert.match(pageSource, /data-testid="slides-sync-indicator"/, 'expected a persistent slides sync indicator in topbar')
  assert.match(pageSource, /const slidesSyncState: 'syncing' \| 'error' \| 'ok'/, 'expected normalized slides sync state union')
  assert.match(pageSource, /slidesSyncState === 'syncing'/, 'expected syncing state branch')
  assert.match(pageSource, /slidesSyncState === 'error'/, 'expected error state branch')
  assert.match(pageSource, /slidesSyncState === 'error' \? 'Retry' : 'Refresh'/, 'expected actionable retry/refresh control')
  assert.equal(
    pageSource.includes('Open Operations'),
    false,
    'Slides should not expose the archived Operations/Activity workspace',
  )
  assert.equal(
    pageSource.includes('SlidesOperationsDrawer'),
    false,
    'Slides should not render the archived Operations drawer',
  )
  assert.match(pageSource, /slides-tab-strip/, 'expected shared tab strip styling for workspace tabs')
})

test('slides decomposition contract: retry action re-attempts save across dirty and failure statuses', () => {
  assert.match(
    persistenceHookSource,
    /saveStatus === 'dirty' \|\| saveStatus === 'queued' \|\| saveStatus === 'error' \|\| saveStatus === 'conflict'/,
    'expected retry action to recover queued/error/conflict unsaved states',
  )
})

test('slides decomposition contract: library refresh ignores stale async responses', () => {
  assert.match(libraryDataHookSource, /requestSequenceRef/, 'expected request sequencing guard in library data hook')
  assert.match(
    libraryDataHookSource,
    /if \(requestId !== requestSequenceRef\.current\) return/,
    'expected stale response short-circuit in library data hook',
  )
})

test('slides decomposition contract: html export uses deferred object URL cleanup', () => {
  assert.match(exportHookSource, /document\.body\.appendChild\(anchor\)/, 'expected export anchor to be attached before click')
  assert.match(exportHookSource, /window\.setTimeout\(\(\) => \{\s*URL\.revokeObjectURL\(url\)/, 'expected deferred object URL revoke')
})

test('slides decomposition contract: import trace source is caller-provided, not hardcoded', () => {
  assert.match(
    persistenceHookSource,
    /runParseWithProgress: \(html: string, source\?: SlidesImportSource\) => Promise<void>/,
    'expected runParseWithProgress signature to support explicit import source',
  )
  assert.doesNotMatch(
    persistenceHookSource,
    /phase: 'parse-start',[\s\S]*source: 'pasted'/,
    'expected parse-start trace source to avoid hardcoded pasted source',
  )
  assert.match(
    readFileSync(pagePath, 'utf8'),
    /runParseWithProgress\(rawHtml, 'pasted'\)/,
    'expected parse actions to label pasted source',
  )
})
