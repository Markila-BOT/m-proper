"use strict";

// File-level scanning for the dependency-maintenance scenarios: manifest
// concreteness, reference checks against the repository's files, lockfile
// range comparisons, and the accepted-ADR policy scan.
//
// Everything here is deliberately pragmatic and loud: surprising shapes fail
// with the file and reason named, and every judgment call the reference scan
// makes is reported by the caller so a run never silently weakens itself.

const fs = require("node:fs");
const path = require("node:path");
const { REPO_ROOT } = require("./harness");

const semver = require("semver");

// ---------------------------------------------------------------------------
// Manifest loading and parsing
// ---------------------------------------------------------------------------

const MANIFEST_PATHS = {
  root: path.join(REPO_ROOT, "package.json"),
  web: path.join(REPO_ROOT, "web", "package.json"),
};

function loadManifests() {
  const root = JSON.parse(fs.readFileSync(MANIFEST_PATHS.root, "utf8"));
  const web = JSON.parse(fs.readFileSync(MANIFEST_PATHS.web, "utf8"));
  return { root, web };
}

// Every direct dependency entry across the three manifests, with the section
// it came from. Sections that do not exist are simply absent.
function collectDirectEntries(manifests) {
  const entries = [];
  for (const section of ["dependencies", "devDependencies"]) {
    if (manifests.root[section]) {
      for (const [name, range] of Object.entries(manifests.root[section])) {
        entries.push({ manifest: "root", section, name, range });
      }
    }
    if (manifests.web[section]) {
      for (const [name, range] of Object.entries(manifests.web[section])) {
        entries.push({ manifest: "web", section, name, range });
      }
    }
  }
  return entries;
}

function extractTomlSection(tomlText, sectionName) {
  const lines = tomlText.split(/\r?\n/);
  const start = lines.findIndex((line) =>
    new RegExp(`^\\[${sectionName}\\]\\s*$`).test(line),
  );
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\[/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

// Direct [dependencies] of api/Cargo.toml: `name = "range"` or
// `name = { version = "range", features = [...] }`. A dependency with no
// version key (git/path deps) surfaces with range null and fails the
// concreteness step, naming the entry.
function cargoDirectDependencies(tomlText) {
  const body = extractTomlSection(tomlText, "dependencies");
  if (body === null) {
    throw new Error("api/Cargo.toml has no [dependencies] section");
  }
  const entries = [];
  for (const rawLine of body) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const name = line.slice(0, eq).trim();
    const rest = line.slice(eq + 1).trim();
    let range = null;
    const inline = /^"([^"]*)"$/.exec(rest);
    const versioned = /(?:^|\{|,)\s*version\s*=\s*"([^"]*)"/.exec(rest);
    if (inline) range = inline[1];
    else if (versioned) range = versioned[1];
    entries.push({ name, range });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Concreteness: an entry names a concrete version constraint, never a
// dist-tag or a pointer.
// ---------------------------------------------------------------------------

const DIST_TAGS = new Set([
  "latest",
  "next",
  "canary",
  "alpha",
  "beta",
  "rc",
  "stable",
  "dev",
  "main",
  "master",
  "experimental",
  "nightly",
]);

function isDistTag(range) {
  if (typeof range !== "string") return true;
  const value = range.trim().toLowerCase();
  return value === "" || value === "*" || value === "x" || DIST_TAGS.has(value);
}

// Concrete JS range: every comparator anchors on a number (caret, tilde,
// comparators, exact pins). Rejects dist-tag words, globs, URLs, git and
// file pointers, and unconstrained workspace refs.
function isConcreteJsRange(range) {
  if (typeof range !== "string") return false;
  const value = range.trim();
  if (!value) return false;
  if (isDistTag(value)) return false;
  if (/^(file|git|https?|link):/i.test(value)) return false;
  if (/^workspace:/i.test(value)) return /^workspace:(\^|~)?\d/.test(value);
  const comparators = value.split(/\s+|\|\|/).filter(Boolean);
  if (comparators.length === 0) return false;
  return comparators.every((comparator) =>
    /^(\^|~|>=|<=|>|<|=)?\d+(\.\d+){0,2}(-[0-9A-Za-z.+-]+)?(\.\*)?$/.test(
      comparator,
    ),
  );
}

// Concrete cargo range: digits (major, optional minor/patch, optional
// prerelease). The repo's manifests use plain "X" / "X.Y" caret ranges.
function isConcreteCargoRange(range) {
  if (typeof range !== "string") return false;
  return /^\d+(\.\d+){0,2}(-[0-9A-Za-z.+-]+)?$/.test(range.trim());
}

