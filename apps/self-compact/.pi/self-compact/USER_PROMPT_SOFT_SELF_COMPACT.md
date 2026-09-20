[self-compact · notice] Heads-up only. Context usage is {{used_tokens}} tokens ({{used_percent}}) of a {{context_window}}-token window, past the soft line of {{soft_tokens}} ({{soft_percent}}). Nothing is blocked, nothing is required, and this message asks for no action. Keep working.

For awareness: the warning line is at {{warning_tokens}} tokens ({{warning_percent}}) and the hard cutoff at {{forced_tokens}} ({{forced_percent}}), {{remaining_to_forced}} tokens away. You will be told when you reach the warning line, and there is still room to work before it. If you want to know where you stand as you move closer, call `view_context` for the current numbers.

You are in control of when to compact. If you ever decide the moment is right, `self_compact` takes a `note_to_self` (up to {{note_max_chars}} chars) with anything you would want to see or know after the compaction; it is handed back to you as is. Compaction cycles completed so far: {{cycle}}.
