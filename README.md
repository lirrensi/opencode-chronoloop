# opencode-chonoloop 🌀🌌🌠🎆

[![npm version](https://img.shields.io/npm/v/opencode-chonoloop?color=6b48ff)](https://www.npmjs.com/package/opencode-chonoloop)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Endless autonomous loop for OpenCode.** 🔄🌟✨🪐🌙
No completion criteria. No tool. No "I'm done" meowing. 🐱🙅‍♀️🐾🗣️
Just pure, time-bounded, keep-going energy. ⏱️💫⚡🔥💥

Your agent works continuously on open-ended tasks — refining, improving, creating new work — until the clock runs out. Not because it *thinks* it's done. 💅🔮🎯✨💖

> ⚠️ **Disclaimer:** This README is absolutely riddled with emojis because we were stress-testing loop continuation functionality and got carried away. Every tool call was followed by "add more emojis" to verify the agent stayed on task. It worked! But now it looks like a Lisa Frank sticker book exploded. 🦄🌈✨🎨

---

## Why ChronoLoop? 🤔🌈💡🧠🎯

Existing loop patterns (goal, Ralph) are designed for **completable** work — they stop when the agent decides it's finished. But what if your work is:

- **Endlessly refinable** — a codebase that can always be cleaner, faster, better documented 🧹✨🌟🔧
- **Additive** — run out of tasks? Create new ones 📝🆕🚀✨
- **Open-ended** — exploration, research, creative work with no finish line 🔭🚀🌍🌌
- **Background automation** — set it and forget it while you sleep 🌙😴💤🛌

ChronoLoop is for all of that. The exit condition is **purely time-based**, and the agent never knows about it. No reward hacking, no premature "done" declarations — just work until time's up. ⏰🔥🎯💯

---

## How it's different ⚔️🔥🆚🥊🏆

| Feature | Goal / Ralph | ChronoLoop |
|---|---|---|
| Stop condition | Agent calls `update_goal` | ⏱️ Server says time's up |
| Agent knows the limit? | Yes (objective + criteria) | **No** — time is hidden |
| Completion criteria | Required | **None** — endless by design |
| Tool exposed | `update_goal` | **No tool** |
| Prompt injection | Objective + audit instructions | Your custom message or default "keep going" |
| Best for | Defined tasks with a finish line | Open-ended work, refinement, background loops |

---

## Commands 🚀🎉🎮🕹️🎯

### `/cronoloop <minutes> [message]` 🎬🎥🎞️📽️

Start an endless loop for the given number of minutes.

```
/cronoloop 120
/cronoloop 60 "Keep working on the backlog. Check TODO.md for next priorities."
```

If no message is provided, the default is used:

> *We are running in an autonomous loop. Continue working. Make progress, improve things. Do not stop — there is always more to do.* 🔄♾️🌀💫

### `/cronoloop` 👀👁️🧐🔍

Show current loop status — elapsed time and remaining.

### `/cronoloop stop` 🛑⛔🚫🚷

Stop the loop immediately.

---

## What the agent sees 👁️💎👀🧠🔮

Your message (or the default) is sent as a user message each time the loop continues. The agent never sees:

- How much time is left
- That there's a time limit at all
- Any completion criteria or exit condition

It just sees "continue working" and keeps going. This prevents shortcut behavior, sleeping, or premature wrap-ups. 🙈🚫⛔🛑

---

## Heartbeat 💓💖💗🫀🩺

While the loop is active, a toast notification shows remaining time every 30 seconds so you always know it's alive and working.

---

## State 💾🎨📦🧰🗃️

Ephemeral — all state lives in memory. If OpenCode restarts, the loop is gone. No disk I/O, no stale state files.

---

## Install 📦🌟📥⬇️🚀

```jsonc
// opencode.jsonc
{
  "plugin": [
    "opencode-chonoloop",
  ]
}
```

Restart OpenCode. That's it. ✨🚀🎉💫

---

## Development 🛠️🏆🔧⚙️🔩

```sh
git clone https://github.com/lirrensi/opencode-chronoloop
cd opencode-chronoloop
pnpm install
pnpm typecheck   # TypeScript check
pnpm test        # Run tests 🧪🔬🧫🔎
```

---

## Best Practices 🌸📚💎🧠🏆

ChronoLoop is a different kind of tool — there's no finish line, so how you set it up determines whether you get 8 hours of beautiful progress or 8 hours of the agent spinning in circles. Here's what to think about.

### 1. Calibrate time to your inference speed ⏱️🐢🚀⚡🕰️

ChronoLoop was originally built for **slow local models** running overnight. If you're using one, setting 6–8 hours makes sense — each continuation takes minutes, and you want enough runway for real progress.

If you're using a **fast API model** (GPT-4o, Claude, etc.), continuations take seconds, not minutes. That same 8-hour window will produce hundreds of turns. Adjust accordingly:

| Model speed | Suggested range | Why |
|---|---|---|
| 🐢 Slow local (7B–13B, quantized) | 4–8 hours | Each turn is slow; needs runway |
| 🚶‍♂️ Medium (34B–70B, local) | 1–4 hours | Decent speed, still benefits from longer runs |
| 🚀 Fast API (Claude, GPT-4o, etc.) | 10–60 minutes | Blazing fast turns; long runs can drift or hit context limits |

For fast models, start small (15–30 minutes), observe the quality, and scale up. A fast model in a 6-hour loop can generate hundreds of messages — make sure your context window and budget can handle it.

### 2. Give the agent a way to pick up where it left off 📝📌🔄📍🗺️

ChronoLoop fires the same message every time. If the agent has no memory of what it was doing, it will restart from scratch — or worse, repeat the same work.

**You need a persistence mechanism.** Common patterns:

- **A shared scratchpad file** — `scratchpad.md`, `progress.md`, or `CHRONO_CONTEXT.md` that the agent reads at the start of each continuation and writes to during work. The file tracks: what was done, what's next, current state, blockers.
- **A task list file** — `TODO.md`, `tasks.json`, or `backlog.md` that the agent pops tasks from and appends new ones to.
- **A productivity system** — a notes directory, a kanban board file, or any structured format the agent can parse and update.

Your message should point to this mechanism:

```
/cronoloop 60 "Read CHRONO_CONTEXT.md and continue from where you left off. Update the file with progress when you complete something."
```

**Assume compaction happens.** The chat history will be cleared at some point — by context limits, by OpenCode trimming, or by a session restart. Your scratchpad file is the source of truth, not the conversation. Design for it.

### 3. Define what happens when there's nothing left to do 🤔🎯💡🧠🗺️

This is the hardest part. On loop #27, the agent may have improved every file, written every test, refactored everything, and still has 3 hours left. If you haven't told it what to do next, it will:

- Re-refactor the same code
- Write the same tests in different styles
- Start making things up
- Produce low-quality churn

**Prevent this with layered focus directives:**

```
Layer 1 — Overall mission:
"The goal is to make this project production-ready. Prioritize correctness, observability, 
error handling, documentation, and edge cases — in that order."

Layer 2 — When stuck for work:
"If you've addressed all items in the current focus area, move to the next one in the 
priority list. If all focus areas are addressed, do a fresh audit: check for missing tests, 
unhandled errors, undocumented APIs, performance bottlenecks, and security concerns."

Layer 3 — When genuinely everything is done:
"Run a comprehensive audit against the project's stated goals. Identify the weakest area 
and start a new improvement cycle there. If you truly cannot find anything productive, 
compact your findings into a summary document and wait."
```

**Scouting — the art of finding new work:**
The agent should know how to *scout* for work, not just execute a fixed list:

- "Scan recent git log for areas with high churn — those need stabilization"
- "Check dependency freshness — any outdated packages need updating"
- "Review open issues or TODOs in the codebase"
- "Profile the application — find the slowest path and optimize it"
- "Look for untested code paths, missing error handling, unvalidated inputs"

Structure your message so the agent has both a **task source** (where to find work) and an **escalation path** (what to do when that source is empty).

### 4. Separate constitution from continuation 📜🔄📖🗣️🏛️

Your agent needs two distinct pieces of guidance:

| What | Purpose | When it's used |
|---|---|---|
| **The Constitution** | Core principles, focus areas, priorities, navigation rules, work philosophy | Set once at the start, referenced by the continuation message |
| **The Continuation Message** | Simple instruction to read the source of truth and continue | Every loop iteration |

The pattern:

```
# Initial setup (one-time, in chat or in a system file):
"You are an autonomous improvement agent. Your constitution:
1. Always leave things better than you found them
2. Prefer small, safe, incremental changes
3. Update the scratchpad after every significant action
4. If blocked on something for more than 2 attempts, compact and pivot
5. Quality over quantity — one real improvement > five superficial ones"

# Continuation message (every loop):
"Read CHRONO_CONTEXT.md. Continue from where you left off. 
Follow the constitution. Update the scratchpad."
```

The constitution should be **a file in the project** (`.chonoloop-constitution.md` or similar), not just in chat history, because chat gets compacted. The continuation message just says "read the file and follow it."

### 5. Plan for catastrophic blockers 💥🛑🔥🚨⚠️

Some problems will stop any agent cold:

- **Code won't compile** — dependency broken, build system corrupted, API changed
- **Test infrastructure down** — test DB unreachable, mock server not running
- **Network/service unavailable** — can't fetch dependencies, can't run integration tests
- **License/legal blocks** — can't actually make that change

An agent without guidance will burn continuations retrying the same failing action, generating error messages, and getting nowhere.

**Strategies:**

- **Fail-fast detection:** Tell the agent to recognize within 1–2 attempts if a core action is fundamentally blocked (e.g., "if `pnpm build` fails with an infrastructure error, don't retry 10 times — compact and pivot")
- **Compaction trigger:** Define what counts as a "serious blocker" and tell the agent to compact its findings and move to a different area instead of spinning
- **Time-boxed attempts:** "Try any task a maximum of 3 times. If it fails 3 times, write it to BLOCKERS.md with the error and move on"
- **Escalation document:** Have the agent write a clear summary of the blocker so you can fix it when you're back
- **Fallback work:** Maintain a list of safe, low-risk tasks that can progress even when the main path is blocked (documentation, code review notes, refactoring plans)

**Design your time budget with blockers in mind.** If you set an 8-hour loop and the agent hits a compile error in minute 5, you have 7 hours 55 minutes of potential waste. Catching failures early and redirecting is critical for long runs.

A well-structured continuation message might look like:

```
Read CHRONO_CONTEXT.md and continue.
- Follow the constitution in .chonoloop-constitution.md
- Update scratchpad after each action
- If blocked 3 times on the same thing, document in BLOCKERS.md and pivot
- If all tasks are exhausted, run a fresh audit and define the next improvement cycle
- If you hit a catastrophic blocker, compact everything into BLOCKERS.md and wait
```

---

## Design constraints 🧱🛡️⚙️🔒🚧

- No `update_goal` tool — the agent cannot mark itself complete
- Time limit is never revealed to the agent — prevents reward hacking
- Plan mode is detected and skipped — no infinite planning loops
- No message transform tricks — the continuation message is sent directly

---

## License 📜📄🎊📝✨

MIT 🎊✨🎉💖
