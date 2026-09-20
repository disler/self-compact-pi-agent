import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const { loadExtensions } = await import(pathToFileURL(join(globalModules, '@earendil-works/pi-coding-agent/dist/core/extensions/loader.js')));
const entry = resolve('extensions/self-compact/self-compact.ts');

function seedEntries(chars = 2000) {
  // A minimal real-shaped branch: one finished turn plus the current user prompt, so Pi's cut-point
  // arithmetic (the same one prepareCompaction uses) finds material to summarize.
  const usage = { input: 10, output: 10, cacheRead: 0, cacheWrite: 0, totalTokens: 20, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
  return [
    { type: 'message', id: 'seed-1', parentId: null, timestamp: '2026-01-01T00:00:00.000Z', message: { role: 'user', content: 'seed prompt '.repeat(chars / 12), timestamp: 1 } },
    { type: 'message', id: 'seed-2', parentId: 'seed-1', timestamp: '2026-01-01T00:00:01.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'seed answer '.repeat(chars / 12) }], api: 'openai-completions', provider: 'fake', model: 'parity-model', usage, stopReason: 'stop', timestamp: 2 } },
    { type: 'message', id: 'seed-3', parentId: 'seed-2', timestamp: '2026-01-01T00:00:02.000Z', message: { role: 'user', content: 'current prompt', timestamp: 3 } },
  ];
}

async function host(t, flags = {}, settings = { compaction: { keepRecentTokens: 100 } }) {
  const cwd = mkdtempSync(join(tmpdir(), 'self-compact-parity-'));
  mkdirSync(join(cwd, '.pi'), { recursive: true });
  writeFileSync(join(cwd, '.pi', 'settings.json'), JSON.stringify(settings));
  const loaded = await loadExtensions([entry], cwd);
  assert.deepEqual(loaded.errors, []);
  const extension = loaded.extensions[0];
  const entries = seedEntries(), messages = [], notices = [], compactions = [], requests = [];
  let tokens = 0;
  let footer;
  for (const [key, value] of Object.entries({ 'compact-soft-at': '20%', 'compact-at': '50%', 'compact-buffer': '10%', ...flags })) loaded.runtime.flagValues.set(key, value);
  loaded.runtime.appendEntry = (customType, data) => entries.push({ type: 'custom', customType, data });
  loaded.runtime.sendMessage = (message, options) => messages.push({ ...message, options });
  const ctx = {
    cwd, mode: 'tui', hasUI: true, thinkingLevel: 'off',
    model: { id: 'parity-model', provider: 'fake', contextWindow: 200000, maxTokens: 8192, api: 'openai-completions', reasoning: true },
    sessionManager: { getBranch: () => entries },
    getContextUsage: () => ({ tokens, contextWindow: ctx.model.contextWindow, percent: tokens / ctx.model.contextWindow * 100 }),
    isIdle: () => true,
    compact: options => compactions.push(options),
    ui: { notify: (message, type) => notices.push({ message, type }), setFooter: factory => { footer = factory; }, setStatus() {} },
    modelRegistry: { complete: async (_model, request, options) => {
      requests.push({ request, options });
      return { role: 'assistant', api: 'openai-completions', provider: 'fake', model: 'parity-model', timestamp: 1, stopReason: 'stop', content: [{ type: 'text', text: 'Verified summary.' }], usage: { input: 10, output: 10, totalTokens: 20, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
    } },
  };
  const emit = async (name, event = {}) => {
    let result;
    for (const handler of extension.handlers.get(name) ?? []) result = await handler(event, ctx);
    return result;
  };
  t.after(async () => { await emit('session_shutdown'); rmSync(cwd, { recursive: true, force: true }); });
  await emit('session_start', { reason: 'start' });
  return {
    ctx, entries, messages, notices, compactions, requests, emit,
    usage: value => { tokens = value; },
    prompt: (kind, text) => {
      const dir = join(cwd, '.pi/self-compact');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `USER_PROMPT_${kind}.md`), text);
    },
    execute: (note = 'NEXT ACTION: continue', signal) => extension.tools.get('self_compact').definition.execute('call', { note_to_self: note }, signal, undefined, ctx),
    view: () => extension.tools.get('view_context').definition.execute('view', {}, undefined, undefined, ctx),
    info: () => extension.commands.get('self-compact-info').handler('', ctx),
    footer: () => footer({ requestRender() {} }, { fg: (_color, text) => text, bold: text => text }).render(100)[0],
  };
}

function summaryEvent(overrides = {}) {
  return {
    reason: 'manual', signal: new AbortController().signal,
    preparation: {
      messagesToSummarize: [{ role: 'user', content: 'Implement parser. Tests remain pending.', timestamp: 1 }],
      turnPrefixMessages: [], isSplitTurn: false, firstKeptEntryId: 'keep', tokensBefore: 80000,
      settings: { enabled: true, reserveTokens: 16384, keepRecentTokens: 1500 },
      fileOps: { read: new Set(['README.md']), written: new Set(['parser.ts']), edited: new Set() },
      ...overrides,
    },
  };
}

test('P1: automatic compaction cannot bypass the note, including before settlement', async t => {
  const h = await host(t);
  for (const reason of ['threshold', 'overflow']) assert.deepEqual(await h.emit('session_before_compact', { reason }), { cancel: true });
  assert.equal((await h.emit('tool_call', { toolName: 'read' })).block, true);
  await h.execute();
  assert.deepEqual(await h.emit('session_before_compact', { reason: 'threshold' }), { cancel: true });
  await h.emit('session_compact_failed', { reason: 'threshold', aborted: true });
  assert.equal(h.entries.filter(entry => entry.customType === 'self-compact-state').at(-1).data.handoff.status, 'pending');
  await h.emit('agent_settled');
  assert.equal(h.compactions.length, 1);
  const result = await h.emit('session_before_compact', summaryEvent());
  assert.ok(result.compaction);
  assert.equal(h.requests[0].options.reasoningEffort, 'low');
});

test('P1: final-answer crossing requests one follow-up, soft advice does not', async t => {
  const h = await host(t);
  h.usage(45000);
  await h.emit('agent_end');
  assert.equal(h.messages.length, 0);
  h.usage(110000);
  await h.emit('agent_end');
  await h.emit('agent_end');
  assert.equal(h.messages.filter(message => message.options?.triggerTurn).length, 1);
  await h.execute();
  await h.emit('agent_end');
  assert.equal(h.messages.length, 1);
});

test('P3: context refreshes one live guidance message and supports harness templates', async t => {
  const h = await host(t);
  h.prompt('SOFT_SELF_COMPACT', '{{context_tokens}} / {{context_window}} ({{context_percent}}%). {{remaining_tokens}} remain, warn {{warning_percent}}%.');
  h.usage(40000);
  const first = await h.emit('context', { messages: [] });
  assert.equal(first.messages.length, 1);
  assert.match(first.messages[0].content, /40,000 \/ 200,000 \(20.0%\).*160,000 remain, warn 50.0%/);
  h.usage(44000);
  const second = await h.emit('context', first);
  assert.equal(second.messages.length, 1);
  assert.match(second.messages[0].content, /44,000.*22.0%/);
  h.prompt('SOFT_SELF_COMPACT', 'UPDATED {{context_tokens}}');
  assert.match((await h.emit('context', second)).messages[0].content, /UPDATED 44,000/);
});

test('P3: tool preflight, turn boundary, and model change enforce newly crossed hard cutoff', async t => {
  for (const boundary of ['tool_call', 'turn_end', 'model_select']) {
    const h = await host(t);
    h.usage(120000);
    await h.emit(boundary, { toolName: 'external_tool' });
    assert.equal((await h.emit('tool_call', { toolName: 'external_tool' })).block, true);
  }
});

test('P2: invalid prompt files report errors without replacing the operator input silently', async t => {
  const h = await host(t);
  h.prompt('SOFT_SELF_COMPACT', '  ');
  h.usage(45000);
  assert.equal((await h.emit('context', { messages: [] })).messages.length, 0);
  await h.emit('context', { messages: [] });
  assert.equal(h.notices.filter(notice => /Prompt file is empty/.test(notice.message)).length, 1);
  assert.equal(await h.emit('tool_call', { toolName: 'read' }), undefined);
  h.prompt('COMPACTION_MESSAGE', '  ');
  assert.deepEqual(await h.emit('session_before_compact', summaryEvent()), { cancel: true });
  assert.equal(h.requests.length, 0);
  await h.info();
  assert.match(h.entries.at(-1).data.lines.join('\n'), /ERROR: Prompt file is empty/);
});

test('P1: aborted self_compact never saves a note', async t => {
  const h = await host(t);
  await assert.rejects(h.execute('NEXT ACTION: continue', AbortSignal.abort()), /cancelled before saving/);
  assert.equal(h.entries.filter(entry => entry.customType === 'self-compact-state').length, 0);
});

test('P1: Nothing to compact is a failure, never a successful note delivery', async t => {
  const h = await host(t);
  await h.execute();
  await h.emit('agent_settled');
  await h.emit('session_compact_failed', { reason: 'manual', aborted: false, errorMessage: 'Nothing to compact' });
  const state = h.entries.filter(entry => entry.customType === 'self-compact-state').at(-1).data;
  assert.equal(state.locked, true);
  assert.equal(state.handoff.status, 'failed');
  assert.equal(state.cycle, 0);
  assert.equal(h.messages.length, 0);
});

test('Footer keeps context percentage and useful phases without idle ok', async t => {
  const h = await host(t);
  assert.match(h.footer(), /\] 0%\s*$/);
  assert.doesNotMatch(h.footer(), /\bok\b/);
  h.usage(45000);
  await h.emit('turn_end');
  assert.match(h.footer(), /NOTICE/);
});

test('P2: native engine preserves split turns, previous summaries, budgets and file metadata', async t => {
  const h = await host(t, { 'compact-prompt': 'EXACT SYSTEM OVERRIDE' });
  h.prompt('SUMMARY_INSTRUCTIONS', 'USER INSTRUCTIONS: preserve evidence.');
  const event = summaryEvent({ previousSummary: 'Previous checkpoint.', isSplitTurn: true, turnPrefixMessages: [{ role: 'user', content: 'Continue parser tests.', timestamp: 2 }], settings: { reserveTokens: 1000, keepRecentTokens: 100 } });
  event.customInstructions = 'Keep the failing test name.';
  const result = await h.emit('session_before_compact', event);
  assert.ok(result.compaction);
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.requests.map(({ options }) => options.maxTokens), [800, 500]);
  for (const { request, options } of h.requests) {
    assert.equal(request.systemPrompt, 'EXACT SYSTEM OVERRIDE');
    assert.equal(options.reasoningEffort, 'low');
    assert.match(request.messages[0].content[0].text, /USER INSTRUCTIONS.*preserve evidence/);
    assert.match(request.messages[0].content[0].text, /Keep the failing test name/);
    assert.doesNotMatch(request.messages[0].content[0].text, /Use this EXACT format/);
  }
  assert.match(h.requests[0].request.messages[0].content[0].text, /<previous-summary>\nPrevious checkpoint/);
  assert.match(h.requests[1].request.messages[0].content[0].text, /Continue parser tests/);
  assert.match(result.compaction.summary, /Turn Context \(split turn\)/);
  assert.deepEqual(result.compaction.details.readFiles, ['README.md']);
  assert.deepEqual(result.compaction.details.modifiedFiles, ['parser.ts']);
  assert.equal(result.compaction.firstKeptEntryId, 'keep');
});

