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
      /** Claude's last reply on the main thread, clipped: once there is one, a typed prompt goes as typed. */
      last: string
    }
  }
}
