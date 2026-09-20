# Self Compaction

## Problem

Long Running autonomous agents run out of context.

Long running context reduces performance (context rot) and burns cash (state of the art models).

These agents are primarily built for long running, autonomous, no human in the loop "out loop" agentic work.

## Solution

Build a standalone pi coding agent with a few key features.

1. `self_compact(note_to_self)` - allow the agent to compact itself.
2. `Context Control` - Three unique threshold levels: notice, warning, forced compaction with cli flags to support it.
3. `Pi UI` - 0 A UI to match the three compaction levels.
4. `Prompt Engineering` - Concrete prompts for each interaction with our agent (compaction prompt, soft notice user prompt, warning user prompt)
5. `HIL Commands` - concrete commands to showcase our threshold limits and to force a compaction by hand.

## Variables

- `PROJECT_ROOT: /Users/indydevdan/Documents/projects/yt/self-compact`
- `PI_AGENT_AI_DOCS_DIR: <PROJECT_ROOT>/ai_docs/`, read-only.
- `PLAN_DIR: <PROJECT_ROOT>/specs/<name-of-model-or-agent>/`
  - Save your own plan here.
- `YOUR_WORKING_DIR: <PROJECT_ROOT>/apps/<name-of-model-or-agent>/`
  - Save your work here.

## Workflow

1. Plan. Use the `/planf3` skill to create an implementation plan from these requirements and `PI_AGENT_AI_DOCS_DIR`. Save the completed plan in `PLAN_DIR/` before writing implementation code.

2. Build. After the plan is written, follow `/planf3`'s build step to implement that plan inside `YOUR_WORKING_DIR`. Do not skip straight from this prompt to implementation.

3. Verify. Check every item in Definition Of Done, fix failures, and rerun the affected checks. Keep final verification artifacts inside `YOUR_WORKING_DIR` and report actual results and any remaining blockers.

## Definition Of Done

### Workflow Complete

- Your completed `/planf3` implementation plan exists in `PLAN_DIR/`.
  - It was written before implementation, and the build followed its build step.
- `YOUR_WORKING_DIR/extensions/self-compact/self-compact.ts` loads as a standalone extension, with small helpers as needed and no dependency on other extensions.

### Self Compact Tool

- The handoff tool resumes real work.
  - `self_compact({note_to_self: "..."})` rejects blank notes and notes over 24,000 characters, saves valid notes, and ends the current run cleanly.
  - Expected: compact only once idle, return the note verbatim, restore tools, and continue without another user message.
  - For a task whose saved next action is to write `YOUR_WORKING_DIR/result.txt` containing `done`, verify that exact file result after continuation. A completed task must not restart.
  - Failed or cancelled compaction preserves the note and keeps other tools locked until success. Retry and reload recovery retain the handoff.


### User Interface

- The context bar shows usage and thresholds.
  - Expected example: `[###~====-!-|--------] 40%`, with default thresholds and half the used context cached.
  - Verify 20 cells at 5% each, cached `#`, uncached `=`, free `-`, and visible `~` / `!` / `|` markers at 20% / 50% / 60%.
  - The token-based launch on a 1,000,000-token model moves markers to 10% / 20% / 25%. A zero buffer shows `|` where warning and forced overlap.

### Prompt Engineering

- Files are in correct places:
    - `YOUR_WORK_DIR/.pi/self-compact/USER_PROMPT_SOFT_SELF_COMPACT.md` supplies editable soft OPTIONAL guidance with live usage values. Runs from `--compact-soft-at`.
    - `YOUR_WORK_DIR/.pi/self-compact/USER_PROMPT_WARNING_SELF_COMPACT.md` supplies a more stern 'time to compact soon, hard cutoff at ...' message. Runs from `--compact-at`.
    - `YOUR_WORK_DIR/.pi/self-compact/USER_PROMPT_COMPACTION_MESSAGE.md` replaces pi coding agent default compaction prompt. Is overridden by `--compact-prompt`


### Compact Thresholds

- All four flags work.
  - `--compact-soft-at 20%`: optional heads-up, tools remain available.
  - `--compact-at 50%`: ask the agent to write its note and compact, without blocking ordinary tools yet.
  - `--compact-buffer 10%`: allow ten more percentage points of the model window, then block other tools at 60%. Accept `0` for immediate enforcement.
  - `--compact-prompt "..."`: replace the summary system prompt with literal text, independently of the saved note and optional user-prompt file.
  - Thresholds and buffer accept whole token counts, `k`/`m` suffixes, or percentages `%`. Cap the hard limit at 90% and reject invalid settings.
  - Defaults (after testing. test with lower amounts)
    - soft: 225k
    - warning: 250k
    - force: 270k

### Launch Commands

- Launch variants produce expected results:
  - `pi -e "$YOUR_WORKING_DIR/extensions/self-compact/self-compact.ts"`
    - Expected launch with the defaults: 225k, 250k, 270k. Use a combo of `k` and `%`.
  - `pi -e "$YOUR_WORKING_DIR/extensions/self-compact/self-compact.ts" --compact-soft-at 100k --compact-at 200k --compact-buffer 50k`
  - Expected: soft at 100,000 tokens, warning at 200,000, and other tools blocked at 250,000. Use a model with at least a 300,000-token window.
  - `pi -e "$YOUR_WORKING_DIR/extensions/self-compact/self-compact.ts" --compact-soft-at 20% --compact-at 50% --compact-buffer 0 --compact-prompt "Summarize the current goal, completed work, exact paths, test results, and next action. Do not invent completed work."`
  - Expected: soft at 20%, other tools blocked at 50%, and the supplied summary system prompt used. The saved note returns separately after success.

### HIL Commands

- Slash commands are available.
  - `/self-compact-info`: show settings, resolved thresholds, usage, state, cycle count, prompt details, and pending notes or errors without starting an LLM turn.
  - `/self-compact-now`: ask the agent to write its note and call `self_compact`. On retry, include the saved note rather than inventing one or bypassing the tool.
  - `/compact`: retain Pi’s manual escape hatch outside the required-note workflow, while honoring the configured summary overrides. (Don't touch built in)


## How You're Graded

- You'll be graded on a continuous basis based on every completed bullet in the definition of done.
- Every step of Workflow must be fully accomplished: plan, build and verify.
- Instant failure if you write project deliverables outside your `YOUR_WORKING_DIR` with the exception of `PLAN_DIR`
- Instant failure if you read any part of any file inside of <PROJECT_ROOT>specs/* that isn't your own plan.
- Instant failure if you read any part of any file inside of <PROJECT_ROOT>apps/* that isn't your own work.
- Running tools outside these directories is allowed. Temporary files and tool-managed runtime data (caches, logs, browser profiles, updater logs) may use their normal locations and are not grading failures.
- If you find you've mistakenly caused a failure stop immediately and report your failure.
