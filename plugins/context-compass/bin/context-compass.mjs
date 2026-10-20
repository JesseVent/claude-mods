#!/usr/bin/env node
// context-compass: a live view of what a Claude Code session has in context.
//
//   context-compass                 follow the session for this directory (TUI)
//   context-compass --once          print one frame and exit
//   context-compass --band          one-line status (use as Claude Code statusLine)
//   context-compass --transcript F  pin to one transcript file

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, spawnSync } from 'node:child_process';
import { parseSession } from '../lib/parse.mjs';
import { frame, band, listItems } from '../lib/render.mjs';
import { makeTheme } from '../lib/theme.mjs';

const HOME = os.homedir();
const STATE = path.join(HOME, '.claude', 'context-compass');
const PROJECTS = path.join(HOME, '.claude', 'projects');

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next != null && !next.startsWith('--') && ['transcript', 'cols', 'rows', 'window', 'compact-at', 'root', 'cwd'].includes(k)) { o[k] = next; i++; }
    else o[k] = true;
  }
  return o;
}
const A = args(process.argv.slice(2));
if (A.help) {
  console.log('usage: context-compass [--once|--band] [--transcript FILE] [--cwd DIR] [--window N] [--compact-at N] [--root DIR] [--cols N --rows N] [--no-color] [--no-links] [--ascii]');
  process.exit(0);
}

const num = (v) => (v == null || v === true ? null : Number(String(v).replace(/k$/i, '')) * (/k$/i.test(String(v)) ? 1000 : 1));
const WINDOW_SET = num(A.window) || num(process.env.CTX_WINDOW) || null;
const COMPACT_SET = num(A['compact-at']) || num(process.env.CTX_COMPACT_AT) || null;
const ROOT = A.root || process.env.CTX_ROOT || null;
const canSend = !!(process.env.CTX_TARGET_PANE || process.env.TMUX);
// Window and compaction point for a parsed session. The transcript does not record the
// window size, so a session that has ever gone past 200k is taken to be on the 1M window.
function eff(m) {
  const big = m && ((m.requested && /\[1m\]|-1m\b/i.test(m.requested)) || m.peak > 200000);
  const window = WINDOW_SET || (big ? 1000000 : 200000);
  let compactAt = COMPACT_SET, compactGuess = false;
  if (!compactAt && process.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE) compactAt = Math.round((window * Number(process.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE)) / 100);
  if (!compactAt) { compactAt = Math.round(window * 0.8); compactGuess = true; }
  return { window, compactAt, compactGuess, root: ROOT, canSend, linkTemplate: process.env.CTX_LINK_URL || null };
}
const opts = { root: ROOT };

const cwdHash = (d) => crypto.createHash('sha1').update(d).digest('hex').slice(0, 16);
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

function newestJsonl(dir) {
  let best = null;
  try {
    for (const n of fs.readdirSync(dir)) {
      if (!n.endsWith('.jsonl')) continue;
      const p = path.join(dir, n);
      const m = fs.statSync(p).mtimeMs;
      if (!best || m > best.m) best = { p, m };
    }
  } catch { /* missing */ }
  return best;
}

