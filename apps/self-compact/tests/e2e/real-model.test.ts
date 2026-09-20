/**
 * Live proof with a real model (SC_REAL_MODEL, default anthropic/claude-haiku-4-5): the forced lock interrupts a task,
 * the model writes its note and calls self_compact, the summary is generated with our prompt,
 * the note returns verbatim, and the model finishes the task from the note (result.txt = done).
 *
 * Opt in with SC_REAL=1 (needs the API key for the chosen provider). Costs a few cents.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RpcClient, eventsOfType, messageText } from "../harness/rpc-client.ts";
import { EXTENSION, makeTestDir } from "../harness/env.ts";

const REAL = process.env.SC_REAL === "1";
const MODEL = process.env.SC_REAL_MODEL ?? "anthropic/claude-haiku-4-5";

function bigText(): string {
	const lines: string[] = [];
	for (let i = 1; i <= 900; i++) {
		lines.push(`record ${String(i).padStart(4, "0")}: sensor=${(i * 7919) % 1000} status=${i % 3 === 0 ? "warn" : "ok"} note="synthetic filler line ${i} for a context growth test, lorem ipsum dolor sit amet consectetur"`);
	}
	lines.push("final-word: done");
	return `${lines.join("\n")}\n`;
}

test("real model: forced lock -> self_compact -> compaction -> note verbatim -> result.txt = done", { skip: !REAL ? "set SC_REAL=1 to run against a live model" : false }, async () => {
	const t = makeTestDir("real-model");
	writeFileSync(join(t.dir, "big.txt"), bigText());
	const client = new RpcClient({
		args: [
			"--no-extensions",
			"--no-skills",
			"--no-prompt-templates",
			"--no-context-files",
			"-a",
			"-e",
			EXTENSION,
			"--model",
			MODEL,
			"--session-dir",
			t.sessionDir,
			"--compact-soft-at",
			"6k",
			"--compact-at",
			"9k",
			"--compact-buffer",
			"1k",
		],
		cwd: t.dir,
		env: { PI_OFFLINE: "" },
		logFile: t.logFile,
	});
	try {
		const task = [
			"You are an autonomous agent under test. Complete this task without asking questions.",
			"Step 1: read the file big.txt in full with the read tool (no offset or limit). Its very last line has the form `final-word: <word>`.",
			"Step 2: only after you have seen that last line, create the file result.txt containing exactly that <word> and nothing else.",
			"Step 3: reply with the text: Task complete",
			"A self-compaction system watches your context. If it tells you the hard cutoff was reached, write a note_to_self whose last line is the exact NEXT ACTION and call self_compact; after compaction your note is returned and you continue from that NEXT ACTION.",
		].join("\n");
		const accepted = await client.request({ type: "prompt", message: task });
		assert.equal(accepted.success, true, JSON.stringify(accepted));

		const selfCompact = await client.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "self_compact" && e.isError === false, 240_000);
		const args = (eventsOfType(client.events, "tool_execution_start").find((e) => e.toolCallId === selfCompact.toolCallId)?.args ?? {}) as { note_to_self?: string };
		const note = (args.note_to_self ?? "").trim();
		assert.ok(note.length > 20, "model wrote a real note");

		const compactionEnd = await client.waitFor((e) => e.type === "compaction_end", 240_000, { since: client.events.indexOf(selfCompact) });
		assert.equal(compactionEnd.aborted, false, JSON.stringify(compactionEnd).slice(0, 500));
		const summary = ((compactionEnd.result as { summary?: string })?.summary) ?? "";
		assert.ok(summary.length > 50, "summary generated");
		assert.match(summary, /Goal/i, "summary follows our structured compaction prompt");

		const handoff = await client.waitFor((e) => e.type === "message_end" && (e.message as { customType?: string })?.customType === "self-compact-handoff", 60_000, { since: client.events.indexOf(compactionEnd) });
		assert.equal(messageText(handoff.message), note, "note returned verbatim as the whole message");

		const write = await client.waitFor((e) => e.type === "tool_execution_end" && e.toolName === "write" && e.isError === false, 240_000, { since: client.events.indexOf(handoff) });
		await client.waitFor((e) => e.type === "agent_settled", 120_000, { since: client.events.indexOf(write) });
		const resultPath = join(t.dir, "result.txt");
		assert.ok(existsSync(resultPath), "result.txt exists");
		assert.equal(readFileSync(resultPath, "utf8").trim(), "done");

		const userAfterHandoff = eventsOfType(client.events, "message_end")
			.slice(client.events.indexOf(handoff))
			.filter((e) => (e.message as { role?: string }).role === "user");
		assert.equal(userAfterHandoff.length, 0, "no human message was needed after the handoff");
		const blocked = eventsOfType(client.events, "tool_execution_end").filter((e) => e.isError === true && /blocked by self-compact/.test(messageText(e.result)));
		writeFileSync(
			join(t.dir, "summary.json"),
			JSON.stringify(
				{
					model: MODEL,
					note,
					noteChars: note.length,
					blockedToolCalls: blocked.map((e) => e.toolName),
					compactionSummary: summary,
					tokensBefore: (compactionEnd.result as { tokensBefore?: number })?.tokensBefore,
					estimatedTokensAfter: (compactionEnd.result as { estimatedTokensAfter?: number })?.estimatedTokensAfter,
					result: readFileSync(resultPath, "utf8"),
				},
				null,
				2,
			),
		);
	} finally {
		await client.close();
	}
});
