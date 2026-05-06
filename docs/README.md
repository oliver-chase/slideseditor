# Setup and Runtime Docs

Canonical setup docs for this repo:
- `docs/SETUP_MODES.md` — installation profiles vs runtime modes
- `docs/MANUAL_SETUP.md` — shortest manual path for a local checkout
- `docs/repo-structure-contract.md` — tracked path/contract authority

Use this order when deciding setup behavior:
1. `README.md`
2. `docs/SETUP_MODES.md`
3. `docs/MANUAL_SETUP.md`
4. project-specific product docs

Public tracked files describe the reusable contract.
Private operator state stays in `.env.local`, `.secrets/*`, local tokens, and host/runtime wiring outside git.
