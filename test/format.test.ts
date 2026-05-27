import { describe, expect, test } from "vitest"
import {
  formatDuration,
  formatRemaining,
  formatLoopSummary,
} from "../src/test-helpers"

import type { ChronoLoopState } from "../src/test-helpers"
describe("formatDuration", () => {
  test.each([
    [0, "0s"],
    [1_000, "1s"],
    [59_000, "59s"],
    [60_000, "1m"],
    [30 * 60_000, "30m"],
    [90 * 60_000, "1h 30m"],
    [2 * 60 * 60_000, "2h"],
    [23 * 60 * 60_000 + 59 * 60_000, "23h 59m"],
    [24 * 60 * 60_000, "24h"],
  ])("formats %d ms", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })
})

describe("formatRemaining", () => {
  test("shows remaining time", () => {
    expect(formatRemaining(5_000, 65_000)).toBe("1m")
    expect(formatRemaining(0, 60_000)).toBe("1m")
  })

  test("never goes below 0", () => {
    expect(formatRemaining(999_999, 60_000)).toBe("0s")
  })
})

describe("formatLoopSummary", () => {
  test("shows running state", () => {
    const state: ChronoLoopState = {
      startTime: Date.now() - 5 * 60 * 1000, // 5 min ago
      durationMs: 120 * 60 * 1000, // 120 min
      message: "keep going",
      active: true,
      dwellTimer: null,
    }

    const summary = formatLoopSummary(state)
    expect(summary).toContain("ChronoLoop")
    expect(summary).toContain("running")
    expect(summary).toContain("Elapsed:")
    expect(summary).toContain("Remaining:")
    expect(summary).toContain("keep going")
  })

  test("truncates long messages", () => {
    const state: ChronoLoopState = {
      startTime: Date.now(),
      durationMs: 60 * 1000,
      message: "a".repeat(100),
      active: true,
      dwellTimer: null,
    }

    const summary = formatLoopSummary(state)
    expect(summary).toContain("…")
  })
})
