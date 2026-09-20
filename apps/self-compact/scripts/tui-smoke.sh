#!/usr/bin/env bash
# Launch pi interactively inside tmux with the scripted provider, drive one run through the
# thresholds, and capture the footer (context bar + level) at several points.
# Output: verification/tui-footer.txt
set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"
OUT="$ROOT/verification/tui-footer.txt"
DIR="$ROOT/verification/tmp/tui-smoke"
rm -rf "$DIR"; mkdir -p "$DIR/.pi" "$DIR/sessions"
echo '{"compaction":{"enabled":true,"reserveTokens":16384,"keepRecentTokens":1500}}' > "$DIR/.pi/settings.json"
SESSION="sc-tui-$$"
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -x 140 -y 42 -c "$DIR" \
  "env PI_SKIP_VERSION_CHECK=1 PI_OFFLINE=1 SC_FAKE_WINDOW=200000 SC_FAKE_BASE=5000 SC_FAKE_STEP=20000 SC_FAKE_SCENARIO=ignore-until-forced SC_FAKE_TRACE=$DIR/trace.jsonl \
   pi --no-extensions --no-skills --no-prompt-templates --no-context-files -a --no-session \
      -e $ROOT/extensions/self-compact/self-compact.ts -e $ROOT/tests/harness/fake-provider.ts \
      --model fake/scripted --compact-soft-at 20% --compact-at 50% --compact-buffer 10%; sleep 5"
sleep 6
{
  echo "### startup footer"
  tmux capture-pane -t "$SESSION" -p | tail -6
} > "$OUT"
tmux send-keys -t "$SESSION" "/self-compact-info" Enter
sleep 2
{
  echo; echo "### after /self-compact-info (card + footer)"
  tmux capture-pane -t "$SESSION" -p | grep -v '^\s*$' | tail -22
} >> "$OUT"
tmux send-keys -t "$SESSION" "Start the scripted work." Enter
sleep 8
{
  echo; echo "### after the scripted run (notice -> warning -> forced -> self_compact -> compaction -> handoff -> result)"
  tmux capture-pane -t "$SESSION" -p -S -2000 | grep -v '^\s*$' | tail -400
} >> "$OUT"
tmux send-keys -t "$SESSION" "/self-compact-info" Enter
sleep 2
{
  echo; echo "### final /self-compact-info"
  tmux capture-pane -t "$SESSION" -p | grep -v '^\s*$' | tail -16
} >> "$OUT"
tmux send-keys -t "$SESSION" "/quit" Enter
sleep 2
tmux kill-session -t "$SESSION" 2>/dev/null || true
echo "captured to $OUT"
# The run must have produced the result file and a footer line with the bar.
test -f "$DIR/result.txt" && grep -q "done" "$DIR/result.txt" && grep -Eq '\[[#=~!|-]{20}\] *[0-9-]+%' "$OUT"
