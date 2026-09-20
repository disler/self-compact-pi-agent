---
description: Prime Claude with the self-compact codebase: a standalone Pi extension that lets an autonomous agent compact its own context
---

# Purpose

Orient yourself in this repository: one Pi (v0.85.1) extension in `apps/self-compact/` that watches context usage against three thresholds, locks tools at the hard cutoff, lets the agent read its own usage through `view_context()`, and hands the agent off to itself through `self_compact(note_to_self)`, plus the specs and Pi docs that shaped it.

## Workflow

1. Run `git ls-files` to see the tracked tree (the extension in `apps/self-compact/`, plans in `specs/`, Pi docs in `ai_docs/`, the build prompt in `prompts/`).
2. Read `README.md` and `justfile` for the launch, demo, test, and verify recipes.
3. Read `apps/self-compact/README.md` and `apps/self-compact/extensions/self-compact/self-compact.ts` (entry) plus its six helpers in the same directory: `defaults.ts` (shipped thresholds 10% / 20% / 30%), `thresholds.ts`, `context-bar.ts`, `prompts.ts`, `summary.ts`, `state.ts`.
4. Read the three editable prompt files in `apps/self-compact/.pi/self-compact/`.
5. Skim `apps/self-compact/tests/harness/fake-provider.ts` (scripted model that drives the e2e suites) and `apps/self-compact/scripts/verify.sh` (what `just verify` checks; its logs land in a gitignored `verification/` folder).
6. Skim `specs/self-compact-merge.html` (merge plan) and `ai_docs/README.md` (which Pi docs matter: extensions, compaction, session format, TUI, RPC).
7. Summarize your understanding of the project: purpose, stack, structure, key files, and entry points.
