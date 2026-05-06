import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')

const requiredChecks = [
  {
    id: 'table-slide-import-session-traces',
    regex: /CREATE TABLE IF NOT EXISTS\s+public\.slide_import_session_traces/i,
  },
  {
    id: 'index-correlation',
    regex: /CREATE INDEX IF NOT EXISTS\s+slide_import_session_traces_correlation_created_idx/i,
  },
  {
    id: 'rls-enable',
    regex: /ALTER TABLE\s+public\.slide_import_session_traces\s+ENABLE ROW LEVEL SECURITY/i,
  },
  {
    id: 'deny-client-policy',
    regex: /CREATE POLICY\s+"deny client access"\s+ON public\.slide_import_session_traces/i,
  },
]

if (!existsSync(MIGRATIONS_DIR)) {
  console.error(`slides-migration-verification: missing migrations dir at ${MIGRATIONS_DIR}`)
  process.exit(1)
}

const sql = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  .join('\n\n')

const missing = requiredChecks.filter((check) => !check.regex.test(sql))
if (missing.length > 0) {
  console.error('slides-migration-verification: failed')
  for (const check of missing) {
    console.error(`- missing required migration proof: ${check.id}`)
  }
  process.exit(1)
}

console.log('slides-migration-verification: ok')