test('P2: configured transport retry applies inside each summary attempt', async t => {
  const h = await host(t);
  mkdirSync(join(h.ctx.cwd, '.pi'), { recursive: true });
  writeFileSync(join(h.ctx.cwd, '.pi/settings.json'), JSON.stringify({ retry: { enabled: true, maxRetries: 1, baseDelayMs: 1 } }));
  const complete = h.ctx.modelRegistry.complete;
  let calls = 0;
  h.ctx.modelRegistry.complete = async (...args) => {
    const response = await complete(...args);
    if (++calls === 1) return { ...response, stopReason: 'error', errorMessage: '503 Service unavailable' };
    return response;
  };
  const result = await h.emit('session_before_compact', summaryEvent());
  assert.equal(calls, 2);
  assert.equal(result.compaction.details.selfCompact.attempt, 1, 'transport retry succeeds within the first logical summary attempt');
});

test('P2: empty, truncated and tool-calling summaries never become checkpoints', async t => {
  for (const response of [
    { content: [], stopReason: 'stop' },
    { content: [{ type: 'text', text: 'Partial summary' }], stopReason: 'length' },
    { content: [{ type: 'toolCall', id: 'bad', name: 'write', arguments: {} }], stopReason: 'toolUse' },
  ]) {
    const h = await host(t);
    h.ctx.modelRegistry.complete = async () => response;
    assert.deepEqual(await h.emit('session_before_compact', summaryEvent()), { cancel: true });
  }
});

