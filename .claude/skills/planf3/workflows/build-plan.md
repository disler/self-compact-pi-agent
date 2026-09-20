# Build Plan

Task status markers: `[]` idle · `[wip]` in progress · `[x]` complete · `[f]` failed.

1. Locate the Plan - From the `USER_PROMPT`, resolve the path to the target plan `.html` file; if no path is given, infer the most likely plan from `PLAN_OUTPUT_DIRECTORY` and confirm before building
2. Absorb Context - Read the full plan: all embedded images, the metadata header, and every back reference (depth 1) so you fully understand prior/related work before writing code
3. Execute Phases - For each phase in order, top to bottom:
   - Announce the phase you are starting
   - Set the phase and current task marker to `[wip]` in the plan file
   - Implement the task's specific actions
   - Run that phase's Testing Strategy commands; loop on failure until they pass
   - Check off work at BOTH levels, fine-grained: mark each individual task/checklist box `[x]` the moment it lands (or `[f]` if it cannot be made to pass) — one by one as you go, never in a single bulk pass at the end
   - Mark the PHASE header `[x]` ONLY after every task + test box inside it is `[x]`/`[f]`; never mark a phase `[x]` while it still holds unchecked boxes, and never check only the phase header while its tasks stay `[]`
   - Do not start the next phase until the current phase's tasks and tests resolve
4. Final Validation - Run the global Validation Commands and confirm every box passes
5. Update Metadata - Append the current ISO timestamp to `modified`, append agent name / session id, and append the relevant commit SHA(s) to the metadata header
6. Report - Summarize what was built per phase, the final status of every task, and any `[f]` failures that need attention
