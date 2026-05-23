# Changelog

All notable changes to **opencode-chronoloop** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.1] — 2026-05-23

### Fixed

- **Package name corrected** — `opencode-chonoloop` → `opencode-chronoloop`
  (missing 'r' in "chrono"). The old `opencode-chonoloop` package on npm has
  been deprecated — please update your config to reference
  `opencode-chronoloop` instead.

---

## [0.2.0] — 2026-05-23

### Added

- **Backtick command execution in loop messages** — the message sent each
  continuation now supports backtick-enclosed shell commands (`` `cmd` ``).
  Commands are evaluated left-to-right via the system shell and their stdout
  is substituted inline, similar to PHP backticks. This lets agents embed
  live data (file listings, git status, build output, timestamps, etc.)
  into their own continuation prompts.
  - Output is capped at 2,000 characters per command (configurable via
    `MAX_BACKTICK_OUTPUT_LENGTH`).
  - Failed commands insert an `(error: ...)` placeholder instead of crashing.
  - Empty backticks (`` ``` ``) are silently removed.
  - 30-second timeout per command prevents runaway processes.
  - Full test suite covering: passthrough, execution, multiple segments,
    empty commands, error handling, long output truncation, whitespace
    trimming, no-output placeholders, and shell pipelines.

---

## [0.1.1] — 2026-05-23

### Fixed

- CI supply-chain policy: set `PNPM_MINIMUM_RELEASE_AGE=0` to allow immediate
  publishing.

---

## [0.1.0] — 2026-05-23

### Added

- Initial release: endless autonomous loop plugin for OpenCode.
- Time-based loop with configurable duration and custom message.
- `/cronoloop <minutes> [message]` command to start a loop.
- `/cronoloop` (status) and `/cronoloop stop` commands.
- Heartbeat toast every 30 seconds showing remaining time.
- Session-scoped loops (one per session).
- In-flight detection and abort-on-interrupt handling.
- Plan-mode safe-skip (no infinite planning loops).
- No tool exposed to agent — pure time-based exit, hidden from agent.

[0.2.1]: https://github.com/lirrensi/opencode-chronoloop/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/lirrensi/opencode-chronoloop/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/lirrensi/opencode-chronoloop/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lirrensi/opencode-chronoloop/releases/tag/v0.1.0