'use strict';

// The type-check gates.
//
// Two callers:
//
// - "A drifted response shape fails the type check" writes a throwaway fixture
//   under the harness's scratch area (`.extracted/typecheck/…`), compiles it
//   with the web project's own TypeScript, and expects a non-zero exit naming
//   the drifted field. The fixture imports the *shared* domain type the routes
//   and the client both use, so it proves the check catches a response shape
//   that no longer matches — without mutating the repository or web/src.
// - "Type check gate" runs the real project check (`tsc --noEmit`) over
//   web/tsconfig.json.
//
// The web project's TypeScript is used directly (`web/node_modules`), never a
// global tsc, so the gate is the dependency the lockfile pins.

const fs = require('node:fs');
const path = require('node:path');

const { runCommand } = require('./harness');
const { WEB_DIR } = require('./web-bundle');

const TSC_BIN = path.join(WEB_DIR, 'node_modules', 'typescript', 'bin', 'tsc');
const SCRATCH_ROOT = path.join(__dirname, '..', '.extracted', 'typecheck');

// The web application's own TypeScript check. `--noEmit` is also in
// web/tsconfig.json; stating it keeps the intent at the call site.
async function runProjectTypeCheck() {
  return runCommand(process.execPath, [TSC_BIN, '--noEmit'], {
    cwd: WEB_DIR,
    timeoutMs: 300_000,
  });
}

// A response row whose field drifted to another naming convention. The
// annotation is the shared domain type, so TypeScript must reject it.
const DRIFTED_PROPERTY_SOURCE = `// Throwaway fixture — the route response shape drifted from the domain type.
import type { Property } from '#/lib/domain.ts'

export const driftedProperty: Property = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'Drifted Shape',
  address: 'Acceptance Probe Way 1',
  type: 'residential',
  units: 1,
  isActive: true,
  created_at: '2026-01-01T00:00:00Z',
}
`;

// Writes the fixture and its own tsconfig under the scratch area. The tsconfig
// mirrors web/tsconfig.json's strictness but maps `#/*` at the web sources by a
// path relative to the fixture, so no project file is touched and the fixture
// is not part of web's include list.
function writeDriftedPropertyFixture() {
  const dir = path.join(SCRATCH_ROOT, 'drifted-property');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const webSrcFromFixture = path
    .relative(dir, path.join(WEB_DIR, 'src'))
    .split(path.sep)
    .join('/');

  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      verbatimModuleSyntax: true,
      lib: ['ES2022'],
      types: [],
      paths: { '#/*': [`${webSrcFromFixture}/*`] },
    },
    include: ['drifted-property.ts'],
  };

  const fixturePath = path.join(dir, 'drifted-property.ts');
  const tsconfigPath = path.join(dir, 'tsconfig.json');
  fs.writeFileSync(fixturePath, DRIFTED_PROPERTY_SOURCE);
  fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

  return { dir, fixturePath, tsconfigPath };
}

// Compiles the fixture. Never throws on a non-zero exit — the caller asserts.
async function runFixtureTypeCheck(fixture) {
  return runCommand(process.execPath, [TSC_BIN, '-p', fixture.tsconfigPath], {
    cwd: WEB_DIR,
    timeoutMs: 120_000,
  });
}

function removeFixture(fixture) {
  if (!fixture || !fixture.dir) return;
  fs.rmSync(fixture.dir, { recursive: true, force: true });
}

module.exports = {
  TSC_BIN,
  SCRATCH_ROOT,
  runProjectTypeCheck,
  writeDriftedPropertyFixture,
  runFixtureTypeCheck,
  removeFixture,
};
