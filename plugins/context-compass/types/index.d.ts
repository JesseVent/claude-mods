export type ContextFile = {
  path: string
  via: 'instructions' | 'mention' | 'read' | 'edit' | 'write'
  /** CLAUDE.md tier (user, project, memory, nested), or a Read's kind (image, pdf) */
  detail?: string
  /** Lines seen, merged; absent means the whole file */
  ranges?: [number, number][]
  /** The file's total lines, from a Read */
  total?: number
  /** Only part of the file entered (an Edit's snippet, a capped Read, PDF pages) */
  isSnippet?: boolean
  /** ≈ chars/4 of what entered */
  tokens: number
  /** Set when a helper (subagent) loop read it: not in the main context */
  agentId?: string
  /** A compaction ran after it entered: only the summary remains */
  isCompacted: boolean
}

export type LoadedSkill = {
  name: string
  /** The plugin it came with, else where it was found (userSettings, built-in, ...) */
  source: string
  /** ≈ chars/4 of its prompt, summed over every load */
  tokens: number
}

/** Text a settings hook put in front of Claude (SessionStart output, additionalContext, ...), grouped by event and first line */
export type HookText = {
  event: string
  /** The skill the text names, else its first line */
  label: string
  /** How many times it was added (a per-prompt hook adds once per prompt) */
  count: number
  tokens: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-compass': { files: ContextFile[]; shell: string[]; skills: LoadedSkill[]; hookText: HookText[] }
  }
}
