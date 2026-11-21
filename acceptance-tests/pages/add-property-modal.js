'use strict';

// Page object for the Add Property modal flow: open it from the sidebar,
// fill the form, pick the type through the Radix select (a combobox trigger
// plus a portal listbox — never raw <select> semantics), and submit.

const WAIT_MS = 20_000;

// The option labels the Radix select renders (web/src/lib/domain.ts).
const TYPE_LABELS = {
  residential: 'Residential',
  commercial: 'Commercial',
  lot: 'Lot',
};

async function submitProperty(page, { name, address, type, units }) {
  // The sidebar's "Add Property" button opens the modal (a Radix dialog).
  await page.getByRole('button', { name: 'Add Property' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });

  await dialog.locator('#name').fill(name);
  await dialog.locator('#address').fill(address);
  if (units !== undefined && units !== null) {
    await dialog.locator('#units').fill(String(units));
  }

  // Radix select: click the combobox trigger, then the option in the
  // portal-rendered listbox.
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: TYPE_LABELS[type] }).click();

  await dialog.getByRole('button', { name: 'Create Property' }).click();
  // On success the modal closes and the property list refetches.
  await dialog.waitFor({ state: 'detached', timeout: WAIT_MS });
}

module.exports = { submitProperty, TYPE_LABELS };
