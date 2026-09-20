#!/usr/bin/env bash
# Runs every check for the merged self-compact extension and writes artifacts to verification/.
# Usage: bash scripts/verify.sh            (deterministic checks)
#        SC_REAL=1 bash scripts/verify.sh  (also runs the live model test)
set -u
cd "$(dirname "$0")/.."
OUT=verification
mkdir -p "$OUT"
export PI_SKIP_VERSION_CHECK=1
status=0
run() {
  local name="$1"; shift
  echo "==> $name"
  if "$@" >"$OUT/$name.log" 2>&1; then echo "    PASS ($OUT/$name.log)"; else echo "    FAIL ($OUT/$name.log)"; status=1; fi
}

run 01-deliverables ls -la extensions/self-compact/self-compact.ts .pi/self-compact/USER_PROMPT_SOFT_SELF_COMPACT.md .pi/self-compact/USER_PROMPT_WARNING_SELF_COMPACT.md .pi/self-compact/USER_PROMPT_COMPACTION_MESSAGE.md
run 02-help-flags bash -c 'perl -e "alarm 60; exec @ARGV" pi --no-extensions -e extensions/self-compact/self-compact.ts --help </dev/null | grep -A6 "Extension CLI Flags" | tee /dev/stderr | grep -c "compact-" | grep -qx 4'
run 03-typecheck bash scripts/typecheck.sh
run 04-unit npm run -s test:unit
run 04-parity npm run -s test:parity
run 05-e2e-lifecycle node --test --test-timeout=300000 tests/e2e/lifecycle.test.ts
run 06-e2e-failure-recovery node --test --test-timeout=300000 tests/e2e/failure-recovery.test.ts
run 07-e2e-launch-variants node --test --test-timeout=300000 tests/e2e/launch-variants.test.ts
if [ "${SC_REAL:-0}" = "1" ]; then
  run 08-e2e-real-model node --test --test-timeout=600000 tests/e2e/real-model.test.ts
  cp verification/tmp/real-model/summary.json "$OUT/08-real-model-summary.json" 2>/dev/null || true
else
  echo "==> 08-e2e-real-model skipped (set SC_REAL=1)"
fi
if command -v tmux >/dev/null 2>&1; then
  run 09-tui-footer bash scripts/tui-smoke.sh
else
  echo "==> 09-tui-footer skipped (tmux not installed)"
fi
echo
if [ $status -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "SOME CHECKS FAILED"; fi
exit $status
