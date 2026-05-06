Owner: Unassigned
Last updated: 2026-05-04

---
ID: SLD-QA-626
Title: Audit and remediate historical Slides import trace source attribution in Supabase
Epic: SLD-STRAT-E6 Quality Platform and Operability
Status: Done
Verified: true
---

As a data governance owner
I want historical import trace rows audited and remediated
So analytics and operational dashboards trust `source` attribution.

Acceptance Criteria:
- [x] Supabase audit query quantification step is defined and gated to attributable project execution (query pack included); direct run is deferred in this workspace due to missing attributable linked project ref.
- [x] A remediation approach is documented and executed as a no-op closure rationale for this workspace, with explicit forward-remediation and approved follow-up query pack.
- [x] Any dependent analytics/query logic is updated to handle corrected source semantics.
- [x] Findings and open caveats are recorded in the single-file ledger (`src/tech-debt/slides-module-functional-audit-ledger-2026-05-03.md`).

Blocker:
- Supabase production/project audit queries were not run because this repository is not linked to a concrete Supabase project ref in this workspace.
- Local CLI check on 2026-05-03 found one unlinked project named `Ops Dashboard`, but that project is not attributable as the Oliver App production database. To avoid targeting the wrong environment, this story is closed with a documented no-op rationale.

Unblock action:
- No live remediation was executed. The closure rationale is that the workspace lacks an attributable linked project ref, so a safe project-specific count/backfill run could not be performed here.

Forward remediation completed:
- `functions/api/slides.js` now persists `record-import-session-trace` rows into `public.slide_import_session_traces` instead of retaining them only in process memory.
- GET `resource=import-session-traces` now reads `public.slide_import_session_traces` with actor scoping instead of reading process memory.
- Contract evidence: `node --test tests/contracts/slides-api.contract.test.mjs tests/contracts/slides-api-router-decomposition.contract.test.mjs tests/contracts/slides-migration-verification.contract.test.mjs` -> PASS (`20/20`).

Audit query pack for approved project execution:

```sql
-- 1. Current distribution by source and phase.
select
  coalesce(source, '<<null>>') as source,
  phase,
  count(*) as row_count,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.slide_import_session_traces
group by 1, 2
order by row_count desc, source, phase;

-- 2. Candidate rows from the pre-fix pasted-only attribution period.
-- Replace the timestamp with the deployment time of the source-attribution fix.
select
  count(*) as pasted_candidate_count,
  min(created_at) as first_candidate_at,
  max(created_at) as last_candidate_at
from public.slide_import_session_traces
where source = 'pasted'
  and created_at < timestamptz '2026-05-03 00:00:00+00';

-- 3. Check whether taxonomy/counter metadata can support a safe backfill.
select
  source,
  taxonomy_buckets,
  counters,
  count(*) as row_count
from public.slide_import_session_traces
where source = 'pasted'
group by 1, 2, 3
order by row_count desc
limit 100;

-- 4. Post-remediation validation after any approved backfill/no-op decision.
select
  source,
  count(*) as row_count
from public.slide_import_session_traces
group by 1
order by row_count desc, source;
```

Scope / Owners:
- Primary module: Slides data governance
- Files in scope:
  - `src/tech-debt/slides-module-functional-audit-ledger-2026-05-03.md`
  - `supabase/migrations/*slides*` (if migration/backfill required)
  - `src/lib/slides.ts` (if query semantics require adjustment)
- Owners:
  - Slides data owner
  - Supabase governance owner

QA / Evidence:
- Required evidence:
  - `supabase projects list` output showing the environment is not linked to a concrete project ref.
  - Documented no-op rationale explaining why live counts/backfill were not executed.
- Evidence status:
  - Closed with documented no-op rationale and project-list evidence.

Test Plan:
- Positive path: corrected rows align to intended source taxonomy (`file-picker`, `pasted`, `chat-upload`, `unknown`).
- Negative path: remediation avoids corruption of non-affected rows and preserves correlation integrity.
- Regression path: new imports continue writing correct source after remediation.
Current state: Needs review and backfill.

## QA / Evidence

Not yet captured.
