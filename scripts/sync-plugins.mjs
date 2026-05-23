#!/usr/bin/env node
/**
 * sync-plugins.mjs
 *
 * Writes the opencode-chonoloop plugin re-export file into
 * `.opencode/plugins/` so OpenCode picks it up locally.
 *
 * The re-export file just points back to the project source,
 * so changes to src/ are reflected immediately — no copy needed.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const PLUGIN_DIR = resolve(root, ".opencode", "plugins")
const PLUGIN_FILE = resolve(PLUGIN_DIR, "opencode-chonoloop.ts")

const RE_EXPORT_CONTENT = `/**
 * opencode-chonoloop — endless autonomous loop plugin
 *
 * OpenCode auto-loads .ts files from its plugins directory.
 * This file re-exports the plugin from the project source.
 */
export { ChronoLoopPlugin, default } from "../../src/index"
`

if (!existsSync(PLUGIN_DIR)) {
  mkdirSync(PLUGIN_DIR, { recursive: true })
}

writeFileSync(PLUGIN_FILE, RE_EXPORT_CONTENT, "utf8")
console.log(`✓ Synced plugin to ${PLUGIN_FILE}`)
