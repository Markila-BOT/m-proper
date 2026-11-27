'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { globSync } = require('glob');

const RULE_RE = /^\s*Rule:\s*(.+)$/;
const MARKER_RE = /@openspec:\s*(ADDED|MODIFIED|REMOVED|RENAMED)/;
const SCENARIO_RE = /^\s*Scenario(?: Outline)?:\s*(.*)$/;

function readLines(featurePath) {
  return fs.readFileSync(path.resolve(__dirname, featurePath), 'utf8').split(/\r?\n/);
}

function sourceOf(featurePath) {
  return featurePath.replace(/^\.extracted\//, '../openspec/').replace(/spec\.feature$/, 'spec.md');
}

function capabilityOf(featurePath) {
  const parts = featurePath.split('/');
  return parts[parts.lastIndexOf('specs') + 1];
}

function changeIdOf(deltaPath) {
  const parts = deltaPath.split('/');
  return parts[parts.indexOf('changes') + 1];
}

function collectSupersededRules(deltaPaths) {
  const superseded = new Map();
  for (const deltaPath of deltaPaths) {
    const capability = capabilityOf(deltaPath);
    const changeId = changeIdOf(deltaPath);
    let pendingOp = null;
    for (const line of readLines(deltaPath)) {
      const marker = MARKER_RE.exec(line);
      if (marker) {
        pendingOp = marker[1];
        continue;
      }
      const rule = RULE_RE.exec(line);
      if (!rule) continue;
      const name = rule[1].trim();
      if (pendingOp === 'MODIFIED' || pendingOp === 'REMOVED') {
        if (!superseded.has(capability)) superseded.set(capability, new Map());
        const byRule = superseded.get(capability);
        const otherChange = byRule.get(name);
        if (otherChange && otherChange !== changeId) {
          throw new Error(
            `Active changes "${otherChange}" and "${changeId}" both supersede rule "${name}" of capability "${capability}".`
          );
        }
        byRule.set(name, changeId);
      }
    }
  }
  return superseded;
}

function filterSourceOfTruthSpec(specPath, supersededByRule) {
  const seenRules = new Set();
  const keptScenarioLines = [];
  const excluded = [];
  let currentExclusion = null;
  readLines(specPath).forEach((line, idx) => {
    const rule = RULE_RE.exec(line);
    if (rule) {
      const name = rule[1].trim();
      seenRules.add(name);
      if (supersededByRule.has(name)) {
        currentExclusion = { rule: name, changeId: supersededByRule.get(name), scenarios: [] };
        excluded.push(currentExclusion);
      } else {
        currentExclusion = null;
      }
      return;
    }
    const scenario = SCENARIO_RE.exec(line);
    if (!scenario) return;
    if (currentExclusion) {
      currentExclusion.scenarios.push({ name: scenario[1].trim() || '(unnamed scenario)', line: idx + 1 });
    } else {
      keptScenarioLines.push(idx + 1);
    }
  });
  if (excluded.length === 0) return { entry: specPath, seenRules, excluded };
  if (keptScenarioLines.length === 0) return { entry: null, seenRules, excluded };
  return { entry: `${specPath}:${keptScenarioLines.join(':')}`, seenRules, excluded };
}

function printCompositionReport(exclusions) {
  let leftOut = 0;
  for (const { specPath, capability, rules } of exclusions) {
    for (const { rule, changeId, scenarios } of rules) {
      console.error(`[effective-spec] ${capability} / Rule: ${rule}`);
      console.error(`[effective-spec]   superseded by change: ${changeId}`);
      for (const { name, line } of scenarios) {
        console.error(`[effective-spec]   left out: ${name} (${sourceOf(specPath)}:${line})`);
        leftOut += 1;
      }
    }
  }
  console.error(`[effective-spec] ${leftOut} source-of-truth scenario(s) excluded; delta versions run from openspec/changes/`);
}

// The run's change scope. Unset (the default) means the full effective spec:
// every active change's delta applied. HARNESS_CHANGE=<change-id> narrows the
// run to the source-of-truth specs plus that one change's delta, so a change
// can be verified before the other active changes' scenarios exist. An empty
// value (HARNESS_CHANGE="") is the same as unset.
function requestedChangeId() {
  const raw = (process.env.HARNESS_CHANGE || '').trim();
  return raw === '' ? null : raw;
}

// The run's composition scope. Unset (the default, "effective") is the
// effective spec: every source-of-truth spec with every active change delta
// applied. HARNESS_SCOPE=specs is the main-spec composition: openspec/specs
// exactly as committed, with no active-change delta, no supersession, and a
// report naming every active change left out. It is what `npm run test:specs`
// sets and what the release gate trusts. An empty value is the same as unset.
const SCOPES = new Set(['effective', 'specs']);

function requestedScope() {
  const raw = (process.env.HARNESS_SCOPE || '').trim();
  if (raw === '') return 'effective';
  if (!SCOPES.has(raw)) {
    throw new Error(
      `HARNESS_SCOPE="${raw}" is not a composition scope: use "specs" for the main-spec ` +
        'composition, or leave it unset for the effective spec.'
    );
  }
  return raw;
}

function effectivePaths({ changeId = requestedChangeId(), scope = requestedScope() } = {}) {
  const allDeltaPaths = globSync('.extracted/changes/*/specs/**/*.feature', {
    cwd: __dirname,
    posix: true,
  }).filter((p) => !p.includes('changes/archive/'));

  const sotPaths = globSync('.extracted/specs/**/*.feature', {
    cwd: __dirname,
    posix: true,
  });

  // A change-scoped run is narrower than any scope: it is the source of truth
  // plus exactly one change's delta. It wins over HARNESS_SCOPE, so the
  // suite's supersession probe keeps proving the mechanism even when the run
  // itself is the main-spec composition.
  if (changeId) {
    if (scope === 'specs') {
      console.error(
        `[effective-spec] change-scoped run: HARNESS_CHANGE=${changeId} wins over HARNESS_SCOPE=specs`
      );
    }
    const deltaPaths = allDeltaPaths.filter((deltaPath) => changeIdOf(deltaPath) === changeId);
    if (deltaPaths.length === 0) {
      throw new Error(
        `HARNESS_CHANGE="${changeId}" selects no active change delta: no .extracted/changes/${changeId}/specs/**/*.feature exists. ` +
          'Check the change id (archived changes never execute).'
      );
    }
    const excluded = [...new Set(allDeltaPaths.map(changeIdOf))].filter((id) => id !== changeId);
    console.error(
      `[effective-spec] change-scoped run: HARNESS_CHANGE=${changeId} — source-of-truth specs plus ` +
        `${deltaPaths.length} delta feature(s) from that change only` +
        (excluded.length > 0 ? `; other active changes excluded: ${excluded.join(', ')}` : '')
    );
    return composeEffectivePaths(sotPaths, deltaPaths);
  }

  if (scope === 'specs') {
    printSpecsScopeReport(allDeltaPaths);
    // The main-spec composition: every source-of-truth spec as committed. No
    // delta applies, so nothing is superseded and no line targeting is needed.
    return sotPaths;
  }

  return composeEffectivePaths(sotPaths, allDeltaPaths);
}

// The main-spec composition report: every active change whose delta is left
// out, by id, so the run states exactly what it does not trust itself to
// execute yet.
function printSpecsScopeReport(allDeltaPaths) {
  const byChange = new Map();
  for (const deltaPath of allDeltaPaths) {
    const id = changeIdOf(deltaPath);
    byChange.set(id, (byChange.get(id) || 0) + 1);
  }
  const ids = [...byChange.keys()].sort();
  if (ids.length === 0) {
    console.error('[effective-spec] scope=specs: main specs only; no active change delta exists.');
    return;
  }
  console.error(
    `[effective-spec] scope=specs: main specs only (openspec/specs); ` +
      `${ids.length} active change(s) excluded from this run:`
  );
  for (const id of ids) {
    console.error(
      `[effective-spec]   excluded active change: ${id} (${byChange.get(id)} delta feature(s))`
    );
  }
  console.error(
    `[effective-spec] ${ids.length} active-change exclusion(s); no delta scenario executes in the specs profile`
  );
}

function composeEffectivePaths(sotPaths, deltaPaths) {
  const superseded = collectSupersededRules(deltaPaths);
  const paths = [];
  const seenRulesByCapability = new Map();
  const exclusions = [];

  for (const specPath of sotPaths) {
    const capability = capabilityOf(specPath);
    const supersededByRule = superseded.get(capability);
    if (!supersededByRule) {
      paths.push(specPath);
      continue;
    }
    const { entry, seenRules, excluded } = filterSourceOfTruthSpec(specPath, supersededByRule);
    if (entry) paths.push(entry);
    seenRulesByCapability.set(capability, seenRules);
    if (excluded.length > 0) exclusions.push({ specPath, capability, rules: excluded });
  }
  if (exclusions.length > 0) printCompositionReport(exclusions);

  for (const [capability, byRule] of superseded) {
    const seenRules = seenRulesByCapability.get(capability) ?? new Set();
    for (const [name, changeId] of byRule) {
      if (!seenRules.has(name)) {
        console.error(`[effective-spec] WARNING: change "${changeId}" marks rule "${name}" of capability "${capability}" as MODIFIED/REMOVED, but no such rule exists in openspec/specs.`);
      }
    }
  }

  paths.push(...deltaPaths);
  return paths;
}

module.exports = { effectivePaths, requestedChangeId, requestedScope, SCOPES };
