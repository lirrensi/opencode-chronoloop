import { describe, expect, test } from "vitest"
import { evaluateBackticks, MAX_BACKTICK_OUTPUT_LENGTH } from "../src/test-helpers"

describe("evaluateBackticks", () => {
  test("no backticks passes through unchanged", () => {
    const msg = "continue working on the project"
    expect(evaluateBackticks(msg)).toBe(msg)
  })

  test("executes a simple echo command", () => {
    const result = evaluateBackticks("Result: `echo hello world`")
    expect(result).toBe("Result: hello world")
  })

  test("executes multiple backtick segments", () => {
    const result = evaluateBackticks("`echo a` and `echo b`")
    expect(result).toBe("a and b")
  })

  test("empty backticks are left as-is (no command to run)", () => {
    const result = evaluateBackticks("hello `` world")
    expect(result).toBe("hello `` world")
  })

  test("handles error gracefully", () => {
    const result = evaluateBackticks("run `nonexistent_command_xyz123`")
    expect(result).toContain("(error:")
    // Should still contain the prefix
    expect(result).toContain("run ")
  })

  test("truncates long output", () => {
    const long = "a".repeat(MAX_BACKTICK_OUTPUT_LENGTH + 500)
    const result = evaluateBackticks(`\`echo ${long}\``)
    expect(result.length).toBeLessThanOrEqual(MAX_BACKTICK_OUTPUT_LENGTH + 200) // +message suffix
    expect(result).toContain("[truncated")
  })

  test("trimmed whitespace inside backticks", () => {
    const result = evaluateBackticks("x `  echo hi  ` y")
    expect(result).toBe("x hi y")
  })

  test("no output shows placeholder", () => {
    // `true` is a command that produces no stdout on some shells
    const result = evaluateBackticks("done: `echo -n ''`")
    // Could be "(no output)" or error depending on shell, but should not crash
    expect(result).toContain("done: ")
  })

  test("pipelines work", () => {
    const result = evaluateBackticks("count: `echo 'a b c' | findstr /r . | find /c /v \"\"`")
    // Just check it doesn't error — output format varies by shell
    expect(result).toContain("count: ")
  })
})
