import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SLIDES_MODULE_DIR = join(ROOT, '.github', 'oliver-app', 'modules', 'slides-module')

const files = readdirSync(SLIDES_MODULE_DIR)
  .filter((name) => name.endsWith('.md'))
  .sort((a, b) => a.localeCompare(b))

const REQUIRED_FIELDS = [
  { key: 'Epic', pattern: /^Epic:\s*.+$/m },
  { key: 'Acceptance Criteria', pattern: /^Acceptance Criteria:\s*$/m },
  { key: 'QA / Evidence', pattern: /^QA \/ Evidence:\s*$/m },
  { key: 'Test Plan', pattern: /^Test Plan:\s*$/m },
]

const findings = []
let doneVerifiedCount = 0

for (const file of files) {
  const absolutePath = join(SLIDES_MODULE_DIR, file)
  const text = readFileSync(absolutePath, 'utf8')
  const status = (text.match(/^Status:\s*(.+)$/m) || [])[1]?.trim() || ''
  const verified = (text.match(/^Verified:\s*(.+)$/m) || [])[1]?.trim().toLowerCase() || ''

  if (!/^(done|complete)$/i.test(status) || verified !== 'true') continue
  doneVerifiedCount += 1

  const missing = REQUIRED_FIELDS
    .filter(({ pattern }) => !pattern.test(text))
    .map(({ key }) => key)
  if (!/^- \[x\]\s+.+$/im.test(text)) {
    missing.push('checked Acceptance Criteria')
  }
  if (/^- \[ \]\s+.+$/im.test(text)) {
    missing.push('unchecked Acceptance Criteria')
  }
  if (missing.length === 0) continue

  findings.push({ file, missing })
}

if (findings.length > 0) {
  console.error(
    `slides-lifecycle-audit: failed (${findings.length} files missing required fields out of ${doneVerifiedCount} Done+Verified stories)`,
  )
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.missing.join(', ')}`)
  }
  process.exit(1)
}

console.log(
  `slides-lifecycle-audit: clean (${doneVerifiedCount} Done+Verified stories include Epic, checked Acceptance Criteria, QA / Evidence, and Test Plan)`,
)
