> Framework rules (voice, practice, gates, skill placement) load automatically from
> `~/.claude/CLAUDE.md`, which symlinks into OliverCode. Resolve OliverCode's own path with
> `dirname "$(readlink ~/.claude/CLAUDE.md)"` when you need a file from it. This file carries
> only what is specific to this repo.

# slideseditor — Agent Rules

Open work lives in the `slideseditor` GitHub Project (`oliver-chase`, project 16), named in
`docs/backlog-config.json` — `backlog-management` governs it. `BACKLOG.md` no longer exists.
Every item it held was still open. This session filed all of it as issues (#1-#10) instead
of deleting it.

No build command, test command, or npm scripts exist in this repo. There is no `package.json`.
The engine rebuild step is `node scripts/build-bundle.mjs` (zero dependencies). Run it after
changing `engine/*.ts` or `src/shell.html`. The only real pre-commit validation is this
repo's own `.githooks/pre-commit`. It runs nine gates: secrets, icons/emojis, PII,
deleted-repo references, workflow push auth, planning-doc governance, backlog hygiene,
archived content, and writing clarity. A repo setting named `core.hooksPath` installs it.
