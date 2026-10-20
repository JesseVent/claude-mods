// Lays the model out on the character grid described in the v2 cell spec.
// Every line is exactly `cols` cells: one cell of padding, W content cells, one cell of padding.

import os from 'node:os';
import path from 'node:path';
import { ranges } from './parse.mjs';

export const fmt = (n) => {
  if (n == null) return '–';
  if (n < 1000) return String(Math.round(n));
  if (n < 100000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n / 1000) + 'k';
};
const fmtShort = (n) => (n < 1000 ? String(Math.round(n)) : Math.round(n / 1000) + 'k');
const hhmm = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const tilde = (p) => { const h = os.homedir(); return p.startsWith(h) ? '~' + p.slice(h.length) : p; };

function cut(s, n, ell) {
  if (n <= 0) return '';
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + ell;
}
const padR = (s, n, ell = '…') => cut(s, n, ell).padEnd(n);
const padL = (s, n, ell = '…') => cut(s, n, ell).padStart(n);

// Fit a segment list to exactly w cells.
function fit(segs, w) {
  const out = [];
  let used = 0;
  for (const s of segs) {
    if (used >= w) break;
    const t = s[0].slice(0, w - used);
    used += t.length;
    out.push([t, s[1], s[2], s[3]]);
  }
  if (used < w) out.push([' '.repeat(w - used), null]);
  return out;
}
// Left segs + right-aligned segs on one line of width w.
function lr(left, right, w) {
  const lw = left.reduce((a, s) => a + s[0].length, 0);
  const rw = right.reduce((a, s) => a + s[0].length, 0);
  if (lw + rw + 1 > w) return fit([...left, [' ', null], ...right], w);
  return [...left, [' '.repeat(w - lw - rw), null], ...right];
}

