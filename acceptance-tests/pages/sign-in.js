'use strict';

// Page object for the public sign-in surface. Routes, field ids, and the
// authenticated-shell signals live here; the session plumbing and the step
// definitions read as intent.
//
// The sign-in form posts to the Start server function, which writes the
// Supabase cookie session on the response and then the page navigates to the
// validated return target. "Authenticated" therefore means: the URL left
// /sign-in, the shell's navigation rendered, and the header names the
// expected landlord — the same guard the app uses for every protected page.

const shell = require('./app-shell');

const WAIT_MS = 60_000;
const POLL_MS = 250;

function isSignInUrl(page) {
  return new URL(page.url()).pathname.startsWith('/sign-in');
}

function signInUrl(origin) {
  return new URL('/sign-in', origin).toString();
}

async function open(page, origin) {
  // networkidle, not just domcontentloaded: the sign-in form's submit handler
  // is a React handler. Clicking before hydration falls back to the browser's
  // native GET submission (and puts the password in the URL), so wait for the
  // page's scripts to settle first — the same signal app-shell.open uses.
  await page.goto(signInUrl(origin), { waitUntil: 'networkidle' });
  await page
    .getByRole('heading', { level: 1, name: 'Sign in', exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

// Fill and submit without judging the outcome. Refusal helpers
// (expectConfirmationRequired, errorMessage) read the page afterwards.
async function submit(page, { email, password }) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

// The full successful flow: open, submit, and wait for the guard to land on
// the authenticated shell as the expected landlord.
async function signIn(page, credentials, { origin }) {
  await open(page, origin);
  await submit(page, credentials);
  await waitForAuthenticated(page, credentials.email);
}

async function waitForAuthenticated(page, email) {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (!isSignInUrl(page)) break;

    // A refusal is a visible alert on the form. Surface its words instead of
    // timing out with no explanation. A navigation in flight can invalidate
    // the locator mid-check; that just means the sign-in is moving on.
    try {
      const alert = page.getByRole('alert');
      if ((await alert.count()) > 0) {
        const first = alert.first();
        if (await first.isVisible().catch(() => false)) {
          const text = (await first.innerText()).trim();
          throw new Error(`sign-in for ${email} was refused: ${text}`);
        }
      }
    } catch (error) {
      if (/was refused/.test(error.message)) throw error;
      // The document was navigating: poll again.
    }

    await page.waitForTimeout(POLL_MS);
  }

  if (isSignInUrl(page)) {
    throw new Error(
      `sign-in for ${email} did not leave the sign-in page within ${Math.round(WAIT_MS / 1000)}s ` +
        '(the guard never landed on the authenticated shell).'
    );
  }

  await shell.waitForShell(page);
  await page
    .getByText(email, { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

// An unconfirmed account: the sign-in is refused with the confirmation
// message and the resend control. Confirmation is enabled in the project, so
// this is the real path, not a mock.
async function expectConfirmationRequired(page, email) {
  const alert = page.getByRole('alert').first();
  await alert.waitFor({ state: 'visible', timeout: WAIT_MS });
  const text = (await alert.innerText()).trim();
  if (!/not been confirmed/i.test(text)) {
    throw new Error(
      `sign-in for ${email} must name the confirmation step, but the alert said: "${text}"`
    );
  }
  await page
    .getByRole('button', { name: /Resend the confirmation email/i })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
  return text;
}

async function errorMessage(page) {
  const alert = page.getByRole('alert').first();
  await alert.waitFor({ state: 'visible', timeout: WAIT_MS });
  return (await alert.innerText()).trim();
}

module.exports = {
  WAIT_MS,
  signInUrl,
  isSignInUrl,
  open,
  submit,
  signIn,
  waitForAuthenticated,
  expectConfirmationRequired,
  errorMessage,
};
