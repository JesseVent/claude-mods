// Parses a Claude Code session transcript (JSONL) into the sidebar's model.
// Token counts for individual files and helper summaries are estimates
// (characters / 4). The context total comes from the API usage Claude Code
// records on each assistant message, so it is exact.

import fs from 'node:fs';
import path from 'node:path';

export const est = (s) => Math.ceil((s || '').length / 4);

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((c) => (c && c.type === 'text' ? c.text || '' : '')).join('\n');
}

function imageTokens(file) {
  const d = file && file.dimensions;
  const w = d ? d.displayWidth || d.originalWidth : 0;
  const h = d ? d.displayHeight || d.originalHeight : 0;
  if (w && h) return Math.max(85, Math.ceil((w * h) / 750));
  return 1500;
}

const usageTotal = (u) =>
  u ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.output_tokens || 0) : 0;

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);
const AGENT_TOOLS = new Set(['Task', 'Agent']);
const PRINTING_HOOK_EVENTS = new Set(['SessionStart', 'UserPromptSubmit']); // their stdout goes to Claude

// What a hook put in front of Claude: any hook's additionalContext, or what a SessionStart or UserPromptSubmit hook printed.
function hookTextOf(a) {
  if (a.type === 'hook_additional_context') return Array.isArray(a.content) ? a.content.join('\n') : String(a.content || '');
  if (a.type === 'hook_success' && PRINTING_HOOK_EVENTS.has(a.hookEvent)) return a.content || '';
  return '';
}

// The skill a hook's text names ("full content of your 'superpowers:using-superpowers' skill"), else its first line.
export function hookLabel(text) {
  const named = /'([\w:.-]+)' skill/.exec(text);
  if (named) return named[1];
  for (const line of text.split('\n')) {
    const l = line.replace(/<[^>]*>/g, '').replace(/^[#=*\s]+|[=*\s]+$/g, '');
    if (l) return l;
  }
  return '';
}

export function readJsonl(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* partial last line while writing */ }
  }
  return out;
}

// Reads made inside one subagent transcript: [{path, ts}]
function subagentReads(entries) {
  const pending = new Map();
  const reads = [];
  for (const o of entries) {
    const c = o.message && o.message.content;
    if (!Array.isArray(c)) continue;
    for (const it of c) {
      if (o.type === 'assistant' && it.type === 'tool_use' && it.name === 'Read') pending.set(it.id, it.input || {});
      if (o.type === 'user' && it.type === 'tool_result' && pending.has(it.tool_use_id)) {
        reads.push({ path: pending.get(it.tool_use_id).file_path, ts: Date.parse(o.timestamp) || 0 });
      }
    }
  }
  return reads;
}

