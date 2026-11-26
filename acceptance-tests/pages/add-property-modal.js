'use strict';

// Page object for the Add Property modal flow: open it from the sidebar,
// fill the form, pick the type through the Radix select (a combobox trigger
// plus a portal listbox — never raw <select> semantics), and submit.
//
// The steps are separate because one scenario (the revoked-session sign-out)
// submits a form that is expected to fail: it must not wait for the success
// path's dialog close. `submitProperty` is the full successful flow the other
// scenarios use.

const WAIT_MS = 20_000;

// The option labels the Radix select renders (web/src/lib/domain.ts).
const TYPE_LABELS = {
  residential: 'Residential',
  commercial: 'Commercial',
  lot: 'Lot',
};

async function open(page) {
  // The sidebar's "Add Property" button opens the modal (a Radix dialog).
  await page.getByRole('button', { name: 'Add Property' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  return dialog;
}

async function fill(page, { name, address, type, units }) {
  const dialog = page.getByRole('dialog');
  await dialog.locator('#name').fill(name);
  await dialog.locator('#address').fill(address);
  if (units !== undefined && units !== null) {
    await dialog.locator('#units').fill(String(units));
  }

  // Radix select: click the combobox trigger, then the option in the
  // portal-rendered listbox.
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: TYPE_LABELS[type] }).click();
}

// Click the submit control and return without judging the outcome.
async function submit(page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Create Property' }).click();
}

// The full successful flow: on success the modal closes and the property list
// refetches.
async function submitProperty(page, payload) {
  await open(page);
  await fill(page, payload);
  await submit(page);
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: WAIT_MS });
}

module.exports = { WAIT_MS, TYPE_LABELS, open, fill, submit, submitProperty };
