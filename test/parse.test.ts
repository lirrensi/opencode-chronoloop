import { describe, expect, test } from "vitest"
import { parseChronoLoopCommand, DEFAULT_MESSAGE } from "../src/test-helpers"

describe("parseChronoLoopCommand", () => {
  test("empty input returns status", () => {
    expect(parseChronoLoopCommand("")).toEqual({ kind: "status" })
    expect(parseChronoLoopCommand("   ")).toEqual({ kind: "status" })
  })

  test("'stop' returns stop command", () => {
    expect(parseChronoLoopCommand("stop")).toEqual({ kind: "stop" })
    expect(parseChronoLoopCommand(" STOP ")).toEqual({ kind: "stop" })
  })

  test("number-only starts loop with default message", () => {
    const result = parseChronoLoopCommand("120")
    expect(result).toEqual({
      kind: "start",
      minutes: 120,
      message: DEFAULT_MESSAGE,
    })
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
  })

  test("garbage input returns status", () => {
    expect(parseChronoLoopCommand("hello world")).toEqual({ kind: "status" })
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
