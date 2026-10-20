import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSession } from '../lib/parse.mjs';
import { frame, band, listItems } from '../lib/render.mjs';
import { makeTheme } from '../lib/theme.mjs';
import { makeSession, strip } from './helpers.mjs';

const S = makeSession();
const M = parseSession(S.tPath);
const byName = (n) => M.files.find((f) => path.basename(f.path) === n);
const opts = { window: 200000, compactAt: 160000, compactGuess: true, canSend: true };
const view = () => ({ mode: 'list', sel: 0, scroll: 0, sort: 'size', filter: '', collapsed: new Set() });

test('coverage merges adjacent partial reads', () => {
  const p = byName('pyodideService.ts');
  assert.equal(p.reads.length, 2);
  assert.ok(Math.abs(p.seen - 40 / 106) < 1e-9);
  assert.equal(byName('schema.generated.ts').seen, 1);
});

test('files read before a compaction are summarised, not in context', () => {
  const old = byName('next.config.ts');
  assert.equal(old.inContext, false);
  assert.equal(old.summarised, true);
  assert.ok(old.wasTokens > 0);
  assert.equal(M.compactions.length, 1);
});

test('stale means changed on disk after the last read or edit by Claude', () => {
  assert.equal(byName('release_guard_test.ts').stale, true);
  assert.equal(byName('guard.ts').stale, false);
  assert.equal(byName('main.py').stale, false);
});

test('images get a size-based estimate', () => {
  const img = byName('hero.png');
  assert.equal(img.image, true);
  assert.equal(img.tokens, Math.ceil((1000 * 600) / 750));
});

test('helpers: finished ones cost their summary, running ones are listed, subagent reads are counted', () => {
  assert.equal(M.helpers.length, 2);
  const [done, running] = M.helpers;
  assert.equal(done.done, true);
  assert.ok(done.tokens > 100);
  assert.equal(done.reads.length, 1);
  assert.equal(running.done, false);
});

test('skills: named by the Skill call or the typed /name; a compaction drops those it does not re-attach', () => {
  const live = M.skills.filter((s) => !s.summarised);
  assert.deepEqual(live.map((s) => s.name), ['kept', 'superpowers:tdd']);
  assert.equal(live[0].tokens, 100);
  assert.ok(live[1].tokens > 500);
  assert.equal(M.skills.find((s) => s.name === 'dropped').summarised, true);
  const out = strip(frame(M, view(), { ...opts, cols: 40, rows: 44, theme: makeTheme({}, { isTTY: true, color: false }) }).join('\n'));
  assert.match(out, /SKILLS 2/);
  assert.ok(out.includes('superpowers:tdd'));
  assert.ok(!out.includes('dropped'));
});

test('hook text: printed by SessionStart/UserPromptSubmit or added as context, grouped, reset by a compaction', () => {
  const live = M.hookTexts.filter((h) => !h.summarised);
  assert.deepEqual(live.map((h) => h.label), ['superpowers:using-superpowers', 'REMEMBER', '[13:49 ACDT -- me]']);
  assert.deepEqual(live.map((h) => h.count), [1, 1, 2]);
  assert.ok(!M.hookTexts.some((h) => h.event === 'PreToolUse'));
  const out = strip(frame(M, view(), { ...opts, cols: 40, rows: 50, theme: makeTheme({}, { isTTY: true, color: false }) }).join('\n'));
  assert.match(out, /HOOK TEXT 3/);
  assert.match(out, /» superpowers:using-superpowers/);
  assert.match(out, /\[13:49 ACDT -- me\] +×2/);
});

test('context total ignores sidechain usage and parts add up', () => {
  assert.equal(M.used, 42000);
  const sum = Object.values(M.parts).reduce((a, b) => a + b, 0);
  assert.equal(sum, M.used);
});

test('groups by project under the common root', () => {
  const { items } = listItems(M, view(), null);
  const groups = items.filter((i) => i.kind === 'group').map((i) => i.group.name);
  assert.deepEqual(groups.sort(), ['arcsql', 'client', 'drive-eqms']);
});

for (const [cols, rows] of [[40, 44], [32, 20], [60, 30], [40, 12]]) {
  for (const ascii of [false, true]) {
    test(`every line is exactly ${cols} cells (${rows} rows, ascii=${ascii})`, () => {
      const theme = makeTheme({ COLORTERM: 'truecolor' }, { isTTY: true, ascii });
      for (const mode of ['list', 'filter', 'help', 'detail']) {
        const v = view();
        v.mode = mode;
        if (mode === 'filter') v.filter = 'guard';
        if (mode === 'detail') v.detailFile = byName('pyodideService.ts');
        const out = frame(M, v, { ...opts, cols, rows, theme });
        assert.equal(out.length, rows, mode);
        out.forEach((l, i) => assert.equal(strip(l).length, cols, `${mode} row ${i + 1}: "${strip(l)}"`));
      }
    });
  }
}

test('ascii mode uses only ASCII', () => {
  const theme = makeTheme({}, { isTTY: true, color: false, ascii: true });
  const out = strip(frame(M, view(), { ...opts, cols: 40, rows: 44, theme }).join('\n'));
  assert.ok(/^[\x20-\x7e\n]*$/.test(out), out.match(/[^\x20-\x7e\n]/g)?.join(''));
});

test('band is one line', () => {
  const theme = makeTheme({}, { isTTY: true, color: false });
  const b = band(M, { ...opts, theme });
  assert.ok(!b.includes('\n'));
  assert.match(b, /42k\/200k/);
});

test('CLI --once renders a frame for a transcript', () => {
  const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'context-compass.mjs');
  const out = execFileSync('node', [bin, '--once', '--transcript', S.tPath, '--cols', '40', '--rows', '44', '--no-color'], { encoding: 'utf8' });
  const lines = out.trimEnd().split('\n');
  assert.equal(lines.length, 44);
  assert.match(lines[0], /CONTEXT\s+42k \/ 200k {2}21%/);
  assert.ok(out.includes('release_guard_test.ts'));
});

test('file names are OSC 8 links to the file, default file:// for the system app', () => {
  const theme = makeTheme({}, { isTTY: true, color: false, links: true });
  const out = frame(M, view(), { ...opts, cols: 40, rows: 44, theme }).join('\n');
  const urls = [...out.matchAll(/\x1b\]8;;([^\x1b]+)\x1b\\([^\x1b]*)\x1b\]8;;\x1b\\/g)].map((m) => [m[1], m[2]]);
  const big = urls.find(([, text]) => text === 'schema.generated.ts');
  assert.ok(big, 'schema.generated.ts is linked');
  assert.match(big[0], /^file:\/\/[^/]*\/.*\/arcsql\/schema\/schema\.generated\.ts$/);
  assert.ok(!urls.some(([, text]) => /\s$/.test(text)), 'trailing padding is not inside links');
});

test('link template and path encoding', async () => {
  const { linkFor } = await import('../lib/render.mjs');
  const f = { path: '/Users/j/My Dev/a#b.ts', reads: [{ start: 21 }, { start: 1 }] };
  assert.match(linkFor(f), /\/Users\/j\/My%20Dev\/a%23b\.ts$/);
  assert.equal(linkFor(f, 'vscode://file/{path}:{line}'), 'vscode://file//Users/j/My%20Dev/a%23b.ts:1');
});

test('links can be turned off', () => {
  const theme = makeTheme({ CTX_LINKS: '0' }, { isTTY: true, color: false });
  assert.ok(!frame(M, view(), { ...opts, cols: 40, rows: 44, theme }).join('').includes('\x1b]8;;'));
});
