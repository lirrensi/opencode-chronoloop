import { execSync } from "child_process"

export type ChronoLoopState = {
  startTime: number; durationMs: number; message: string; active: boolean
  dwellTimer: ReturnType<typeof setTimeout> | null
}

export const DEFAULT_MESSAGE = "We are running in an autonomous loop. Continue working. Make progress, improve things. Do not stop — there is always more to do."

/**
 * Parse a duration string into milliseconds.
 * Bare numbers = minutes (backward compat). Supports s/m/h suffixes.
 * Returns null if the input doesn't match or is <= 0.
 *
 * Examples: "30"→1_800_000  "30m"→1_800_000  "1h"→3_600_000  "90s"→90_000
 */
export function parseDurationMs(raw: string): number | null {
  const match = /^(\d+)([smh]?)$/i.exec(raw.trim())
  if (!match) return null
  const value = parseInt(match[1]!, 10)
  if (value <= 0) return null
  const unit = (match[2] || "m").toLowerCase()
  switch (unit) {
    case "s": return value * 1000
    case "m": return value * 60_000
    case "h": return value * 3_600_000
    default: return null
  }
}

export function parseChronoLoopCommand(input: string): { kind: "start"; minutes: number; message: string } | { kind: "stop" } | { kind: "status" } {
  const text = input.trim()
  if (!text) return { kind: "status" }
  if (text.toLowerCase() === "stop") return { kind: "stop" }
  const match = /^(\d+[smh]?)(?:\s+(.+))?$/si.exec(text)
  if (!match) return { kind: "status" }
  const durMs = parseDurationMs(match[1]!)
  if (durMs === null) return { kind: "status" }
  const raw = match[2]?.trim() ?? ""
  const msg = raw.length >= 2 && ((raw.startsWith('"')&&raw.endsWith('"'))||(raw.startsWith("'")&&raw.endsWith("'")))
    ? raw.slice(1,-1).trim() : raw
  return { kind: "start", minutes: Math.round(durMs / 60_000), message: msg || DEFAULT_MESSAGE }
}

export function formatDuration(ms: number): string {
  const s=Math.max(0,Math.round(ms/1000)),m=Math.floor(s/60),h=Math.floor(m/60)
  if(s<60)return`${s}s`;if(m<60)return`${m}m`;if(m%60===0)return`${h}h`;return`${h}h ${m%60}m`
}

export function formatRemaining(elapsed: number, total: number): string { return formatDuration(Math.max(0, total - elapsed)) }

export function formatLoopSummary(state: ChronoLoopState): string {
  const elapsed = Date.now() - state.startTime
  const remaining = Math.max(0, state.durationMs - elapsed)
  return [
    "ChronoLoop",
    "Status: running",
    `Elapsed: ${formatDuration(elapsed)}`,
    `Remaining: ${formatDuration(remaining)}`,
    `Message: ${state.message.length > 60 ? state.message.slice(0, 60) + "…" : state.message}`,
  ].join("\n")
}

export const BACKTICK_TIMEOUT_MS = 300_000
export const MAX_BACKTICK_OUTPUT_LENGTH = 2_000

export function evaluateBackticks(message: string): string {
  return message.replace(/`([^`]+)`/g, (_match, rawCommand: string) => {
    const cmd = rawCommand.trim()
    if (!cmd) return ""
    try {
      const stdout = execSync(cmd, { encoding: "utf-8", timeout: BACKTICK_TIMEOUT_MS, windowsHide: true, stdio: ["pipe","pipe","pipe"] }) as string
      const output = stdout.trim()
      if (!output) return "(no output)"
      if (output.length > MAX_BACKTICK_OUTPUT_LENGTH) {
        return output.slice(0, MAX_BACKTICK_OUTPUT_LENGTH) + `\n… [truncated, ${output.length} total chars]`
      }
      return output
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return `(error: ${msg.split("\n")[0]!.trim()})`
    }
  })
}
