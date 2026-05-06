# Setup Modes

This repo uses the OliverCode public/private boundary standard.

## Two separate decisions

1. Installation profile = what surface you want to prepare
2. Runtime mode = where that surface runs

## Installation profiles

- `repo-contract-only`
  - Read tracked docs and contracts only
  - No local secrets required

- `local-runtime`
  - Prepare a runnable local checkout
  - Uses `.env.local`
  - Keeps machine-specific secrets out of git

- `private-overlay`
  - Compose the public repo with operator-private runtime state
  - Uses `.env.local`, `.secrets/*`, delegated tokens, host wiring, and local schedulers when needed

## Runtime modes

- `repo-local`
  - Validate and run only what the repo itself owns
  - Must not assume private vault content or host-only runtime state

- `vault-integrated`
  - Validate the integrated private runtime
  - May require mirrored env files, runtime shims, scheduler wiring, or operator-only assets

## Ownership split

Public repo owns:
- code
- docs
- templates
- validators
- bootstrap entrypoints

Private overlay owns:
- `.env.local`
- `.secrets/*`
- `.runtime/`
- `.hermes/`
- delegated tokens
- host scheduler wiring
- machine-specific credentials
