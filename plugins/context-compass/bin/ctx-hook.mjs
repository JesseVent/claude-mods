#!/usr/bin/env node
// SessionStart / UserPromptSubmit hook: records which transcript belongs to which
// directory so the sidebar follows the right session. Never blocks Claude Code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

try {
  const j = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  if (j.transcript_path && j.cwd) {
    const dir = path.join(os.homedir(), '.claude', 'context-compass');
    fs.mkdirSync(path.join(dir, 'by-cwd'), { recursive: true });
    const rec = JSON.stringify({ session_id: j.session_id, transcript_path: j.transcript_path, cwd: j.cwd, at: new Date().toISOString() });
    const h = crypto.createHash('sha1').update(path.resolve(j.cwd)).digest('hex').slice(0, 16);
    fs.writeFileSync(path.join(dir, 'by-cwd', h + '.json'), rec);
    fs.writeFileSync(path.join(dir, 'latest.json'), rec);
    if (process.env.CLAUDE_PLUGIN_ROOT) fs.writeFileSync(path.join(dir, 'plugin-root'), process.env.CLAUDE_PLUGIN_ROOT);
  }
} catch { /* never fail the hook */ }
process.exit(0);
