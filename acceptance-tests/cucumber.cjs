const { extractAll } = require('./extract-gherkin.cjs');
const { effectivePaths, requestedScope } = require('./openspec-effective-paths.cjs');

extractAll();

// The run's composition. HARNESS_SCOPE=specs (what `npm run test:specs` sets)
// is the main-spec composition: openspec/specs only, no active-change delta,
// and a report naming every active change left out. Everything else keeps the
// effective spec.
const scope = requestedScope();

const common = {
  paths: effectivePaths({ scope }),
  import: ['support/**/*.js', 'step-definitions/**/*.js'],
  format: ['progress-bar', ['html', 'reports/cucumber-report.html']],
};

// `npm run test:specs` — the main-spec profile the release gate runs. Its
// paths are the main specs whatever the ambient scope: a delta feature never
// reaches the gate. Its own message stream lets the acceptance-suite scenarios
// read exactly what it discovered. The composition report for this profile is
// printed by effectivePaths() when the script sets HARNESS_SCOPE=specs.
const specs = {
  ...common,
  paths: ['.extracted/specs/**/*.feature'],
  format: [
    'progress-bar',
    ['html', 'reports/test-specs-report.html'],
    ['message', 'reports/test-specs-messages.ndjson'],
  ],
};

module.exports = { default: common, specs };
