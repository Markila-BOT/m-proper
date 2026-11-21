'use strict';

// Browser access for the steps: every page-object method takes the
// scenario's Playwright page. When chromium could not be launched (the
// browser binary is missing), HTTP scenarios still run and browser steps
// fail with this named cause instead of an opaque undefined-page error.

const { state, tailOf } = require('../support/harness');

function requirePage(world) {
  if (!world.page) {
    const cause = state.browserLaunchError
      ? tailOf(state.browserLaunchError.message, 300)
      : 'no page was created for this scenario';
    throw new Error(
      'this scenario needs a real browser page, but none is available: ' +
        `${cause}. Install the browser binary once with ` +
        '`npx playwright install chromium` inside acceptance-tests/.'
    );
  }
  return world.page;
}

module.exports = { requirePage };