function resolveTranscript(cwd) {
  if (A.transcript) return A.transcript;
  if (process.env.CTX_TRANSCRIPT) return process.env.CTX_TRANSCRIPT;
  const ptr = readJson(path.join(STATE, 'by-cwd', cwdHash(cwd) + '.json'));
  const slugDir = path.join(PROJECTS, cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  const newest = newestJsonl(slugDir);
  // Prefer the hook's pointer unless a newer transcript exists for this directory (e.g. hook not installed yet).
  if (ptr && ptr.transcript_path && fs.existsSync(ptr.transcript_path)) {
    const pm = fs.statSync(ptr.transcript_path).mtimeMs;
    if (!newest || newest.m <= pm + 5000) return ptr.transcript_path;
  }
  if (newest) return newest.p;
  const latest = readJson(path.join(STATE, 'latest.json'));
  return latest && latest.transcript_path ? latest.transcript_path : null;
}

// ---------- --band (statusLine) ----------
if (A.band) {
  let input = '';
  if (!process.stdin.isTTY) { try { input = fs.readFileSync(0, 'utf8'); } catch { /* none */ } }
  let j = null; try { j = JSON.parse(input); } catch { /* not json */ }
  const cwd = A.cwd || (j && (j.cwd || (j.workspace && j.workspace.current_dir))) || process.cwd();
  const tp = (j && j.transcript_path) || resolveTranscript(cwd);
  const theme = makeTheme(process.env, { isTTY: true, color: A['no-color'] ? false : true, ascii: A.ascii ? true : undefined, links: A['no-links'] ? false : undefined });
  if (!tp) { process.stdout.write(theme.paint([['ctx: no session', 's']])); process.exit(0); }
  { const m = parseSession(tp); process.stdout.write(band(m, { ...eff(m), theme })); }
  process.exit(0);
}

const cwd = path.resolve(A.cwd || process.cwd());

// ---------- --once ----------
if (A.once || !process.stdout.isTTY) {
  const theme = makeTheme(process.env, { isTTY: process.stdout.isTTY, color: A['no-color'] ? false : undefined, ascii: A.ascii ? true : undefined, links: A['no-links'] ? false : undefined });
  const tp = resolveTranscript(cwd);
  if (!tp) { console.error('context-compass: no Claude Code transcript found for ' + cwd); process.exit(1); }
  const view = { mode: 'list', sel: 0, scroll: 0, sort: 'size', filter: '', collapsed: new Set() };
  const cols = Number(A.cols) || process.stdout.columns || 40;
  const rows = Number(A.rows) || process.stdout.rows || 44;
  const m = parseSession(tp);
  process.stdout.write(frame(m, view, { ...eff(m), cols, rows, theme }).join('\n') + '\n');
  process.exit(0);
}

// ---------- TUI ----------
const theme = makeTheme(process.env, { isTTY: true, color: A['no-color'] ? false : undefined, ascii: A.ascii ? true : undefined, links: A['no-links'] ? false : undefined });
const out = process.stdout;
const view = { mode: 'list', sel: 0, scroll: 0, sort: 'size', filter: '', collapsed: new Set(), detailPath: null, detailFile: null, flash: null, flashUntil: 0 };
let tp = null, model = null, sig = '';
let watchers = [];

function signature(p) {
  let s = '';
  try { s += fs.statSync(p).mtimeMs; } catch { s += 'x'; }
  const sub = p.replace(/\.jsonl$/, '') + '/subagents';
  try { for (const n of fs.readdirSync(sub)) s += n + fs.statSync(path.join(sub, n)).mtimeMs; } catch { /* none */ }
  return s;
}

function rewatch() {
  for (const w of watchers) { try { w.close(); } catch { /* closed */ } }
  watchers = [];
  if (!tp) return;
  for (const p of [tp, tp.replace(/\.jsonl$/, '') + '/subagents']) {
    try { watchers.push(fs.watch(p, { persistent: false }, () => schedule())); } catch { /* not there yet */ }
  }
}

let timer = null;
function schedule() { if (!timer) timer = setTimeout(() => { timer = null; refresh(); }, 120); }

let tick = 0;
function refresh(force) {
  const next = resolveTranscript(cwd);
  if (next !== tp) { tp = next; sig = ''; view.sel = 0; view.scroll = 0; rewatch(); }
  tick++;
  const s = tp ? signature(tp) : '';
  // Re-parse when the transcript changes, and every few ticks anyway so on-disk staleness updates.
  if (force || s !== sig || tick % 3 === 0) { sig = s; model = tp ? parseSession(tp) : null; }
  draw();
}

function flash(msg) { view.flash = msg; view.flashUntil = Date.now() + 2500; draw(); setTimeout(draw, 2600); }

function draw() {
  const cols = out.columns || 40, rows = out.rows || 44;
  let lines;
  if (!model) {

    const msg = ['', ' CONTEXT', '', ` waiting for a Claude Code session in`, ` ${cwd.replace(HOME, '~')}`.slice(0, cols)];
    lines = msg.map((l) => theme.paint([[l.padEnd(cols).slice(0, cols), 's']]));
    while (lines.length < rows) lines.push(' '.repeat(cols));
  } else {
    if (view.mode === 'detail') {
      view.detailFile = model.files.find((f) => f.path === view.detailPath) || null;
      if (!view.detailFile) view.mode = 'list';
    }
    lines = frame(model, view, { ...eff(model), cols, rows, theme });
    if (view.flash && Date.now() < view.flashUntil) lines[lines.length - 1] = theme.paint([[(' ' + view.flash).padEnd(cols).slice(0, cols), 'a']]);
  }
  // Each line at its own row, cleared to the end: with autowrap off (set at start) a frame that does not
  // fit the pane (a resize mid-draw, a wide glyph) is clipped instead of scrolling copies into scrollback.
  out.write(lines.slice(0, rows).map((l, i) => `\x1b[${i + 1};1H${l}\x1b[K`).join('') + '\x1b[J');
}

function current() {
  if (!model) return null;
  const { items } = listItems(model, view, opts.root);
  return items[Math.max(0, Math.min(view.sel, items.length - 1))] || null;
}
function selectedFile() {
  if (view.mode === 'detail') return view.detailFile;
  const it = current();
  return it && it.kind === 'file' ? it.file : null;
}

function copy(text) {
  if (process.env.TMUX) {
    const r = spawnSync('tmux', ['load-buffer', '-w', '-'], { input: text });
    if (r.status === 0) return true;
  }
  for (const [cmd, a] of [['pbcopy', []], ['wl-copy', []], ['xclip', ['-selection', 'clipboard']]]) {
    const r = spawnSync(cmd, a, { input: text });
    if (r.status === 0) return true;
  }
  out.write(`\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`);
  return true;
}

function openFile(f) {
  const editor = process.env.VISUAL || process.env.EDITOR || 'vi';
  if (!process.env.TMUX) return flash('open needs tmux; path copied instead'), copy(f.path);
  const q = (s) => "'" + s.replace(/'/g, "'\\''") + "'";
  execFile('tmux', ['new-window', '-n', path.basename(f.path), `${editor} ${q(f.path)}`], () => {});
  flash('opened in a new tmux window');
}

function sendPrompt(f) {
  const pane = process.env.CTX_TARGET_PANE;
  if (!pane) return flash('no Claude pane linked; start with ctx-open');
  const text = f.summarised ? `Re-read ${f.path}` : `Read the parts of ${f.path} you have not seen yet`;
  execFile('tmux', ['send-keys', '-t', pane, '-l', text], (err) => flash(err ? 'could not reach the Claude pane' : 'typed into Claude; press enter to send'));
}

function onKey(k) {
  if (k === '\x03') return quit();
  if (view.mode === 'help') { view.mode = 'list'; return draw(); }
  if (view.mode === 'filter') {
    if (k === '\r') view.mode = 'list';
    else if (k === '\x1b') { view.filter = ''; view.mode = 'list'; }
    else if (k === '\x7f' || k === '\b') view.filter = view.filter.slice(0, -1);
    else if (k.length === 1 && k >= ' ') { view.filter += k; view.sel = 0; view.scroll = 0; }
    return draw();
  }
  const total = model ? listItems(model, view, opts.root).items.length : 0;
  const page = Math.max(1, (out.rows || 44) - 20);
  switch (k) {
    case 'q': return quit();
    case '\x1b[A': case 'k': view.sel = Math.max(0, view.sel - 1); break;
    case '\x1b[B': case 'j': view.sel = Math.min(total - 1, view.sel + 1); break;
    case '\x1b[5~': view.sel = Math.max(0, view.sel - page); break;
    case '\x1b[6~': view.sel = Math.min(total - 1, view.sel + page); break;
    case 'g': view.sel = 0; break;
    case 'G': view.sel = total - 1; break;
    case '?': view.mode = 'help'; break;
    case '/': if (view.mode === 'list') { view.mode = 'filter'; } break;
    case 's': view.sort = { size: 'name', name: 'recent', recent: 'size' }[view.sort]; view.sel = 0; view.scroll = 0; break;
    case '\x1b': case '\x1b[D': case 'h': if (view.mode === 'detail') view.mode = 'list'; else if (view.filter) view.filter = ''; break;
    case '\r': case ' ': case '\x1b[C': case 'l': {
      if (view.mode === 'detail') break;
      const it = current();
      if (!it) break;
      if (it.kind === 'group' || k === ' ') {
        const name = it.group.name;
        if (view.collapsed.has(name)) view.collapsed.delete(name); else view.collapsed.add(name);
        if (it.kind === 'file') { const { items } = listItems(model, view, opts.root); view.sel = items.findIndex((x) => x.kind === 'group' && x.group.name === name); }
      } else {
        view.mode = 'detail';
        view.detailPath = it.file.path;
        const files = listItems(model, view, opts.root).items.filter((x) => x.kind === 'file');
        view.detailPos = files.findIndex((x) => x.file.path === it.file.path) + 1;
      }
      break;
    }
    case 'o': { const f = selectedFile(); if (f) openFile(f); return; }
    case 'y': { const f = selectedFile(); if (f) { copy(f.path); flash('copied ' + path.basename(f.path)); } return; }
    case 'r': { const f = selectedFile(); if (f) sendPrompt(f); return; }
    default: return;
  }
  draw();
}

function quit() {
  out.write('\x1b[0m\x1b[?25h\x1b[?7h\x1b[?1049l');
  process.exit(0);
}

out.write('\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[2J');
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  // Split a burst into keys: escape sequences stay whole.
  const keys = d.match(/\x1b\[[0-9;]*[A-Za-z~]|\x1bO[A-Za-z]|\x1b|[\s\S]/g) || [];
  for (const k of keys) onKey(k === '\x1bOA' ? '\x1b[A' : k === '\x1bOB' ? '\x1b[B' : k);
});
out.on('resize', () => { out.write('\x1b[2J'); draw(); });
process.on('SIGTERM', quit);
process.on('SIGHUP', quit);
refresh(true);
setInterval(() => refresh(false), 1500);
