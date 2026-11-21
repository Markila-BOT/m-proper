'use strict';

// Suite discovery configuration for the "Superseded rules never reach the
// runner" self-check: a dry run over the FULL effective spec (this
// acceptance-suite feature included) that writes only the message stream.
//
// It must not run the default profile's html formatter — the parent run
// owns reports/cucumber-report.html while this child runs — and a dry run
// boots nothing and executes no steps, so it is quick and side-effect free.

const { extractAll } = require('./extract-gherkin.cjs');
const { effectivePaths } = require('./openspec-effective-paths.cjs');

extractAll();

module.exports = {
  default: {
    paths: effectivePaths(),
    import: ['support/**/*.js', 'step-definitions/**/*.js'],
    format: [['message', 'reports/superseded-check-messages.ndjson']],
  },
};
