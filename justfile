set dotenv-load := true
set shell := ["/bin/zsh", "-ic"]

project_root := justfile_directory()
app := project_root + "/apps/self-compact"
ext := app + "/extensions/self-compact/self-compact.ts"

# Threshold overrides for `just run` (e.g. `just soft=5% warn=10% buffer=5% run`). Empty = the shipped defaults
# in apps/self-compact/extensions/self-compact/defaults.ts (notice 10%, warning 20%, hard cutoff 30% of the window).
soft := ""
warn := ""
buffer := ""

# Model for `just real` (override with SC_REAL_MODEL in .env or the shell).
real_model := env("SC_REAL_MODEL", "openrouter/deepseek/deepseek-v4.1-flash")

default:
    @just --list

# Run the self-compact Pi agent with the shipped defaults (notice 10%, warning 20%, hard cutoff 30% of the model window); extra args go to pi (e.g. --model openrouter/deepseek/deepseek-v4.1-flash).
run *ARGS:
    pi -e "{{ext}}" {{ if soft != "" { "--compact-soft-at " + soft } else { "" } }} {{ if warn != "" { "--compact-at " + warn } else { "" } }} {{ if buffer != "" { "--compact-buffer " + buffer } else { "" } }} {{ARGS}}

# Run with a scripted zero-cost model that walks every threshold (demo of the full cycle, no API key needed).
demo *ARGS:
    #!/usr/bin/env bash
    set -euo pipefail
    export SC_FAKE_WINDOW=200000 SC_FAKE_BASE=5000 SC_FAKE_STEP=20000 SC_FAKE_SCENARIO=ignore-until-forced
    pi --no-extensions -a -e "{{ext}}" -e "{{app}}/tests/harness/fake-provider.ts" --model fake/scripted \
       --compact-soft-at 20% --compact-at 50% --compact-buffer 10% {{ARGS}}

# Unit tests (thresholds, context bar, prompts, recovery reducer).
test:
    cd "{{app}}" && npm run -s test:unit

# Deterministic end-to-end tests through the real pi CLI with the scripted provider (no API cost).
e2e:
    cd "{{app}}" && npm run -s test:e2e

# Live model test (needs the provider key for real_model): forced cutoff -> self_compact -> compaction -> verbatim note -> result.txt = done.
real:
    cd "{{app}}" && SC_REAL=1 SC_REAL_MODEL="{{real_model}}" npm run -s test:real

# Every deterministic check: typecheck, unit, parity, e2e, TUI footer capture. Logs land in apps/self-compact/verification/ (gitignored).
verify:
    cd "{{app}}" && bash scripts/verify.sh
