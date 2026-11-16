# Repo structure contract

Status: Active

## Canonical contract sources

1. `OliverCode/docs/RULES.md` ("Project structure")
2. `OliverCode/docs/CONTRACT.md`

## Profile

This repo uses the GitHub Project backlog profile. Its backlog is the GitHub Project named
in `docs/backlog-config.json`, read and written by the `backlog` skill.

## Required structure

1. Root docs:
- `README.md`
- `CLAUDE.md`
- `docs/repo-structure-contract.md`
2. Backlog:
- `docs/backlog-config.json` — the `backlog` skill's config for this repo's Project

## Backlog and evidence paths

1. Active backlog source: the GitHub Project named in `docs/backlog-config.json`
2. Story catalog source: the GitHub Project's issue list
3. Acceptance test matrix source: `N/A (each issue carries AC/test evidence directly)`

## Branches

This repo works on `main`. If it needs a development or staging branch, name it here with
what moves through it.

## Enforcement

1. `bash scripts/validate.sh`, which also runs `npm run validate` when the repo has one
