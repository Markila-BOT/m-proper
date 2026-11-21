'use strict';

// Page object for the Properties view: the property cards and the
// per-property delete flow (the per-card Delete button, then the inline
// Confirm that appears inside the same card).

const shell = require('./app-shell');

const WAIT_MS = 20_000;

async function open(page) {
  await shell.openTab(page, 'properties');
  // Scope to main: the sidebar carries a "Properties" heading too.
  await page
    .locator('main')
    .getByRole('heading', { name: 'Properties', exact: true })
    .waitFor({ state: 'visible', timeout: WAIT_MS });
}

// Each property renders as a card — a container whose heading names it.
// Scope to main so the sidebar's property entries never match.
async function propertyCard(page, name) {
  return page
    .locator('main')
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');
}

async function expectProperty(page, name) {
  const card = await propertyCard(page, name);
  await card.waitFor({ state: 'visible', timeout: WAIT_MS });
  return card;
}

async function expectPropertyAbsent(page, name) {
  const card = await propertyCard(page, name);
  await card.waitFor({ state: 'detached', timeout: WAIT_MS });
}

async function propertyNames(page) {
  // The Properties view titles every card with a level-3 heading.
  const titles = await page.locator('main').getByRole('heading', { level: 3 }).allTextContents();
  return titles.map((title) => title.trim()).filter((title) => title.length > 0);
}

async function deleteProperty(page, name) {
  // The per-property Delete button, then the inline Confirm that replaces
  // it inside the same card while the delete is in flight.
  const card = await propertyCard(page, name);
  await card.getByRole('button', { name: 'Delete property' }).click();
  const confirm = card.getByRole('button', { name: 'Confirm', exact: true });
  await confirm.waitFor({ state: 'visible', timeout: 5000 });
  await confirm.click();
  // The list refetches and the card disappears.
  await card.waitFor({ state: 'detached', timeout: WAIT_MS });
}

module.exports = {
  open,
  propertyCard,
  expectProperty,
  expectPropertyAbsent,
  propertyNames,
  deleteProperty,
};
