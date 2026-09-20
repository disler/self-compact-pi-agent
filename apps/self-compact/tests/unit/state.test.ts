import { test } from "node:test";
import assert from "node:assert/strict";
import { HANDOFF_TYPE, STATE_TYPE, latestAssistantUsage, recoverState, type EntryLike, type PersistedState } from "../../extensions/self-compact/state.ts";

function snapshot(state: Partial<PersistedState> & { handoff?: PersistedState["handoff"] }): EntryLike {
	return { type: "custom", customType: STATE_TYPE, data: { version: 1, cycle: 0, locked: false, ...state } };
}
const note = (status: PersistedState["handoff"] extends infer H ? (H extends { status: infer S } ? S : never) : never, extra: Record<string, unknown> = {}) => ({ id: "h1", note: "NEXT ACTION: write result.txt", status, attempts: 0, savedAt: 1, ...extra });
const compactionFor = (id: string): EntryLike => ({ type: "compaction", details: { handoffId: id } });
const handoffMessage = (id: string): EntryLike => ({ type: "custom_message", customType: HANDOFF_TYPE, details: { id } });
const assistant: EntryLike = { type: "message", message: { role: "assistant", stopReason: "stop" } };
const user: EntryLike = { type: "message", message: { role: "user" } };

test("no snapshot -> empty state", () => {
	assert.deepEqual(recoverState([user]), { state: { version: 1, cycle: 0, locked: false }, journaledUnanswered: false, answered: false });
});

test("pending note without a compaction stays pending; latest snapshot wins", () => {
	const r = recoverState([snapshot({ handoff: note("pending") }), snapshot({ handoff: note("failed", { attempts: 2, error: "boom" }), locked: true })]);
	assert.equal(r.state.handoff?.status, "failed");
	assert.equal(r.state.handoff?.attempts, 2);
	assert.equal(r.state.locked, true);
});

test("compaction carrying the handoff id means the summary landed: status ready", () => {
	const r = recoverState([snapshot({ handoff: note("compacting"), locked: true }), compactionFor("h1")]);
	assert.equal(r.state.handoff?.status, "ready");
	assert.equal(r.journaledUnanswered, false);
});

test("journaled handoff message without an answer -> journaledUnanswered", () => {
	const r = recoverState([snapshot({ handoff: note("ready"), cycle: 1 }), compactionFor("h1"), handoffMessage("h1")]);
	assert.equal(r.journaledUnanswered, true);
	assert.equal(r.answered, false);
});

test("journaled handoff message with an assistant answer -> answered, never restarts", () => {
	const r = recoverState([snapshot({ handoff: note("ready"), cycle: 1 }), compactionFor("h1"), handoffMessage("h1"), assistant]);
	assert.equal(r.answered, true);
	assert.equal(r.journaledUnanswered, false);
});

test("done handoff whose journaled message was never answered still resumes", () => {
	const r = recoverState([snapshot({ handoff: note("ready"), cycle: 1 }), compactionFor("h1"), handoffMessage("h1"), snapshot({ handoff: note("done"), cycle: 1 })]);
	assert.equal(r.state.handoff?.status, "done");
	assert.equal(r.journaledUnanswered, true);
	const answered = recoverState([snapshot({ handoff: note("done"), cycle: 1 }), handoffMessage("h1"), assistant]);
	assert.equal(answered.journaledUnanswered, false);
	assert.equal(answered.answered, true);
});

test("done handoff is left alone", () => {
	const r = recoverState([snapshot({ handoff: note("done"), cycle: 1 })]);
	assert.equal(r.state.handoff?.status, "done");
	assert.equal(r.state.cycle, 1);
});

test("latestAssistantUsage ignores pre-compaction, aborted, and zero usage", () => {
	const good: EntryLike = { type: "message", message: { role: "assistant", stopReason: "stop", usage: { input: 10, output: 5, cacheRead: 10, cacheWrite: 0, totalTokens: 25 } } };
	const aborted: EntryLike = { type: "message", message: { role: "assistant", stopReason: "aborted", usage: { input: 99, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 100 } } };
	const zero: EntryLike = { type: "message", message: { role: "assistant", stopReason: "stop", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 } } };
	assert.deepEqual(latestAssistantUsage([good, aborted, zero]), good.message!.usage);
	assert.equal(latestAssistantUsage([good, { type: "compaction" }]), undefined);
	assert.deepEqual(latestAssistantUsage([good, { type: "compaction" }, user, good]), good.message!.usage);
});
