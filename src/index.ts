import type { Plugin } from "@opencode-ai/plugin"
import { execSync } from "child_process"

// ═══════════════════════════════════════════
//  ChronoLoop — pnpm run deploy to install.
// ═══════════════════════════════════════════

// ── internal types ──

type LoopState = {
    startTime: number; durationMs: number; message: string; active: boolean
    dwellTimer: ReturnType<typeof setTimeout> | null
}

// ── internal helpers ──

const BACKTICK_TIMEOUT_MS = 300_000
const SHORT_DWELL_MS = 3_000
const DWELL_MS = 10_000

const DEFAULT_COMMAND_DESCRIPTION = "start or manage an endless autonomous loop — supports 30, 30m, 1h, 90s"
const NO_LOOP = "No active chronoloop.\nUsage: /chronoloop <duration> [message]  (bare=mins, 30m, 1h, 90s)"
const MSG_STOPPED = "ChronoLoop stopped."
const MSG_COMPLETED = (m: number) => `ChronoLoop completed — ran for ${m} minute${m === 1 ? "" : "s"}.`
const MSG_NO_LOOP_TO_STOP = "No active chronoloop to stop."

function parseDurationMs(raw: string): number | null {
    const m = /^(\d+)([smh]?)$/i.exec(raw.trim())
    if (!m) return null
    const v = parseInt(m[1]!, 10)
    if (v <= 0) return null
    const u = (m[2] || "m").toLowerCase()
    if (u === "s") return v * 1000
    if (u === "m") return v * 60_000
    if (u === "h") return v * 3_600_000
    return null
}

function parseCommand(input: string): { kind: "start"; minutes: number; message: string } | { kind: "stop" } | { kind: "status" } {
    const text = input.trim()
    if (!text) return { kind: "status" }
    if (text.toLowerCase() === "stop") return { kind: "stop" }
    const match = /^(\d+[smh]?)(?:\s+(.+))?$/si.exec(text)
    if (!match) return { kind: "status" }
    const durMs = parseDurationMs(match[1]!)
    if (durMs === null) return { kind: "status" }
    const raw = match[2]?.trim() ?? ""
    const msg = raw.length >= 2 && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
        ? raw.slice(1, -1).trim() : raw
    return { kind: "start", minutes: Math.round(durMs / 60_000), message: msg || "Continue working autonomously." }
}

function fmt(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000)), m = Math.floor(s / 60), h = Math.floor(m / 60)
    if (s < 60) return `${s}s`; if (m < 60) return `${m}m`; if (m % 60 === 0) return `${h}h`; return `${h}h ${m % 60}m`
}

function fmtRemaining(elapsed: number, total: number): string { return fmt(Math.max(0, total - elapsed)) }

function fmtSummary(st: LoopState): string {
    const e = Date.now() - st.startTime, r = Math.max(0, st.durationMs - e)
    return `ChronoLoop\nRunning\nElapsed: ${fmt(e)}\nRemaining: ${fmt(r)}`
}

function evalBackticks(msg: string): string {
    return msg.replace(/`([^`]+)`/g, (_m: string, cmd: string) => {
        const c = cmd.trim(); if (!c) return ""
        try { const o = (execSync(c, { encoding: "utf-8", timeout: BACKTICK_TIMEOUT_MS, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }) as string).trim(); return o || "(no output)" }
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
    let dwellStartedAt = 0
    let dwellDuration = 0
    let hb: any = null

    const toast = (m: string, v = "info", d = 5000) =>
        client.tui.showToast({ body: { message: m, variant: v, duration: d } }).catch(() => { })

    const cancelDwell = () => { if (loop?.dwellTimer) { clearTimeout(loop.dwellTimer); loop.dwellTimer = null; dwellStartedAt = 0; dwellDuration = 0 } }

    const startDwell = (dwellMs = DWELL_MS) => {
        if (!loop?.active) return
        const r = Math.max(0, loop.durationMs - (Date.now() - loop.startTime))
        if (r <= 0) { doStop(); toast(MSG_COMPLETED(Math.round(loop.durationMs / 60000)), "info", 8000); return }
        cancelDwell()
        dwellStartedAt = Date.now()
        dwellDuration = dwellMs
        loop.dwellTimer = setTimeout(() => {
            loop!.dwellTimer = null; dwellStartedAt = 0; dwellDuration = 0
            const r2 = Math.max(0, loop!.durationMs - (Date.now() - loop!.startTime))
            if (r2 <= 0) { doStop(); toast(MSG_COMPLETED(Math.round(loop!.durationMs / 60000)), "info", 8000); return }
            fire()
        }, dwellMs)
    }

    const fire = async () => {
        if (inFlight || !loop) return; inFlight = true
        try {
            const msg = evalBackticks(loop.message)
            await client.tui.clearPrompt(); await client.tui.appendPrompt({ body: { text: msg } }); await client.tui.submitPrompt()
        } catch (e: any) { toast(`ChronoLoop fail: ${e.message}`, "error") }
        finally { inFlight = false }
    }

    const doStop = () => { cancelDwell(); loop = null; inFlight = false; refreshHb() }

    const refreshHb = () => {
        if (loop?.active && !hb) {
            hb = setInterval(() => {
                if (!loop?.active) return
                const r = Math.max(0, loop.durationMs - (Date.now() - loop.startTime))
                if (r <= 0) { doStop(); toast(MSG_COMPLETED(Math.round(loop.durationMs / 60000)), "info", 8000); return }
                const dwellLeft = dwellStartedAt > 0 ? Math.round((dwellDuration - (Date.now() - dwellStartedAt)) / 1000) : 0
                const status = dwellStartedAt > 0
                    ? `⏳ dwell ${dwellLeft}s → fire`
                    : isIdle ? "🟢 idle — waiting" : "🔴 active — waiting"
                toast(`ChronoLoop ${fmt(r)} | ${status}`, "info", 4000)
            }, 5_000)
        } else if (!loop?.active && hb) { clearInterval(hb); hb = null }
    }

    return {
        config: async (cfg: any) => {
            cfg.command ??= {}
            cfg.command.chronoloop = { template: "<duration> [message]", description: DEFAULT_COMMAND_DESCRIPTION }
        },
        event: async ({ event }: any) => {
            const t = event.type, p = event.properties || event.data || {}
            if (t === "message.updated") {
                if (p?.info?.role === "assistant") {
                    isIdle = false; cancelDwell()
                    if (p?.info?.error?.name === "MessageAbortedError" && loop?.active) { doStop(); toast("ChronoLoop stopped after interrupt", "info") }
                }
                return
            }
            if (t === "session.idle") { isIdle = true; inFlight = false; startDwell() }
            if (t === "session.created") {
                if (loop?.active) {
                    const e = fmt(Date.now() - loop.startTime); doStop()
                    toast(`ChronoLoop auto-stopped (new session) — ran ${e}`, "info")
                }
            }
        },
        "command.execute.before": async (input: any) => {
            if (input.command !== "chronoloop") return
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
            if (loop?.active) { toast(`Already running. ${fmtRemaining(Date.now() - loop.startTime, loop.durationMs)} remaining. /chronoloop stop first.`, "error"); throw new Error(DONE) }
            loop = { startTime: Date.now(), durationMs: op.minutes * 60_000, message: op.message, active: true, dwellTimer: null }
            refreshHb()
            toast(`ChronoLoop armed — fires after idle (${fmt(op.minutes * 60_000)})`, "info", 5000)
            if (isIdle) { startDwell(SHORT_DWELL_MS) }
            // not idle → no startDwell; session.idle will trigger startDwell(DWELL_MS)
            throw new Error(DONE)
        },
    }
}
