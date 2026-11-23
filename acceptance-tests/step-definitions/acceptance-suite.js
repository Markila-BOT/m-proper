'use strict';

// Step definitions for the acceptance-suite capability: the harness's own
// scenarios. Each describes the suite itself and is implemented honestly —
// a child run proves the single command, a throwaway probe proves the
// unfenced-spec failure, a dry run proves supersession, the live run proves
// the app lifecycle, and the recorded ADR plus the OpenSpec config carry the
// archive gate.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { Given, When, Then } = require('@cucumber/cucumber');

const { extractAll, extractFile } = require('../extract-gherkin.cjs');
const { effectivePaths } = require('../openspec-effective-paths.cjs');
const {
  REPO_ROOT,
  state,
  delay,
  probeTcpPort,
  runCommand,
  registerPostTeardownCheck,
  tailOf,
} = require('../support/harness');
const { parseMessages, summarizeCases } = require('../support/cucumber-messages');
const { removeScenarioSmokeRows, clearScenarioBrowserState } = require('../support/cleanup');
const { requirePage } = require('../pages/browser');
const shell = require('../pages/app-shell');
const ledgerView = require('../pages/ledger-view');

const HARNESS_DIR = path.join(REPO_ROOT, 'acceptance-tests');
// The suite's own capability is a main spec now (adopt-acceptance-suite was
// archived), so the self feature lives under .extracted/specs/, not under a
// change's delta path.
const SELF_FEATURE_MARKER = 'specs/acceptance-suite/';

async function git(args) {
  return runCommand('git', args, { cwd: REPO_ROOT, timeoutMs: 30_000 });
}

// Scenario headings of the given effective path entries, honoring the
// line-targeted entries (feature:line:line…) that supersession produces.
function scenarioSummaries(featurePathEntries) {
  const summaries = [];
  for (const entry of featurePathEntries) {
    const match = /^(.*\.feature)(?::([\d:]+))?$/.exec(entry);
    assert.ok(match, `unrecognized feature path entry: ${entry}`);
    const [, featurePath, linesPart] = match;
    const keepLines = linesPart
      ? new Set(linesPart.split(':').filter(Boolean).map(Number))
      : null;
    const featureText = fs.readFileSync(path.join(HARNESS_DIR, featurePath), 'utf8');
    const lines = featureText.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const heading = /^\s*Scenario(?: Outline)?:\s*(.+?)\s*$/.exec(line);
      if (!heading) return;
      if (keepLines && !keepLines.has(idx + 1)) return;
      const summary = `${featurePath}::${heading[1]}`;
      // A plain Scenario is one test case. A Scenario Outline is one test
      // case per Examples data row (the first table row is the header), so
      // the expected set must expand it the same way cucumber does.
      if (!/^\s*Scenario\s+Outline:/.test(line)) {
        summaries.push(summary);
        return;
      }
      let inExamples = false;
      let headerSeen = false;
      let dataRows = 0;
      for (let next = idx + 1; next < lines.length; next += 1) {
        const row = lines[next];
        if (/^\s*Scenario(?:\s+Outline)?:/.test(row)) break;
        if (/^\s*Examples:/.test(row)) {
          inExamples = true;
          continue;
        }
        if (!inExamples || !/^\s*\|/.test(row)) continue;
        if (!headerSeen) {
          headerSeen = true;
          continue;
        }
        dataRows += 1;
      }
      for (let n = 0; n < dataRows; n += 1) summaries.push(summary);
    });
  }
  return summaries.sort();
}

// ---------------------------------------------------------------------------
// One command runs every committed behavior
// ---------------------------------------------------------------------------

