'use strict';

// Step definitions for the dependency-maintenance capability (the
// adopt-acceptance-suite delta's effective scenarios). These are file- and
// command-level checks against the repository at its committed state; the
// properties round-trip talks HTTP to the running API like the properties
// feature does.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { Given, When, Then } = require('@cucumber/cucumber');
const semver = require('semver');

const {
  REPO_ROOT,
  state,
  delay,
  probeTcpPort,
  spawnHarnessProcess,
  stopSpawnedProcess,
  runCommand,
  tailOf,
} = require('../support/harness');
const {
  MANIFEST_PATHS,
  loadManifests,
  loadAcceptedAdrs,
  collectDirectEntries,
  isDistTag,
  entryIsConcrete,
  scanManifestReferences,
  parsePnpmImporters,
  stripPnpmPeerSuffix,
  cargoRangeSatisfies,
  parseCargoLockPackages,
  scanDependencyPolicyAdr,
} = require('../support/dep-scan');
const { assertEnvelope, assertPropertyRow } = require('../support/api-shapes');

// ---------------------------------------------------------------------------
// git helpers — the "committed state" preconditions and the openapi restore
// ---------------------------------------------------------------------------

async function git(args) {
  return runCommand('git', args, { cwd: REPO_ROOT, timeoutMs: 30_000 });
}

async function gitStatusPorcelain(paths) {
  const result = await git(['status', '--porcelain', '--', ...paths]);
  assert.strictEqual(result.code, 0, `git status failed:\n${tailOf(result.stderr)}`);
  return result.stdout.trim();
}

async function gitShowHead(repoPath) {
  const result = await git(['show', `HEAD:${repoPath}`]);
  if (result.code !== 0) return null;
  return result.stdout;
}

async function gitRestoreHead(repoPath) {
  const result = await git(['restore', '--source=HEAD', '--staged', '--worktree', '--', repoPath]);
  assert.strictEqual(result.code, 0, `git restore failed for ${repoPath}:\n${tailOf(result.stderr)}`);
}

function groupEntriesByManifest(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.manifest)) grouped.set(entry.manifest, []);
    grouped.get(entry.manifest).push(entry);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Manifest scan finds no dist-tags
// ---------------------------------------------------------------------------

Given('the dependency manifests at their committed state', async function () {
  const dirty = await gitStatusPorcelain(['web/package.json', 'api/Cargo.toml', 'package.json']);
  assert.strictEqual(
    dirty,
    '',
    `the dependency manifests must be at their committed state; git reports:\n${dirty}`
  );
  this.manifests = loadManifests();
});

When('a reader scans every direct dependency entry', async function () {
  this.depEntries = collectDirectEntries(this.manifests);
  assert.ok(this.depEntries.length > 0, 'no direct dependency entries were found');
  console.log(
    `[dep-scan] ${this.depEntries.length} direct entries across package.json, web/package.json and api/Cargo.toml`
  );
});

Then('each entry names a concrete version constraint', async function () {
  for (const entry of this.depEntries) {
    assert.ok(
      entry.range !== null && entry.range !== undefined,
      `${entry.manifest} dependency "${entry.name}" declares no version range at all`
    );
    assert.ok(
      entryIsConcrete(entry),
      `${entry.manifest} dependency "${entry.name}" must name a concrete version constraint, got "${entry.range}"`
    );
  }
});

Then('no entry reads latest or another dist-tag', async function () {
  for (const entry of this.depEntries) {
    assert.ok(
      !isDistTag(entry.range),
      `${entry.manifest} dependency "${entry.name}" reads the dist-tag "${entry.range}"`
    );
  }
});

Then("each entry is referenced by the repository's files", async function () {
  const grouped = groupEntriesByManifest(this.depEntries);
  const unreferenced = [];
  for (const [manifestName, entries] of grouped) {
    const result = scanManifestReferences(manifestName, entries);
    for (const { name, reason } of result.judged) {
      console.log(`[dep-scan] judgment: ${manifestName}/${name} — ${reason}`);
    }
    unreferenced.push(...result.unreferenced.map((name) => `${manifestName}:${name}`));
  }
  assert.deepStrictEqual(
    unreferenced,
    [],
    'entries no repository file references (and no reported judgment rule covers): ' +
      unreferenced.join(', ')
  );
});

// ---------------------------------------------------------------------------
// Refreshing a dependency produces a reviewable diff
// ---------------------------------------------------------------------------