function entryIsConcrete(entry) {
  return entry.manifest === "api"
    ? isConcreteCargoRange(entry.range)
    : isConcreteJsRange(entry.range);
}

// ---------------------------------------------------------------------------
// Reference scan: each entry referenced by the repository's files
// ---------------------------------------------------------------------------

const SCOPE_TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".json",
  ".html",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".rs",
  ".sh",
]);

const SCOPE_SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".output",
  ".tanstack",
  ".impeccable",
  ".git",
  "coverage",
  "target",
  ".extracted",
  "reports",
]);

function walkScopeFiles(dir, collected = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SCOPE_SKIP_DIRS.has(entry.name)) walkScopeFiles(full, collected);
      continue;
    }
    if (
      entry.name === "pnpm-lock.yaml" ||
      entry.name === "Cargo.lock" ||
      /^\.env/i.test(entry.name)
    )
      continue;
    if (SCOPE_TEXT_EXTENSIONS.has(path.extname(entry.name)))
      collected.push(full);
  }
  return collected;
}

// Manifest files are in scope (scripts live there) but their own dependency
// blocks are stripped, so an entry never references itself by declaration.
function scopeTextFor(file) {
  const raw = fs.readFileSync(file, "utf8");
  if (path.extname(file) === ".json") {
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        "dependencies" in parsed
      ) {
        for (const key of [
          "dependencies",
          "devDependencies",
          "peerDependencies",
          "optionalDependencies",
          "resolutions",
          "overrides",
          "pnpm",
        ]) {
          delete parsed[key];
        }
        return JSON.stringify(parsed);
      }
    } catch {
      /* fall through to raw text */
    }
  }
  return raw;
}

// The corpus each manifest is scanned against. The web manifest's scope is
// the web app's code, configs and scripts; the root manifest's is the root
// scripts and workspace configuration; the api manifest's is api/src.
function collectScopeCorpus(scope) {
  const files =
    scope === "web"
      ? [MANIFEST_PATHS.web, ...walkScopeFiles(path.join(REPO_ROOT, "web"))]
      : scope === "root"
        ? [
            MANIFEST_PATHS.root,
            ...walkScopeFiles(path.join(REPO_ROOT, "scripts")),
          ]
        : scope === "api"
          ? walkScopeFiles(path.join(REPO_ROOT, "api", "src"))
          : (() => {
              throw new Error(`unknown reference-scan scope "${scope}"`);
            })();
  return files.map((file) => ({ file, text: scopeTextFor(file) }));
}

function escapeRegExp(text) {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// Word-safe matcher: an identifier-continuation (word char or hyphen) before
// or after the name means a different token; a following '/' is allowed
// (subpath imports like `react-icons/fa`); a preceding '@' '.' or '/' means
// the name is embedded in another package's scoped name and does not count.
function buildNameMatcher(name) {
  return new RegExp(`(?<![\\w@./-])${escapeRegExp(name)}(?![\\w-])`);
}

// Cargo crates are referenced by their underscore form in `use` paths.
function buildCrateMatcher(name) {
  return buildNameMatcher(name.replace(/-/g, "_"));
}

function packageBinNames(packageName, installRoot) {
  const manifestPath = path.join(
    installRoot,
    "node_modules",
    packageName,
    "package.json",
  );
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (typeof manifest.bin === "string") return [path.basename(manifest.bin)];
    if (manifest.bin && typeof manifest.bin === "object")
      return Object.keys(manifest.bin);
  } catch {
    /* not installed or unreadable — the rule simply does not apply */
  }
  return [];
}

// Documented judgment rules, applied in order. Every allowance a rule grants
// is reported by the caller; none of these can hide a genuinely new
// unreferenced dependency (the fixture scenario proves the catch).
const REFERENCE_RULES = [
  {
    id: "scoped-types-ride-their-runtime-package",
    applies: (entry) => /^@types\/(.+)$/.exec(entry.name) !== null,
    reason: (entry, corpus) => {
      const base = entry.name.slice("@types/".length);
      const matcher = buildNameMatcher(base);
      const hit = corpus.some(({ text }) => matcher.test(text));
      return hit ? `types for ${base}, which is referenced in scope` : null;
    },
  },
  {
    id: "script-invokes-its-bin",
    applies: () => true,
    reason: (entry, corpus) => {
      const installRoot =
        entry.manifest === "web" ? path.join(REPO_ROOT, "web") : REPO_ROOT;
      for (const bin of packageBinNames(entry.name, installRoot)) {
        const matcher = buildNameMatcher(bin);
        if (corpus.some(({ text }) => matcher.test(text))) {
          return `its bin command "${bin}" is invoked by the workspace scripts`;
        }
      }
      return null;
    },
  },
];

