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
// A child run booted from this config must use its own ports (the parent sets
// HARNESS_API_PORT / HARNESS_WEB_PORT / HARNESS_OPENAPI_PORT in its
// environment) and writes its own report and message streams, so it can never
// collide with the parent run that spawned it.

const { extractAll } = require('./extract-gherkin.cjs');
const { effectivePaths } = require('./openspec-effective-paths.cjs');

extractAll();

const SELF_FEATURE = 'changes/adopt-acceptance-suite/specs/acceptance-suite/';

const paths = effectivePaths().filter((featurePath) => !featurePath.includes(SELF_FEATURE));

module.exports = {
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
