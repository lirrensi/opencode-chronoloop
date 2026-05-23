// ──────────────────────────────────────────────
//  ChronoLoop — OpenCode server plugin
//  Endless autonomous loop, time-based exit
// ──────────────────────────────────────────────

import { type Plugin } from "@opencode-ai/plugin"

import {
  type ChronoLoopState,
  DEFAULT_COMMAND_DESCRIPTION,
  NO_LOOP,
  MSG_ALREADY_RUNNING,
  MSG_STOPPED,
  MSG_COMPLETED,
  MSG_NO_LOOP_TO_STOP,
  parseChronoLoopCommand,
  formatRemaining,
  formatDuration,
  formatLoopSummary,
  evaluateBackticks,
} from "./core"

const HANDLED = "__CHRONOLOOP_HANDLED__"

/** How often to ping the user with remaining-time toast while loop is active. */
const HEARTBEAT_MS = 30_000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const ChronoLoopPlugin: Plugin = async ({ client, directory, worktree }) => {
  // ── state ──────────────────────────────────
  const loops = new Map<string, ChronoLoopState>()
  const inFlight = new Set<string>()
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  // ── helpers ────────────────────────────────

  const toast = (message: string, variant: "info" | "error" = "info", duration = 5000) =>
    client.tui.showToast({ body: { message, variant, duration } }).catch(() => undefined)

  const stop = async (message: string, variant: "info" | "error" = "info"): Promise<never> => {
    await toast(message, variant)
    throw new Error(HANDLED)
  }

  /** Check if any loops are still active. */
  const hasActiveLoops = () => {
    for (const loop of loops.values()) {
      if (loop.active) return true
    }
    return false
  }

  /** Heartbeat tick — shows remaining time for each active loop. */
  const heartbeatTick = () => {
    const now = Date.now()
    for (const [, loop] of loops) {
      if (!loop.active) continue
      const remaining = Math.max(0, loop.durationMs - (now - loop.startTime))
      if (remaining <= 0) continue
      toast(
        `ChronoLoop active — ${formatDuration(remaining)} remaining`,
        "info",
        4000,
      ).catch(() => undefined)
    }
  }

  /** Start or stop the heartbeat timer based on whether any loops are active. */
  const refreshHeartbeat = () => {
    if (hasActiveLoops()) {
      if (heartbeatTimer === null) {
        // Fire immediately, then every HEARTBEAT_MS
        heartbeatTick()
        heartbeatTimer = setInterval(heartbeatTick, HEARTBEAT_MS)
      }
    } else if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /** Compute remaining seconds for an active loop. Returns 0 if not active. */
  const remainingMs = (state: ChronoLoopState): number =>
    state.active ? Math.max(0, state.durationMs - (Date.now() - state.startTime)) : 0

  /** Fire a continuation prompt for the given session.
   *
   * Simulates a real user typing into the TUI prompt box and pressing Enter.
   * This preserves all routing context (agent, model, etc.) because it flows
   * through the exact same path as a human-typed message.
   *
   * Before sending, any backtick-enclosed commands (`` `cmd` ``) in the message
   * are evaluated and replaced with their shell output — like PHP backticks.
   */
  const fireContinuation = async (sessionID: string, state: ChronoLoopState) => {
    if (inFlight.has(sessionID)) return
    inFlight.add(sessionID)

    try {
      // 0. Evaluate backtick commands in the message
      const processedMessage = evaluateBackticks(state.message)

      // 1. Clear any existing text in the prompt box
      await client.tui.clearPrompt()
      // 2. Type the processed message into the prompt box
      await client.tui.appendPrompt({ body: { text: processedMessage } })
      // 3. Press Enter — routes exactly like a human-typed message
      await client.tui.submitPrompt()
    } catch (error) {
      console.error("ChronoLoop continuation failed", { sessionID, error })
      inFlight.delete(sessionID)
      await toast(
        `ChronoLoop continuation failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      )
    }
  }

  // ── plugin hooks ───────────────────────────

  return {
    config: async (cfg) => {
      cfg.command ??= {}
      cfg.command.cronoloop = {
        template: "<minutes> [message]",
        description: DEFAULT_COMMAND_DESCRIPTION,
      }
    },

    event: async ({ event }) => {
      const eventRecord = event as { type?: string; properties?: unknown; data?: unknown }
      const eventType = eventRecord.type
      const payload = isRecord(eventRecord.properties)
        ? eventRecord.properties
        : isRecord(eventRecord.data)
          ? eventRecord.data
          : undefined

      // ── Handle aborts ───────────────────────
      if (eventType === "message.updated") {
        const messageInfo = payload?.info
        if (!isRecord(messageInfo)) return

        const sessionID =
          typeof messageInfo.sessionID === "string" ? messageInfo.sessionID : undefined

        // User pressed escape / aborted — stop the loop
        if (messageInfo.role === "assistant" && sessionID) {
          const errorInfo = isRecord(messageInfo.error) ? messageInfo.error : undefined
          if (errorInfo?.name === "MessageAbortedError") {
            const loop = loops.get(sessionID)
            if (loop?.active) {
              loop.active = false
              loops.delete(sessionID)
              inFlight.delete(sessionID)
              refreshHeartbeat()
              await toast("ChronoLoop stopped after interrupt", "info")
            }
          }
        }
        return
      }

      // ── session.idle → fire continuation ─────
      // session.idle fires ONLY when the agent has fully completed its turn
      // (not between internal tool calls). This is the correct signal to
      // send the next loop message.
      if (eventType !== "session.idle") return

      const sessionID =
        typeof payload?.sessionID === "string" ? payload.sessionID : undefined
      if (!sessionID) return

      // Clear in-flight flag — the previous turn just completed
      const wasInFlight = inFlight.delete(sessionID)

      const loop = loops.get(sessionID)
      if (!loop?.active) {
        if (wasInFlight) {
          // Loop was stopped while a continuation was in-flight; nothing more to do
        }
        return
      }

      // Time check
      const remaining = remainingMs(loop)
      if (remaining <= 0) {
        loop.active = false
        loops.delete(sessionID)
        inFlight.delete(sessionID)
        refreshHeartbeat()
        const totalMinutes = Math.round(loop.durationMs / 60000)
        await toast(MSG_COMPLETED(totalMinutes), "info", 8000)
        return
      }

      // Fire the next continuation
      await fireContinuation(sessionID, loop)
    },

    "command.execute.before": async (input) => {
      if (input.command !== "cronoloop") return

      const sessionID = input.sessionID
      const op = parseChronoLoopCommand(input.arguments ?? "")

      // ── status ──────────────────────────────
      if (op.kind === "status") {
        const loop = loops.get(sessionID)
        if (!loop?.active) return stop(NO_LOOP)
        return stop(formatLoopSummary(loop))
      }

      // ── stop ────────────────────────────────
      if (op.kind === "stop") {
        const loop = loops.get(sessionID)
        if (!loop?.active) return stop(MSG_NO_LOOP_TO_STOP, "error")

        loop.active = false
        loops.delete(sessionID)
        inFlight.delete(sessionID)
        refreshHeartbeat()
        const elapsed = formatDuration(Date.now() - loop.startTime)
        return stop(`${MSG_STOPPED} Elapsed: ${elapsed}`)
      }

      // ── start ───────────────────────────────
      const existing = loops.get(sessionID)
      if (existing?.active) {
        const remaining = formatRemaining(Date.now() - existing.startTime, existing.durationMs)
        return stop(MSG_ALREADY_RUNNING(remaining), "error")
      }

      const now = Date.now()
      const state: ChronoLoopState = {
        startTime: now,
        durationMs: op.minutes * 60 * 1000,
        message: op.message,
        active: true,
      }

      loops.set(sessionID, state)
      refreshHeartbeat()

      // Toast confirmation — loop is armed, will fire on next session.idle
      const totalFormatted = formatDuration(state.durationMs)
      await toast(
        `ChronoLoop started — ${op.minutes}m (${totalFormatted})`,
        "info",
        5000,
      )

      // Do NOT fire the first continuation here. Wait for session.idle so the
      // current agent turn (if any) can finish first. If the session is already
      // idle, the handler below will pick it up.
      throw new Error(HANDLED)
    },


  }
}

export default ChronoLoopPlugin
