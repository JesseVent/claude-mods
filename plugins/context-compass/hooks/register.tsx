import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ContextFile, HookText, LoadedSkill } from '../types'

const PANE = 'context-compass'
const files = atom({ plugin: 'context-compass', key: 'files' } as const, [] as ContextFile[])
const shell = atom({ plugin: 'context-compass', key: 'shell' } as const, [] as string[])
const skills = atom({ plugin: 'context-compass', key: 'skills' } as const, [] as LoadedSkill[])
const hookText = atom({ plugin: 'context-compass', key: 'hookText' } as const, [] as HookText[])

let home = ''

type Seen = Omit<ContextFile, 'isCompacted'>

const tokensOf = (text: string) => Math.ceil(text.length / 4)
const group = (via: ContextFile['via']) => (via === 'mention' ? 'read' : via === 'write' ? 'edit' : via)

export function mergeRanges(ranges: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = []
  for (const [from, to] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1]
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to)
    else out.push([from, to])
  }
  return out
}

function merge(old: ContextFile, seen: Seen): ContextFile {
  // A re-read after compaction starts over: what entered before it is summary only.
  if (old.isCompacted) return { ...seen, isCompacted: false }
  return {
    ...old,
    ...seen,
    detail: seen.detail ?? old.detail,
    ranges: old.ranges && seen.ranges ? mergeRanges([...old.ranges, ...seen.ranges]) : undefined,
    total: seen.total ?? old.total,
    isSnippet: old.isSnippet && seen.isSnippet ? true : undefined,
    tokens: old.tokens + seen.tokens,
  }
}

async function record($: EngineInterface, seen: Seen) {
  await update($, files, list => {
    const i = list.findIndex(
      f => f.path === seen.path && f.agentId === seen.agentId && group(f.via) === group(seen.via),
    )
    if (i < 0) return [...list, { ...seen, isCompacted: false }]
    return list.map((f, j) => (j === i ? merge(f, seen) : f))
  })
}