Given('the main specs are fenced and committed', async function () {
  // Every main spec, including this suite's own capability (it became a main
  // spec when adopt-acceptance-suite was archived).
  const mainSpecs = ['properties', 'web-app', 'dependency-maintenance', 'acceptance-suite'].map(
    (capability) => path.join('openspec', 'specs', capability, 'spec.md')
  );
  for (const relativePath of mainSpecs) {
    const absolutePath = path.join(REPO_ROOT, relativePath);
    assert.ok(fs.existsSync(absolutePath), `${relativePath} is missing`);
    const dirty = await git(['status', '--porcelain', '--', relativePath]);
    assert.strictEqual(dirty.code, 0, `git status failed:\n${tailOf(dirty.stderr)}`);
    assert.strictEqual(
      dirty.stdout.trim(),
      '',
      `${relativePath} must be at its committed state; git reports:\n${dirty.stdout.trim()}`
    );
    // Fenced: extracting this very spec succeeds — an unfenced scenario
    // heading is a hard extraction error — and its steps reach the output.
    const feature = extractFile(absolutePath);
    assert.match(feature, /^Feature: /, `${relativePath} must extract a Feature heading`);
    assert.ok(
      /^(?:Given|When|Then|And|But) /m.test(feature),
      `${relativePath} extracted no gherkin steps — is it fenced?`
    );
  }
});

When('the landlord runs the single test command', async function () {
  // The suite-minus-self child run: the single test command's effective
  // scenario set minus this acceptance-suite feature itself (a suite cannot
  // verify itself by recursing), booted on offset ports so the child cannot
  // collide with this parent run. suite-minus-self.cjs holds the exact
  // composition; the README documents the doubled runtime cost.
  const childPorts = {
    api: state.apiPort + 10,
    web: state.webPort + 10,
    openapi: state.openapiPort + 10,
  };
  const startedAt = Date.now();
  const child = await runCommand('npx', ['cucumber-js', '--config', 'suite-minus-self.cjs'], {
    cwd: HARNESS_DIR,
    timeoutMs: 20 * 60_000,
    env: {
      ...process.env,
      HARNESS_API_PORT: String(childPorts.api),
      HARNESS_WEB_PORT: String(childPorts.web),
      HARNESS_OPENAPI_PORT: String(childPorts.openapi),
    },
  });
  const messagesPath = path.join(HARNESS_DIR, 'reports', 'suite-minus-self-messages.ndjson');
  const reportPath = path.join(HARNESS_DIR, 'reports', 'suite-minus-self-report.html');
  const cases = parseMessages(fs.readFileSync(messagesPath, 'utf8'));

  this.suiteMinusSelfRun = { child, cases, messagesPath, reportPath, childPorts, durationMs: Date.now() - startedAt };
  // Stash for the later self-scenarios in this feature (they run after this
  // scenario; cucumber executes a feature's scenarios in order).
  state.suiteMinusSelf = this.suiteMinusSelfRun;
  console.log(
    `[self] suite-minus-self child run: ${summarizeCases(cases)} in ` +
      `${Math.round(this.suiteMinusSelfRun.durationMs / 1000)}s ` +
      `(parent ports ${state.apiPort}/${state.webPort}, child ports ${childPorts.api}/${childPorts.web})`
  );
});

Then('every scenario of the effective spec executes with no pending or undefined steps', async function () {
  const { child, cases } = this.suiteMinusSelfRun;

  // Every scenario of the effective spec (minus this self feature)
  // executes — nothing lost, nothing extra.
  const expected = scenarioSummaries(effectivePaths().filter((entry) => !entry.includes(SELF_FEATURE_MARKER)));
  const executed = cases.map((testCase) => `${testCase.uri}::${testCase.name}`).sort();
  assert.deepStrictEqual(
    executed,
    expected,
    'the child run must execute exactly the effective spec minus this self feature'
  );

  // No pending or undefined steps anywhere.
  for (const testCase of cases) {
    assert.ok(
      !['UNDEFINED', 'PENDING', 'AMBIGUOUS'].includes(testCase.status),
      `"${testCase.name}" ended ${testCase.status} — every step must be defined ` +
        `(step statuses: ${testCase.stepStatuses.join(', ')})`
    );
  }

  // Nothing fails: the archived redesign-ledger-passbook scenarios (running
  // balance, column sorting) run green from the main spec like everything
  // else, so the single command must exit clean.
  const failed = cases.filter((testCase) => testCase.status === 'FAILED').map((testCase) => testCase.name);
  assert.deepStrictEqual(
    failed,
    [],
    `the child run must fail on nothing — the archived redesign-ledger-passbook scenarios ` +
      `run green from the main spec, and any failure is a regression (failures were: ${failed.join(', ')})`
  );
  assert.strictEqual(
    child.code,
    0,
    `the child run's exit code must be clean (got ${child.code})`
  );
});

