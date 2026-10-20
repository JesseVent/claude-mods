/** What the index in `$.store` keeps per Keychain account: never the value. */
export type StoredEntry = {
  name: string
  /** `global`, or the root of the project it was pasted in */
  scope: string
  /** Local date it was saved, YYYY-MM-DD */
  saved: string
}

declare module 'claude-code' {
  interface PluginState {
    'secret-keeper': {
      vault: Record<string, string>
      exported: string[]
      project: { id: string; root: string }
    }
  }
}
