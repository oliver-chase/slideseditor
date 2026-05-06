# Quality Baseline Standard — Slides Editor

Slides Editor is a **standalone extraction of the Slides module from oliver-app**. This repository uses shared quality files managed by the OliverCode framework.

## Source of Truth

Canonical source (managed by OliverCode framework):

- `<vault-root>/Oliver/Project Repos/OliverCode/shared/templates/project/.github/workflows/qa-hygiene.yml`
- `<vault-root>/Oliver/Project Repos/OliverCode/shared/templates/project/.github/workflows/governance-secrets-gate.yml`
- `<vault-root>/Oliver/Project Repos/OliverCode/shared/templates/project/.github/workflows/dependency-review.yml`
- `<vault-root>/Oliver/Project Repos/OliverCode/shared/templates/project/.github/CODEOWNERS`
- `<vault-root>/Oliver/Project Repos/OliverCode/shared/templates/project/.github/pull_request_template.md`
- `<vault-root>/Oliver/Project Repos/OliverCode/shared/templates/project/QUALITY_BASELINE.md`

## Quality Gates

1. **TypeScript type checking** before push:
   ```bash
   npm run typecheck
   ```
2. **Module extraction correctness** — code moved out of `imported/` must preserve the import/edit/save/export workflow behavior.
3. **Dead scaffolding removal** — prefer deleting dormant code over leaving it in place.
4. **Docs alignment** — keep `docs/` aligned with route and API changes during extraction.
5. **No secrets** — do not commit `.env.local`, secrets, or host paths.

## Extraction-Specific Rules

- `imported/` is a temporary holding area for the original module code during extraction.
- Only current-scope code (import/edit/save/export) should be moved out of `imported/`.
- Once extraction is complete, `imported/` must be deleted entirely.
- Stale governance/audit/chatbot/module-web dependencies should be removed.

## Rule

If a managed quality file changes, the canonical file in OliverCode must be changed first and then synced to this project.

## Canonical Validation Command

Run from repo root:

```bash
bash scripts/validate.sh
```

This repo runs its own quality checks (pre-commit gates, profile checks). See `scripts/validate.sh` for the exact gate list.