Then('a run report records what ran', async function () {
  const { reportPath, cases } = this.suiteMinusSelfRun;
  assert.ok(fs.existsSync(reportPath), `the child run must write its report at ${path.relative(REPO_ROOT, reportPath)}`);
  const report = fs.readFileSync(reportPath, 'utf8');
  assert.ok(report.length > 100_000, 'the report must carry the full run, not a stub');
  // Records what ran: the kept web-app scenarios and the redesign's
  // running-balance scenario alike.
  assert.ok(
    report.includes('View properties from API'),
    'the report must record the executed web-app scenarios'
  );
  assert.ok(
    report.includes('The ledger shows a running balance'),
    'the report must record the archived redesign-ledger-passbook scenarios too ' +
      '(they run from the main spec)'
  );
  const summaryLine = summarizeCases(cases);
  console.log(`[self] the child report records the run — ${summaryLine}`);
});

// ---------------------------------------------------------------------------
// An unfenced scenario fails the run loudly
// ---------------------------------------------------------------------------

Given('a spec whose scenario heading has no gherkin fence', async function () {
  // A throwaway change dir holding one spec whose scenario heading has no
  // gherkin fence. It is created here and removed completely in the When's
  // finally — the committed tree never carries it.
  const changeDir = path.join(REPO_ROOT, 'openspec', 'changes', '__unfenced_probe__');
  this.unfencedProbe = {
    changeDir,
    specPath: path.join(changeDir, 'specs', 'probe-capability', 'spec.md'),
    relativeSpecPath: path.join(
      'openspec',
      'changes',
      '__unfenced_probe__',
      'specs',
      'probe-capability',
      'spec.md'
    ),
    scenarioLine: 7,
    outDir: path.join(HARNESS_DIR, '.extracted', 'unfenced-probe'),
  };
  fs.mkdirSync(path.dirname(this.unfencedProbe.specPath), { recursive: true });
  fs.writeFileSync(
    this.unfencedProbe.specPath,
    [
      '# probe-capability',
      '',
      '## ADDED Requirements',
      '',
      '### Requirement: Probe requirement',
      '',
      '#### Scenario: Unfenced probe',
      '',
      'This scenario heading deliberately has no gherkin fence after it, so the',
      'extractor must refuse the whole tree and name this file and line.',
      '',
    ].join('\n')
  );
});

When('extraction runs', async function () {
  try {
    // Extract the openspec tree (the probe included) into a scratch outDir
    // of its own, so the parent run's .extracted is never the casualty. A
    // fully fenced tree would extract cleanly; the probe must break it.
    this.unfencedExtraction = await runCommand(
      'node',
      ['extract-gherkin.cjs', '../openspec', '.extracted/unfenced-probe'],
      { cwd: HARNESS_DIR, timeoutMs: 60_000 }
    );
  } finally {
    // The throwaway probe never survives the scenario — not even when the
    // assertions below fail (which would itself be a harness bug).
    fs.rmSync(this.unfencedProbe.changeDir, { recursive: true, force: true });
    fs.rmSync(this.unfencedProbe.outDir, { recursive: true, force: true });
  }
});

Then('the run fails naming that spec file and line', async function () {
  const { code, stderr, stdout } = this.unfencedExtraction;
  assert.notStrictEqual(
    code,
    0,
    'extraction must fail when a scenario heading has no gherkin fence — it exited 0'
  );
  const output = `${stderr}\n${stdout}`;
  assert.ok(
    output.includes(this.unfencedProbe.relativeSpecPath) &&
      output.includes(`:${this.unfencedProbe.scenarioLine}:`),
    `the failure must name the spec file and line ` +
      `("${this.unfencedProbe.relativeSpecPath}:${this.unfencedProbe.scenarioLine}"), got:\n${tailOf(output)}`
  );
  assert.ok(
    output.includes('gherkin fence'),
    `the failure must say what is wrong (a missing gherkin fence), got:\n${tailOf(output)}`
  );
  console.log('[self] an unfenced scenario fails extraction loudly — the probe is removed again');
});

// ---------------------------------------------------------------------------
// Superseded rules never reach the runner
// ---------------------------------------------------------------------------

