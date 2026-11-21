'use strict';

// Shared harness state and process helpers.
//
// hooks.js owns the lifecycle; the World, step definitions, and the
// dependency-maintenance steps read the state from here. The harness picks
// its own ports (the machine's dev-default 3000/3001 are squatted by other
// work today) and never logs the resolved database URL.

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_API_PORT = 3021;
const DEFAULT_WEB_PORT = 3022;
const DEFAULT_OPENAPI_PORT = 3023;

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Identifies this run's smoke rows: unique per run, swept at teardown.
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const PROBE_NAME_PREFIX = `Acceptance Probe ${RUN_STAMP}`;
let probeCounter = 0;

function portFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Acceptance harness: ${name} must be a valid port, got "${raw}".`);
  }
  return port;
}

const state = {
  apiPort: portFromEnv('HARNESS_API_PORT', DEFAULT_API_PORT),
  webPort: portFromEnv('HARNESS_WEB_PORT', DEFAULT_WEB_PORT),
  openapiPort: portFromEnv('HARNESS_OPENAPI_PORT', DEFAULT_OPENAPI_PORT),
  apiBaseUrl: null, // set at boot
  webBaseUrl: null, // set at boot
  databaseUrl: null, // resolved secret — never printed or logged
  apiProcess: null,
  webProcess: null,
  browser: null, // one Playwright chromium for the whole suite
  browserLaunchError: null,
  spawned: [], // [{ child, label }] — everything the harness booted
  portsFreeBeforeBoot: false, // BeforeAll records that both ports were free pre-boot
  suiteMinusSelf: null, // parsed results of the self-check child run, for the later self-scenarios
};

function logDir() {
  return path.join(__dirname, '..', '.extracted', 'harness-logs');
}

function nextProbeName() {
  probeCounter += 1;
  return `${PROBE_NAME_PREFIX} #${probeCounter}`;
}

function isProbeName(name) {
  return typeof name === 'string' && name.startsWith(PROBE_NAME_PREFIX);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Spawns a child in its own process group so teardown can kill the whole
// tree (cargo build children, vite workers) without leaking grandchildren.
// Output goes to a per-label log under .extracted/ (gitignored, wiped per run).
function spawnHarnessProcess({ label, command, args, cwd, env }) {
  fs.mkdirSync(logDir(), { recursive: true });
  const logStream = fs.createWriteStream(path.join(logDir(), `${label}.log`));
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  child.on('exit', () => logStream.end());
  state.spawned.push({ child, label });
  return child;
}

// Belt and braces: even a crashed or interrupted run must not leak the apps.
// process 'exit' handlers are synchronous — SIGKILL the whole groups.
function killSpawnedGroupsSync(signal) {
  for (const { child } of state.spawned) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      process.kill(-child.pid, signal);
    } catch {
      /* group already gone */
    }
    try {
      child.kill(signal);
    } catch {
      /* process already gone */
    }
  }
}
process.on('exit', () => killSpawnedGroupsSync('SIGKILL'));

function stopSpawnedProcess(child, label, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    let settled = false;
    let fallback = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(escalate);
      if (fallback) clearTimeout(fallback);
      resolve();
    };
    const escalate = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* group already gone */
      }
      try {
        child.kill('SIGKILL');
      } catch {
        /* process already gone */
      }
    }, timeoutMs);
    // Safety net: never hang teardown on a process that ignores everything.
    fallback = setTimeout(finish, timeoutMs + 2500);
    child.once('exit', finish);
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        /* process already gone */
      }
    }
  });
}

async function stopAllSpawnedProcesses() {
  const stops = state.spawned
    .slice()
    .reverse() // stop the most recently booted first (web before api)
    .map(({ child, label }) => stopSpawnedProcess(child, label));
  await Promise.all(stops);
  state.spawned.length = 0;
}

// Polls `fn` until it returns truthy; throws naming the label on timeout.
async function waitFor(fn, { timeoutMs, intervalMs = 250, label }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) return;
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  const detail = lastError ? ` (last error: ${lastError.message})` : '';
  throw new Error(`${label} not ready within ${Math.round(timeoutMs / 1000)}s${detail}.`);
}

// The API logs "Listening on ..." once up; /health tells the truth about the
// database. A rebuild may kick in under `cargo run`, so the window is generous.
async function waitForApiHealth(baseUrl, timeoutMs) {
  await waitFor(
    async () => {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (response.status !== 200) return false;
      const body = await response.json().catch(() => null);
      return Boolean(body && body.success === true);
    },
    { timeoutMs, intervalMs: 500, label: `API health at ${baseUrl}/health` }
  );
}

// TCP-connect probe: the vite dev server is ready when its port accepts
// connections (it prints "ready in" just before that).
function probeTcpPort(port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, '127.0.0.1');
  });
}

async function waitForTcpPort(port, timeoutMs, label) {
  await waitFor(() => probeTcpPort(port), { timeoutMs, intervalMs: 300, label });
}

// Runs a command to completion (used by the check/build gate steps and the
// suite's own self-check child runs). Captures output; never throws on
// non-zero exit — the caller asserts. `env` defaults to this process's
// environment; the self-check scenarios override it (offset ports, stripped
// DATABASE_URL).
function runCommand(command, args, { cwd, timeoutMs, env = process.env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      reject(new Error(`${command} ${args.join(' ')} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 200_000) stdout = stdout.slice(-100_000);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function tailOf(text, maxChars = 4000) {
  if (!text) return '(no output)';
  const flat = String(text).replace(/\u001b\[[0-9;]*m/g, '');
  return flat.length <= maxChars ? flat : `…${flat.slice(-maxChars)}`;
}

// --- registered post-teardown checks ---
//
// A scenario can register a check that must hold AFTER AfterAll has stopped
// everything the harness booted — the "gone after the run" contracts. A
// check cannot redden its own scenario (teardown happens after the last
// one), so the harness runs them at the very end of AfterAll instead: each
// PASS prints, each FAIL prints and marks the run's exit code non-zero, so
// a leak is never silent. This complements the synchronous process 'exit'
// SIGKILL handler above, which stays the crash backstop.
const postTeardownChecks = [];

function registerPostTeardownCheck({ label, check }) {
  postTeardownChecks.push({ label, check });
}

async function runPostTeardownChecks() {
  for (const { label, check } of postTeardownChecks) {
    try {
      const ok = await check();
      if (ok) {
        console.error(`[harness] PASS (after teardown): ${label}`);
      } else {
        process.exitCode = 1;
        console.error(`[harness] FAIL (after teardown): ${label}`);
      }
    } catch (error) {
      process.exitCode = 1;
      console.error(`[harness] FAIL (after teardown): ${label} — ${tailOf(error.message, 300)}`);
    }
  }
  postTeardownChecks.length = 0;
}

module.exports = {
  REPO_ROOT,
  RUN_STAMP,
  PROBE_NAME_PREFIX,
  state,
  nextProbeName,
  isProbeName,
  delay,
  spawnHarnessProcess,
  stopSpawnedProcess,
  stopAllSpawnedProcesses,
  waitFor,
  waitForApiHealth,
  probeTcpPort,
  waitForTcpPort,
  runCommand,
  registerPostTeardownCheck,
  runPostTeardownChecks,
  tailOf,
};
