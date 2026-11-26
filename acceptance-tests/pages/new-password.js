'use strict';

// Page object for the recovery landing page (/new-password).
//
// The page accepts either shape Supabase's mail templates send: a PKCE `code`
// or a `token_hash` (web/src/routes/new-password.tsx). This environment has no
// SMTP provider, so the harness takes the admin-generated recovery link and
// drives the documented `token_hash` form: the route exchanges it for a
// recovery session in cookies, then the form updates the password. The
// generated action link's implicit-flow `#access_token` fragment is not used —
// the app's cookie client never reads a hash fragment, so that form would not
// establish the server-side session the update needs.

const WAIT_MS = 60_000;

function newPasswordUrl(origin, { tokenHash }) {
  const url = new URL('/new-password', origin);
  if (tokenHash) {
    url.searchParams.set('token_hash', tokenHash);
    url.searchParams.set('type', 'recovery');
  }
  return url.toString();
}

async function openWithTokenHash(page, origin, tokenHash) {
  await page.goto(newPasswordUrl(origin, { tokenHash }), { waitUntil: 'networkidle' });
}

// The form is usable once the recovery session exists; an invalid link gets
// the alert instead and never renders the field.
async function waitForForm(page) {
  await page
    .getByRole('heading', { level: 1, name: 'Choose a new password', exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
  await page.getByLabel('New password', { exact: true }).waitFor({
    state: 'visible',
    timeout: WAIT_MS,
  });
}

// Either outcome the route can produce for a link: the form (the recovery
// session exists) or the invalid-link alert (the exchange was refused). Used
// where the scenario needs to report which one happened instead of timing out
// on the form alone.
async function waitForOutcome(page) {
  const form = page.getByLabel('New password', { exact: true });
  const alert = page.getByRole('alert').first();
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (await form.isVisible().catch(() => false)) return { form: true, alertText: null };
    if (await alert.isVisible().catch(() => false)) {
      return { form: false, alertText: (await alert.innerText()).trim() };
    }
    await page.waitForTimeout(250);
  }
  throw new Error(
    `the recovery landing page reached neither the form nor the invalid-link alert within ` +
      `${Math.round(WAIT_MS / 1000)}s (url: ${page.url()})`
  );
}

async function invalidLinkMessage(page) {
  const alert = page.getByRole('alert').first();
  await alert.waitFor({ state: 'visible', timeout: WAIT_MS });
  return (await alert.innerText()).trim();
}

async function submit(page, { password }) {
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Set new password', exact: true }).click();
}

module.exports = {
  WAIT_MS,
  newPasswordUrl,
  openWithTokenHash,
  waitForForm,
  waitForOutcome,
  invalidLinkMessage,
  submit,
};
