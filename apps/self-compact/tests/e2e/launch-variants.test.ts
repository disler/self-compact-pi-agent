/**
 * The three launch commands from the Definition of Done, /self-compact-info without an LLM turn,
 * the --compact-prompt literal, invalid settings, and the untouched built-in /compact.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { RpcClient, eventsOfType, messageText, type RpcEvent } from "../harness/rpc-client.ts";
import { DEFAULT_FAKE_ENV, makeTestDir, scriptedArgs } from "../harness/env.ts";

const LITERAL_PROMPT = "Summarize the current goal, completed work, exact paths, test results, and next action. Do not invent completed work.";

async function info(client: RpcClient): Promise<{ text: string; events: RpcEvent[] }> {
	const since = client.mark();
	const response = await client.request({ type: "prompt", message: "/self-compact-info" });
	assert.equal(response.success, true, JSON.stringify(response));
	const notify = await client.waitFor((e) => e.type === "extension_ui_request" && e.method === "notify" && /^self-compact info/.test(String(e.message)), 20_000, { since });
	return { text: String(notify.message), events: client.events.slice(since) };
}

test("launch 1: defaults on a 1M model resolve to 100k / 200k / 300k (10% / 20% / 30%); info starts no LLM turn", async () => {
	const t = makeTestDir("launch-defaults");
	const client = new RpcClient({
		args: scriptedArgs(t, ["--model", "anthropic/claude-sonnet-4-5"]),
		cwd: t.dir,
		env: DEFAULT_FAKE_ENV,
		logFile: t.logFile,
	});
	try {
		const { text, events } = await info(client);
		assert.match(text, /--compact-soft-at 10% \(default\), --compact-at 20% \(default\), --compact-buffer 10% \(default\), --compact-prompt unset/);
		assert.match(text, /window 1,000,000 tokens, cap 900,000/);
		assert.match(text, /resolved: soft 100,000 \(10\.0%\), warning 200,000 \(20\.0%\), buffer 100,000, forced 300,000 \(30\.0%\)/);
		assert.match(text, /prompts: soft .*USER_PROMPT_SOFT_SELF_COMPACT\.md \(\d+ chars\), warning .*USER_PROMPT_WARNING_SELF_COMPACT\.md \(\d+ chars\), compaction .*USER_PROMPT_COMPACTION_MESSAGE\.md \(\d+ chars\)/);
		assert.match(text, /state: level (idle|unknown), tools unlocked, handoff none, attempts 0/);
		assert.match(text, /cycles completed: 0/);
		assert.equal(eventsOfType(events, "agent_start").length, 0, "no LLM turn for /self-compact-info");
		assert.doesNotMatch(text, /REJECTED/);
	} finally {
		await client.close();
	}
});

test("launch 2: 100k / 200k / 50k on a 1M model -> 10% / 20% / 25% markers", async () => {
	const t = makeTestDir("launch-tokens");
	const client = new RpcClient({
		args: scriptedArgs(t, ["--model", "anthropic/claude-sonnet-4-5", "--compact-soft-at", "100k", "--compact-at", "200k", "--compact-buffer", "50k"]),
		cwd: t.dir,
		env: DEFAULT_FAKE_ENV,
		logFile: t.logFile,
	});
	try {
		const { text, events } = await info(client);
		assert.match(text, /--compact-soft-at 100k \(flag\), --compact-at 200k \(flag\), --compact-buffer 50k \(flag\)/);
		assert.match(text, /resolved: soft 100,000 \(10\.0%\), warning 200,000 \(20\.0%\), buffer 50,000, forced 250,000 \(25\.0%\)/);
		assert.ok(text.includes("[-~-!|---------------]"), `bar markers moved to 10/20/25: ${text}`);
		assert.equal(eventsOfType(events, "agent_start").length, 0);
	} finally {
		await client.close();
	}
});

test("launch 3: 20% / 50% / 0 with --compact-prompt: zero buffer, literal summary prompt, note-free /compact", async () => {
	const t = makeTestDir("launch-percent-prompt");
	const client = new RpcClient({
		args: scriptedArgs(t, ["--compact-soft-at", "20%", "--compact-at", "50%", "--compact-buffer", "0", "--compact-prompt", LITERAL_PROMPT]),
		cwd: t.dir,
		env: { ...DEFAULT_FAKE_ENV, SC_FAKE_SCENARIO: "never-compact", SC_FAKE_MAX_STEPS: "3", SC_FAKE_STEP: "5000", SC_FAKE_TRACE: t.traceFile },
		logFile: t.logFile,
	});
	try {
		const first = await info(client);
		assert.match(first.text, /--compact-prompt set \(\d+ chars\)/);
		assert.match(first.text, /resolved: soft 40,000 \(20\.0%\), warning 100,000 \(50\.0%\), buffer 0, forced 100,000 \(50\.0%\)/);
		assert.ok(first.text.includes("[---~-----|----------]"), `zero buffer shows a single | : ${first.text}`);
		assert.match(first.text, /compaction flag \(\d+ chars\)/);

		// A short bounded conversation, then the built-in /compact escape hatch (RPC "compact" = /compact).
		await client.request({ type: "prompt", message: "Start the scripted work." });
		await client.waitFor((e) => e.type === "agent_settled", 60_000);
		const compact = await client.request({ type: "compact" }, 60_000);
		assert.equal(compact.success, true, JSON.stringify(compact));
		const data = compact.data as { summary?: string; details?: { selfCompact?: { promptSource?: string; noteChars?: number } } };
		assert.ok((data.summary ?? "").includes(`FAKE-SUMMARY[${LITERAL_PROMPT.slice(0, 60)}]`), `literal --compact-prompt used as the summary system prompt: ${data.summary}`);
		assert.equal(data.details?.selfCompact?.promptSource, "flag");
		assert.equal(data.details?.selfCompact?.noteChars, 0, "manual /compact runs without a note");
		assert.equal(eventsOfType(client.events, "message_end").filter((e) => (e.message as { details?: { kind?: string } })?.details?.kind === "handoff").length, 0, "no note to return after a note-free /compact");
		const after = await info(client);
		assert.match(after.text, /handoff none/);
	} finally {
		await client.close();
	}
});

test("invalid settings are rejected: info reports it and every tool is blocked", async () => {
	const cases: Array<{ name: string; flags: string[]; pattern: RegExp }> = [
		{ name: "reject-cap", flags: ["--compact-at", "95%"], pattern: /REJECTED: Invalid --compact-at: "95%" is above the 90% hard cap/ },
		{ name: "reject-order", flags: ["--compact-soft-at", "60%", "--compact-at", "50%"], pattern: /REJECTED: Invalid thresholds: --compact-soft-at \(60%\) must not exceed --compact-at \(50%\)/ },
		{ name: "reject-syntax", flags: ["--compact-buffer", "lots"], pattern: /REJECTED: Invalid --compact-buffer: "lots"/ },
		{ name: "reject-mixed", flags: ["--compact-soft-at", "60%", "--compact-at", "500k"], pattern: /REJECTED: Invalid --compact-at: 500k \(500000 tokens\) exceeds the 90% cap/ },
	];
	for (const c of cases) {
		const t = makeTestDir(c.name);
		// Bounded fake: with every tool blocked the scripted agent would otherwise retry forever.
		const client = new RpcClient({ args: scriptedArgs(t, c.flags), cwd: t.dir, env: { ...DEFAULT_FAKE_ENV, SC_FAKE_MAX_STEPS: "2", SC_FAKE_TRACE: t.traceFile }, logFile: t.logFile });
		try {
			const { text } = await info(client);
			assert.match(text, c.pattern, `${c.name}: ${text}`);
			const since = client.mark();
			await client.request({ type: "prompt", message: "Start the scripted work." });
			const blocked = await client.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "bash", 30_000, { since });
			assert.equal(blocked.isError, true, `${c.name}: tool blocked`);
			assert.match(messageText(blocked.result), /rejected its settings/, `${c.name}: reason names the rejection (got: ${messageText(blocked.result).slice(0, 120)})`);
			await client.waitFor((e) => e.type === "agent_settled", 30_000, { since });
		} finally {
			await client.close();
		}
	}
});

test("commands: self-compact-info and self-compact-now are registered; built-in /compact is untouched", async () => {
	const t = makeTestDir("commands");
	const client = new RpcClient({ args: scriptedArgs(t), cwd: t.dir, env: DEFAULT_FAKE_ENV, logFile: t.logFile });
	try {
		const response = await client.request({ type: "get_commands" });
		const names = ((response.data as { commands?: Array<{ name: string; source: string }> })?.commands ?? []).filter((c) => c.source === "extension").map((c) => c.name);
		assert.ok(names.includes("self-compact-info"), names.join(","));
		assert.ok(names.includes("self-compact-now"), names.join(","));
		assert.ok(!names.includes("compact"), "no extension command shadows the built-in /compact");
	} finally {
		await client.close();
	}
});