// As lib/parse.mjs hookLabel: the skill a hook's text names, else its first line, past the engine's "<Event> hook success: " prefix.
export function hookLabel(text: string): string {
  const named = /'([\w:.-]+)' skill/.exec(text)
  if (named?.[1]) return named[1]
  const body = text.replace(/^(?:<[^>]*>\s*)?[^\n]{0,80}?\bhook [a-z ]+: /, '')
  for (const line of body.split('\n')) {
    const l = line.replace(/<[^>]*>/g, '').replace(/^[#=*\s]+|[=*\s]+$/g, '')
    if (l) return l
  }
  return ''
}

// ponytail: digits blanked so a per-prompt hook (a timestamp) is one row; two hooks whose first lines differ only in numbers merge
const hookKey = (h: Pick<HookText, 'event' | 'label'>) => `${h.event} ${h.label.replace(/\d+/g, '#')}`

export function depth(f: ContextFile): string {
  if (f.isSnippet) return 'partial'
  if (!f.ranges || !f.total) return 'full'
  const seen = f.ranges.reduce((n, [from, to]) => n + to - from + 1, 0)
  return seen >= f.total ? 'full' : `partial ${Math.floor((seen / f.total) * 100)}%`
}

const kTokens = (n: number) => (n === 0 ? '' : n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`)
const fit = (text: string, width: number) =>
  text.length <= width ? text : `…${text.slice(text.length - Math.max(1, width - 1))}`

// A sidebar only: docked beside a fullscreen transcript, never inline above the prompt.
const openPane = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Context compass', columns: 64 })
let triedOpen = false

// Where the pane cannot dock, the sidebar is a tmux or iTerm2 split running bin/context-compass.mjs.
// A mod is not told its own folder; this plugin's SessionStart command hook records it in plugin-root.
const OPEN_SPLIT = `f="$HOME/.claude/context-compass/plugin-root"
[ -s "$f" ] || { echo "Context compass: its SessionStart hook has not run yet; restart Claude Code."; exit 1; }
sh "$(cat "$f")/bin/ctx-open.sh"`
const openSplit = async ($: EngineInterface) => {
  const r = await $.process.run(['sh', '-c', OPEN_SPLIT])
  return (r.stdout + r.stderr).trim() || `context-compass exited ${r.exitCode}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    home = (await $.env.get('HOME')) ?? ''
    await $.command.register({
      name: 'context-compass',
      description: "Show which files and skills are in Claude's context, and how much of each",
    })

    return next(e)
  })

  // Only a render hook's viewport says whether the surface docks panes, so the unasked open waits for one.
  // As the built-in sidebars do: a pane the person closed stays closed in later sessions until /context-compass.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!triedOpen && e.viewport?.isFullscreen === true) {
      triedOpen = true
      if ((await $.store.get('open')) !== false) void openPane($)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') await $.store.set('open', false)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'context-compass' }, async ($, e) => {
    const { isFullscreen, columns } = e.presentation
    // The main screen, and a fullscreen one under 110 columns, would seat the pane inline.
    if (!isFullscreen || columns < 110) return { text: await openSplit($) }
    await $.store.set('open', true)
    const opened = await openPane($)
    if (!opened.isPlaced) return { text: `Context compass pane is open but not drawn yet: ${opened.reason}` }

    return { text: 'Context compass pane docked beside the transcript.' }
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, files, () => [])
      await update($, shell, () => [])
      await update($, skills, () => [])
      await update($, hookText, () => [])
    }

    return next(e)
  })

  // A settings hook's text (SessionStart output, additionalContext, ...) as Claude reads it; a subagent's stays out of main context.
  on('session.append', async ($, e, next) => {
    const r = await next(e)
    if (e.origin.kind === 'hook' && e.message.role && !e.agentId) {
      const text = e.message.content.map(b => (b.type === 'text' ? b.text : '')).join('\n')
      const seen = { event: e.origin.event, label: hookLabel(text) }
      if (text.trim()) {
        await update($, hookText, list => {
          const old = list.find(h => hookKey(h) === hookKey(seen))
          const count = (old?.count ?? 0) + 1
          return [...list.filter(h => h !== old), { ...seen, count, tokens: (old?.tokens ?? 0) + tokensOf(text) }]
        })
      }
    }

    return r
  }).catch(($, e, next) => next(e))

  // Typed as /name, run by the Skill tool, or preloaded into a subagent. A compaction re-attaches loaded skills, so they stay live.
  on('skill.prompt', async ($, e, next) => {
    const r = await next(e)
    await update($, skills, list => {
      const old = list.find(s => s.name === e.skill)
      const tokens = (old?.tokens ?? 0) + tokensOf(r.text)
      return [...list.filter(s => s !== old), { name: e.skill, source: e.pluginName ?? e.source, tokens }]
    })

    return r
  }).catch(($, e, next) => next(e))

  on('prompt.context', async ($, e, next) => {
    const r = await next(e)
    const loaded = r.instructionFiles ?? e.instructionFiles
    if (loaded) {
      await update($, files, list => [
        ...list.filter(f => f.via !== 'instructions' || f.detail === 'nested'),
        ...loaded.map(f => ({
          path: f.path,
          via: 'instructions' as const,
          detail: f.kind,
          tokens: tokensOf(f.content),
          isCompacted: false,
        })),
      ])
    }

    return r
  }).catch(($, e, next) => next(e))

  on('prompt.mention', async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.type === 'file') {
      await record($, {
        path: e.path,
        via: 'mention',
        ranges: e.offset === undefined ? undefined : [[e.offset, e.offset + (e.limit ?? 1) - 1]],
        tokens: 0,
        agentId: e.agentId,
      })
    }

    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny !== undefined || r.isError) return r
    const res = r.result
    const base = { path: e.file_path, via: 'read' as const, agentId: e.agentId }
    if (res.type === 'text') {
      const { startLine, numLines, totalLines, content, truncatedByTokenCap } = res.file
      await record($, {
        ...base,
        ranges: numLines > 0 ? [[startLine, startLine + numLines - 1]] : undefined,
        total: totalLines,
        isSnippet: truncatedByTokenCap ? true : undefined,
        tokens: tokensOf(content),
      })
    } else if (res.type !== 'file_unchanged') {
      await record($, { ...base, detail: res.type, isSnippet: e.pages ? true : undefined, tokens: 0 })
    }

    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && !r.isError) {
      await record($, {
        path: e.file_path,
        via: 'edit',
        isSnippet: true,
        tokens: tokensOf(e.old_string + e.new_string),
        agentId: e.agentId,
      })
    }

    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && !r.isError) {
      await record($, {
        path: e.notebook_path,
        via: 'edit',
        isSnippet: true,
        tokens: tokensOf(e.new_source),
        agentId: e.agentId,
      })
    }

    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && !r.isError) {
      await record($, { path: e.file_path, via: 'write', tokens: tokensOf(e.content), agentId: e.agentId })
    }

    return r
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && !e.agentId) await update($, shell, list => [...list, e.command].slice(-20))

    return r
  }).catch(($, e, next) => next(e))

  on('session.append', { door: 'attachment' }, async ($, e, next) => {
    const r = await next(e)
    if (e.message.name === 'nested_memory') {
      const text = e.message.content.map(b => (b.type === 'text' ? b.text : '')).join('\n')
      // ponytail: path parsed from the rendered row (the payload is not on e); breaks if its wording changes
      for (const [, path] of text.matchAll(/Contents of (.+?)(?: \([^)]*\))?:\n/g)) {
        if (path) await record($, { path, via: 'instructions', detail: 'nested', tokens: tokensOf(text), agentId: e.agentId })
      }
    }

    return r
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    // CLAUDE.md files are sent again after a compaction; everything else is summary only.
    // ponytail: the engine also re-attaches a few recent files; they read pre-compact until re-read
    if (e.trigger !== 'precompute' && r.messages) {
      await update($, files, list =>
        list.map(f =>
          f.agentId === e.agentId && !(f.via === 'instructions' && f.detail !== 'nested')
            ? { ...f, isCompacted: true }
            : f,
        ),
      )
      // What hooks added before is summary now; SessionStart hooks run again and add theirs afresh.
      if (!e.agentId) await update($, hookText, () => [])
    }

    return r
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, files)
    const cmds = await read($, shell)
    const loadedSkills = await read($, skills)
    const hooks = [...(await read($, hookText))].sort((a, b) => b.tokens - a.tokens)
    const columns = e.props.bodyColumns

    const live = list.filter(f => !f.agentId && !f.isCompacted)
    const partial = live.filter(f => depth(f) !== 'full').length
    const liveTokens = live.reduce((n, f) => n + f.tokens, 0)
    const stale = list.filter(f => !f.agentId && f.isCompacted).length
    const helper = list.filter(f => f.agentId).length

    const row = (f: ContextFile) => {
      const where = f.agentId ? 'helper' : 'main'
      const how = depth(f)
      const when = f.isCompacted ? 'pre-compact' : 'live'
      const lines =
        how.startsWith('partial') && f.ranges
          ? ` L${f.ranges.map(([from, to]) => `${from}-${to}`).join(',')}${f.total ? ` of ${f.total}` : ''}`
          : f.detail && f.via !== 'instructions'
            ? ` ${f.detail}`
            : ''
      const tok = kTokens(f.tokens)
      const shown = home && f.path.startsWith(home) ? `~${f.path.slice(home.length)}` : f.path
      const width = Math.max(8, columns - 33 - fit(lines, 24).length - tok.length)
      const isFaded = Boolean(f.agentId) || f.isCompacted

      // A sidebar is too narrow for one line: the path on its own line, the labels under it.
      if (columns < 90) {
        return (
          <Box key={`${f.via}:${f.agentId ?? ''}:${f.path}`} flexDirection="column">
            <Text dimColor={isFaded}>{fit(shown, columns)}</Text>
            <Box flexDirection="row">
              <Text dimColor={Boolean(f.agentId)}>{`  ${where}`}</Text>
              <Text dimColor> · </Text>
              <Text color={how === 'full' ? 'success' : 'warning'}>{how}</Text>
              <Text dimColor> · </Text>
              <Text dimColor={f.isCompacted}>{when}</Text>
              <Text dimColor>{fit(`${lines}${tok ? ` · ${tok}` : ''}`, Math.max(8, columns - 40))}</Text>
            </Box>
          </Box>
        )
      }

      return (
        <Box key={`${f.via}:${f.agentId ?? ''}:${f.path}`} flexDirection="row">
          <Text dimColor={Boolean(f.agentId)}>{where.padEnd(7)}</Text>
          <Text color={how === 'full' ? 'success' : 'warning'}>{how.padEnd(13)}</Text>
          <Text dimColor={f.isCompacted}>{when.padEnd(12)}</Text>
          <Text dimColor={isFaded}>{fit(shown, width)}</Text>
          <Text dimColor>{fit(lines, 24)}</Text>
          <Text dimColor> {tok}</Text>
        </Box>
      )
    }

    const sections: [string, ContextFile[]][] = [
      ['Read', list.filter(f => group(f.via) === 'read')],
      ['Edited / written', list.filter(f => group(f.via) === 'edit')],
      ['Instructions', list.filter(f => f.via === 'instructions')],
    ]
    const body = sections.flatMap(([title, entries]) =>
      entries.length === 0
        ? []
        : [
            <Text key={title} bold>
              {title} ({entries.length})
            </Text>,
            ...entries.map(row),
          ],
    )
    if (loadedSkills.length > 0) {
      body.push(
        <Text key="skills" bold>
          Skills ({loadedSkills.length})
        </Text>,
        ...loadedSkills.map(s => {
          const tail = ` ${s.source} · ${kTokens(s.tokens)}`
          return (
            <Box key={`skill:${s.name}`} flexDirection="row">
              <Text>{fit(s.name, Math.max(8, columns - tail.length))}</Text>
              <Text dimColor>{tail}</Text>
            </Box>
          )
        }),
      )
    }
    if (hooks.length > 0) {
      body.push(
        <Text key="hooks" bold>
          Hook text ({hooks.length})
        </Text>,
        ...hooks.map(hook => {
          const tail = ` ${hook.event}${hook.count > 1 ? ` ×${hook.count}` : ''} · ${kTokens(hook.tokens)}`
          return (
            <Box key={`hook:${hookKey(hook)}`} flexDirection="row">
              <Text>{fit(hook.label, Math.max(8, columns - tail.length))}</Text>
              <Text dimColor>{tail}</Text>
            </Box>
          )
        }),
      )
    }
    if (cmds.length > 0) {
      body.push(
        <Text key="shell" bold>
          Shell: output in context, files not tracked ({cmds.length})
        </Text>,
        ...cmds.slice(-5).map((c, i) => (
          <Text key={`sh${i}`} dimColor>
            {fit(`$ ${c.replace(/\s+/g, ' ')}`, columns)}
          </Text>
        )),
      )
    }

    return (
      <Box flexDirection="column">
        <Text>
          main live {live.length} ({live.length - partial} full · {partial} partial) · pre-compact {stale} · helper{' '}
          {helper} · ~{kTokens(liveTokens) || 0} tok
        </Text>
        <Text dimColor>main/helper · full/partial · live/pre-compact (pre-compact = summary only)</Text>
        {list.length === 0 && cmds.length === 0 && loadedSkills.length === 0 && hooks.length === 0 && (
          <Text dimColor>No files in context yet.</Text>
        )}
        {body}
      </Box>
    )
  })
}
