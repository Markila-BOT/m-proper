'use strict';

// Page object for the public sign-up surface (/sign-up).
//
// The form posts to the sign-up server function and answers in one of two
// shapes: a `status` paragraph ("Check your email for a confirmation link…")
// when the request was accepted, or an `alert` when it was refused. Both
// pages render `role="status"` for the page talking and `role="alert"` for a
// rejection (web/src/components/auth/AuthPage.tsx), so the object reads the
// role, not the styling.

const WAIT_MS = 60_000;

function signUpUrl(origin) {
  return new URL('/sign-up', origin).toString();
}

function isSignUpUrl(page) {
  return new URL(page.url()).pathname.startsWith('/sign-up');
}

async function open(page, origin) {
  await page.goto(signUpUrl(origin), { waitUntil: 'networkidle' });
  await page
    .getByRole('heading', { level: 1, name: 'Create an account', exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

async function submit(page, { email, password }) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

// The form's answer, whichever tone it carries: `{ tone: 'status' | 'error',
// text }`. Throws with the visible copy when no answer appears.
async function answer(page) {
  const message = page.locator('[role="status"], [role="alert"]').first();
  await message.waitFor({ state: 'visible', timeout: WAIT_MS });
  const role = await message.getAttribute('role');
  return {
    tone: role === 'alert' ? 'error' : 'status',
    text: (await message.innerText()).trim(),
  };
}

// A sign-up that was accepted: the confirmation sentence renders and the form
// is replaced (there is nothing left to fill).
async function expectAccepted(page) {
  const result = await answer(page);
  if (result.tone !== 'status') {
    throw new Error(`the sign-up was refused, not accepted: "${result.text}"`);
  }
  return result.text;
}

module.exports = {
  WAIT_MS,
  signUpUrl,
  isSignUpUrl,
  open,
  submit,
  answer,
  expectAccepted,
};