test('P4: view_context returns usage, percent, and thresholds as JSON and stays allowed under the lock', async t => {
  const h = await host(t);
  h.usage(45000);
  const view = JSON.parse((await h.view()).content[0].text);
  assert.equal(view.used_tokens, 45000);
  assert.equal(view.used_percent, 22.5);
  assert.equal(view.context_window, 200000);
  assert.equal(view.level, 'notice');
  assert.deepEqual(view.thresholds, { notice: { tokens: 40000, percent: 20 }, warning: { tokens: 100000, percent: 50 }, hard_cutoff: { tokens: 120000, percent: 60 } });
  assert.equal(view.tokens_until_warning, 55000);
  assert.equal(view.tokens_until_hard_cutoff, 75000);
  assert.equal(view.tools_locked, false);
  assert.equal(view.compaction_cycles, 0);
  h.usage(125000);
  await h.emit('turn_end');
  assert.equal((await h.emit('tool_call', { toolName: 'read' })).block, true);
  assert.equal(await h.emit('tool_call', { toolName: 'view_context' }), undefined);
  const locked = JSON.parse((await h.view()).content[0].text);
  assert.equal(locked.level, 'forced');
  assert.equal(locked.tools_locked, true);
  assert.equal(locked.tokens_until_hard_cutoff, 0);
});

test('P5: nothing to compact -> self_compact refuses, no lock, no guidance', async t => {
  const h = await host(t, {}, { compaction: { keepRecentTokens: 10000000 } });
  h.usage(125000);
  await h.emit('turn_end');
  assert.equal(await h.emit('tool_call', { toolName: 'read' }), undefined, 'forced level does not lock when compaction is impossible');
  assert.equal((await h.emit('context', { messages: [] })).messages.length, 0, 'no guidance when there is nothing to cut');
  await assert.rejects(h.execute('NEXT ACTION: continue'), /Nothing to compact yet: Pi keeps the newest 10,000,000 tokens/);
  assert.equal(h.entries.filter(entry => entry.customType === 'self-compact-state').length, 0, 'no note was saved');
  const view = JSON.parse((await h.view()).content[0].text);
  assert.equal(view.tools_locked, false);
});