Given('the committed lockfiles beside the manifests', async function () {
  const dirty = await gitStatusPorcelain(['pnpm-lock.yaml', 'api/Cargo.lock']);
  assert.strictEqual(
    dirty,
    '',
    `the lockfiles must be at their committed state; git reports:\n${dirty}`
  );
  assert.ok(fs.existsSync(path.join(REPO_ROOT, 'pnpm-lock.yaml')), 'pnpm-lock.yaml is missing');
  assert.ok(fs.existsSync(path.join(REPO_ROOT, 'api', 'Cargo.lock')), 'api/Cargo.lock is missing');
  this.lockfiles = {
    pnpm: fs.readFileSync(path.join(REPO_ROOT, 'pnpm-lock.yaml'), 'utf8'),
    cargo: fs.readFileSync(path.join(REPO_ROOT, 'api', 'Cargo.lock'), 'utf8'),
  };
});

When("a reader compares each direct dependency's resolved version to its manifest range", async function () {
  const manifests = this.manifests ?? loadManifests();
  const entries = collectDirectEntries(manifests);
  const importers = parsePnpmImporters(this.lockfiles.pnpm);
  const cargoPackages = parseCargoLockPackages(this.lockfiles.cargo);

  const pairs = [];
  for (const entry of entries) {
    if (entry.manifest === 'api') {
      pairs.push({
        ...entry,
        kind: 'cargo',
        resolved: cargoPackages[entry.name] ?? null,
      });
      continue;
    }
    const importer = entry.manifest === 'web' ? 'web' : '.';
    const lockEntry = (importers[importer] ?? {})[entry.section]?.[entry.name];
    pairs.push({
      ...entry,
      kind: 'pnpm',
      resolved: lockEntry ? stripPnpmPeerSuffix(lockEntry.version) : null,
      lockSpecifier: lockEntry ? lockEntry.specifier : null,
    });
  }
  this.lockPairs = pairs;
  console.log('[dep-scan] approach: semver.satisfies for pnpm resolved versions; cargo caret semantics (X → <X+1, 0.Y → <0.Y+1) for Cargo');
});

Then('every resolved version satisfies its declared range', async function () {
  for (const pair of this.lockPairs) {
    assert.ok(
      pair.resolved,
      `no resolved version found in the lockfile for ${pair.manifest}:${pair.name}`
    );
    const satisfied =
      pair.kind === 'cargo'
        ? cargoRangeSatisfies(pair.resolved, pair.range)
        : semver.satisfies(pair.resolved, pair.range);
    assert.ok(
      satisfied,
      `${pair.manifest}:${pair.name} resolved ${pair.resolved} does not satisfy its declared range "${pair.range}"`
    );
  }
  console.log(`[dep-scan] all ${this.lockPairs.length} resolved versions satisfy their declared ranges`);
});

Then('the manifest range is what a refresh must keep', async function () {
  // pnpm: the lockfile's importer specifier must still be the manifest's
  // range — a refresh may move resolved versions, never the declared one.
  for (const pair of this.lockPairs.filter((pair) => pair.kind === 'pnpm')) {
    assert.strictEqual(
      pair.lockSpecifier,
      pair.range,
      `pnpm-lock records specifier "${pair.lockSpecifier}" for ${pair.manifest}:${pair.name} but the manifest declares "${pair.range}" — a refresh must keep the manifest range`
    );
  }
  // Cargo.lock records versions only, so the manifest is the sole range
  // authority: assert the manifests still sit at their committed ranges.
  const dirty = await gitStatusPorcelain(['web/package.json', 'api/Cargo.toml', 'package.json']);
  assert.strictEqual(
    dirty,
    '',
    `a lockfile refresh must never rewrite the manifest ranges; git reports:\n${dirty}`
  );
});

// ---------------------------------------------------------------------------
// An unreferenced dependency is caught before it ships
// ---------------------------------------------------------------------------

Given('a direct dependency is declared but no file references it', async function () {
  // A fixture manifest: the web app's dependencies plus one package nothing
  // in the repository references. It lives under .extracted/ (gitignored,
  // wiped per run) so the committed manifests are never touched.
  const fixtureDir = path.join(REPO_ROOT, 'acceptance-tests', '.extracted', 'fixtures');
  fs.mkdirSync(fixtureDir, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATHS.web, 'utf8'));
  const fixtureName = 'acceptance-fixture-unreferenced-package';
  manifest.dependencies[fixtureName] = '^1.0.0';
  this.fixture = {
    name: fixtureName,
    path: path.join(fixtureDir, 'web-fixture-package.json'),
  };
  fs.writeFileSync(this.fixture.path, `${JSON.stringify(manifest, null, 2)}\n`);
});

When('the manifest scan runs', async function () {
  const manifest = JSON.parse(fs.readFileSync(this.fixture.path, 'utf8'));
  const entries = Object.entries(manifest.dependencies).map(([name, range]) => ({
    manifest: 'web',
    section: 'dependencies',
    name,
    range,
  }));
  this.fixtureScan = scanManifestReferences('web', entries);
});