export function groupFiles(files, root) {
  const dirs = files.map((f) => path.dirname(f.path));
  if (!root) {
    if (!dirs.length) root = '/';
    else {
      let parts = dirs[0].split(path.sep);
      for (const d of dirs.slice(1)) {
        const p = d.split(path.sep);
        let i = 0;
        while (i < parts.length && i < p.length && parts[i] === p[i]) i++;
        parts = parts.slice(0, i);
      }
      root = parts.join(path.sep) || path.sep;
      if (dirs.every((d) => d === root)) root = path.dirname(root);
    }
  }
  const groups = new Map();
  for (const f of files) {
    const rel = path.relative(root, path.dirname(f.path));
    const key = rel === '' ? path.basename(root) || root : rel.startsWith('..') ? path.dirname(f.path) : rel.split(path.sep)[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return { root, groups };
}

// Link target for a file. Default opens it with the system's default app (file:// URL).
// CTX_LINK_URL can set a template instead, e.g. "vscode://file/{path}:{line}".
export function linkFor(f, template) {
  const line = f.reads && f.reads.length ? Math.min(...f.reads.map((r) => r.start)) : 1;
  if (template) return template.replace(/\{path\}/g, encodeURI(f.path).replace(/#/g, '%23').replace(/\?/g, '%3F')).replace(/\{line\}/g, String(line));
  const enc = f.path.split('/').map(encodeURIComponent).join('/');
  return `file://${os.hostname()}${enc}`;
}

const fileTok = (f) => (f.inContext ? f.tokens : f.wasTokens);

export function listItems(model, view, root) {
  let files = model.files.filter((f) => f.inContext || f.summarised);
  if (!root) root = groupFiles(files, null).root; // group against the full set so filtering keeps project names
  if (view.filter) {
    const q = view.filter.toLowerCase();
    files = files.filter((f) => f.path.toLowerCase().includes(q));
  }
  const cmp = view.sort === 'name' ? (a, b) => path.basename(a.path).localeCompare(path.basename(b.path))
    : view.sort === 'recent' ? (a, b) => b.lastTouch - a.lastTouch
      : (a, b) => fileTok(b) - fileTok(a);
  const { groups } = groupFiles(files, root);
  const gl = [...groups.entries()].map(([name, fs]) => ({
    name, files: fs.sort((a, b) => (a.inContext === b.inContext ? cmp(a, b) : a.inContext ? -1 : 1)),
    tokens: fs.reduce((a, f) => a + (f.inContext ? f.tokens : 0), 0),
    last: Math.max(...fs.map((f) => f.lastTouch)),
  }));
  gl.sort(view.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : view.sort === 'recent' ? (a, b) => b.last - a.last : (a, b) => b.tokens - a.tokens);
  const items = [];
  for (const g of gl) {
    const closed = view.collapsed.has(g.name);
    items.push({ kind: 'group', group: g, closed });
    if (!closed) for (const f of g.files) items.push({ kind: 'file', file: f, group: g });
  }
  return { items, count: files.length, files };
}

function fileRow(f, W, t, sel, tpl) {
  const g = t.g;
  let glyph = [g.full, 'a'], nc = 'f';
  if (f.summarised) { glyph = [g.summ, 'm']; nc = 's'; }
  else if (f.stale || f.missing) { glyph = [g.stale, 'y']; nc = 'y'; }
  else if (f.image) glyph = [g.image, 'c'];
  const nameW = W - 13;
  const seen = !f.image && f.inContext && f.seen < 0.995 ? Math.max(1, Math.round(f.seen * 100)) + '%' : '';
  const tok = f.summarised ? g.dash : (f.image ? '~' : '') + fmt(f.tokens);
  return {
    sel,
    segs: [glyph, [' ', null], ...linked(padR(path.basename(f.path), nameW, g.ell), nc, linkFor(f, tpl)), [' ', null], [padL(seen, 4), 'a'], [' ', null], [padL(tok, 5), 'm']],
  };
}

// Split padded text so only the visible name is inside the link, not its trailing spaces.
function linked(text, colour, url) {
  const name = text.trimEnd();
  return [[name, colour, null, url], [text.slice(name.length), null]];
}

function groupRow(item, W, t, sel) {
  const g = item.group;
  const label = g.name + (item.closed ? ` (${g.files.length})` : '');
  return { sel, segs: [[(item.closed ? t.g.closed : t.g.open) + ' ', 'x'], [padR(label, W - 9, t.g.ell), 'm'], [padL(fmt(g.tokens), 7), 'm']] };
}

function bar(W, frac, markFrac, t, hot) {
  const fill = Math.max(0, Math.min(1, frac)) * W;
  const full = Math.floor(fill);
  const half = fill - full >= 0.5;
  const mark = markFrac != null ? Math.max(0, Math.min(W - 1, Math.round(markFrac * W) - 1)) : -1;
  const segs = [];
  for (let i = 0; i < W; i++) {
    if (i === mark) segs.push([t.g.mark, i < full ? 'f' : 'y']);
    else if (i < full) segs.push([t.g.bar, hot ? 'y' : 'a']);
    else if (i === full && half) segs.push([t.g.half, hot ? 'y' : 'a']);
    else segs.push([t.g.bar, 'x']);
  }
  return segs;
}

function shareBar(parts, W, t) {
  const keys = [['sys', 'm'], ['chat', 'v'], ['files', 'b'], ['helpers', 'o']];
  const total = keys.reduce((a, [k]) => a + parts[k], 0);
  if (!total) return [[t.g.block.repeat(W), 'x']];
  const raw = keys.map(([k]) => (parts[k] / total) * W);
  const cells = raw.map(Math.floor);
  let left = W - cells.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - cells[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { cells[i]++; left--; } });
  return keys.map(([, c], i) => [t.g.block.repeat(cells[i]), c]);
}

export function budget(model, opts) {
  const window = opts.window;
  const compactAt = opts.compactAt;
  return { window, compactAt, used: model.used, pct: Math.round((model.used / window) * 100), free: Math.max(0, compactAt - model.used), hot: model.used >= compactAt * 0.9 };
}

function header(model, W, t, opts) {
  const b = budget(model, opts);
  const P = model.parts;
  const L = [];
  L.push({ segs: lr([['CONTEXT', 'm']], [[`${fmt(b.used)} / ${fmt(b.window)}  ${b.pct}%`, 'f']], W) });
  L.push({ segs: bar(W, b.used / b.window, b.compactAt / b.window, t, b.hot) });
  L.push({ segs: lr([[`${fmt(b.free)} free`, b.hot ? 'y' : 's']], [[`compacts ${opts.compactGuess ? t.g.approx : 'at '}${fmt(b.compactAt)}`, 's']], W) });
  L.push({ segs: shareBar(P, W, t) });
  const sq = t.g.sq;
  const leg = [[sq, 'm'], [` sys ${fmtShort(P.sys)} `, 's'], [sq, 'v'], [` chat ${fmtShort(P.chat)} `, 's'], [sq, 'b'], [` files ${fmtShort(P.files)} `, 's'], [sq, 'o'], [` ${fmtShort(P.helpers)}`, 's']];
  L.push({ segs: fit(leg, W) });
  L.push({ segs: [[t.g.rule.repeat(W), 'x']] });
  return L;
}

function keyHints(pairs, W) {
  const len = (sep) => pairs.reduce((a, [k, l]) => a + k.length + (l ? l.length + 1 : 0), 0) + sep * (pairs.length - 1);
  const sep = len(2) <= W ? 2 : 1;
  const segs = [];
  pairs.forEach(([k, label], i) => { segs.push([k, 'f', 'k']); if (label) segs.push([' ' + label, 's']); if (i < pairs.length - 1) segs.push([' '.repeat(sep), null]); });
  return fit(segs, W);
}

export function frame(model, view, opts) {
  const { cols, rows, theme: t } = opts;
  const W = Math.max(20, cols - 2);
  const H = Math.max(10, rows);
  const lines = view.mode === 'detail' ? detail(model, view, W, H, t, opts) : list(model, view, W, H, t, opts);
  while (lines.length < H) lines.push({ segs: [[' '.repeat(W), null]] });
  return lines.slice(0, H).map((l) => t.paint([[' ', null], ...fit(l.segs, W), [' ', null]], { sel: l.sel }));
}

function list(model, view, W, H, t, opts) {
  const g = t.g;
  const top = header(model, W, t, opts);
  const { items, count, files } = listItems(model, view, opts.root);
  const n = (p) => files.filter(p).length;
  const counts = `${g.full}${n((f) => f.inContext && !f.stale && !f.image)} ${g.stale}${n((f) => f.stale || f.missing)} ${g.image}${n((f) => f.image && f.inContext)} ${g.summ}${n((f) => f.summarised)}`;
  top.push({ segs: lr([['FILES', 'm'], [` ${count}`, 'f']], [[`${counts}   ${view.sort} ${g.down}`, 's']], W) });

  // Bottom block
  const bottom = [];
  const helpers = model.helpers.filter((h) => !h.summarised);
  bottom.push({ segs: [[g.rule.repeat(W), 'x']] });
  bottom.push({ segs: lr([['HELPERS', 'm'], [` ${helpers.length}`, 'f']], [[helpers.length ? 'cost to main' : 'none', 's']], W) });
  const maxH = 3;
  for (const h of helpers.slice(-maxH)) {
    const desc = `${h.type}  ${h.desc}`;
    const reads = h.reads.length ? ` ${h.reads.length}r` : '';
    bottom.push({ segs: [[g.helper, 'o'], [' ', null], [padR(desc, W - 9 - reads.length, g.ell), 'f'], [reads, 's'], [padL(h.done ? fmt(h.tokens) : 'running', 7), h.done ? 'm' : 'g']] });
  }
  if (helpers.length > maxH) bottom.push({ segs: [[`+${helpers.length - maxH} earlier helpers`, 's']] });
  const skills = model.skills.filter((s) => !s.summarised);
  bottom.push({ segs: [[g.rule.repeat(W), 'x']] });
  bottom.push({ segs: lr([['SKILLS', 'm'], [` ${skills.length}`, 'f']], [[skills.length ? fmt(skills.reduce((a, s) => a + s.tokens, 0)) : 'none', 's']], W) });
  for (const s of skills.slice(-maxH)) {
    bottom.push({ segs: [[g.skill, 'c'], [' ', null], [padR(s.name, W - 9, g.ell), 'f'], [padL(fmt(s.tokens), 7), 'm']] });
  }
  if (skills.length > maxH) bottom.push({ segs: [[`+${skills.length - maxH} earlier skills`, 's']] });
  const hooks = model.hookTexts.filter((h) => !h.summarised);
  bottom.push({ segs: [[g.rule.repeat(W), 'x']] });
  bottom.push({ segs: lr([['HOOK TEXT', 'm'], [` ${hooks.length}`, 'f']], [[hooks.length ? fmt(hooks.reduce((a, h) => a + h.tokens, 0)) : 'none', 's']], W) });
  for (const h of hooks.slice(0, maxH)) {
    const times = h.count > 1 ? ` ${g.times}${h.count}` : '';
    bottom.push({ segs: [[g.hook, 'v'], [' ', null], [padR(h.label, W - 9 - times.length, g.ell), 'f'], [times, 's'], [padL(fmt(h.tokens), 7), 'm']] });
  }
  if (hooks.length > maxH) bottom.push({ segs: [[`+${hooks.length - maxH} more`, 's']] });
  const summ = model.files.filter((f) => f.summarised).length;
  const lastC = model.compactions[model.compactions.length - 1];
  bottom.push({ segs: [[g.rule.repeat(W), 'x']] });
  bottom.push({ segs: lr([['SUMMARISED', 'm'], [` ${summ}`, 'f']], [[lastC ? `compacted ${hhmm(lastC.ts)}` : 'nothing compacted yet', 's']], W) });
  if (summ) bottom.push({ segs: [[g.summ, 'm'], [' ', null], ['summary only, re-read with r', 's']] });
  bottom.push({ segs: [[g.rule.repeat(W), 'x']] });
  if (view.mode === 'filter') bottom.push({ segs: [['/', 'm'], [' ' + view.filter, 'f'], [g.cursor, 'f'], ['   enter done  esc clear', 's']] });
  else bottom.push({ segs: keyHints([[g.updown, ''], ['ret', 'detail'], ['/', 'filter'], ['s', 'sort'], ['?', 'keys']], W) });

  if (view.mode === 'help') return helpScreen(W, t);

  let room = H - top.length - bottom.length;
  const out = [...top];
  if (!items.length) {
    out.push({ segs: [[model.files.length ? 'no files match the filter' : 'no files read yet', 's']] });
    room -= 1;
  } else {
    view.sel = Math.max(0, Math.min(view.sel, items.length - 1));
    const needMore = items.length > room;
    const vis = needMore ? room - 1 : room;
    if (view.sel < view.scroll) view.scroll = view.sel;
    if (view.sel >= view.scroll + vis) view.scroll = view.sel - vis + 1;
    view.scroll = Math.max(0, Math.min(view.scroll, Math.max(0, items.length - vis)));
    const slice = items.slice(view.scroll, view.scroll + vis);
    slice.forEach((it, i) => {
      const sel = view.scroll + i === view.sel;
      out.push(it.kind === 'group' ? groupRow(it, W, t, sel) : fileRow(it.file, W, t, sel, opts.linkTemplate));
    });
    if (needMore) {
      const below = items.length - view.scroll - vis;
      const hidden = items.filter((x) => x.kind === 'group' && x.closed).reduce((a, x) => a + x.group.files.length, 0);
      out.push({ segs: [[below > 0 ? `${g.down} ${below} more rows` : `${view.scroll} rows above`, 's'], [hidden ? `  ${hidden} in collapsed groups` : '', 's']] });
    }
    room -= slice.length + (needMore ? 1 : 0);
  }
  for (let i = 0; i < room; i++) out.push({ segs: [[' ', null]] });
  return [...out, ...bottom];
}

function detail(model, view, W, H, t, opts) {
  const g = t.g;
  const f = view.detailFile;
  const out = [];
  const total = model.files.filter((x) => x.inContext || x.summarised).length;
  out.push({ segs: lr([[`${g.back} files`, 's']], [[view.detailPos ? `${view.detailPos} of ${total}` : '', 's']], W) });
  const row = fileRow(f, W, t, false);
  out.push({ segs: [row.segs[0], [' ', null], [path.basename(f.path), row.segs[2][1], 'b', linkFor(f, opts.linkTemplate)]] });
  out.push({ segs: [['  ', null], [cut(tilde(path.dirname(f.path)) + '/', W - 2, g.ell), 's', null, linkFor({ path: path.dirname(f.path) })]] });
  out.push({ segs: [[g.rule.repeat(W), 'x']] });

  out.push({ segs: [['SEEN', 'm']] });
  if (f.summarised) {
    const c = model.compactions[model.compactions.length - 1];
    out.push({ segs: [['summary only', 'f'], [c ? `  since ${hhmm(c.ts)}` : '', 's']] });
    out.push({ segs: [['exact lines are gone from context', 's']] });
  } else if (f.image) {
    out.push({ segs: [['image', 'c'], ['  sent whole', 's']] });
  } else {
    const rs = ranges(f);
    const tl = f.totalLines || (rs.length ? rs[rs.length - 1][1] : 0);
    const pct = Math.round(f.seen * 100);
    const rtxt = rs.map(([a, b]) => (a === b ? `L${a}` : `L${a}${g.dash}${b}`)).join(', ');
    out.push({ segs: [[`${pct}%`, 'f', 'b'], [pct >= 100 ? '  whole file' : `  ${rtxt} of ${tl}`, 'm']] });
    if (tl) {
      const segs = [];
      for (let i = 0; i < W; i++) {
        const a = Math.floor((i * tl) / W) + 1, b = Math.max(a, Math.floor(((i + 1) * tl) / W));
        const hit = rs.some(([s, e]) => s <= b && e >= a);
        segs.push([g.bar, hit ? 'a' : 'x']);
      }
      out.push({ segs });
      out.push({ segs: lr([['1', 's']], [[String(tl), 's']], W) });
    }
  }
  out.push({ segs: [[g.rule.repeat(W), 'x']] });

  out.push({ segs: [['COST', 'm']] });
  const tok = f.inContext ? f.tokens : f.wasTokens;
  out.push({ segs: lr([[f.summarised ? 'tokens before compact' : 'tokens (est.)', 'm']], [[(f.image ? '~' : '') + fmt(tok), 'f']], W) });
  if (f.inContext) out.push({ segs: lr([['share of context', 'm']], [[model.used ? ((tok / model.used) * 100).toFixed(1) + '%' : g.dash, 'f']], W) });
  out.push({ segs: lr([['loaded by', 'm']], [[f.loadedBy, 'f']], W) });
  const disk = f.missing ? ['deleted', 'y'] : f.stale ? ['changed after read', 'y'] : f.image || f.summarised ? [g.dash, 's'] : ['unchanged', 'g'];
  out.push({ segs: lr([['on disk', 'm']], [disk], W) });
  out.push({ segs: [[g.rule.repeat(W), 'x']] });

  out.push({ segs: lr([['READS', 'm']], [[f.reads.length ? '' : 'none since compact', 's']], W) });
  const keysLines = 2;
  const room = H - out.length - keysLines;
  const reads = f.reads.slice(-Math.max(0, room));
  for (const r of reads) {
    const span = f.image ? 'image' : r.start === r.end ? `L${r.start}` : `L${r.start}${g.dash}${r.end}`;
    out.push({ segs: lr([[hhmm(r.ts), 's'], ['  Read ', 'f'], [span, 'm']], [[fmt(r.tokens), 'm']], W) });
  }
  while (out.length < H - keysLines) out.push({ segs: [[' ', null]] });
  out.push({ segs: [[g.rule.repeat(W), 'x']] });
  const pairs = [['o', 'open'], ['y', 'copy'], ['esc', 'back']];
  if (opts.canSend && (f.summarised || (f.seen < 0.995 && !f.image))) pairs.splice(2, 0, ['r', f.summarised ? 're-read' : 'read rest']);
  out.push({ segs: keyHints(pairs, W) });
  return out;
}

function helpScreen(W, t) {
  const rows = [
    [t.g.updown + ' j k', 'move'], ['ret', 'file detail, or fold a group'], ['space', 'fold group'], ['/', 'filter by path'],
    ['s', 'sort: size, name, recent'], ['o', 'open in $EDITOR'], ['y', 'copy path'],
    ['r', 'ask Claude to re-read'], ['esc', 'back'], ['q', 'quit'],
  ];
  const out = [{ segs: [['KEYS', 'm']] }, { segs: [[t.g.rule.repeat(W), 'x']] }];
  for (const [k, d] of rows) out.push({ segs: [[k.padEnd(8), 'f'], [d, 's']] });
  out.push({ segs: [[' ', null]] });
  const legend = [[t.g.full, 'a', 'in context'], [t.g.stale, 'y', 'changed on disk after read'], [t.g.image, 'c', 'image'], [t.g.summ, 'm', 'summarised by compaction'], [t.g.helper, 'o', 'helper agent'], [t.g.skill, 'c', 'skill loaded'], [t.g.hook, 'v', 'text a hook added']];
  for (const [gl, c, d] of legend) out.push({ segs: [[gl, c], ['  ' + d, 's']] });
  out.push({ segs: [[' ', null]] });
  out.push({ segs: [['press any key', 's']] });
  return out;
}

// One-line status for Claude Code's statusLine, or narrow terminals.
export function band(model, opts) {
  const t = opts.theme, g = t.g;
  const b = budget(model, opts);
  const live = model.files.filter((f) => f.inContext);
  const stale = live.filter((f) => f.stale || f.missing).length;
  const helpers = model.helpers.filter((h) => !h.summarised).length;
  const segs = [['ctx ', 's'], ...bar(12, b.used / b.window, b.compactAt / b.window, t, b.hot), [` ${fmt(b.used)}`, 'f'], [`/${fmt(b.window)}`, 's'],
    [` ${g.dot} `, 's'], [g.full, 'a'], [String(live.length - stale), 'f']];
  if (stale) segs.push([' ', null], [g.stale, 'y'], [String(stale), 'f']);
  if (helpers) segs.push([` ${g.dot} `, 's'], [g.helper, 'o'], [String(helpers), 'f']);
  return t.paint(segs);
}