// Scenario names under one requirement of a main spec, in order.
function scenarioNamesOfRequirement(specPath, requirementName) {
  const lines = fs.readFileSync(specPath, 'utf8').split(/\r?\n/);
  const names = [];
  let inRequirement = false;
  for (const line of lines) {
    const requirement = /^###\s+Requirement:\s*(.+?)\s*$/.exec(line);
    if (requirement) {
      inRequirement = requirement[1] === requirementName;
      continue;
    }
    // Any other heading ends the requirement; a #### Scenario is matched below.
    if (/^#{1,3}\s+/.test(line)) {
      inRequirement = false;
      continue;
    }
    if (!inRequirement) continue;
    const scenario = /^####\s+Scenario(?:\s+Outline)?:\s*(.+?)\s*$/.exec(line);
    if (scenario) names.push(scenario[1]);
  }
  return names;
}

Given('an active change replaces a requirement of a main spec', async function () {
  // Supersession is a mechanism, not a property of whichever change happens
  // to be active. The suite builds a throwaway active change that marks a
  // real main requirement MODIFIED, so the proof never depends on a change's
  // name — and the probe is removed in the When's finally, before any
  // assertion runs, so a failing assertion cannot leak it into the tree.
  const requirement = 'Client-side transactions retained';
  const deltaScenario = 'Transactions survive reload (superseded probe)';
  const mainPath = path.join(REPO_ROOT, 'openspec', 'specs', 'web-app', 'spec.md');
  const changeDir = path.join(REPO_ROOT, 'openspec', 'changes', '__superseded_probe__');
  const deltaPath = path.join(changeDir, 'specs', 'web-app', 'spec.md');

  assert.ok(fs.existsSync(mainPath), 'the main web-app spec is missing');
  const mainNames = requirementNames(mainPath, {});
  assert.ok(
    mainNames.includes(requirement),
    `the probe must supersede a real main-spec rule (missing: ${requirement})`
  );
  const mainScenarioNames = scenarioNamesOfRequirement(mainPath, requirement);
  assert.ok(mainScenarioNames.length > 0, `the superseded rule "${requirement}" must carry a scenario`);

  this.supersededProbe = {
    changeDir,
    requirement,
    deltaScenario,
    mainScenarioNames,
    mainUri: '.extracted/specs/web-app/spec.feature',
    deltaUri: '.extracted/changes/__superseded_probe__/specs/web-app/spec.feature',
  };

  fs.rmSync(changeDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(deltaPath), { recursive: true });
  fs.writeFileSync(
    deltaPath,
    [
      '# web-app',
      '',
      '## MODIFIED Requirements',
      '',
      `### Requirement: ${requirement}`,
      '',
      'Transactions are retained client-side. This throwaway delta exists only',
      'to prove the supersession mechanism: the suite rewrites this rule,',
      'extracts the tree, and checks that the main version never reaches the',
      'runner.',
      '',
      `#### Scenario: ${deltaScenario}`,
      '',
      '```gherkin',
      'Given the user has recorded transactions and reloads the application',
      'Then those transactions are still available in the UI',
      '```',
      '',
    ].join('\n')
  );
});

function requirementNames(specPath, { section }) {
  const lines = fs.readFileSync(specPath, 'utf8').split(/\r?\n/);
  const names = [];
  let inSection = !section;
  for (const line of lines) {
    const deltaHeading = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i.exec(line);
    if (deltaHeading) {
      inSection = section ? deltaHeading[1].toUpperCase() === section : true;
      continue;
    }
    const requirement = /^###\s+Requirement:\s*(.+?)\s*$/.exec(line);
    if (requirement && inSection) names.push(requirement[1]);
  }
  return names;
}

