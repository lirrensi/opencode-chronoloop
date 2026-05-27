import type { Plugin } from "@opencode-ai/plugin"
import { execSync } from "node:child_process"

// ═══════════════════════════════════════════
//  ChronoLoop — copy this file to
//  ~/.config/opencode/plugins/ to install.
//  No build step. No deploy script.
// ═══════════════════════════════════════════

// ── internal types ──

type LoopState = {
  startTime: number; durationMs: number; message: string; active: boolean
  dwellTimer: ReturnType<typeof setTimeout> | null
}

// ── internal helpers ──

const DEFAULT_COMMAND_DESCRIPTION = "start or manage an endless autonomous loop"
const NO_LOOP = "No active cronoloop.\nUsage: /cronoloop <minutes> [message]"
const MSG_STOPPED = "ChronoLoop stopped."
const MSG_COMPLETED = (m: number) => `ChronoLoop completed — ran for ${m} minute${m === 1 ? "" : "s"}.`
const MSG_NO_LOOP_TO_STOP = "No active cronoloop to stop."

function parseCommand(input: string): { kind: "start"; minutes: number; message: string } | { kind: "stop" } | { kind: "status" } {
  const text = input.trim()
  if (!text) return { kind: "status" }
  if (text.toLowerCase() === "stop") return { kind: "stop" }
  const match = /^(\d+)(?:\s+(.+))?$/s.exec(text)
  if (!match || parseInt(match[1]!) <= 0) return { kind: "status" }
  const raw = match[2]?.trim() ?? ""
  const msg = raw.length >= 2 && ((raw.startsWith('"')&&raw.endsWith('"'))||(raw.startsWith("'")&&raw.endsWith("'")))
    ? raw.slice(1,-1).trim() : raw
  return { kind: "start", minutes: parseInt(match[1]!), message: msg || "Continue working autonomously." }
}

function fmt(ms: number): string {
  const s=Math.max(0,Math.round(ms/1000)),m=Math.floor(s/60),h=Math.floor(m/60)
  if(s<60)return`${s}s`;if(m<60)return`${m}m`;if(m%60===0)return`${h}h`;return`${h}h ${m%60}m`
}

function fmtRemaining(elapsed: number, total: number): string { return fmt(Math.max(0, total - elapsed)) }

function fmtSummary(st: LoopState): string {
  const e = Date.now() - st.startTime, r = Math.max(0, st.durationMs - e)
  return `ChronoLoop\nRunning\nElapsed: ${fmt(e)}\nRemaining: ${fmt(r)}`
}

function evalBackticks(msg: string): string {
  return msg.replace(/`([^`]+)`/g, (_m: string, cmd: string) => {
    const c = cmd.trim(); if (!c) return ""
    try { const o = (execSync(c, { encoding: "utf-8", timeout: 30_000, windowsHide: true, stdio: ["pipe","pipe","pipe"] }) as string).trim(); return o || "(no output)" }
    catch (e: any) { return `(error: ${e.message.split("\n")[0]})` }
  })
}

// ═══════════════════════════════════════════
//  Plugin — the ONLY export
// ═══════════════════════════════════════════

export const ChronoLoopPlugin: Plugin = async ({ client }: any) => {
  let loop: LoopState | null = null
  let isIdle = false
  let inFlight = false
  let hb: any = null

  const toast = (m: string, v = "info", d = 5000) =>
    client.tui.showToast({ body: { message: m, variant: v, duration: d } }).catch(() => {})

  const cancelDwell = () => { if (loop?.dwellTimer) { clearTimeout(loop.dwellTimer); loop.dwellTimer = null } }

  const startDwell = () => {
    if (!loop?.active) return
    const r = Math.max(0, loop.durationMs - (Date.now() - loop.startTime))
    if (r <= 0) { doStop(); toast(MSG_COMPLETED(Math.round(loop.durationMs / 60000)), "info", 8000); return }
    toast(`DWELL started (${Math.round(r/1000)}s left)`, "info", 2000)
    cancelDwell()
    loop.dwellTimer = setTimeout(() => {
      loop!.dwellTimer = null
      const r2 = Math.max(0, loop!.durationMs - (Date.now() - loop!.startTime))
      if (r2 <= 0) { doStop(); toast(MSG_COMPLETED(Math.round(loop!.durationMs / 60000)), "info", 8000); return }
      toast("DWELL FIRED → sending", "info", 3000)
      fire()
    }, 30_000)
  }

  const fire = async () => {
    if (inFlight || !loop) return; inFlight = true
    try {
      const msg = evalBackticks(loop.message)
      await client.tui.clearPrompt(); await client.tui.appendPrompt({ body: { text: msg } }); await client.tui.submitPrompt()
    } catch (e: any) { inFlight = false; toast(`ChronoLoop fail: ${e.message}`, "error") }
  }

  const doStop = () => { cancelDwell(); loop = null; inFlight = false; refreshHb() }

  const refreshHb = () => {
    if (loop?.active && !hb) {
      hb = setInterval(() => {
        if (!loop?.active) return
        const r = Math.max(0, loop.durationMs - (Date.now() - loop.startTime))
        if (r > 0) toast(`ChronoLoop — ${fmt(r)} remaining`, "info", 4000)
      }, 30_000)
    } else if (!loop?.active && hb) { clearInterval(hb); hb = null }
  }

  return {
    config: async (cfg: any) => {
      cfg.command ??= {}
      cfg.command.cronoloop = { template: "<minutes> [message]", description: DEFAULT_COMMAND_DESCRIPTION }
    },
    event: async ({ event }: any) => {
      const t = event.type, p = event.properties || event.data || {}
      // DEBUG: show every event
      if (t !== "message.updated" && t !== "session.status") {
        toast(`[${t}]`, "info", 2000)
      }
      if (t === "message.updated") {
        if (p?.info?.role === "assistant") {
          toast("ACTIVITY — cancel dwell", "info", 1500)
          isIdle = false; cancelDwell()
          if (p?.info?.error?.name === "MessageAbortedError" && loop?.active) { doStop(); toast("ChronoLoop stopped after interrupt", "info") }
        }
        return
      }
      if (t === "session.idle") {
        toast("IDLE — start dwell", "info", 2000)
        isIdle = true; inFlight = false; startDwell()
      }
    },
    "command.execute.before": async (input: any) => {
      if (input.command !== "cronoloop") return
      const DONE = "__CHL__"
      const op = parseCommand((input.arguments ?? "").trim())
      if (op.kind === "status") {
        if (!loop?.active) { toast(NO_LOOP, "error"); throw new Error(DONE) }
        toast(fmtSummary(loop)); throw new Error(DONE)
      }
      if (op.kind === "stop") {
        if (!loop?.active) { toast(MSG_NO_LOOP_TO_STOP, "error"); throw new Error(DONE) }
        const e = fmt(Date.now() - loop.startTime); doStop()
        toast(`${MSG_STOPPED} Elapsed: ${e}`); throw new Error(DONE)
      }
      if (loop?.active) { toast(`Already running. ${fmtRemaining(Date.now() - loop.startTime, loop.durationMs)} remaining. /cronoloop stop first.`, "error"); throw new Error(DONE) }
      loop = { startTime: Date.now(), durationMs: op.minutes * 60_000, message: op.message, active: true, dwellTimer: null }
      refreshHb()
      toast(`ChronoLoop armed — fires after 30s of idle (${op.minutes}m)`, "info", 5000)
      startDwell()
      throw new Error(DONE)
    },
  }
}
