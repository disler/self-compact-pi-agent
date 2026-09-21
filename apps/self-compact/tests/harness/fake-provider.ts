/**
 * Test-only Pi extension: registers a scripted provider "fake" with model "scripted".
 *
 * The model reports whatever context usage the scenario needs, so threshold
 * crossings, the tool lock, compaction, and note delivery can be verified through
 * the real CLI with real built-in tools and zero API cost.
 *
 * Environment:
 *   SC_FAKE_WINDOW        context window (default 100000)
 *   SC_FAKE_BASE          total context tokens reported on the first turn (default 5000)
 *   SC_FAKE_STEP          extra tokens per assistant message present in context (default 15000)
 *   SC_FAKE_SCENARIO      "ignore-until-forced" (default) | "obey-notice" | "obey-warning" | "obey-forced" | "never-compact"
 *   SC_FAKE_SUMMARY_FAIL  number of summary requests that fail before one succeeds (default 0)
 *   SC_FAKE_NOTE          note_to_self text used when the script calls self_compact
 *   SC_FAKE_NOTE_MODE     "normal" (default) | "blank" | "toolong" | "maxlen" | "whitespace"
 *   SC_FAKE_RESULT_PATH   file the script writes after the handoff (default "result.txt")
 *   SC_FAKE_TRACE         path to append a JSONL trace of every model request
 *   SC_FAKE_MAX_STEPS     stop with "Task complete." after this many bash steps (0 = unbounded)
 *   SC_FAKE_SIBLING       "before" | "after": when handing off, also emit a bash call before/after self_compact in the same batch
 *   SC_FAKE_CYCLES        number of handoffs to complete before writing the result (default 1)
 */
import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream, getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import type { AssistantMessage, Context, JsonObject, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";

const env = (key: string, fallback: string) => process.env[key] ?? fallback;
const WINDOW = Number(env("SC_FAKE_WINDOW", "100000"));
const BASE = Number(env("SC_FAKE_BASE", "5000"));
const STEP = Number(env("SC_FAKE_STEP", "15000"));
const SCENARIO = env("SC_FAKE_SCENARIO", "ignore-until-forced");
const SUMMARY_FAIL = Number(env("SC_FAKE_SUMMARY_FAIL", "0"));
const RESULT_PATH = env("SC_FAKE_RESULT_PATH", "result.txt");
const TRACE = process.env.SC_FAKE_TRACE;
const NOTE_MODE = env("SC_FAKE_NOTE_MODE", "normal");
const DEFAULT_NOTE = [
	"GOAL: prove the self-compaction handoff resumes real work.",
	"DONE: ran the scripted bash steps; nothing else is pending.",
	"DECISIONS: none.",
	"TEST RESULTS: n/a.",
	`NEXT ACTION: write ${RESULT_PATH} containing exactly done, then reply "Task complete".`,
].join("\n");
const NOTE = env("SC_FAKE_NOTE", DEFAULT_NOTE);

let summaryCalls = 0;
let stepCounter = 0;
let taskDone = false;
let lastSentNote = "";
const MAX_STEPS = Number(env("SC_FAKE_MAX_STEPS", "0"));
const SIBLING = env("SC_FAKE_SIBLING", "");
const CYCLES = Number(env("SC_FAKE_CYCLES", "1"));
let handoffsSeen = 0;

function noteForMode(): string {
	if (NOTE_MODE === "blank") return "   ";
	if (NOTE_MODE === "toolong") return "x".repeat(24_001);
	if (NOTE_MODE === "maxlen") return "y".repeat(24_000);
	if (NOTE_MODE === "whitespace") return `\n  ${NOTE}  \n\n`;
	return NOTE;
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((block) => (block && typeof block === "object" && (block as { type?: string }).type === "text" ? String((block as { text?: string }).text ?? "") : ""))
			.join("\n");
	}
	return "";
}

function trace(record: Record<string, unknown>) {
	if (!TRACE) return;
	try {
		appendFileSync(TRACE, `${JSON.stringify({ at: Date.now(), ...record })}\n`);
	} catch {
		// ignore
	}
}

interface Plan {
	text?: string;
	toolCall?: { name: string; arguments: JsonObject };
	/** Extra calls emitted in the same batch (sibling tests). */
	siblings?: Array<{ name: string; arguments: JsonObject; position: "before" | "after" }>;
	usageTotal: number;
	stopReason: "stop" | "toolUse";
}

function handoffPlan(note: string, usageTotal: number): Plan {
	lastSentNote = note;
	const plan: Plan = { toolCall: { name: "self_compact", arguments: { note_to_self: note } }, usageTotal, stopReason: "toolUse" };
	if (SIBLING === "before" || SIBLING === "after") {
		plan.siblings = [{ name: "bash", arguments: { command: "echo sibling-must-not-run > sibling.txt" }, position: SIBLING }];
	}
	return plan;
}

