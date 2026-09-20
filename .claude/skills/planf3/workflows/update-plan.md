# Update Plan

1. Identify the Plan - From the `USER_PROMPT`, locate the target plan `.html` file to modify
2. Scope the Change - THINK HARD about exactly what the prompt asks to change, extend, or revise; keep the edit surgical and touch only the affected sections
3. Apply the Change - Edit the relevant plan sections in place, preserving existing structure, content, and `{{...}}` conventions. **If the change reflects completed work, check off the specific task/checklist boxes that are done (`[x]`) — not just the phase header. Roll a phase header up to `[x]` only once every task + test box inside it is `[x]`/`[f]`.**
4. Sync the TOC - If the change added, removed, renamed, or reordered a section or a phase, update the `<nav id="toc">` in the same edit. Every link must still point at a real `id`; a new phase needs both its `id="phase-N"` and its TOC entry
5. Update Metadata - Append the current ISO timestamp to `modified` and append the agent name / session id to their lists; never overwrite existing metadata entries
6. Record Amendment - Append a new entry to the Amendments section (newest at the bottom) summarizing what changed and why
7. Report - Summarize the change made and the amendment recorded
