'use strict';

// Page object for the reset request (/reset). The page answers every address
// — known, unknown, or one whose mail Supabase refused to send — with the one
// generic sentence in a `status` paragraph; the step definitions compare that
// sentence between addresses rather than reading any branch from it.

const WAIT_MS = 60_000;

function resetUrl(origin) {
  return new URL('/reset', origin).toString();
}

async function open(page, origin) {
  await page.goto(resetUrl(origin), { waitUntil: 'networkidle' });
  await page
    .getByRole('heading', { level: 1, name: 'Reset your password', exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

async function submit(page, { email }) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
}

async function answer(page) {
  const message = page.locator('[role="status"], [role="alert"]').first();
  await message.waitFor({ state: 'visible', timeout: WAIT_MS });
  const role = await message.getAttribute('role');
  return {
    tone: role === 'alert' ? 'error' : 'status',
    text: (await message.innerText()).trim(),
  };
}

module.exports = {
  WAIT_MS,
  resetUrl,
  open,
  submit,
  answer,
};
