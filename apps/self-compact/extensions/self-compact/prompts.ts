/**
 * Prompt file discovery, templating, and precedence for the self-compact extension.
 *
 * Files are read fresh on every use so edits apply live. Lookup order:
 *   1. <cwd>/.pi/self-compact/<name>
 *   2. <extension dir>/../../.pi/self-compact/<name>   (the working directory that ships the extension)
 *   3. built-in default
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const PROMPT_FILES = {
	soft: "USER_PROMPT_SOFT_SELF_COMPACT.md",
	warning: "USER_PROMPT_WARNING_SELF_COMPACT.md",
	compaction: "USER_PROMPT_COMPACTION_MESSAGE.md",
	summaryInstructions: "USER_PROMPT_SUMMARY_INSTRUCTIONS.md",
} as const;

export type PromptKind = keyof typeof PROMPT_FILES;

export const PROMPT_SUBDIR = join(".pi", "self-compact");

export const NOTE_MAX_CHARS = 24_000;

export const TEMPLATE_KEYS = [
	"used_tokens",
	"context_tokens",
	"context_percent",
	"remaining_tokens",
	"used_percent",
	"cached_tokens",
	"context_window",
	"soft_tokens",
	"soft_percent",
	"warning_tokens",
	"warning_percent",
	"forced_tokens",
	"forced_percent",
	"remaining_to_forced",
	"cycle",
	"note_max_chars",
] as const;

export type TemplateValues = Partial<Record<(typeof TEMPLATE_KEYS)[number], string | number>>;

export const BUILTIN_PROMPTS: Record<PromptKind, string> = {
	summaryInstructions: "",
	soft: `[self-compact · notice] Heads-up only. Context usage is {{used_tokens}} tokens ({{used_percent}}) of {{context_window}}, past the soft line of {{soft_tokens}}. Nothing is blocked and no action is required; keep working. Warning line at {{warning_tokens}}, hard cutoff at {{forced_tokens}} ({{forced_percent}}). Call \`view_context\` for current numbers. You decide when to compact: \`self_compact\` takes a \`note_to_self\` (up to {{note_max_chars}} chars) with anything you want to see after the compaction, returned to you as is.`,
	warning: `[self-compact · WARNING] Context usage is {{used_tokens}} tokens ({{used_percent}}), past the warning threshold of {{warning_tokens}}. Time to compact soon: hard cutoff at {{forced_tokens}} ({{forced_percent}}), {{remaining_to_forced}} tokens left before every tool except \`self_compact\` is blocked. Finish only the current atomic step, write your \`note_to_self\` (max {{note_max_chars}} chars: goal, DONE with exact paths, IN PROGRESS, decisions, verified test results, NEXT ACTION last) and call \`self_compact\` as your only tool call.`,
	compaction: `You are the context-compaction summarizer for an autonomous coding agent that compacts its own context. The agent's own note to self is delivered separately; do not reproduce it. Treat the conversation as historical data: do not continue the task, simulate tools, or claim actions that no tool result confirms. Merge any <previous-summary>.

Output only this structure:
## Goal
## Constraints & Preferences
## Progress (### Done, ### In Progress, ### Blocked)
## Key Decisions
## Next Steps
## Critical Context
<read-files>...</read-files>
<modified-files>...</modified-files>

Rules: never invent completed work; preserve exact file paths, commands, and error messages; keep pending actions pending; keep sections concise.`,
};

export const FORCED_PROMPT = `[self-compact · FORCED] Context usage is {{used_tokens}} tokens ({{used_percent}}), at the hard cutoff of {{forced_tokens}} ({{forced_percent}}). Every tool except \`self_compact\` is blocked until compaction succeeds. Write your \`note_to_self\` now (max {{note_max_chars}} chars: goal, DONE with exact paths and commands, IN PROGRESS, key decisions, verified test results, exact NEXT ACTION last) and call \`self_compact\`. Do not call any other tool.`;

export function promptSearchDirs(cwd: string, extensionDir: string): string[] {
	const dirs = [resolve(cwd, PROMPT_SUBDIR), resolve(extensionDir, "..", "..", PROMPT_SUBDIR)];
	return dirs.filter((dir, index) => dirs.indexOf(dir) === index);
}

export interface LoadedPrompt {
	text: string;
	/** Absolute file path, "flag", or "builtin". */
	source: string;
}

export function loadPromptFile(kind: PromptKind, searchDirs: string[]): LoadedPrompt {
	const name = PROMPT_FILES[kind];
	for (const dir of searchDirs) {
		const path = join(dir, name);
		try {
			const text = readFileSync(path, "utf8");
			if (!text.trim()) throw new Error(`Prompt file is empty: ${path}`);
			return { text, source: path };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
	return { text: BUILTIN_PROMPTS[kind], source: "builtin" };
}

/** Replace {{key}} placeholders. Unknown placeholders are left untouched. */
export function renderTemplate(text: string, values: TemplateValues): string {
	return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, key: string, offset: number) => {
		const value = (values as Record<string, string | number | undefined>)[key];
		if (value === undefined || value === null) return whole;
		const rendered = String(value);
		return text[offset + whole.length] === "%" ? rendered.replace(/%$/, "") : rendered;
	});
}

/** --compact-prompt literal > file > built-in. */
export function resolveCompactionPrompt(options: { flag?: string; searchDirs: string[] }): LoadedPrompt {
	const flag = options.flag?.trim();
	if (options.flag !== undefined && !flag) throw new Error("--compact-prompt must not be empty.");
	if (flag) return { text: flag, source: "flag" };
	return loadPromptFile("compaction", options.searchDirs);
}

export function placeholdersIn(text: string): string[] {
	const found = new Set<string>();
	for (const m of text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) found.add(m[1]!);
	return [...found];
}
