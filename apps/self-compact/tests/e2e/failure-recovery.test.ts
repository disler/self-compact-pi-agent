/**
 * Failure and recovery: a failing summarizer keeps the note and the lock, /self-compact-now
 * includes the saved note verbatim, and a restart with --session restores the handoff and
 * finishes it once the summarizer works again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RpcClient, eventsOfType, messageText, type RpcEvent } from "../harness/rpc-client.ts";
import { DEFAULT_FAKE_ENV, latestSessionFile, makeTestDir, scriptedArgs } from "../harness/env.ts";

const PERCENT_FLAGS = ["--compact-soft-at", "20%", "--compact-at", "50%", "--compact-buffer", "10%"];

function notifies(events: RpcEvent[], pattern: RegExp): RpcEvent[] {
	return eventsOfType(events, "extension_ui_request").filter((e) => e.method === "notify" && pattern.test(String(e.message ?? "")));
}

function traceNotes(traceFile: string): string[] {
	return readFileSync(traceFile, "utf8")
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line) as { kind: string; plan?: { toolCall?: { name: string; arguments?: { note_to_self?: string } } } })
		.filter((r) => r.kind === "turn" && r.plan?.toolCall?.name === "self_compact")
		.map((r) => r.plan!.toolCall!.arguments!.note_to_self!);
}

test("failed compaction keeps the note and the lock; /self-compact-now reuses the saved note; reload recovery finishes the handoff", async () => {
	const t = makeTestDir("failure-recovery");
	const env = { ...DEFAULT_FAKE_ENV, SC_FAKE_SCENARIO: "ignore-until-forced", SC_FAKE_TRACE: t.traceFile };

	// ---- Run 1: the summarizer always fails.
	const first = new RpcClient({ args: scriptedArgs(t, PERCENT_FLAGS), cwd: t.dir, env: { ...env, SC_FAKE_SUMMARY_FAIL: "99" }, logFile: t.logFile });
	let sessionFile: string | undefined;
	try {
		await first.request({ type: "prompt", message: "Start the scripted work." });
		await first.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "self_compact" && e.isError === false, 90_000);
		// First failure, then automatic retries (attempt 2 after 2s, attempt 3 after 4s), then a final "run /self-compact-now" notice.
		const finalFailure = await first.waitFor(
			(e) => e.type === "extension_ui_request" && e.method === "notify" && /Run \/self-compact-now or \/compact to retry/.test(String(e.message)),
			60_000,
		);
		const failures = eventsOfType(first.events, "compaction_end").filter((e) => e.aborted === true || e.errorMessage);
		assert.ok(failures.length >= 3, `expected at least 3 failed compactions, saw ${failures.length}`);
		assert.match(String(finalFailure.message), /Note kept and tools stay locked/);
		assert.ok(notifies(first.events, /retrying automatically/).length >= 1, "automatic retry announced");
		assert.ok(notifies(first.events, /Summary generation failed after 2 attempts: .*fake summary failure/).length >= 1, "real error recorded");

		// Note retained in the session ledger (latest state snapshot).
		const entries = await first.request({ type: "get_entries" });
		const list = ((entries.data as { entries?: Array<{ type: string; customType?: string; data?: { handoff?: { status?: string; note?: string; attempts?: number; error?: string } } }> })?.entries ?? []).filter(
			(e) => e.type === "custom" && e.customType === "self-compact-state",
		);
		const lastEntry = list[list.length - 1]!;
		assert.equal(lastEntry.data?.handoff?.status, "failed");
		assert.ok((lastEntry.data?.handoff?.note ?? "").length > 10, "note retained");
		assert.ok((lastEntry.data?.handoff?.attempts ?? 0) >= 3);
		assert.match(lastEntry.data?.handoff?.error ?? "", /fake summary failure/);
		const savedNote = lastEntry.data!.handoff!.note!;

		// Tools are still locked: an ordinary tool call is blocked with the failure as the reason.
		const mark = first.mark();
		await first.request({ type: "prompt", message: "continue" });
		const blocked = await first.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "bash" && e.isError === true && /blocked by self-compact/.test(messageText(e.result)), 60_000, { since: mark });
		assert.match(messageText(blocked.result), /the last compaction failed/);
		assert.match(messageText(blocked.result), /self_compact/);
		// The scripted agent hands off again; that compaction fails too (summarizer still broken).
		await first.waitFor((e) => e.type === "extension_ui_request" && e.method === "notify" && /Run \/self-compact-now or \/compact to retry/.test(String(e.message)), 60_000, { since: mark });

		// /self-compact-now includes the saved note verbatim and the agent passes it back unchanged.
		const mark2 = first.mark();
		const nowResponse = await first.request({ type: "prompt", message: "/self-compact-now" });
		assert.equal(nowResponse.success, true);
		const userMessage = await first.waitFor((e) => e.type === "message_end" && (e.message as { role?: string }).role === "user", 30_000, { since: mark2 });
		const userText = messageText(userMessage.message);
		assert.match(userText, /A note is already saved from a previous attempt/);
		assert.ok(userText.includes(savedNote), "saved note included verbatim in the /self-compact-now request");
		const retryCall = await first.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "self_compact", 60_000, { since: mark2 });
		assert.equal(retryCall.isError, false);
		const notes = traceNotes(t.traceFile);
		assert.equal(notes[notes.length - 1], savedNote, "agent reused the saved note instead of inventing one");
		assert.equal(eventsOfType(first.events, "message_end").filter((e) => (e.message as { customType?: string })?.customType === "self-compact-handoff").length, 0, "no handoff delivered while compaction keeps failing");
		await first.waitFor((e) => e.type === "extension_ui_request" && e.method === "notify" && /Run \/self-compact-now or \/compact to retry/.test(String(e.message)), 60_000, { since: mark2 });
		sessionFile = latestSessionFile(t);
		assert.ok(sessionFile, "session file persisted");
	} finally {
		await first.close();
	}

	// ---- Run 2: same session file, summarizer works again -> recovery completes the handoff.
	const second = new RpcClient({
		args: scriptedArgs(t, PERCENT_FLAGS, { session: sessionFile }),
		cwd: t.dir,
		env: { ...env, SC_FAKE_SUMMARY_FAIL: "0" },
		logFile: t.logFile,
	});
	try {
		const restored = await second.waitFor((e) => e.type === "extension_ui_request" && e.method === "notify" && /restored a saved note/.test(String(e.message)), 30_000);
		assert.match(String(restored.message), /Tools stay locked until compaction succeeds/);
		const compactionEnd = await second.waitFor((e) => e.type === "compaction_end", 60_000);
		assert.equal(compactionEnd.aborted, false);
		assert.match(((compactionEnd.result as { summary?: string })?.summary) ?? "", /FAKE-SUMMARY\[/);
		const handoff = await second.waitFor((e) => e.type === "message_end" && (e.message as { customType?: string })?.customType === "self-compact-handoff", 60_000);
		const savedNote = traceNotes(t.traceFile).pop()!;
		assert.ok(messageText(handoff.message).includes(savedNote), "recovered note returned verbatim after restart");
		await second.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "write" && e.isError === false, 60_000);
		assert.equal(readFileSync(join(t.dir, "result.txt"), "utf8").trim(), "done");
		await second.waitFor((e) => e.type === "agent_settled", 60_000, { since: second.events.indexOf(handoff) });
		const entries = await second.request({ type: "get_entries" });
		const statuses = ((entries.data as { entries?: Array<{ type: string; customType?: string; data?: { handoff?: { status?: string } } }> })?.entries ?? [])
			.filter((e) => e.type === "custom" && e.customType === "self-compact-state")
			.map((e) => e.data?.handoff?.status);
		assert.equal(statuses[statuses.length - 1], "done");
	} finally {
		await second.close();
	}

	// ---- Run 3: an answered handoff never restarts after another reload.
	const third = new RpcClient({ args: scriptedArgs(t, PERCENT_FLAGS, { session: sessionFile }), cwd: t.dir, env: { ...env, SC_FAKE_SUMMARY_FAIL: "0" }, logFile: t.logFile });
	try {
		await third.request({ type: "get_state" });
		await new Promise((resolve) => setTimeout(resolve, 3_000));
		assert.equal(eventsOfType(third.events, "agent_start").length, 0, "no run started on reload after a completed handoff");
		assert.equal(eventsOfType(third.events, "compaction_start").length, 0, "no compaction started on reload after a completed handoff");
		assert.equal(notifies(third.events, /restored a saved note/).length, 0);
		const since = third.mark();
		await third.request({ type: "prompt", message: "/self-compact-info" });
		const info = await third.waitFor((e) => e.type === "extension_ui_request" && e.method === "notify" && /^self-compact info/.test(String(e.message)), 20_000, { since });
		assert.match(String(info.message), /tools unlocked, handoff done/);
		assert.match(String(info.message), /cycles completed: 1/);
	} finally {
		await third.close();
	}

	// ---- Run 4: crash between journaling the handoff and the model's answer -> resume without a user prompt.
	const lines = readFileSync(sessionFile!, "utf8").trim().split("\n");
	const handoffLine = lines.findIndex((line) => line.includes('"type":"custom_message"') && line.includes('"customType":"self-compact-handoff"'));
	assert.ok(handoffLine > 0, "session contains the journaled handoff");
	// Keep the state snapshot appended right after the journaled message, drop everything the model answered.
	let cut = handoffLine + 1;
	while (cut < lines.length && lines[cut]!.includes('"customType":"self-compact-state"')) cut += 1;
	const truncated = sessionFile!.replace(/\.jsonl$/, "-truncated.jsonl");
	writeFileSync(truncated, `${lines.slice(0, cut).join("\n")}\n`);
	rmSync(join(t.dir, "result.txt"), { force: true });
	const fourth = new RpcClient({ args: scriptedArgs(t, PERCENT_FLAGS, { session: truncated }), cwd: t.dir, env: { ...env, SC_FAKE_SUMMARY_FAIL: "0" }, logFile: t.logFile });
	try {
		const nudge = await fourth.waitFor((e) => e.type === "extension_ui_request" && e.method === "notify" && /never answered before/.test(String(e.message)), 30_000);
		assert.ok(nudge);
		const resumed = await fourth.waitFor((e) => e.type === "message_end" && (e.message as { customType?: string; details?: { resumed?: boolean } })?.customType === "self-compact-handoff" && (e.message as { details?: { resumed?: boolean } }).details?.resumed === true, 30_000);
		assert.ok(resumed, "resume nudge sent as a triggered turn");
		await fourth.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "write" && e.isError === false, 60_000, { since: fourth.events.indexOf(resumed) });
		await fourth.waitFor((e) => e.type === "agent_settled", 60_000, { since: fourth.events.indexOf(resumed) });
		assert.equal(existsSync(join(t.dir, "result.txt")), true, "work resumed from the journaled note without a user prompt");
		assert.equal(readFileSync(join(t.dir, "result.txt"), "utf8").trim(), "done");
		assert.equal(eventsOfType(fourth.events, "compaction_start").length, 0, "no second compaction for an already-delivered note");
	} finally {
		await fourth.close();
	}
});
