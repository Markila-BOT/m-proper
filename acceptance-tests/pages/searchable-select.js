'use strict';

// Page object for the transaction form's category combobox
// (liquid-glass-ledger, tasks 3.1–3.2). The DOM contract the change fixed:
// the trigger is the form's #transaction-category element, a role=combobox
// named "Category"; the popover holds a filter input (role=combobox, named
// "Search categories") and a listbox named "Category" whose options are the
// filtered categories. The trigger carries data-value — the form's stored
// category — so the step can observe the committed value, not just the
// printed label. Steps read as intent and hold no selectors.

const shell = require('./app-shell');

const WAIT_MS = 20_000;

function dialog(page) {
  return page.getByRole('dialog');
}

async function openTransactionForm(page) {
  await shell.open(page);
  await page.getByRole('button', { name: '+ Add transaction' }).click();
  await dialog(page).waitFor({ state: 'visible', timeout: WAIT_MS });
}

function trigger(page) {
  return dialog(page).getByRole('combobox', { name: 'Category', exact: true });
}

async function open(page) {
  await openTransactionForm(page);
  await trigger(page).click();
  await listbox(page).waitFor({ state: 'visible', timeout: WAIT_MS });
}

function listbox(page) {
  return page.getByRole('listbox', { name: 'Category', exact: true });
}

function searchInput(page) {
  return page.getByRole('combobox', { name: 'Search categories', exact: true });
}

// Free typing: the field filters as the hand writes, so every character is
// a keystroke rather than a single programmatic fill.
async function typeSearch(page, text) {
  const input = searchInput(page);
  await input.fill('');
  await input.pressSequentially(text, { delay: 10 });
}

async function optionLabels(page) {
  const options = listbox(page).getByRole('option');
  const count = await options.count();
  const labels = [];
  for (let i = 0; i < count; i += 1) {
    labels.push((await options.nth(i).innerText()).trim());
  }
  return labels;
}

async function optionCount(page) {
  return listbox(page).getByRole('option').count();
}

async function noMatchMessage(page) {
  const message = page.getByRole('status');
  await message.waitFor({ state: 'visible', timeout: WAIT_MS });
  return (await message.innerText()).trim();
}

async function pressKey(page, key) {
  await searchInput(page).press(key);
}

async function expectClosed(page) {
  await listbox(page).waitFor({ state: 'detached', timeout: WAIT_MS });
}

async function triggerLabel(page) {
  return (await trigger(page).innerText()).trim();
}

// The committed value the form holds — the trigger's data-value, written
// from the same state the form records.
async function storedValue(page) {
  return trigger(page).getAttribute('data-value');
}

async function activeOptionId(page) {
  return searchInput(page).getAttribute('aria-activedescendant');
}

async function expectFocusOnTrigger(page) {
  await page.waitForFunction(
    () =>
      document.activeElement instanceof HTMLElement &&
      document.activeElement.id === 'transaction-category',
    null,
    { timeout: WAIT_MS }
  );
}

module.exports = {
  openTransactionForm,
  trigger,
  open,
  listbox,
  searchInput,
  typeSearch,
  optionLabels,
  optionCount,
  noMatchMessage,
  pressKey,
  expectClosed,
  triggerLabel,
  storedValue,
  activeOptionId,
  expectFocusOnTrigger,
};
