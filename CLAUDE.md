> Framework rules (voice, practice, gates, skill placement) load automatically from
> `~/.claude/CLAUDE.md`, which symlinks into OliverCode. Resolve OliverCode's own path with
> `dirname "$(readlink ~/.claude/CLAUDE.md)"` when you need a file from it. This file carries
> only what is specific to this repo.

# slideseditor — Agent Rules

Open work lives in the `slideseditor` GitHub Project (`oliver-chase`, project 16), named in
`docs/backlog-config.json` — `backlog-management` governs it. `BACKLOG.md` no longer exists;
every item it held was still open, so all of it was filed as issues (#1-#10) instead of
deleted.

No build command, test command, or npm scripts exist in this repo (there is no `package.json`).
The engine rebuild step is `node scripts/build-bundle.mjs` (zero dependencies), run after
changing `engine/*.ts` or `src/shell.html`. The only real pre-commit validation is this repo's
own `.githooks/pre-commit` (nine gates: secrets, icons/emojis, PII, deleted-repo references,
workflow push auth, planning-doc governance, backlog hygiene, archived content, writing
clarity), installed via `core.hooksPath`.