When('the suite runs', async function () {
  // A dry run discovers exactly what a real run would execute — same
  // effective paths, no boots, no steps. Its message stream is joined to
  // the composition report on stderr.
  const probe = this.supersededProbe;
  const messagesPath = path.join(HARNESS_DIR, 'reports', 'superseded-check-messages.ndjson');
  let dryRun;
  let discovered;
  let leftOut;
  let expected;
  try {
    dryRun = await runCommand(
      'npx',
      ['cucumber-js', '--config', 'suite-discovery.cjs', '--dry-run'],
      { cwd: HARNESS_DIR, timeoutMs: 120_000 }
    );
    discovered = parseMessages(fs.readFileSync(messagesPath, 'utf8'));

    // The composition report names each superseded rule and every left-out
    // scenario with its spec.md file:line.
    leftOut = [];
    for (const line of `${dryRun.stderr}\n${dryRun.stdout}`.split(/\r?\n/)) {
      const entry = /\[effective-spec\]\s+left out:\s+(.*?)\s+\((.*?spec\.md):(\d+)\)/.exec(line);
      if (entry) leftOut.push({ name: entry[1], specMd: entry[2], line: Number(entry[3]) });
    }

    // Captured while the probe is still in the tree: the delta version is
    // part of the effective set and the main version is not. The Thens
    // compare the dry run against this snapshot after cleanup.
    expected = scenarioSummaries(effectivePaths());
  } finally {
    // The throwaway probe never survives the scenario — not even when an
    // assertion below fails. Re-extracting restores .extracted to the
    // committed tree's composition.
    fs.rmSync(probe.changeDir, { recursive: true, force: true });
    extractAll();
  }
  this.supersededCheck = { dryRun, discovered, leftOut, expected };
});

