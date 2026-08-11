#!/usr/bin/env node
// PostToolUse hook: after Write/Edit, run Prettier (and ESLint --fix for JS/TS)
// on the touched file. Scoped to this project only — registered in
// .claude/settings.json, not a global hook.
//
// Reads the hook payload JSON from stdin, expects tool_input.file_path.
// Never blocks the agent: any failure is reported to stderr and the
// process still exits 0.

import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const PRETTIER_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".json",
  ".css",
]);

const ESLINT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function readStdin() {
  return new Promise((resolvePromise) => {
    let data = "";
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolvePromise(data));
    process.stdin.on("error", () => resolvePromise(data));
  });
}

function run(bin, args, cwd) {
  const result = spawnSync(bin, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.stderr.write(
      `[format-on-write] ${bin} ${args.join(" ")} exited ${result.status}\n`
    );
    if (result.stdout) process.stderr.write(result.stdout.toString());
    if (result.stderr) process.stderr.write(result.stderr.toString());
  }
}

async function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const raw = await readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return; // no-op if payload isn't parseable
  }

  const filePath = payload?.tool_input?.file_path;
  if (!filePath) return;

  const absPath = resolve(projectDir, filePath);
  if (!existsSync(absPath)) return;

  const ext = extname(absPath).toLowerCase();
  const binExt = process.platform === "win32" ? ".cmd" : "";

  if (PRETTIER_EXTS.has(ext)) {
    const prettierBin = resolve(
      projectDir,
      "node_modules",
      ".bin",
      `prettier${binExt}`
    );
    if (existsSync(prettierBin)) {
      run(prettierBin, ["--write", absPath], projectDir);
    }
  }

  if (ESLINT_EXTS.has(ext)) {
    const eslintBin = resolve(
      projectDir,
      "node_modules",
      ".bin",
      `eslint${binExt}`
    );
    if (existsSync(eslintBin)) {
      run(eslintBin, ["--fix", absPath], projectDir);
    }
  }
}

main()
  .catch((err) => {
    process.stderr.write(`[format-on-write] unexpected error: ${err}\n`);
  })
  .finally(() => {
    process.exit(0);
  });