Then('the scan names that dependency', async function () {
  assert.ok(this.fixtureScan, 'the manifest scan has not run');
  assert.deepStrictEqual(
    this.fixtureScan.unreferenced,
    [this.fixture.name],
    `the scan must name exactly the unreferenced dependency, reported: ${JSON.stringify(
      this.fixtureScan.unreferenced
    )}`
  );
});

// ---------------------------------------------------------------------------
// A deferred major migration is discoverable
// ---------------------------------------------------------------------------

Given('the accepted architecture decision records', async function () {
  const accepted = loadAcceptedAdrs();
  assert.ok(accepted.length > 0, 'no accepted architecture decision record found under adr/');
  this.adrs = accepted;
  console.log(`[adr-scan] accepted records: ${accepted.map((adr) => adr.file).join(', ')}`);
});

When('a later change considers a deferred major upgrade', async function () {
  this.policyScan = scanDependencyPolicyAdr();
});

Then('one accepted record states the explicit-range rule and the per-major review rule', async function () {
  assert.ok(
    this.policyScan.record,
    `no accepted record states both the explicit-range rule and the per-major review rule (${this.policyScan.acceptedCount} accepted record(s) scanned)`
  );
  console.log(`[adr-scan] policy record: ${this.policyScan.record.file}`);
});

Then('every deferred major appears there with its reopening condition', async function () {
  assert.ok(
    this.policyScan.majors.length > 0,
    'the policy record states no deferred major with a reopening condition'
  );
  for (const { major, reopeningCondition } of this.policyScan.majors) {
    assert.ok(
      reopeningCondition,
      `deferred major "${major}" appears without the condition that reopens it`
    );
    console.log(`[adr-scan] deferred: ${major} — "${reopeningCondition}"`);
  }
});

// ---------------------------------------------------------------------------
// Regenerated OpenAPI document matches the committed contract
// ---------------------------------------------------------------------------

Given('the API built with its current dependencies', async function () {
  const binaryPath = path.join(REPO_ROOT, 'api', 'target', 'debug', 'api');
  assert.ok(
    fs.existsSync(binaryPath),
    'api/target/debug/api is not built — run `cargo build` in api/ first'
  );
  const committed = await gitShowHead('api/openapi.json');
  assert.ok(committed !== null, 'api/openapi.json must exist at HEAD as the committed contract');
  this.openapi = { binaryPath, committed };
});

