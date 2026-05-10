/**
 * NextGen IGA — unified dev runner
 * Starts all four services as child processes with colour-coded prefixed logs.
 * Usage:  node run.js
 *         node run.js --only gateway,event-manager
 */

import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

const NODE = process.execPath; // full path to current node binary — avoids PATH lookup failures on Windows

const SERVICES = [
  {
    name: "gateway",
    dir: "gateway",
    cmd: NODE,
    args: ["src/app.js"],
    color: "\x1b[36m", // cyan
  },
  {
    name: "event-manager",
    dir: "event-manager",
    cmd: NODE,
    args: ["index.js"],
    color: "\x1b[35m", // magenta
  },
  {
    name: "access-mgmt",
    dir: "access-management",
    cmd: NODE,
    args: ["src/index.js"],
    color: "\x1b[33m", // yellow
  },
  {
    name: "notifications",
    dir: "notifications",
    cmd: NODE,
    args: ["index.js"],
    color: "\x1b[32m", // green
  },
  {
    name: "recommendation",
    dir: "recommendation",
    cmd: NODE,
    args: ["src/index.js"],
    color: "\x1b[34m", // blue
  },
];

const RESET = "\x1b[0m";
const RED = "\x1b[31m";

// ── CLI filter ───────────────────────────────────────────────────────────────
const onlyArg = process.argv.find(
  (a) => a.startsWith("--only=") || a === "--only",
);
let filter = null;
if (onlyArg) {
  const val = onlyArg.includes("=")
    ? onlyArg.split("=")[1]
    : process.argv[process.argv.indexOf("--only") + 1];
  filter = val ? val.split(",").map((s) => s.trim()) : null;
}

const active = filter
  ? SERVICES.filter((s) => filter.includes(s.name))
  : SERVICES;

if (!active.length) {
  console.error(`No matching services for: ${filter?.join(", ")}`);
  process.exit(1);
}

// ── Spawn ────────────────────────────────────────────────────────────────────
const procs = [];

for (const svc of active) {
  const cwd = resolve(__dir, svc.dir);
  const label = `${svc.color}[${svc.name}]${RESET}`;

  console.log(`${label} starting → ${svc.dir}/${svc.args.join(" ")}`);

  const child = spawn(svc.cmd, svc.args, {
    cwd,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (buf) => {
    buf
      .toString()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => process.stdout.write(`${label} ${line}\n`));
  });

  child.stderr.on("data", (buf) => {
    buf
      .toString()
      .split("\n")
      .filter(Boolean)
      .forEach((line) =>
        process.stderr.write(`${label} ${RED}${line}${RESET}\n`),
      );
  });

  child.on("exit", (code, signal) => {
    const reason = signal ?? `exit ${code}`;
    console.error(`${label} ${RED}stopped (${reason})${RESET}`);
  });

  procs.push({ svc, child });
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(sig) {
  console.log(`\n[runner] ${sig} — stopping all services…`);
  for (const { child } of procs) child.kill(sig);
  setTimeout(() => process.exit(0), 1500);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log(`[runner] ${active.length} service(s) running. Ctrl+C to stop.`);
