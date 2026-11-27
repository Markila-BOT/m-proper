'use strict';

// Suite-minus-self configuration for the acceptance suite's own self-check
// child run ("One command runs every committed behavior").
//
// cucumber-js merges CLI paths into the default profile's paths instead of
// replacing them, so a feature-list exclusion cannot be expressed as command
// line arguments against cucumber.cjs. This file is the same effective
// composition with one difference: the acceptance-suite feature itself is
// left out, so the child run proves every *other* committed behavior without
// recursing into itself.
//
// The child inherits its parent's composition scope. Under
// HARNESS_SCOPE=specs (`npm run test:specs`) both the parent and this child
// execute the main specs only, so the child cannot reintroduce an active
// change's delta into the release gate; the parent passes the resolved scope
// in the child's environment (see step-definitions/acceptance-suite.js).
//
// A child run booted from this config must use its own port (the parent sets
// HARNESS_WEB_PORT in its environment) and writes its own report and message
// streams, so it can never collide with the parent run that spawned it. One
// process serves the pages and /api, so one port is the whole child.

const { extractAll } = require('./extract-gherkin.cjs');
const { effectivePaths, requestedScope } = require('./openspec-effective-paths.cjs');

extractAll();

// Resolved once and applied to the composition, so the child's scenario set is
// the parent's scope — never a wider one.
const scope = requestedScope();

// The suite's own capability is a main spec now (adopt-acceptance-suite was
// archived), so the self feature lives under .extracted/specs/.
const SELF_FEATURE = 'specs/acceptance-suite/';

const paths = effectivePaths({ scope }).filter((featurePath) => !featurePath.includes(SELF_FEATURE));

module.exports = {
  scope,
  default: {
    paths,
    import: ['support/**/*.js', 'step-definitions/**/*.js'],
    format: [
      'progress-bar',
      ['html', 'reports/suite-minus-self-report.html'],
      ['message', 'reports/suite-minus-self-messages.ndjson'],
    ],
  },
};
