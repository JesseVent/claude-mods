/** This session's autopilot: whether it drives, toward what, and how many turns it has started. */
export type Pilot = {
  on: boolean
  goal: string
  turns: number
}

declare module 'claude-code' {
  interface PluginState {
    autopilot: {
      pilot: Pilot
    }
  }
}