// Explicit, per-package allowances. Each is printed on every run; two are
// flagged as removal candidates for a later review.
const REFERENCE_ALLOWANCES = {
  "web:react-dom":
    "framework hydration pair: TanStack Start (referenced) imports react-dom during SSR/hydration; app code imports react only",
  "web:@types/react-dom":
    "types for react-dom (see the react-dom judgment above)",
  "web:@types/node":
    "ambient node types for toolchain configs; no direct name reference in the web scope — removal candidate",
  "web:typescript":
    "the compiler/type-checker for the .ts/.tsx corpus (referenced via @typescript-eslint rules in eslint.config.js); its exact 6.0.3 pin is ADR-0001's deferred-TypeScript-7 record",
  "api:serde_json":
    "implicit serialization backend for axum::Json and the { success, message, data } envelope; no name reference in api/src — removal candidate",
};

// Scans one manifest's entries against its scope corpus.
// Result: { referenced, judged: [{ name, reason }], unreferenced }.
function scanManifestReferences(manifestName, entries, { corpus } = {}) {
  const scopeCorpus = corpus ?? collectScopeCorpus(manifestName);
  const referenced = [];
  const judged = [];
  const unreferenced = [];

  for (const entry of entries) {
    const matcher =
      manifestName === "api"
        ? buildCrateMatcher(entry.name)
        : buildNameMatcher(entry.name);
    if (scopeCorpus.some(({ text }) => matcher.test(text))) {
      referenced.push(entry.name);
      continue;
    }
    let reason = null;
    for (const rule of REFERENCE_RULES) {
      if (rule.applies(entry)) {
        reason = rule.reason(entry, scopeCorpus);
        if (reason) break;
      }
    }
    if (!reason) {
      reason = REFERENCE_ALLOWANCES[`${manifestName}:${entry.name}`] ?? null;
    }
    if (reason) {
      judged.push({ name: entry.name, reason });
    } else {
      unreferenced.push(entry.name);
    }
  }
  return { referenced, judged, unreferenced };
}

// ---------------------------------------------------------------------------
// Lockfile-vs-range
// ---------------------------------------------------------------------------

// Minimal indentation parser for pnpm-lock.yaml's `importers:` block
// (lockfileVersion 9). Scoped names are single-quoted; values are plain.
// Any unexpected line fails loudly rather than mis-reporting satisfaction.
function parsePnpmImporters(lockText) {
  const lines = lockText.split(/\r?\n/);
  const importers = {};
  let inImporters = false;
  let importer = null;
  let section = null;
  let pkg = null;

  const unkey = (text) => text.replace(/:$/, "").replace(/^['"]|['"]$/g, "");
  const unquote = (text) => text.trim().replace(/^['"]|['"]$/g, "");

  for (const line of lines) {
    if (!inImporters) {
      if (/^importers:\s*$/.test(line)) inImporters = true;
      continue;
    }
    if (/^\S/.test(line)) break; // next top-level block (packages:)
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (indent === 2 && /:\s*\{\}\s*$/.test(trimmed)) {
      // An importer with no dependencies at all (the root, once it stopped
      // declaring any) is written inline as `.: {}`.
      importer = trimmed.slice(0, trimmed.indexOf(":")).trim();
      importers[importer] = {};
      section = null;
      pkg = null;
    } else if (indent === 2 && trimmed.endsWith(":")) {
      importer = unkey(trimmed);
      importers[importer] = {};
      section = null;
      pkg = null;
    } else if (indent === 4 && trimmed.endsWith(":")) {
      section = unkey(trimmed);
      if (!importers[importer]) importers[importer] = {};
      importers[importer][section] = {};
      pkg = null;
    } else if (indent === 6 && trimmed.endsWith(":")) {
      pkg = unkey(trimmed);
      importers[importer][section][pkg] = {};
    } else if (indent === 8) {
      const field = /^(\w+):\s*(.*)$/.exec(trimmed);
      if (!pkg || !field) {
        throw new Error(
          `parsePnpmImporters: unexpected pnpm-lock.yaml line: "${line}"`,
        );
      }
      importers[importer][section][pkg][field[1]] = unquote(field[2]);
    } else {
      throw new Error(
        `parsePnpmImporters: unexpected pnpm-lock.yaml line: "${line}"`,
      );
    }
  }
  if (!inImporters) {
    throw new Error(
      "parsePnpmImporters: no importers: block in pnpm-lock.yaml",
    );
  }
  return importers;
}

// pnpm records resolved versions with peer-suffix annotations:
// `1.3.2(react@19.3.1)` — strip everything from the first '('.
function stripPnpmPeerSuffix(version) {
  return version.replace(/\(.*/, "").trim();
}

// Cargo caret semantics, as the repo uses them: declared "X" →
// >=X.0.0 <(X+1).0.0; declared "X.Y" with X = 0 → >=0.Y.0 <0.(Y+1).0;
// declared "X.Y" with X ≥ 1 → >=X.Y.0 <(X+1).0.0 (minor is free above 1.0).
function cargoRangeSatisfies(lockVersion, declared) {
  const version = semver.parse(lockVersion);
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(declared).trim());
  if (!version || !match) return false;
  const major = Number(match[1]);
  const minor = match[2] !== undefined ? Number(match[2]) : null;
  const patch = match[3] !== undefined ? Number(match[3]) : null;
  if (version.major !== major) return false;
  const floor = `${major}.${minor ?? 0}.${patch ?? 0}`;
  if (semver.lt(version, floor)) return false;
  if (major === 0 && minor !== null) return version.minor === minor;
  return true;
}

// [package] blocks of Cargo.lock: name → version.
function parseCargoLockPackages(lockText) {
  const packages = {};
  let inPackage = false;
  let current = null;
  for (const line of lockText.split(/\r?\n/)) {
    if (/^\[\[?package\]\]?\s*$/.test(line)) {
      inPackage = true;
      current = null;
      continue;
    }
    if (line.startsWith("[")) {
      inPackage = false;
      continue;
    }
    if (!inPackage) continue;
    const nameMatch = /^name\s*=\s*"([^"]+)"/.exec(line);
    if (nameMatch) {
      current = nameMatch[1];
      packages[current] = null;
      continue;
    }
    const versionMatch = /^version\s*=\s*"([^"]+)"/.exec(line);
    if (versionMatch && current) {
      packages[current] = versionMatch[1];
    }
  }
  return packages;
}