function decide(context: Context): Plan {
	const messages = context.messages;
	// Model a fresh context after each returned note, including resumed sessions with retained history.
	const lastHandoff = messages.reduce((found, message, index) => {
		if (message.role !== "user") return found;
		const text = textOf(message.content).trim();
		return text === (lastSentNote || NOTE).trim() || text === NOTE.trim() || /^Continue from your saved note_to_self above/.test(text) ? index : found;
	}, -1);
	const assistantCount = messages.slice(lastHandoff + 1).filter((m) => m.role === "assistant").length;
	const usageTotal = BASE + STEP * assistantCount;
	// Transient guidance arrives as a trailing user-role message; look past it for the real last message.
	let lastIndex = messages.length - 1;
	let guidance = "";
	if (lastIndex >= 0 && messages[lastIndex]!.role === "user" && /^\[self-compact · (notice|WARNING|FORCED)\]/.test(textOf((messages[lastIndex] as { content?: unknown }).content))) {
		guidance = textOf((messages[lastIndex] as { content?: unknown }).content);
		lastIndex -= 1;
	}
	const last = messages[lastIndex];
	const lastText = last ? textOf((last as { content?: unknown }).content) : "";
	const lastRole = last?.role;

	// Once the result file was written the task is over: answer everything with a final text and a small
	// (post-compaction) context so the re-armed thresholds do not fire on a finished task.
	if (taskDone) return { text: "Task complete.", usageTotal: BASE, stopReason: "stop" };
	// Optional bounded run: after MAX_STEPS bash steps, finish without compacting.
	if (MAX_STEPS > 0 && stepCounter >= MAX_STEPS) return { text: "Task complete.", usageTotal, stopReason: "stop" };

	// Tool result from a previous call.
	if (lastRole === "toolResult") {
		const tr = last as { toolName?: string; isError?: boolean; content?: unknown };
		const trText = textOf(tr.content);
		if (tr.toolName === "self_compact") {
			// Rejected note (blank / too long) -> retry with the normal note.
			if (tr.isError) {
				return { toolCall: { name: "self_compact", arguments: { note_to_self: NOTE } }, usageTotal, stopReason: "toolUse" };
			}
			return { text: "Note saved; waiting for compaction.", usageTotal, stopReason: "stop" };
		}
		// A blocked sibling in the handoff batch: the batch also contained self_compact, so just stop.
		if (tr.isError && /is in this tool batch/.test(trText)) {
			return { text: "Sibling blocked; waiting for compaction.", usageTotal, stopReason: "stop" };
		}
		if (tr.isError && /blocked by self-compact/.test(trText)) {
			// Blocked by the forced lock -> hand off (unless the scenario never compacts).
			if (SCENARIO === "never-compact") {
				stepCounter += 1;
				return { toolCall: { name: "bash", arguments: { command: `echo blocked-retry ${stepCounter}` } }, usageTotal, stopReason: "toolUse" };
			}
			return handoffPlan(noteForMode(), usageTotal);
		}
		if (tr.toolName === "write") {
			return { text: "Task complete.", usageTotal: BASE, stopReason: "stop" };
		}
	}

	// Guidance-driven scenarios react to the transient message itself.
	if (guidance) {
		if (/self-compact · WARNING/.test(guidance) && SCENARIO === "obey-warning") return handoffPlan(noteForMode(), usageTotal);
		if (/self-compact · notice/.test(guidance) && SCENARIO === "obey-notice") return handoffPlan(noteForMode(), usageTotal);
		if (/self-compact · FORCED/.test(guidance) && SCENARIO === "obey-forced") return handoffPlan(noteForMode(), usageTotal);
	}

	// The handoff is the exact note text; other user-role text is a real prompt or /self-compact-now.
	if (lastRole === "user") {
		if (/^Continue from your saved note_to_self above/.test(lastText)) {
			// Resume nudge after a crash between journaling the note and the answer.
			taskDone = true;
			return { toolCall: { name: "write", arguments: { path: RESULT_PATH, content: "done" } }, usageTotal, stopReason: "toolUse" };
		}
		if (lastText.trim() === (lastSentNote || NOTE).trim() || lastText.trim() === NOTE.trim()) {
			handoffsSeen += 1;
			if (handoffsSeen < CYCLES) {
				// More cycles requested: keep working until the next forced lock.
				stepCounter += 1;
				return { toolCall: { name: "bash", arguments: { command: `printf 'cycle ${handoffsSeen} step ${stepCounter} '; yes filler | head -n 400 | tr '\\n' ' '; echo` } }, usageTotal, stopReason: "toolUse" };
			}
			taskDone = true;
			return {
				toolCall: { name: "write", arguments: { path: RESULT_PATH, content: "done" } },
				usageTotal,
				stopReason: "toolUse",
			};
		}
		if (/note is already saved/i.test(lastText)) {
			const match = /verbatim[^\n]*:\n\n([\s\S]*?)\n\n---/m.exec(lastText);
			const saved = match ? match[1]! : NOTE;
			return { toolCall: { name: "self_compact", arguments: { note_to_self: saved } }, usageTotal, stopReason: "toolUse" };
		}
		if (/^\s*say:\s*/i.test(lastText)) {
			return { text: lastText.replace(/^\s*say:\s*/i, ""), usageTotal, stopReason: "stop" };
		}
	}

	// Default: do a step of "work" with a bulky tool output so compaction has material to cut.
	stepCounter += 1;
	return {
		// Pure shell (no python, no Xcode stubs): ~2.8k chars of filler so compaction has material to cut.
		toolCall: { name: "bash", arguments: { command: `printf 'step ${stepCounter} '; yes filler | head -n 400 | tr '\\n' ' '; echo` } },
		usageTotal,
		stopReason: "toolUse",
	};
}

