import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	BUILTIN_PROMPTS,
	FORCED_PROMPT,
	PROMPT_FILES,
	loadPromptFile,
	placeholdersIn,
	promptSearchDirs,
	renderTemplate,
	resolveCompactionPrompt,
} from "../../extensions/self-compact/prompts.ts";

const HERE = resolve(new URL(".", import.meta.url).pathname);
const WORKDIR = resolve(HERE, "..", "..");

test("promptSearchDirs prefers cwd then the extension's working dir", () => {
	const dirs = promptSearchDirs("/tmp/project", "/work/extensions/self-compact");
	assert.deepEqual(dirs, ["/tmp/project/.pi/self-compact", "/work/.pi/self-compact"]);
	const same = promptSearchDirs("/work", "/work/extensions/self-compact");
	assert.deepEqual(same, ["/work/.pi/self-compact"]);
});

test("loadPromptFile: cwd file wins, then extension fallback, then builtin", () => {
	const root = mkdtempSync(join(tmpdir(), "sc-prompts-"));
	const cwdDir = join(root, "cwd", ".pi", "self-compact");
	const extDir = join(root, "ext", ".pi", "self-compact");
	mkdirSync(cwdDir, { recursive: true });
	mkdirSync(extDir, { recursive: true });
	const dirs = [cwdDir, extDir];

	assert.deepEqual(loadPromptFile("soft", dirs), { text: BUILTIN_PROMPTS.soft, source: "builtin" });

	writeFileSync(join(extDir, PROMPT_FILES.soft), "from ext {{used_tokens}}");
	assert.deepEqual(loadPromptFile("soft", dirs), { text: "from ext {{used_tokens}}", source: join(extDir, PROMPT_FILES.soft) });

	writeFileSync(join(cwdDir, PROMPT_FILES.soft), "from cwd");
	assert.deepEqual(loadPromptFile("soft", dirs), { text: "from cwd", source: join(cwdDir, PROMPT_FILES.soft) });

	writeFileSync(join(cwdDir, PROMPT_FILES.soft), "   \n");
	assert.throws(() => loadPromptFile("soft", dirs), /Prompt file is empty/, "an invalid override must not silently fall back");
});

test("renderTemplate replaces known placeholders and leaves unknown ones", () => {
	const out = renderTemplate("use {{used_tokens}} of {{context_window}} ({{ used_percent }}) {{mystery}}", {
		used_tokens: 120000,
		context_window: "300000",
		used_percent: "40%",
	});
	assert.equal(out, "use 120000 of 300000 (40%) {{mystery}}");
});

test("resolveCompactionPrompt: flag > file > builtin", () => {
	const root = mkdtempSync(join(tmpdir(), "sc-compaction-"));
	const dir = join(root, ".pi", "self-compact");
	mkdirSync(dir, { recursive: true });
	assert.deepEqual(resolveCompactionPrompt({ searchDirs: [dir] }), { text: BUILTIN_PROMPTS.compaction, source: "builtin" });
	writeFileSync(join(dir, PROMPT_FILES.compaction), "file prompt");
	assert.deepEqual(resolveCompactionPrompt({ searchDirs: [dir] }), { text: "file prompt", source: join(dir, PROMPT_FILES.compaction) });
	assert.deepEqual(resolveCompactionPrompt({ flag: "  literal prompt ", searchDirs: [dir] }), { text: "literal prompt", source: "flag" });
	assert.throws(() => resolveCompactionPrompt({ flag: "   ", searchDirs: [dir] }), /must not be empty/);
});

test("shipped prompt files exist and carry live-value placeholders", () => {
	const dir = join(WORKDIR, ".pi", "self-compact");
	const soft = readFileSync(join(dir, PROMPT_FILES.soft), "utf8");
	const warning = readFileSync(join(dir, PROMPT_FILES.warning), "utf8");
	const compaction = readFileSync(join(dir, PROMPT_FILES.compaction), "utf8");
	for (const key of ["used_tokens", "used_percent", "warning_tokens", "forced_tokens", "note_max_chars"]) {
		assert.ok(placeholdersIn(soft).includes(key), `soft prompt should reference {{${key}}}`);
	}
	for (const key of ["used_tokens", "forced_tokens", "forced_percent", "remaining_to_forced"]) {
		assert.ok(placeholdersIn(warning).includes(key), `warning prompt should reference {{${key}}}`);
	}
	assert.match(warning, /hard cutoff/i);
	assert.match(compaction, /## Next Steps/);
	assert.match(compaction, /never invent completed work/i);
	assert.ok(placeholdersIn(FORCED_PROMPT).includes("forced_tokens"));
});
