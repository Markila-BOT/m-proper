'use strict';

// Page object for the Properties view: the ruled register (one line per
// property, web/src/components/PropertiesList.tsx) and the per-property
// delete flow — the trailing-cell delete control, then the inline stamp
// confirm (Delete / Keep) that appears on the same register line.
//
// Critique round two replaced the card grid with the register: each
// property is one ruled table row whose h2 names it, and the destructive
// confirm prints the stamp question with a stamp-ground Delete. This file
// is the one place that knows the row shape.

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

// Each property renders as one register line — a table row whose h2
// heading names it. Scope to main so the sidebar's property entries never
// match.
async function propertyCard(page, name) {
  return page
    .locator('main')
    .getByRole('heading', { name, exact: true })
    .locator('xpath=ancestor::tr[1]');
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
  // The Properties view names every register line with a level-2 heading.
  const titles = await page.locator('main').getByRole('heading', { level: 2 }).allTextContents();
  return titles.map((title) => title.trim()).filter((title) => title.length > 0);
}

async function deleteProperty(page, name) {
  // The trailing-cell delete control, then the inline stamp confirm that
  // appears on the same register line while the delete is in flight.
  const card = await propertyCard(page, name);
  await card.getByRole('button', { name: 'Delete property' }).click();
  const confirm = card.getByRole('button', { name: 'Delete', exact: true });
  await confirm.waitFor({ state: 'visible', timeout: 5000 });
  await confirm.click();
  // The list refetches and the register line disappears.
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