// ---------------------------------------------------------------------------
// Accepted-ADR policy scan
// ---------------------------------------------------------------------------

function loadAcceptedAdrs() {
  const adrDir = path.join(REPO_ROOT, "adr");
  const files = fs
    .readdirSync(adrDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(adrDir, name));
  const accepted = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const status = /^[-*]\s*Status:\s*(\w+)/im.exec(text);
    if (status && status[1].toLowerCase() === "accepted") {
      accepted.push({ file: path.relative(REPO_ROOT, file), text });
    }
  }
  return accepted;
}

// Finds the accepted record that states the explicit-range rule and the
// per-major review rule, plus every deferred major with the sentence that
// reopens it.
function scanDependencyPolicyAdr() {
  const accepted = loadAcceptedAdrs();
  const report = { acceptedCount: accepted.length, record: null, majors: [] };

  const explicitRange =
    /explicit (?:caret )?(?:constraint|range)|names an explicit constraint/i;
  const noDistTag = /No `latest` or other dist-tag/i;
  const perMajorReview = /major upgrade is its own reviewed step/i;

  for (const adr of accepted) {
    if (
      (explicitRange.test(adr.text) || noDistTag.test(adr.text)) &&
      perMajorReview.test(adr.text)
    ) {
      report.record = adr;
      break;
    }
  }
  if (!report.record) return report;

  // Every deferred major must appear with the condition that reopens it.
  const conditionMarker =
    /adopted in|dedicated|reopen|revisit|condition|until|when|before/i;
  const seen = new Set();
  const deferralPattern =
    /([A-Za-z][\w.+#]*(?:\s+[A-Za-z][\w.+#]*)*?\s+\d+(?:\.\d+)?)\s+is deferred/gi;
  let match;
  while ((match = deferralPattern.exec(report.record.text)) !== null) {
    const major = match[1];
    if (seen.has(major)) continue;
    seen.add(major);
    // The condition must live in the same sentence (split at the period).
    const after = report.record.text.slice(match.index);
    const sentence = after.split(".")[0];
    report.majors.push({
      major,
      reopeningCondition: conditionMarker.test(sentence)
        ? sentence.trim()
        : null,
    });
  }
  return report;
}

module.exports = {
  MANIFEST_PATHS,
  loadManifests,
  loadAcceptedAdrs,
  collectDirectEntries,
  cargoDirectDependencies,
  isDistTag,
  isConcreteJsRange,
  isConcreteCargoRange,
  entryIsConcrete,
  collectScopeCorpus,
  scanManifestReferences,
  parsePnpmImporters,
  stripPnpmPeerSuffix,
  cargoRangeSatisfies,
  parseCargoLockPackages,
  scanDependencyPolicyAdr,
  buildNameMatcher,
  buildCrateMatcher,
};
