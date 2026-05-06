import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const SCRIPT_PATH = join(process.cwd(), 'scripts', 'check-slides-migration-verification.mjs')

test('slides migration verification gate passes with required table + policy markers', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'slides-migration-gate-pass-'))
  try {
    const migrationsDir = join(workspace, 'supabase', 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_stub.sql'), `
      CREATE TABLE IF NOT EXISTS public.slide_import_session_traces (id uuid);
      CREATE INDEX IF NOT EXISTS slide_import_session_traces_correlation_created_idx ON public.slide_import_session_traces (correlation_id, created_at DESC);
      ALTER TABLE public.slide_import_session_traces ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "deny client access" ON public.slide_import_session_traces FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
    `)

    const run = spawnSync('node', [SCRIPT_PATH], { cwd: workspace, encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr || run.stdout)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('slides migration verification gate fails when required markers are missing', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'slides-migration-gate-fail-'))
  try {
    const migrationsDir = join(workspace, 'supabase', 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    writeFileSync(join(migrationsDir, '001_stub.sql'), 'CREATE TABLE IF NOT EXISTS public.slides (id uuid);')

    const run = spawnSync('node', [SCRIPT_PATH], { cwd: workspace, encoding: 'utf8' })
    assert.notEqual(run.status, 0)
    assert.match((run.stderr || run.stdout), /slides-migration-verification: failed/i)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