When('its OpenAPI document is regenerated', async function () {
  // The binary exports api/openapi.json at startup, before any database
  // work, so a short spawn with a throwaway port regenerates the document.
  const child = spawnHarnessProcess({
    label: 'openapi-regen',
    command: this.openapi.binaryPath,
    args: [],
    cwd: path.join(REPO_ROOT, 'api'),
    env: { ...process.env, PORT: String(state.openapiPort) },
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const listening = await probeTcpPort(state.openapiPort, 1000);
    const exited = child.exitCode !== null || child.signalCode !== null;
    if (listening || exited) break;
    await delay(300);
  }
  await stopSpawnedProcess(child, 'openapi-regen');
});

Then('the regenerated document matches the committed one in paths and schemas', async function () {
  const regenerated = fs.readFileSync(path.join(REPO_ROOT, 'api', 'openapi.json'), 'utf8');
  if (regenerated === this.openapi.committed) {
    return; // byte-identical export → identical paths and schemas
  }
  // Leave the tree as found, then fail with the structural drift named.
  await gitRestoreHead('api/openapi.json');
  assert.fail(summarizeOpenApiDrift(this.openapi.committed, regenerated));
});

// Compact paths/schemas drift report for the failure message.
function summarizeOpenApiDrift(committedText, regeneratedText) {
  const committed = JSON.parse(committedText);
  const regenerated = JSON.parse(regeneratedText);
  const lines = ['regenerating api/openapi.json drifted from the committed contract:'];

  const committedPaths = new Set(Object.keys(committed.paths ?? {}));
  const regeneratedPaths = new Set(Object.keys(regenerated.paths ?? {}));
  for (const added of regeneratedPaths.difference(committedPaths)) {
    lines.push(`  path added:   ${added}`);
  }
  for (const removed of committedPaths.difference(regeneratedPaths)) {
    lines.push(`  path removed: ${removed}`);
  }
  for (const route of committedPaths.intersection(regeneratedPaths)) {
    const before = new Set(Object.keys(committed.paths[route]));
    const after = new Set(Object.keys(regenerated.paths[route]));
    for (const method of after.difference(before)) lines.push(`  method added:   ${method.toUpperCase()} ${route}`);
    for (const method of before.difference(after)) lines.push(`  method removed: ${method.toUpperCase()} ${route}`);
  }

  const committedSchemas = committed.components?.schemas ?? {};
  const regeneratedSchemas = regenerated.components?.schemas ?? {};
  for (const added of new Set(Object.keys(regeneratedSchemas)).difference(new Set(Object.keys(committedSchemas)))) {
    lines.push(`  schema added:   ${added}`);
  }
  for (const removed of new Set(Object.keys(committedSchemas)).difference(new Set(Object.keys(regeneratedSchemas)))) {
    lines.push(`  schema removed: ${removed}`);
  }
  for (const schema of Object.keys(committedSchemas)) {
    if (!regeneratedSchemas[schema]) continue;
    const before = JSON.stringify(committedSchemas[schema]);
    const after = JSON.stringify(regeneratedSchemas[schema]);
    if (before !== after) lines.push(`  schema changed: ${schema}`);
  }
  if (lines.length === 1) lines.push('  (paths and schemas are equal — the drift is elsewhere in the document)');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Properties round-trip through the running API
// ---------------------------------------------------------------------------

Given('the API running against the configured database', async function () {
  const health = await this.checkApiHealth();
  assert.strictEqual(health.status, 200, `expected the running API's /health to answer 200, got ${health.status}`);
  assert.strictEqual(
    health.body && health.body.success,
    true,
    'expected /health success true against the configured database'
  );
});

When('a property is created, listed, and deleted through the API', async function () {
  this.roundTripPayload = this.probePayload({ units: 2 });
  await this.postProperty(this.roundTripPayload);
  const created = this.lastResponse().body && this.lastResponse().body.data;
  assert.ok(created && created.id, 'the create step must return the created property in data');
  this.subjectPropertyId = created.id;

  await this.getPropertiesList();

  await this.deletePropertyById(this.subjectPropertyId);
});

Then('each response carries the success envelope with camelCase fields', async function () {
  assert.strictEqual(this.responses.length, 3, 'create, list, and delete must all have run');
  const [create, list, del] = this.responses;

  const created = assertEnvelope(create, { status: 201, success: true });
  assertPropertyRow(created.data, { label: 'created property' });
  assert.strictEqual(created.data.name, this.roundTripPayload.name, 'created name must match the payload');

  const listed = assertEnvelope(list, { status: 200, success: true });
  assert.ok(Array.isArray(listed.data), 'the list response data must be an array');
  for (const row of listed.data) {
    assertPropertyRow(row, { label: 'listed row' });
  }

  assertEnvelope(del, { status: 200, success: true });
});

Then('the property is gone from the list after the delete', async function () {
  const list = await this.fetchPropertiesListQuiet();
  const rows = (list.body && Array.isArray(list.body.data) ? list.body.data : []).filter(
    (row) => row.id === this.subjectPropertyId
  );
  assert.strictEqual(
    rows.length,
    0,
    `the deleted property ${this.subjectPropertyId} must be gone from the list`
  );
});

// ---------------------------------------------------------------------------
// Build and check commands stay green
// ---------------------------------------------------------------------------

Given('the API at its committed state', async function () {
  const dirty = await gitStatusPorcelain(['api/']);
  assert.strictEqual(dirty, '', `the API must be at its committed state; git reports:\n${dirty}`);
});

When('the API check command runs', async function () {
  this.checkGate = await runCommand('cargo', ['check'], {
    cwd: path.join(REPO_ROOT, 'api'),
    timeoutMs: 420_000,
  });
});

Then('it completes without errors', async function () {
  const { code, stdout, stderr } = this.checkGate;
  assert.strictEqual(code, 0, `cargo check exited ${code}:\n${tailOf(stderr || stdout)}`);
  for (const line of `${stderr}\n${stdout}`.split(/\r?\n/)) {
    assert.ok(
      !/^error(\[|:)/.test(line),
      `cargo check reported an error: ${line}`
    );
  }
});

Given('the web application at its committed state', async function () {
  const dirty = await gitStatusPorcelain(['web/']);
  assert.strictEqual(dirty, '', `the web application must be at its committed state; git reports:\n${dirty}`);
});

When('the web production build runs', async function () {
  this.buildGate = await runCommand('pnpm', ['--filter', 'web', 'build'], {
    cwd: REPO_ROOT,
    timeoutMs: 420_000,
  });
});

Then('the client and server builds complete without errors', async function () {
  const { code, stdout, stderr } = this.buildGate;
  assert.strictEqual(
    code,
    0,
    `pnpm --filter web build exited ${code}:\n${tailOf(stderr || stdout)}`
  );
  const output = `${stderr}\n${stdout}`;
  for (const line of output.split(/\r?\n/)) {
    assert.ok(
      !/(error during build|build failed|✗ \[ERROR\]|ERROR\(.*\):)/i.test(line),
      `the web build reported an error: ${line}`
    );
  }
  // TanStack Start's production build emits both bundles in one command.
  assert.ok(
    /client/i.test(output) && /server/i.test(output),
    'the build output must mention both the client and server bundles'
  );
});