// The composition report prints the left-out scenarios relative to
// acceptance-tests (../openspec/...); the runner's feature uris are the
// extracted counterparts (.extracted/...).
function featureUriOfSpecMd(specMd) {
  return specMd.replace(/^(\.\.\/)?openspec\//, '.extracted/').replace(/spec\.md$/, 'spec.feature');
}

Then('the replaced version of that requirement is not executed', async function () {
  const { discovered, leftOut } = this.supersededCheck;
  const probe = this.supersededProbe;
  assert.ok(leftOut.length > 0, 'the composition report must name the superseded scenarios it left out');

  // Every main scenario of the superseded rule is named as left out...
  for (const name of probe.mainScenarioNames) {
    assert.ok(
      leftOut.some(
        (entry) => entry.name === name && entry.specMd.endsWith('specs/web-app/spec.md')
      ),
      `the composition report must name the superseded main scenario "${name}" ` +
        `(left out: ${leftOut.map((entry) => entry.name).join(', ') || 'none'})`
    );
  }

  // ...and none of them reaches the runner, under any status.
  for (const name of probe.mainScenarioNames) {
    assert.deepStrictEqual(
      discovered.filter((testCase) => testCase.uri === probe.mainUri && testCase.name === name),
      [],
      `the superseded scenario "${name}" (${probe.mainUri}) must not be executed by the suite`
    );
  }

  // The delta version is what runs instead.
  assert.ok(
    discovered.some(
      (testCase) => testCase.uri === probe.deltaUri && testCase.name === probe.deltaScenario
    ),
    `the replacement scenario "${probe.deltaScenario}" must run from the active change's delta`
  );

  // And the generic left-out set is absent too.
  for (const { name, specMd } of leftOut) {
    const uri = featureUriOfSpecMd(specMd);
    assert.deepStrictEqual(
      discovered.filter((testCase) => testCase.uri === uri && testCase.name === name),
      [],
      `the superseded scenario "${name}" (${uri}) must not be executed by the suite`
    );
  }
  console.log(`[self] ${leftOut.length} superseded scenario(s) stayed out of the runner`);
});

Then('it is not reported as skipped', async function () {
  const { discovered, leftOut, dryRun, expected } = this.supersededCheck;
  // Absent, not skipped: no test case exists for any left-out scenario —
  // under any status.
  for (const { name, specMd } of leftOut) {
    const uri = featureUriOfSpecMd(specMd);
    const present = discovered.filter((testCase) => testCase.uri === uri && testCase.name === name);
    assert.deepStrictEqual(
      present,
      [],
      `"${name}" must not appear as a skipped (or any-status) scenario — supersession excludes it entirely`
    );
  }
  // The runner's discovered set is exactly the effective scenario set
  // captured while the probe was in the tree: nothing superseded, nothing
  // lost.
  const discoveredSummaries = discovered
    .map((testCase) => `${testCase.uri}::${testCase.name}`)
    .sort();
  assert.deepStrictEqual(
    discoveredSummaries,
    expected,
    'the dry run must discover exactly the effective scenario set'
  );
  // The stderr composition report states the exclusions itself.
  assert.ok(
    /\d+ source-of-truth scenario\(s\) excluded/.test(dryRun.stderr),
    'the composition report must state how many source-of-truth scenarios were excluded'
  );
});

// ---------------------------------------------------------------------------
// The app is alive for the scenarios and gone after
// ---------------------------------------------------------------------------

Given('the API and the web application are not running', async function () {
  // Before this suite booted anything, its BeforeAll recorded that both
  // harness ports were free: the apps were not running, and what runs now
  // is this suite's own, booted from scratch.
  assert.strictEqual(
    state.portsFreeBeforeBoot,
    true,
    'the harness must have found both ports free before boot — something was already ' +
      'listening on a harness port when the suite started'
  );
  assert.ok(
    state.apiProcess && state.apiProcess.exitCode === null,
    'the API running now must be this suite’s own process'
  );
  assert.ok(
    state.webProcess && state.webProcess.exitCode === null,
    'the web app running now must be this suite’s own process'
  );
  this.suiteStartMode = 'current-run';
});

// Shared between the lifecycle scenario (this very run is the started
// suite) and the missing-connection scenario (a child suite with no
// database configured). Each Given records which start this is.
When('the landlord starts the acceptance suite', async function () {
  if (this.suiteStartMode === 'preflight-child') {
    // The suite's pre-boot gate as a child process: the same preflight the
    // suite's own BeforeAll runs, with no DATABASE_URL in the child's
    // environment and its .env fallback aimed at a file that does not
    // exist. It must fail before any scenario and before any boot.
    this.preflightProbe = await runCommand(
      process.execPath,
      ['support/preflight.js', this.preflightEnvFile],
      { cwd: HARNESS_DIR, timeoutMs: 30_000, env: this.preflightChildEnv }
    );
    return;
  }
  assert.strictEqual(
    this.suiteStartMode,
    'current-run',
    'this When needs a recorded suite start (one of the Given steps must set the mode)'
  );
  // This run is the started suite: the BeforeAll booted both applications,
  // and the Then below asserts they answer right now.
});

Then('both are running while the scenarios execute', async function () {
  // Right now, mid-suite: the API's health tells the truth about the
  // database, and the web app serves its document root.
  const health = await fetch(`${state.apiBaseUrl}/health`, { signal: AbortSignal.timeout(10_000) });
  assert.strictEqual(health.status, 200, `expected /health to answer 200 mid-suite, got ${health.status}`);
  const healthBody = await health.json();
  assert.strictEqual(healthBody.success, true, 'the API must be healthy while the scenarios execute');

  const web = await fetch(state.webBaseUrl, { signal: AbortSignal.timeout(10_000) });
  assert.strictEqual(web.status, 200, `the web app at ${state.webBaseUrl} must answer 200 mid-suite, got ${web.status}`);
  const webBody = await web.text();
  assert.ok(
    /^<!DOCTYPE html>/i.test(webBody.trim()),
    'the web app must serve its document root while the scenarios execute'
  );
});

Then('both are shut down when the run finishes', async function () {
  // The proof lands after the last scenario: this step registers a
  // post-teardown check the harness runs once AfterAll has stopped both
  // processes. It PASSes only when both ports are closed after the
  // teardown; a FAIL prints and marks the run's exit code non-zero (see
  // support/harness.js and the README's post-run verification note).
  registerPostTeardownCheck({
    label: `after teardown both harness ports are closed (${state.apiPort} api, ${state.webPort} web)`,
    check: async () => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const apiClosed = !(await probeTcpPort(state.apiPort));
        const webClosed = !(await probeTcpPort(state.webPort));
        if (apiClosed && webClosed) return true;
        await delay(250);
      }
      return false;
    },
  });
  console.log('[self] registered the post-teardown port check — the harness prints PASS after the run');
});

// ---------------------------------------------------------------------------
// The ledger's browser scenarios run for real
// ---------------------------------------------------------------------------

Given('scenarios that record and reload transactions in the browser', async function () {
  // The suite-minus-self child run executed the web-app feature's current
  // scenarios — the ones that drive the live application through a real
  // browser, recording and reloading transactions along the way.
  const stash = state.suiteMinusSelf;
  assert.ok(
    stash,
    'the suite-minus-self child run must have executed earlier in this feature ' +
      '(scenario "One command runs every committed behavior" runs first)'
  );
  const uri = '.extracted/specs/web-app/spec.feature';
  this.browserScenarioNames = [
    'View properties from API',
    'Create property from UI',
    'Delete property from UI',
    'Transactions survive reload',
    'Configurable API host',
  ];
  for (const name of this.browserScenarioNames) {
    assert.ok(
      stash.cases.some((testCase) => testCase.uri === uri && testCase.name === name),
      `the child run must have executed "${name}"`
    );
  }
});

