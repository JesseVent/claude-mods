/** This session's autopilot: armed or off, the goal, how many turns it has started, and whether it keeps going after each turn. */
export type Pilot = {
  on: boolean
  goal: string
  turns: number
  driving: boolean
}

declare module 'claude-code' {
  interface PluginState {
    autopilot: {
      pilot: Pilot
    }
  }
}
