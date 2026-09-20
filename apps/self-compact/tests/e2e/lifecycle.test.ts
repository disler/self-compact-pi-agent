/**
 * Deterministic end-to-end lifecycle through the real CLI (`pi --mode rpc`) with the scripted
 * provider: notice -> warning -> forced lock -> self_compact -> compaction -> note returned
 * verbatim -> continuation writes result.txt = done. Guidance reaches the model as transient
 * messages (never persisted), so the transcript only carries the user's own prompt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RpcClient, eventsOfType, messageText, type RpcEvent } from "../harness/rpc-client.ts";
import { DEFAULT_FAKE_ENV, makeTestDir, scriptedArgs } from "../harness/env.ts";

const PERCENT_FLAGS = ["--compact-soft-at", "20%", "--compact-at", "50%", "--compact-buffer", "10%"];
const HANDOFF = "self-compact-handoff";

function entries(events: RpcEvent[], customType: string): Array<{ event: RpcEvent; data: Record<string, unknown> }> {
	return eventsOfType(events, "entry_appended")
		.filter((e) => (e.entry as { customType?: string } | undefined)?.customType === customType)
		.map((e) => ({ event: e, data: ((e.entry as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown> }));
}

function handoffMessages(events: RpcEvent[]): RpcEvent[] {
	return eventsOfType(events, "message_end").filter((e) => (e.message as { role?: string; customType?: string } | undefined)?.customType === HANDOFF);
}

function toolEnds(events: RpcEvent[], toolName: string): RpcEvent[] {
	return eventsOfType(events, "tool_execution_end").filter((e) => e.toolName === toolName);
}

interface TraceTurn {
	kind: string;
	lastRole?: string;
	lastText?: string;
	plan?: { toolCall?: { name: string; arguments?: { note_to_self?: string } } };
}

function trace(traceFile: string): TraceTurn[] {
	return readFileSync(traceFile, "utf8").trim().split("\n").map((line) => JSON.parse(line) as TraceTurn);
}

function noteFromTrace(traceFile: string): string {
	return trace(traceFile).find((r) => r.kind === "turn" && r.plan?.toolCall?.name === "self_compact")?.plan?.toolCall?.arguments?.note_to_self ?? "";
}

function resultText(e: RpcEvent): string {
	return messageText(e.result);
}

async function waitForCompletion(client: RpcClient): Promise<RpcEvent> {
	const handoff = await client.waitFor((e) => e.type === "message_end" && (e.message as { customType?: string })?.customType === HANDOFF, 90_000);
	const after = client.events.indexOf(handoff);
	await client.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "write", 30_000, { since: after });
	await client.waitFor((e) => e.type === "agent_settled", 60_000, { since: after });
	return handoff;
}

test("lifecycle: thresholds, lock, self_compact, compaction, verbatim note, continuation, clean transcript", async () => {
	const t = makeTestDir("lifecycle");
	const client = new RpcClient({
		args: scriptedArgs(t, PERCENT_FLAGS),
		cwd: t.dir,
		env: { ...DEFAULT_FAKE_ENV, SC_FAKE_SCENARIO: "ignore-until-forced", SC_FAKE_TRACE: t.traceFile },
		logFile: t.logFile,
	});
	try {
		const accepted = await client.request({ type: "prompt", message: "Start the scripted work." });
		assert.equal(accepted.success, true, JSON.stringify(accepted));
		const handoffEvent = await waitForCompletion(client);
		const events = client.events;

		// 1. Threshold crossings are recorded (TUI-only lines) in level order, inside ONE run.
		const phases = entries(events, "self-compact-phase").map((p) => p.data.level);
		assert.deepEqual(phases.slice(0, 3), ["notice", "warning", "forced"]);
		assert.equal(eventsOfType(events, "agent_start").length, 2, "one run for the task, one run started by the handoff");

		// 2. Guidance reached the model as transient messages with live values, and nothing extra was persisted.
		const turns = trace(t.traceFile).filter((r) => r.kind === "turn");
		const seen = (marker: RegExp) => turns.find((r) => marker.test(r.lastText ?? ""));
		assert.ok(seen(/^\[self-compact · notice\]/), "model saw the notice guidance");
		const warning = seen(/^\[self-compact · WARNING\]/);
		assert.ok(warning, "model saw the warning guidance");
		assert.match(warning!.lastText ?? "", /Hard cutoff at 120,000/, "warning carries the live forced token count");
		assert.ok(seen(/^\[self-compact · FORCED\]/), "model saw the forced guidance");
		const persistedRoles = eventsOfType(events, "message_end").map((e) => (e.message as { role?: string; customType?: string }).role + ":" + ((e.message as { customType?: string }).customType ?? ""));
		assert.equal(persistedRoles.filter((r) => r.startsWith("custom:")).length, 1, "the only persisted custom message is the handoff");
		assert.equal(persistedRoles.filter((r) => r === "user:").length, 1, "the only user message is the user's prompt");

		// 3. Forced lock blocked an ordinary tool with a reason that names self_compact.
		const bashErrors = toolEnds(events, "bash").filter((e) => e.isError === true);
		const blocked = bashErrors.filter((e) => /blocked by self-compact/.test(resultText(e)));
		assert.ok(blocked.length >= 1, `a bash call was blocked by the lock (bash errors seen: ${bashErrors.map((e) => resultText(e).slice(0, 80)).join(" | ")})`);
		assert.match(resultText(blocked[0]!), /self_compact/);
		const okBash = toolEnds(events, "bash").filter((e) => e.isError === false);
		assert.ok(okBash.length >= 3, "the scripted bash steps ran successfully before the lock (shell filler works in this environment)");

		// 4. self_compact accepted the note and ended the run; compaction ran only once idle.
		const selfCompact = toolEnds(events, "self_compact");
		assert.equal(selfCompact.length, 1, "self_compact called exactly once");
		assert.equal(selfCompact[0]!.isError, false);
		assert.match(resultText(selfCompact[0]!), /Note saved/);
		const firstCompactionStart = eventsOfType(events, "compaction_start")[0]!;
		assert.ok(eventsOfType(events, "agent_end").some((e) => events.indexOf(e) < events.indexOf(firstCompactionStart)), "run ended before compaction started");
		const compactionEnd = eventsOfType(events, "compaction_end")[0]!;
		assert.equal(compactionEnd.aborted, false);
		const result = compactionEnd.result as { summary?: string; details?: { handoffId?: string; selfCompact?: { promptSource?: string } } };
		assert.match(result.summary ?? "", /FAKE-SUMMARY\[You are the context-compaction summarizer/, "summary produced with our compaction prompt file");
		assert.ok(result.details?.handoffId, "compaction carries the durable handoff id");

		// 5. The note came back verbatim, once, and the agent continued without a user message.
		const note = noteFromTrace(t.traceFile);
		assert.ok(note.length > 10, "note captured from trace");
		const handoffText = messageText(handoffEvent.message);
		assert.equal(handoffText, note, "handoff message content is exactly the note");
		assert.deepEqual((handoffEvent.message as { details?: { note?: string; cycle?: number } }).details?.cycle, 1);
		assert.equal((handoffEvent.message as { details?: { note?: string } }).details?.note, note, "details carry the exact note");
		assert.equal(handoffMessages(events).length, 1);

		// 6. Tools were restored and real work resumed: result.txt == done.
		const writes = toolEnds(events, "write");
		assert.ok(writes.length >= 1 && writes[0]!.isError === false, "write ran after the handoff and was not blocked");
		assert.ok(events.indexOf(writes[0]!) > events.indexOf(handoffEvent));
		assert.equal(readFileSync(join(t.dir, "result.txt"), "utf8").trim(), "done");

		// 7. The state ledger and the final info line.
		const statuses = entries(events, "self-compact-state").map((s) => (s.data.handoff as { status?: string } | undefined)?.status).filter(Boolean);
		assert.deepEqual(statuses, ["pending", "compacting", "ready", "done"]);
		const since = client.mark();
		await client.request({ type: "prompt", message: "/self-compact-info" });
		const info = await client.waitFor((e) => e.type === "extension_ui_request" && e.method === "notify" && /^self-compact info/.test(String(e.message)), 20_000, { since });
		assert.match(String(info.message), /tools unlocked, handoff done/);
		assert.match(String(info.message), /cycles completed: 1/);
	} finally {
		await client.close();
	}
});

test("sibling tools in the self_compact batch are blocked in either order", async () => {
	for (const position of ["before", "after"] as const) {
		const t = makeTestDir(`sibling-${position}`);
		const client = new RpcClient({
			args: scriptedArgs(t, PERCENT_FLAGS),
			cwd: t.dir,
			env: { ...DEFAULT_FAKE_ENV, SC_FAKE_SCENARIO: "obey-notice", SC_FAKE_SIBLING: position, SC_FAKE_TRACE: t.traceFile },
			logFile: t.logFile,
		});
		try {
			await client.request({ type: "prompt", message: "Start the scripted work." });
			await waitForCompletion(client);
			const blocked = toolEnds(client.events, "bash").filter((e) => e.isError === true && /is in this tool batch/.test(resultText(e)));
			assert.equal(blocked.length, 1, `${position}: the sibling bash call was blocked`);
			assert.equal(existsSync(join(t.dir, "sibling.txt")), false, `${position}: the sibling never ran`);
			assert.equal(toolEnds(client.events, "self_compact")[0]!.isError, false);
			assert.equal(readFileSync(join(t.dir, "result.txt"), "utf8").trim(), "done");
			assert.equal(eventsOfType(client.events, "agent_start").length, 2, `${position}: the blocked sibling terminated the batch (no extra model call before compaction)`);
		} finally {
			await client.close();
		}
	}
});

test("two cycles: guidance and the forced lock re-arm after a completed handoff", async () => {
	const t = makeTestDir("two-cycles");
	const client = new RpcClient({
		args: scriptedArgs(t, PERCENT_FLAGS),
		cwd: t.dir,
		env: { ...DEFAULT_FAKE_ENV, SC_FAKE_SCENARIO: "ignore-until-forced", SC_FAKE_CYCLES: "2", SC_FAKE_TRACE: t.traceFile },
		logFile: t.logFile,
	});
	try {
		await client.request({ type: "prompt", message: "Start the scripted work." });
		const first = await client.waitFor((e) => e.type === "message_end" && (e.message as { customType?: string })?.customType === HANDOFF, 90_000);
		const second = await client.waitFor((e) => e.type === "message_end" && (e.message as { customType?: string })?.customType === HANDOFF, 120_000, { since: client.events.indexOf(first) + 1 });
		await client.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "write", 30_000, { since: client.events.indexOf(second) });
		await client.waitFor((e) => e.type === "agent_settled", 60_000, { since: client.events.indexOf(second) });
		const events = client.events;
		const phases = entries(events, "self-compact-phase").map((p) => p.data.level);
		assert.equal(phases.filter((l) => l === "forced").length, 2, `forced crossed twice: ${phases.join(",")}`);
		const blocked = toolEnds(events, "bash").filter((e) => e.isError === true && /at or above the forced threshold/.test(resultText(e)));
		assert.equal(blocked.length, 2, "the forced lock engaged in both cycles");
		assert.equal(toolEnds(events, "self_compact").filter((e) => e.isError === false).length, 2);
		assert.equal(eventsOfType(events, "compaction_end").filter((e) => e.aborted === false).length, 2);
		const ids = handoffMessages(events).map((e) => (e.message as { details?: { id?: string; cycle?: number } }).details);
		assert.equal(ids.length, 2);
		assert.notEqual(ids[0]?.id, ids[1]?.id, "each cycle has its own durable handoff id");
		assert.deepEqual(ids.map((d) => d?.cycle), [1, 2]);
		assert.equal(readFileSync(join(t.dir, "result.txt"), "utf8").trim(), "done");
		const since = client.mark();
		await client.request({ type: "prompt", message: "/self-compact-info" });
		const info = await client.waitFor((e) => e.type === "extension_ui_request" && e.method === "notify" && /^self-compact info/.test(String(e.message)), 20_000, { since });
		assert.match(String(info.message), /cycles completed: 2/);
	} finally {
		await client.close();
	}
});

test("note validation: blank rejected, 24001 chars rejected, 24000 chars accepted, whitespace preserved", async () => {
	for (const mode of ["blank", "toolong", "maxlen", "whitespace"] as const) {
		const t = makeTestDir(`note-${mode}`);
		const client = new RpcClient({
			args: scriptedArgs(t, PERCENT_FLAGS),
			cwd: t.dir,
			env: { ...DEFAULT_FAKE_ENV, SC_FAKE_SCENARIO: "obey-notice", SC_FAKE_NOTE_MODE: mode, SC_FAKE_TRACE: t.traceFile },
			logFile: t.logFile,
		});
		try {
			await client.request({ type: "prompt", message: "Start the scripted work." });
			const handoff = await waitForCompletion(client);
			const calls = toolEnds(client.events, "self_compact");
			if (mode === "blank") {
				assert.equal(calls[0]!.isError, true);
				assert.match(resultText(calls[0]!), /must not be blank/);
				assert.equal(calls[1]!.isError, false, "retry with a real note accepted");
			} else if (mode === "toolong") {
				assert.equal(calls[0]!.isError, true);
				assert.match(resultText(calls[0]!), /exceeds 24000 characters \(24001\)/);
				assert.equal(calls[1]!.isError, false);
			} else if (mode === "maxlen") {
				assert.equal(calls[0]!.isError, false, "24000-char note accepted");
				assert.equal(messageText(handoff.message), "y".repeat(24_000), "24000-char note returned verbatim");
			} else {
				assert.equal(calls[0]!.isError, false, "note with surrounding whitespace accepted");
				const raw = noteFromTrace(t.traceFile);
				assert.notEqual(raw, raw.trim(), "test note really has surrounding whitespace");
				assert.equal(messageText(handoff.message), raw, "whitespace preserved byte for byte");
			}
			assert.equal(readFileSync(join(t.dir, "result.txt"), "utf8").trim(), "done");
		} finally {
			await client.close();
		}
	}
});