When('the suite runs them', async function () {
  // The child run already executed them — every step defined, none left
  // undefined or pending.
  const stash = state.suiteMinusSelf;
  assert.ok(
    stash.cases.every(
      (testCase) => testCase.status !== 'UNDEFINED' && testCase.status !== 'PENDING'
    ),
    'no scenario in the child run may end undefined or pending — every step must be defined'
  );
});

Then('each executes against the real web application in a real browser', async function () {
  // The child run booted its own copies of the real applications on its own
  // ports (the same hooks that booted this run) and drove them with a real
  // headless chromium; a passing result proves the execution was real.
  const stash = state.suiteMinusSelf;
  const uri = '.extracted/specs/web-app/spec.feature';
  for (const name of this.browserScenarioNames) {
    const found = stash.cases.find((testCase) => testCase.uri === uri && testCase.name === name);
    assert.ok(found, `"${name}" must be in the child run's results`);
    assert.strictEqual(
      found.status,
      'PASSED',
      `"${name}" must pass against the real web application in a real browser (status ${found.status})`
    );
  }
});

Then('no browser session remains open after the run', async function () {
  // The child run closed its browser and stopped its applications in its
  // own AfterAll before it exited; its ports must be closed right now. A
  // listening port would mean a browser session or a dev server survived.
  const { childPorts } = state.suiteMinusSelf;
  const deadline = Date.now() + 5000;
  let closed = false;
  while (Date.now() < deadline) {
    closed = !(await probeTcpPort(childPorts.api)) && !(await probeTcpPort(childPorts.web));
    if (closed) break;
    await delay(250);
  }
  assert.ok(
    closed,
    `the child run must leave no listener behind (api ${childPorts.api}, web ${childPorts.web}) — ` +
      'a browser session or dev server survived the child run'
  );
});

// ---------------------------------------------------------------------------
// Smoke rows and stored state are gone after the run
// ---------------------------------------------------------------------------

Given('the suite has recorded its own smoke property and seeded browser storage during the run', async function () {
  // Record a smoke property through the API exactly like the suite's other
  // scenarios do — the After-hook cleanup is registered for it.
  const created = await this.postProbeProperty();
  assert.ok(
    created.status === 201 && created.body && created.body.data && created.body.data.id,
    `the smoke property must be recorded through the API (got ${created.status})`
  );
  this.smokeProperty = { id: created.body.data.id, name: created.body.data.name };

  // Seed the app's browser storage from the page, like the browser
  // scenarios do.
  const page = requirePage(this);
  await shell.open(page);
  this.seededStorage = [
    {
      id: `probe-storage-${Date.now()}`,
      date: '2026-11-05',
      description: 'Probe storage sweep transaction',
      category: 'Rent',
      amount: 1000,
      type: 'income',
      property: this.smokeProperty.id,
    },
  ];
  await ledgerView.seedTransactions(page, this.seededStorage);
  assert.deepStrictEqual(
    await ledgerView.storedTransactions(page),
    this.seededStorage,
    'the browser must hold the seeded storage before the cleanup runs'
  );
});

When('the run finishes', async function () {
  // The same cleanup helpers the After hooks run when the run finishes —
  // invoked here so the assertions below prove the real mechanism, not a
  // copy of it.
  await clearScenarioBrowserState(this);
  await removeScenarioSmokeRows(this);
});

Then('the smoke property no longer exists in the ledger', async function () {
  const list = await this.fetchPropertiesListQuiet();
  const rows = list.body && Array.isArray(list.body.data) ? list.body.data : [];
  assert.ok(
    !rows.some((row) => row.id === this.smokeProperty.id),
    `the smoke property "${this.smokeProperty.name}" must be gone from the ledger`
  );
});

Then("the browser's stored state is empty", async function () {
  const stored = await ledgerView.storedTransactions(requirePage(this));
  assert.strictEqual(
    stored,
    null,
    'the app’s transaction storage key must be cleared after the run — the browser’s stored state is empty'
  );
});

