# Update References

1. Identify the Plan - From the `USER_PROMPT`, locate the target plan `.html` file to update
2. Identify Related Work - Determine the other plan(s)/doc(s) and the link direction: back reference (work this plan builds on or depends on) or forward reference (work that builds on or extends this plan)
3. Update This Plan - Edit the target plan's metadata header, adding the link to `{{BACK_REFERENCES}}` or `{{FORWARD_REFERENCES}}` (relative path + short label) without duplicating an existing reference
4. Update the Other Side - For each related plan, add the reciprocal reference so links stay bidirectional, then append the current ISO timestamp to `modified` on every plan touched
5. Record Amendment - Append a new entry to the Amendments section of each plan touched (newest at the bottom) noting the references added
6. Report - List each plan touched and the references added in each direction
