// Builds a realistic Claude Code transcript (same shapes as real JSONL) in a temp dir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function makeSession() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
  const proj = path.join(dir, 'Dev');
  const write = (rel, text) => { const p = path.join(proj, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return p; };
  const lines = (n) => Array.from({ length: n }, (_, i) => `line ${i + 1} ` + 'x'.repeat(30)).join('\n');

  const f = {
    big: write('arcsql/schema/schema.generated.ts', lines(400)),
    pyo: write('arcsql/services/pyodideService.ts', lines(106)),
    main: write('client/forViking/main.py', lines(80)),
    guard: write('drive-eqms/tests/release_guard_test.ts', lines(208)),
    edited: write('drive-eqms/src/guard.ts', lines(50)),
    old: write('client/VXV/next.config.ts', lines(20)),
    img: path.join(proj, 'client/VXV/hero.png'),
  };
  const sid = 'sess-1';
  const tPath = path.join(dir, sid + '.jsonl');
  let t = Date.parse('2026-10-19T01:00:00Z');
  let n = 0;
  const ts = () => new Date((t += 60000)).toISOString();
  const E = [];
  const base = { sessionId: sid, cwd: proj, isSidechain: false };
  const usage = (total) => ({ input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: total - 102 - 50, output_tokens: 50 });

  E.push({ ...base, type: 'user', timestamp: ts(), message: { role: 'user', content: 'what do you mean by declarative for the roles?' } });
  const read = (p, { offset, limit, text, total, image } = {}) => {
    const id = 'tu' + ++n;
    E.push({ ...base, type: 'assistant', timestamp: ts(), message: { model: 'claude-x', content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: p, offset, limit } }], usage: usage(12000 + n * 900) } });
    if (image) {
      E.push({ ...base, type: 'user', timestamp: ts(), message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'image', source: {} }] }] }, toolUseResult: { type: 'image', file: { base64: '', type: 'image/png', dimensions: { displayWidth: 1000, displayHeight: 600 } } } });
      return;
    }
    const all = fs.readFileSync(p, 'utf8').split('\n');
    const start = offset || 1;
    const chunk = all.slice(start - 1, limit ? start - 1 + limit : undefined);
    E.push({ ...base, type: 'user', timestamp: ts(), message: { content: [{ type: 'tool_result', tool_use_id: id, content: chunk.map((l, i) => `${start + i}\t${l}`).join('\n') }] }, toolUseResult: { type: 'text', file: { filePath: p, content: chunk.join('\n'), numLines: chunk.length, startLine: start, totalLines: total || all.length } } });
  };
  const tool = (name, input, result, extra) => {
    const id = 'tu' + ++n;
    E.push({ ...base, type: 'assistant', timestamp: ts(), message: { content: [{ type: 'tool_use', id, name, input }], usage: usage(12000 + n * 900) } });
    E.push({ ...base, type: 'user', timestamp: ts(), message: { content: [{ type: 'tool_result', tool_use_id: id, content: result }] }, toolUseResult: extra });
  };

  const skillText = (dir, size) => ({ role: 'user', content: [{ type: 'text', text: `Base directory for this skill: ${dir}\n\n` + 's'.repeat(size) }] });
  const skillCall = (name, dir, size) => {
    tool('Skill', { skill: name }, `Launching skill: ${name}`, { success: true, commandName: name });
    E.push({ ...base, type: 'user', isMeta: true, sourceToolUseID: 'tu' + n, timestamp: ts(), message: skillText(dir, size) });
  };

  read(f.old);
  E.push({ ...base, type: 'user', timestamp: ts(), message: { role: 'user', content: '<command-message>kept</command-message>\n<command-name>/kept</command-name>\n<command-args></command-args>' } });
  E.push({ ...base, type: 'user', isMeta: true, timestamp: ts(), message: skillText('/home/me/.claude/skills/kept', 800) });
  skillCall('dropped', '/home/me/.claude/skills/dropped', 400);
  const hook = (hookEvent, content, type = 'hook_success') => E.push({ ...base, type: 'attachment', timestamp: ts(), attachment: { type, hookName: hookEvent, hookEvent, content } });
  hook('SessionStart', '=== REMEMBER ===\n' + 'r'.repeat(400));
  hook('UserPromptSubmit', '[12:00 ACDT -- me]');
  E.push({ ...base, type: 'system', subtype: 'compact_boundary', timestamp: ts(), compactMetadata: { trigger: 'auto', preTokens: 150000 } });
  E.push({ ...base, type: 'user', isCompactSummary: true, timestamp: ts(), message: { content: 'Summary of the conversation so far...' } });
  E.push({ ...base, type: 'attachment', timestamp: ts(), attachment: { type: 'invoked_skills', skills: [{ name: 'kept', path: '/home/me/.claude/skills/kept/SKILL.md', content: 'k'.repeat(400) }] } });
  hook('SessionStart', '=== REMEMBER ===\n' + 'r'.repeat(400));
  hook('SessionStart', ["<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n**Below is the full content of your 'superpowers:using-superpowers' skill**\n" + 'u'.repeat(2000)], 'hook_additional_context');
  hook('UserPromptSubmit', '[13:41 ACDT -- me]');
  hook('UserPromptSubmit', '[13:49 ACDT -- me]');
  hook('PreToolUse', 'a PreToolUse hook prints to the person, not to Claude');
  skillCall('superpowers:tdd', '/home/me/.claude/plugins/superpowers/skills/tdd', 2000);
  read(f.big);
  read(f.pyo, { offset: 1, limit: 20 });
  read(f.pyo, { offset: 21, limit: 20 });
  read(f.main);
  read(f.guard, { offset: 1, limit: 30 });
  read(f.edited);
  read(f.img, { image: true });
  tool('Edit', { file_path: f.edited, old_string: 'a', new_string: 'b' }, 'ok');
  tool('Agent', { description: 'map role definitions', subagent_type: 'Explore', prompt: 'find roles' }, [{ type: 'text', text: 'Roles are defined in schema/roles.sql and synced by sync_roles(). '.repeat(20) }], { status: 'completed', agentId: 'abc' });
  E.push({ ...base, type: 'assistant', timestamp: ts(), message: { content: [{ type: 'tool_use', id: 'tu-run', name: 'Agent', input: { description: 'plan migration', subagent_type: 'Plan' } }], usage: usage(42000) } });
  E.push({ ...base, type: 'assistant', isSidechain: true, timestamp: ts(), message: { content: [], usage: usage(999999) } });

  fs.writeFileSync(tPath, E.map((e) => JSON.stringify(e)).join('\n') + '\n');
  const sub = path.join(dir, sid, 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'agent-abc.jsonl'), [
    { type: 'assistant', timestamp: ts(), message: { content: [{ type: 'tool_use', id: 's1', name: 'Read', input: { file_path: f.main } }] } },
    { type: 'user', timestamp: ts(), message: { content: [{ type: 'tool_result', tool_use_id: 's1', content: 'x' }] } },
  ].map((e) => JSON.stringify(e)).join('\n'));

  // Times: reads happened at fake 2026 timestamps. Make the guard test file look edited after its read
  // and every other file look older than its read.
  const past = new Date('2026-10-19T00:00:00Z');
  for (const p of Object.values(f)) if (fs.existsSync(p)) fs.utimesSync(p, past, past);
  const future = new Date('2026-10-19T05:00:00Z');
  fs.utimesSync(f.guard, future, future);
  return { dir, proj, tPath, f };
}

export const strip = (s) => s.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, '').replace(/\x1b\[[0-9;]*m/g, '');