export function parseSession(transcriptPath, opts = {}) {
  const entries = opts.entries || readJsonl(transcriptPath);
  const stat = opts.stat || ((p) => { try { return fs.statSync(p); } catch { return null; } });
  const subDir = transcriptPath ? path.join(transcriptPath.replace(/\.jsonl$/, ''), 'subagents') : null;

  const files = new Map();
  const helpers = [];
  const compactions = [];
  const pending = new Map();
  const skills = new Map();
  const skillCalls = new Map(); // Skill tool_use id -> skill name
  const hookTexts = new Map();
  let lastCommand = null; // a typed /name, which names the skill text that follows it
  let peak = 0, requested = null;
  let firstUsage = null, lastUsage = null, firstPrompt = null, model = null, cwd = null, sessionId = null;

  const fileOf = (p) => {
    if (!files.has(p)) files.set(p, { path: p, reads: [], tokens: 0, totalLines: 0, image: false, inContext: false, summarised: false, lastTouch: 0, wasTokens: 0, loadedBy: 'main' });
    return files.get(p);
  };
  const skillOf = (name) => {
    if (!skills.has(name)) skills.set(name, { name, tokens: 0, ts: 0, summarised: false });
    return skills.get(name);
  };

  for (const o of entries) {
    if (o.cwd && !cwd) cwd = o.cwd;
    if (o.sessionId && !sessionId) sessionId = o.sessionId;
    if (o.isSidechain) continue; // legacy inline subagent turns: not in main context
    const ts = Date.parse(o.timestamp) || 0;

    if (o.type === 'system' && o.subtype === 'compact_boundary') {
      compactions.push({ ts, preTokens: (o.compactMetadata && o.compactMetadata.preTokens) || null, trigger: (o.compactMetadata && o.compactMetadata.trigger) || null });
      for (const f of files.values()) {
        if (f.inContext) { f.inContext = false; f.summarised = true; f.wasTokens = f.tokens; f.tokens = 0; f.reads = []; }
      }
      for (const h of helpers) h.summarised = true;
      for (const s of skills.values()) s.summarised = true;
      for (const h of hookTexts.values()) h.summarised = true;
      continue;
    }

    // After a compaction Claude Code attaches the skills loaded so far again.
    if (o.type === 'attachment' && o.attachment && o.attachment.type === 'invoked_skills') {
      for (const it of o.attachment.skills || []) {
        const s = skillOf(it.name);
        s.summarised = false;
        s.tokens = est(it.content);
      }
      continue;
    }

    const hookText = o.type === 'attachment' && o.attachment ? hookTextOf(o.attachment) : '';
    if (hookText) {
      const label = hookLabel(hookText);
      // ponytail: digits blanked so a per-prompt hook (a timestamp) is one row; two hooks whose first lines differ only in numbers merge
      const key = `${o.attachment.hookEvent} ${label.replace(/\d+/g, '#')}`;
      if (!hookTexts.has(key)) hookTexts.set(key, { event: o.attachment.hookEvent, label, count: 0, tokens: 0, summarised: false });
      const h = hookTexts.get(key);
      if (h.summarised) Object.assign(h, { summarised: false, count: 0, tokens: 0 });
      h.label = label;
      h.count++;
      h.tokens += est(hookText);
      continue;
    }

    if (o.type === 'assistant' && o.message) {
      if (o.message.usage) { lastUsage = o.message.usage; if (!firstUsage) firstUsage = o.message.usage; peak = Math.max(peak, usageTotal(o.message.usage)); }
      if (o.requestedModel) requested = o.requestedModel;
      if (o.message.model && o.message.model !== '<synthetic>') model = o.message.model;
      for (const it of o.message.content || []) {
        if (it.type === 'tool_use') pending.set(it.id, { name: it.name, input: it.input || {}, ts });
        if (it.type === 'tool_use' && it.name === 'Skill' && it.input) skillCalls.set(it.id, it.input.skill);
        if (it.type === 'tool_use' && AGENT_TOOLS.has(it.name)) {
          helpers.push({ id: it.id, type: it.input.subagent_type || 'agent', desc: it.input.description || '', tokens: 0, done: false, reads: [], ts, summarised: false });
        }
      }
      continue;
    }

    if (o.type === 'user' && o.message) {
      const c = o.message.content;
      if (!firstPrompt && !o.isMeta && !o.isCompactSummary && !(Array.isArray(c) && c.some((x) => x.type === 'tool_result'))) {
        const t = textOf(c);
        if (t) firstPrompt = t;
      }
      // A skill's text arrives as a meta user message, after its Skill call or its typed /name.
      const text = textOf(c);
      const typed = !o.isMeta && /<command-name>\/([^<\s]+)<\/command-name>/.exec(text);
      if (typed) lastCommand = typed[1];
      const dir = o.isMeta && /^Base directory for this skill: (.+)/.exec(text);
      if (dir) {
        const s = skillOf(skillCalls.get(o.sourceToolUseID) || lastCommand || path.basename(dir[1].trim()));
        if (s.summarised) { s.summarised = false; s.tokens = 0; }
        s.tokens += est(text);
        s.ts = ts;
        lastCommand = null;
        continue;
      }
      if (!Array.isArray(c)) continue;
      for (const it of c) {
        if (it.type !== 'tool_result') continue;
        const use = pending.get(it.tool_use_id);
        if (!use) continue;
        pending.delete(it.tool_use_id);
        const r = o.toolUseResult && typeof o.toolUseResult === 'object' ? o.toolUseResult : null;

        if (use.name === 'Read') {
          const p = (r && r.file && r.file.filePath) || use.input.file_path;
          if (!p || it.is_error) continue;
          const f = fileOf(p);
          if (f.summarised) { f.summarised = false; f.wasTokens = 0; }
          f.inContext = true;
          f.lastTouch = Math.max(f.lastTouch, ts);
          if (r && r.type === 'image') {
            f.image = true;
            const tok = imageTokens(r.file);
            f.reads.push({ start: 1, end: 1, total: 1, ts, tokens: tok });
            f.tokens += tok;
            f.totalLines = 1;
          } else {
            const tok = est(textOf(it.content));
            let start, n, total;
            if (r && r.file && r.file.numLines != null) {
              start = r.file.startLine || 1; n = r.file.numLines; total = r.file.totalLines || n;
            } else {
              start = use.input.offset || 1;
              n = textOf(it.content).split('\n').length;
              total = use.input.limit ? 0 : start + n - 1;
            }
            const end = Math.max(start, start + n - 1);
            f.reads.push({ start, end, total, ts, tokens: tok });
            f.tokens += tok;
            if (total) f.totalLines = total;
          }
        } else if (EDIT_TOOLS.has(use.name)) {
          const p = use.input.file_path || use.input.notebook_path;
          if (p && files.has(p)) files.get(p).lastTouch = Math.max(files.get(p).lastTouch, ts);
        } else if (AGENT_TOOLS.has(use.name)) {
          const h = helpers.find((x) => x.id === it.tool_use_id);
          if (!h) continue;
          h.done = true;
          h.tokens = est(textOf(it.content));
          h.agentId = r && r.agentId;
          if (subDir && h.agentId) {
            h.reads = subagentReads(readJsonl(path.join(subDir, `agent-${h.agentId}.jsonl`)));
          }
        }
      }
    }
  }

  // Coverage and staleness
  for (const f of files.values()) {
    f.seen = coverage(f);
    const st = f.inContext && !f.image ? stat(f.path) : null;
    f.missing = f.inContext && !f.image && !st;
    f.stale = !!(st && st.mtimeMs > f.lastTouch + 1000);
  }

  const used = usageTotal(lastUsage);
  const promptTok = est(firstPrompt || '');
  const baseline = firstUsage ? Math.max(0, usageTotal(firstUsage) - (firstUsage.output_tokens || 0) - promptTok) : 0;
  const inCtx = [...files.values()].filter((f) => f.inContext);
  const fileTok = inCtx.reduce((a, f) => a + f.tokens, 0);
  const helperTok = helpers.filter((h) => !h.summarised).reduce((a, h) => a + h.tokens, 0);
  const sys = Math.min(baseline, used);
  const chat = Math.max(0, used - sys - fileTok - helperTok);

  return {
    sessionId, cwd, model, requested, peak,
    used,
    parts: { sys, chat, files: fileTok, helpers: helperTok },
    files: [...files.values()],
    helpers,
    skills: [...skills.values()].sort((a, b) => a.ts - b.ts),
    hookTexts: [...hookTexts.values()].sort((a, b) => b.tokens - a.tokens),
    compactions,
  };
}

// Fraction of the file's lines seen in context, 0..1. Images count as 1.
export function coverage(f) {
  if (f.image) return 1;
  if (!f.reads.length) return 0;
  const total = f.totalLines || Math.max(...f.reads.map((r) => r.end));
  if (!total) return 1;
  const rs = f.reads.map((r) => [r.start, Math.min(r.end, total)]).sort((a, b) => a[0] - b[0]);
  let covered = 0, cs = rs[0][0], ce = rs[0][1];
  for (const [s, e] of rs.slice(1)) {
    if (s <= ce + 1) ce = Math.max(ce, e);
    else { covered += ce - cs + 1; cs = s; ce = e; }
  }
  covered += ce - cs + 1;
  return Math.min(1, covered / total);
}

// Merged line ranges a file has in context, for the detail view.
export function ranges(f) {
  if (!f.reads.length) return [];
  const rs = f.reads.map((r) => [r.start, r.end]).sort((a, b) => a[0] - b[0]);
  const out = [rs[0].slice()];
  for (const [s, e] of rs.slice(1)) {
    const last = out[out.length - 1];
    if (s <= last[1] + 1) last[1] = Math.max(last[1], e); else out.push([s, e]);
  }
  return out;
}
