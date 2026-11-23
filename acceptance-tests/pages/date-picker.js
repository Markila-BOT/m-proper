'use strict';

// Page object for the two calendar controls (liquid-glass-ledger, tasks
// 2.1–2.5): the transaction form's single date picker and the ledger
// filter's range picker. The selectors here are the DOM contract the
// change fixed — the form input id, the two triggers' accessible names,
// the day buttons' data-date hook, and the range fields' ids. Steps read
// as intent and hold no selectors.

const shell = require('./app-shell');
const { waitFor } = require('../support/harness');

const WAIT_MS = 20_000;

// --- the transaction form's single picker ---

function dialog(page) {
  return page.getByRole('dialog');
}

async function openTransactionForm(page) {
  await shell.open(page);
  await page.getByRole('button', { name: '+ Add transaction' }).click();
  await dialog(page).waitFor({ state: 'visible', timeout: WAIT_MS });
}

function formDateInput(page) {
  return dialog(page).locator('#transaction-date');
}

async function formDateValue(page) {
  return formDateInput(page).inputValue();
}

function openCalendarTrigger(page) {
  // The single picker's trigger: an icon button whose accessible name is
  // the contract ("Open calendar").
  return dialog(page).getByRole('button', { name: 'Open calendar', exact: true });
}

async function openCalendar(page) {
  await openCalendarTrigger(page).click();
  await firstDay(page).waitFor({ state: 'visible', timeout: WAIT_MS });
}

function firstDay(page) {
  return page.locator('[data-date]').first();
}

async function expectCalendarClosed(page) {
  await firstDay(page).waitFor({ state: 'detached', timeout: WAIT_MS });
}

// The day the calendar's own focus model currently holds. The calendar
// buttons carry data-date, so the keyboard path is observable without
// reaching into react-day-picker's internals.
async function focusedDay(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    return active instanceof HTMLElement
      ? active.getAttribute('data-date')
      : null;
  });
}

// A key that changes the month replaces the day buttons, so the focus
// model needs a beat to land on the new day. Waiting for the predicate is
// the honest observation — the key's effect, not the keypress's return.
async function waitForFocusedDay(page, predicate) {
  let value = null;
  await waitFor(
    async () => {
      value = await focusedDay(page);
      return Boolean(value && predicate(value));
    },
    { timeoutMs: WAIT_MS, intervalMs: 50, label: 'the calendar focus to move' }
  );
  return value;
}

async function expectFocusOnCalendarTrigger(page) {
  await page.waitForFunction(
    () =>
      document.activeElement instanceof HTMLElement &&
      document.activeElement.getAttribute('aria-label') === 'Open calendar',
    null,
    { timeout: WAIT_MS }
  );
}

function formDateAlert(page) {
  return dialog(page).getByRole('alert');
}

async function typeIntoFormDate(page, text) {
  // Free typing: the input holds the visitor's characters until Enter
  // confirms them. Filling focuses the field, which dismisses the open
  // popover exactly as a hand reaching for the input would.
  const input = formDateInput(page);
  await input.fill(text);
  await input.press('Enter');
}

// --- the ledger filter's range picker ---

function filters(page) {
  return page.locator('#ledger-filters');
}

function rangeTrigger(page) {
  return filters(page).getByRole('button', {
    name: 'Choose date range',
    exact: true,
  });
}

async function openRangePicker(page) {
  await rangeTrigger(page).click();
  await firstDay(page).waitFor({ state: 'visible', timeout: WAIT_MS });
}

function rangeStartInput(page) {
  return filters(page).locator('#ledger-start-date');
}

function rangeEndInput(page) {
  return filters(page).locator('#ledger-end-date');
}

async function typeRange(page, start, end) {
  const startInput = rangeStartInput(page);
  await startInput.fill(start);
  await startInput.press('Enter');
  const endInput = rangeEndInput(page);
  await endInput.fill(end);
  await endInput.press('Enter');
}

async function rangeValues(page) {
  return {
    start: await rangeStartInput(page).inputValue(),
    end: await rangeEndInput(page).inputValue(),
  };
}

async function rangeTriggerText(page) {
  return (await rangeTrigger(page).innerText()).trim();
}

module.exports = {
  openTransactionForm,
  formDateInput,
  formDateValue,
  openCalendarTrigger,
  openCalendar,
  expectCalendarClosed,
  focusedDay,
  waitForFocusedDay,
  expectFocusOnCalendarTrigger,
  formDateAlert,
  typeIntoFormDate,
  filters,
  rangeTrigger,
  openRangePicker,
  rangeStartInput,
  rangeEndInput,
  typeRange,
  rangeValues,
  rangeTriggerText,
};