// ---------------------------------------------------------------------------
// A missing database connection is named and nothing runs
// ---------------------------------------------------------------------------

Given('the API has no database connection configured', async function () {
  // The contrast: this suite itself resolved a connection at boot. The child
  // below gets none — DATABASE_URL absent, and its .env fallback aimed at a
  // file that does not exist.
  assert.ok(
    state.databaseUrl,
    'this suite resolved a database connection at boot — the contrast that makes the child failure meaningful'
  );
  this.preflightEnvFile = path.join(HARNESS_DIR, '.extracted', 'no-such-api.env');
  assert.ok(!fs.existsSync(this.preflightEnvFile), 'the probe env-file path must not exist');
  const { DATABASE_URL, ...envWithoutDatabaseUrl } = process.env;
  this.preflightChildEnv = envWithoutDatabaseUrl;
  assert.ok(!this.preflightChildEnv.DATABASE_URL, 'the child environment must carry no DATABASE_URL');
  this.suiteStartMode = 'preflight-child';
});

Then('the run fails before any scenario executes', async function () {
  const { code, stderr } = this.preflightProbe;
  assert.notStrictEqual(
    code,
    0,
    'the preflight must fail the run when no database connection is configured'
  );
  assert.ok(
    /refuses to run any scenario/i.test(stderr),
    'the failure must state that the suite refuses to run any scenario'
  );
  // Before booting anything: the preflight is the pre-boot gate, and its
  // output must show no harness boot happened at all.
  assert.ok(
    !stderr.includes('[harness]'),
    'the preflight must fail before the harness boots anything — its output shows a boot line'
  );
});

Then('the failure names the missing configuration', async function () {
  const { stderr } = this.preflightProbe;
  assert.ok(/database connection/i.test(stderr), 'the failure must name the missing database connection');
  assert.ok(/DATABASE_URL/.test(stderr), 'the failure must name the missing configuration variable');
  console.log('[self] the missing-configuration failure names what is absent and nothing runs');
});

// ---------------------------------------------------------------------------
// Archive waits for green
// ---------------------------------------------------------------------------

Given('a change whose effective suite runs green', async function () {
  // The precondition the archive gate waits for, proven by the
  // suite-minus-self child run earlier in this feature: every scenario of
  // the effective spec passes, nothing pending or undefined. (The run that
  // once failed on the redesign-ledger-passbook pair went green when that
  // change landed and its delta was absorbed into the main spec.)
  const stash = state.suiteMinusSelf;
  assert.ok(stash, 'the suite-minus-self child run must have executed earlier in this feature');
  const failing = stash.cases.filter((testCase) => testCase.status !== 'PASSED');
  assert.deepStrictEqual(
    failing.map((testCase) => testCase.name),
    [],
    'the effective suite must run green — every scenario passes, nothing pending or undefined'
  );
});

When('the landlord considers a change ready to archive', async function () {
  // Considering an archive consults the standing gate: the accepted ADR
  // that states it, and the archive guidance the OpenSpec config carries.
  const adrPath = path.join(REPO_ROOT, 'adr', '0002-specs-are-executable-source-of-truth.md');
  const configPath = path.join(REPO_ROOT, 'openspec', 'config.yaml');
  this.archiveGate = {
    adrPath,
    adr: fs.readFileSync(adrPath, 'utf8'),
    configPath,
    config: fs.readFileSync(configPath, 'utf8'),
  };
});

Then('archiving waits until the suite runs green with zero pending steps', async function () {
  const { adr, adrPath, config, configPath } = this.archiveGate;
  assert.match(adr, /^- Status: accepted$/m, `${path.relative(REPO_ROOT, adrPath)} must be accepted`);
  assert.ok(
    /green run with zero pending or undefined steps gates sync and archive/.test(adr),
    `${path.relative(REPO_ROOT, adrPath)} must state the green-run gate`
  );
  assert.ok(
    config.includes('Must run OpenSpec Sync before archiving'),
    `${path.relative(REPO_ROOT, configPath)} archive guidance must carry the sync-before-archive step`
  );
  console.log('[self] the archive gate is recorded and loadable: ADR-0002 accepted, config guidance present');
});
