// ──────────────────────────────────────────────
//  ChronoLoop — endless autonomous worker loop
//  No completion criteria, no tool, pure time
// ──────────────────────────────────────────────

export const DEFAULT_MESSAGE =
  "We are running in an autonomous loop. Continue working. Make progress, improve things. Do not stop — there is always more to do."

export const DEFAULT_COMMAND_DESCRIPTION =
  "start or manage an endless autonomous loop that continues until the minimum time elapses"

export type ChronoLoopState = {
  /** Unix ms when the loop started */
  startTime: number
  /** How long the loop must run, in ms */
  durationMs: number
  /** The message sent to the agent each continuation */
  message: string
  /** Whether the loop is actively triggering continuations */
  active: boolean
}

export type ChronoLoopCommand =
  | { kind: "start"; minutes: number; message: string }
  | { kind: "stop" }
  | { kind: "status" }

export const NO_LOOP =
  "No active cronoloop.\nUsage: /cronoloop <minutes> [message]"

export const MSG_ALREADY_RUNNING = (remaining: string) =>
  `ChronoLoop is already running. ${remaining} remaining. Use /cronoloop stop first if you want to restart.`

export const MSG_STOPPED =
  "ChronoLoop stopped."

export const MSG_COMPLETED = (minutes: number) =>
  `ChronoLoop completed — ran for ${minutes} minute${minutes === 1 ? "" : "s"}.`

export const MSG_NO_LOOP_TO_STOP =
  "No active cronoloop to stop."

/**
 * Parse a `/cronoloop` argument string.
 *
 * `/cronoloop`                → status
 * `/cronoloop stop`           → stop
 * `/cronoloop 120`            → start 120min with default message
 * `/cronoloop 120 "message"`  → start 120min with custom message
 * `/cronoloop 120 message`    → start 120min with custom message
 */
export function parseChronoLoopCommand(input: string): ChronoLoopCommand {
  const text = input.trim()

  // No args → status
  if (!text) return { kind: "status" }

  // stop
  if (text.toLowerCase() === "stop") return { kind: "stop" }

  // Try to match: number followed by optional message
  const match = /^(\d+)(?:\s+(.+))?$/s.exec(text)
  if (!match) {
    // If it starts with a known keyword that isn't valid, treat as status
    return { kind: "status" }
  }

  const minutes = parseInt(match[1]!, 10)
  if (minutes <= 0) return { kind: "status" }

  const rawMessage = match[2]?.trim() ?? ""

  // Strip surrounding quotes if present
  const message =
    rawMessage.length >= 2 &&
    ((rawMessage.startsWith('"') && rawMessage.endsWith('"')) ||
      (rawMessage.startsWith("'") && rawMessage.endsWith("'")))
      ? rawMessage.slice(1, -1).trim()
      : rawMessage

  return {
    kind: "start",
    minutes,
    message: message || DEFAULT_MESSAGE,
  }
}

/** Format ms into a human-readable duration. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const hours = Math.floor(minutes / 60)

  if (total < 60) return `${total}s`
  if (minutes < 60) return `${minutes}m`
  if (minutes % 60 === 0) return `${hours}h`
  return `${hours}h ${minutes % 60}m`
}

/** Format remaining time from now vs end time. */
export function formatRemaining(elapsedMs: number, totalMs: number): string {
  const remaining = Math.max(0, totalMs - elapsedMs)
  return formatDuration(remaining)
}

export function formatLoopSummary(state: ChronoLoopState): string {
  const elapsed = Date.now() - state.startTime
  const remaining = Math.max(0, state.durationMs - elapsed)
  return [
    "ChronoLoop",
    `Status: running`,
    `Elapsed: ${formatDuration(elapsed)}`,
    `Remaining: ${formatDuration(remaining)}`,
    `Message: ${state.message.length > 60 ? state.message.slice(0, 60) + "…" : state.message}`,
  ].join("\n")
}