function streamScripted(model: Model<any>, context: Context, options?: SimpleStreamOptions) {
	const stream = createAssistantMessageEventStream();
	const output: AssistantMessage = {
		role: "assistant",
		content: [],
		api: model.api,
		provider: model.provider,
		model: model.id,
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
		stopReason: "pending",
		timestamp: Date.now(),
	};
	const scTools = getCurrentTools(context.messages as any);
	const scSystemPrompt = getCurrentSystemPrompt(context.messages as any);
	const isSummary = scTools.length === 0;
	setTimeout(() => {
		try {
			stream.push({ type: "start", partial: output });
			if (isSummary) {
				summaryCalls += 1;
				trace({ kind: "summary", call: summaryCalls, systemPrompt: scSystemPrompt?.slice(0, 200) });
				if (summaryCalls <= SUMMARY_FAIL) {
					throw new Error(`fake summary failure #${summaryCalls}`);
				}
				const text = `FAKE-SUMMARY[${(scSystemPrompt ?? "").slice(0, 60)}]\n## Goal\nScripted goal.\n## Next Steps\n1. Follow the note.`;
				output.content.push({ type: "text", text: "" });
				stream.push({ type: "text_start", contentIndex: 0, partial: output });
				(output.content[0] as { text: string }).text = text;
				stream.push({ type: "text_delta", contentIndex: 0, delta: text, partial: output });
				stream.push({ type: "text_end", contentIndex: 0, content: text, partial: output });
				output.usage.input = 1000;
				output.usage.output = 50;
				output.usage.totalTokens = 1050;
				output.stopReason = "stop";
			} else {
				const plan = decide(context);
				const lastMessage = context.messages[context.messages.length - 1];
				trace({ kind: "turn", plan, lastRole: lastMessage?.role, lastText: lastMessage ? textOf((lastMessage as { content?: unknown }).content).slice(0, 400) : "", messages: context.messages.length });
				let index = 0;
				if (plan.text) {
					output.content.push({ type: "text", text: "" });
					stream.push({ type: "text_start", contentIndex: index, partial: output });
					(output.content[index] as { text: string }).text = plan.text;
					stream.push({ type: "text_delta", contentIndex: index, delta: plan.text, partial: output });
					stream.push({ type: "text_end", contentIndex: index, content: plan.text, partial: output });
					index += 1;
				}
				const emitCall = (name: string, args: JsonObject) => {
					const id = `call_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
					const toolCall = { type: "toolCall" as const, id, name, arguments: args };
					output.content.push(toolCall);
					stream.push({ type: "toolcall_start", contentIndex: index, partial: output });
					stream.push({ type: "toolcall_delta", contentIndex: index, delta: JSON.stringify(args), partial: output });
					stream.push({ type: "toolcall_end", contentIndex: index, toolCall, partial: output });
					index += 1;
				};
				for (const sibling of plan.siblings ?? []) if (sibling.position === "before") emitCall(sibling.name, sibling.arguments);
				if (plan.toolCall) emitCall(plan.toolCall.name, plan.toolCall.arguments);
				for (const sibling of plan.siblings ?? []) if (sibling.position === "after") emitCall(sibling.name, sibling.arguments);
				const half = Math.floor(plan.usageTotal / 2);
				output.usage.input = plan.usageTotal - half - 20;
				output.usage.cacheRead = half;
				output.usage.output = 20;
				output.usage.totalTokens = plan.usageTotal;
				output.stopReason = plan.stopReason;
			}
			stream.push({ type: "done", reason: output.stopReason as "stop" | "toolUse", message: output });
			stream.end();
		} catch (error) {
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = error instanceof Error ? error.message : String(error);
			stream.push({ type: "error", reason: output.stopReason, error: output });
			stream.end();
		}
	}, 5);
	return stream;
}

export default function fakeProvider(pi: ExtensionAPI) {
	pi.registerProvider("fake", {
		name: "Fake scripted provider",
		baseUrl: "http://127.0.0.1:1/fake",
		apiKey: "fake-key",
		api: "openai-completions",
		models: [
			{
				id: "scripted",
				name: "Scripted fake model",
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: WINDOW,
				maxTokens: 8192,
			},
		],
		streamSimple: streamScripted as any,
	});
}
