import { describe, expect, test } from "vitest"
import { parseChronoLoopCommand, parseDurationMs, DEFAULT_MESSAGE } from "../src/test-helpers"

describe("parseDurationMs", () => {
  test("bare number = minutes", () => {
    expect(parseDurationMs("30")).toBe(30 * 60_000)
    expect(parseDurationMs("1")).toBe(60_000)
    expect(parseDurationMs("120")).toBe(120 * 60_000)
  })

  test("explicit minutes", () => {
    expect(parseDurationMs("30m")).toBe(30 * 60_000)
    expect(parseDurationMs("1m")).toBe(60_000)
    expect(parseDurationMs("5M")).toBe(5 * 60_000)
  })

  test("hours", () => {
    expect(parseDurationMs("1h")).toBe(3_600_000)
    expect(parseDurationMs("2h")).toBe(7_200_000)
    expect(parseDurationMs("1H")).toBe(3_600_000)
  })

  test("seconds", () => {
    expect(parseDurationMs("30s")).toBe(30_000)
    expect(parseDurationMs("90s")).toBe(90_000)
    expect(parseDurationMs("5S")).toBe(5_000)
  })

  test("zero returns null", () => {
    expect(parseDurationMs("0")).toBeNull()
    expect(parseDurationMs("0m")).toBeNull()
    expect(parseDurationMs("0h")).toBeNull()
    expect(parseDurationMs("0s")).toBeNull()
  })

  test("invalid returns null", () => {
    expect(parseDurationMs("")).toBeNull()
    expect(parseDurationMs("abc")).toBeNull()
    expect(parseDurationMs("-5")).toBeNull()
    expect(parseDurationMs("5x")).toBeNull()
    expect(parseDurationMs("5mm")).toBeNull()
    expect(parseDurationMs("1.5h")).toBeNull()
  })

  test("whitespace is trimmed", () => {
    expect(parseDurationMs(" 30m ")).toBe(30 * 60_000)
    expect(parseDurationMs("  1h  ")).toBe(3_600_000)
  })
})

describe("parseChronoLoopCommand", () => {
  test("empty input returns status", () => {
    expect(parseChronoLoopCommand("")).toEqual({ kind: "status" })
    expect(parseChronoLoopCommand("   ")).toEqual({ kind: "status" })
  })

  test("'stop' returns stop command", () => {
    expect(parseChronoLoopCommand("stop")).toEqual({ kind: "stop" })
    expect(parseChronoLoopCommand(" STOP ")).toEqual({ kind: "stop" })
  })

  test("bare number starts loop (backward compat)", () => {
    const result = parseChronoLoopCommand("120")
    expect(result).toEqual({
      kind: "start",
      minutes: 120,
      message: DEFAULT_MESSAGE,
    })
  })

  test("explicit minutes suffix", () => {
    const result = parseChronoLoopCommand("45m")
    expect(result).toEqual({ kind: "start", minutes: 45, message: DEFAULT_MESSAGE })
  })

  test("hours suffix", () => {
    const result = parseChronoLoopCommand("1h")
    expect(result).toEqual({ kind: "start", minutes: 60, message: DEFAULT_MESSAGE })
  })

  test("seconds suffix", () => {
    const result = parseChronoLoopCommand("90s")
    expect(result).toEqual({ kind: "start", minutes: 2, message: DEFAULT_MESSAGE })
  })

  test("seconds suffix with message", () => {
    const result = parseChronoLoopCommand('90s "quick test"')
    expect(result).toEqual({ kind: "start", minutes: 2, message: "quick test" })
  })

  test("number with quoted message", () => {
    const result = parseChronoLoopCommand('120 "keep going forever"')
    expect(result).toEqual({
      kind: "start",
      minutes: 120,
      message: "keep going forever",
    })
  })

  test("number with single-quoted message", () => {
    const result = parseChronoLoopCommand("120 'keep going'")
    expect(result).toEqual({
      kind: "start",
      minutes: 120,
      message: "keep going",
    })
  })

  test("number with unquoted message", () => {
    const result = parseChronoLoopCommand("120 keep going forever")
    expect(result).toEqual({
      kind: "start",
      minutes: 120,
      message: "keep going forever",
    })
  })

  test("hours with message", () => {
    const result = parseChronoLoopCommand("2h keep refining the codebase")
    expect(result).toEqual({
      kind: "start",
      minutes: 120,
      message: "keep refining the codebase",
    })
  })

  test("small numbers work", () => {
    const result = parseChronoLoopCommand("5")
    expect(result).toEqual({
      kind: "start",
      minutes: 5,
      message: DEFAULT_MESSAGE,
    })
  })

  test("zero or negative returns status", () => {
    expect(parseChronoLoopCommand("0")).toEqual({ kind: "status" })
    expect(parseChronoLoopCommand("-5")).toEqual({ kind: "status" })
    expect(parseChronoLoopCommand("0m")).toEqual({ kind: "status" })
    expect(parseChronoLoopCommand("0h")).toEqual({ kind: "status" })
  })

  test("garbage input returns status", () => {
    expect(parseChronoLoopCommand("hello world")).toEqual({ kind: "status" })
    expect(parseChronoLoopCommand("5x")).toEqual({ kind: "status" })
  })

  test("lone quote treated as literal message", () => {
    // Edge case: unbalanced quote is kept as-is
    const result = parseChronoLoopCommand('30 "')
    expect(result.kind).toBe("start")
    if (result.kind === "start") {
      expect(result.minutes).toBe(30)
      expect(result.message).toBe('"')
    }
  })
})
