# Manual Setup

Fastest path for a new local checkout:

1. Review `README.md`
2. Review `docs/SETUP_MODES.md`
3. Create local runtime env from `.env.example`
4. Keep real values in `.env.local` only
5. Keep private runtime artifacts in `.secrets/*`
6. Run `bash scripts/run-profile-checks.sh --profile local-runtime --mode repo-local`

## Private overlay workflow

Use `private-overlay` only when you need:
- mirrored runtime env values
- delegated tokens
- host scheduler wiring
- machine-specific private assets

In that mode:
- tracked docs stay generic
- `.env.example` stays placeholder-only
- local/private values stay out of git
