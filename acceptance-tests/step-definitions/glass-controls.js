'use strict';

// Step definitions for liquid-glass-ledger's calendar controls (tasks
// 2.1–2.5). Three scenarios describe the pickers' behavior: the keyboard
// path through the calendar, the typed-entry rejection that leaves the
// stored date unchanged, and the filter pair's typed range. The other
// glass scenarios (the four-condition fallback Outline, the text floor,
// the scrolling subtree, the searchable select) belong to later batches
// and stay undefined here.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

const { waitFor } = require('../support/harness');
const { requirePage } = require('../pages/browser');
const shell = require('../pages/app-shell');
const ledgerView = require('../pages/ledger-view');
const datePicker = require('../pages/date-picker');

const WAIT_MS = 20_000;

// A calendar string's month as one comparable number, so PageUp/PageDown
// are asserted across year boundaries too.
function monthIndex(calendarDate) {
  const [year, month] = calendarDate.split('-').map(Number);
  return year * 12 + (month - 1);
}

// --- The calendar is keyboard-operable ---

Given('the transaction form is open', async function () {
  const page = requirePage(this);
  await datePicker.openTransactionForm(page);
  this.formDateBeforeKeyboard = await datePicker.formDateValue(page);
});

When(
  'the user opens the date picker and moves by arrow keys, PageUp, and PageDown, then presses Enter',
  async function () {
    const page = requirePage(this);
    await datePicker.openCalendar(page);

    // The calendar's own focus model starts on the selected day; every
    // key below must move that focus, which data-date makes observable.
    this.focusedDayBeforeMove = await datePicker.focusedDay(page);
    await page.keyboard.press('ArrowRight');
    this.focusedDayAfterArrow = await datePicker.waitForFocusedDay(
      page,
      (day) => day !== this.focusedDayBeforeMove
    );
    await page.keyboard.press('PageUp');
    this.focusedDayAfterPageUp = await datePicker.waitForFocusedDay(
      page,
      (day) => monthIndex(day) === monthIndex(this.focusedDayAfterArrow) - 1
    );
    await page.keyboard.press('PageDown');
    this.focusedDayAfterPageDown = await datePicker.waitForFocusedDay(
      page,
      (day) => monthIndex(day) === monthIndex(this.focusedDayAfterArrow)
    );
    await page.keyboard.press('Enter');
  }
);

Then('a date is chosen and the picker closes', async function () {
  const page = requirePage(this);
  await datePicker.expectCalendarClosed(page);

  assert.match(
    this.formDateBeforeKeyboard,
    /^\d{4}-\d{2}-\d{2}$/,
    'the form must start from a real calendar date so the keyboard path has a starting point'
  );
  assert.ok(
    this.focusedDayBeforeMove,
    'the opened calendar must place focus on a day, or no key can move it'
  );
  assert.notStrictEqual(
    this.focusedDayAfterArrow,
    this.focusedDayBeforeMove,
    'ArrowRight must move the calendar focus to another day'
  );
  assert.strictEqual(
    monthIndex(this.focusedDayAfterPageUp),
    monthIndex(this.focusedDayAfterArrow) - 1,
    'PageUp must move the calendar focus to the previous month'
  );
  assert.strictEqual(
    monthIndex(this.focusedDayAfterPageDown),
    monthIndex(this.focusedDayAfterArrow),
    'PageDown must move the calendar focus back to the month ArrowRight reached'
  );

  const chosen = await datePicker.formDateValue(page);
  assert.strictEqual(
    chosen,
    this.focusedDayAfterPageDown,
    'Enter must choose the day the keyboard left focused'
  );
});

Then("focus returns to the picker's trigger", async function () {
  const page = requirePage(this);
  await datePicker.expectFocusOnCalendarTrigger(page);
});

// --- An impossible typed date is rejected ---

Given("the transaction form's date picker is open", async function () {
  const page = requirePage(this);
  await datePicker.openTransactionForm(page);
  this.storedFormDate = await datePicker.formDateValue(page);
  await datePicker.openCalendar(page);
});

When('the user types an impossible calendar date and confirms', async function () {
  const page = requirePage(this);
  this.typedImpossibleDate = '2025-02-30';
  await datePicker.typeIntoFormDate(page, this.typedImpossibleDate);
});

Then('the picker shows a message naming the problem and the recovery', async function () {
  const page = requirePage(this);
  const alert = datePicker.formDateAlert(page);
  await alert.waitFor({ state: 'visible', timeout: WAIT_MS });

  const message = (await alert.innerText()).trim();
  assert.ok(
    message.includes(this.typedImpossibleDate),
    `the message must name the value that was rejected; saw "${message}"`
  );
  assert.match(
    message,
    /not a real date/i,
    `the message must name the problem — the day does not exist; saw "${message}"`
  );
  assert.match(
    message,
    /YYYY-MM-DD/,
    `the message must name the recovery — the calendar-string format; saw "${message}"`
  );
  assert.match(
    message,
    /for example \d{4}-\d{2}-\d{2}/,
    `the message must offer a recovery example; saw "${message}"`
  );

  const input = datePicker.formDateInput(page);
  assert.strictEqual(
    await input.getAttribute('aria-invalid'),
    'true',
    'the input must announce its invalid state to assistive technology'
  );
  const describedBy = await input.getAttribute('aria-describedby');
  const alertId = await alert.getAttribute('id');
  assert.ok(
    alertId && describedBy && describedBy.split(/\s+/).includes(alertId),
    `the input must reference the message through aria-describedby; input names "${describedBy}", alert id "${alertId}"`
  );
});

Then('the stored date is unchanged', async function () {
  const page = requirePage(this);
  assert.match(
    this.storedFormDate,
    /^\d{4}-\d{2}-\d{2}$/,
    'the arrangement must have stored a real calendar date'
  );
  assert.strictEqual(
    await datePicker.formDateValue(page),
    this.storedFormDate,
    'the input must revert to the last stored date — the rejected text never becomes the stored value'
  );
});

// --- The filter pair accepts a typed range ---

Given('the ledger filters are visible', async function () {
  const page = requirePage(this);
  await shell.open(page);

  const list = await this.fetchPropertiesListQuiet();
  const property = list.body && Array.isArray(list.body.data) ? list.body.data[0] : null;
  const propertyId = property ? property.id : 'all';
  const stamp = Date.now();
  // Three entries on known distinct dates: one before the range, one on
  // each boundary. The range 2026-03-12…2026-03-18 must show exactly the
  // two boundary entries — inclusive on both ends.
  this.rangeEntries = [
    {
      id: `probe-range-${stamp}-before`,
      date: '2026-03-10',
      description: 'Probe before the range',
      category: 'Rent',
      amount: 1000,
      type: 'income',
      property: propertyId,
    },
    {
      id: `probe-range-${stamp}-start`,
      date: '2026-03-12',
      description: 'Probe on the range start',
      category: 'Rent',
      amount: 1100,
      type: 'income',
      property: propertyId,
    },
    {
      id: `probe-range-${stamp}-end`,
      date: '2026-03-18',
      description: 'Probe on the range end',
      category: 'Rent',
      amount: 1200,
      type: 'income',
      property: propertyId,
    },
  ];
  await ledgerView.seedTransactions(page, this.rangeEntries);
  await ledgerView.open(page);
  await datePicker.filters(page).waitFor({ state: 'visible', timeout: WAIT_MS });

  // The arrangement is observable before the filter is applied: all three
  // entries print, so the Then's exclusion is the range's doing.
  const displayed = await ledgerView.displayedTransactionDescriptions(page);
  for (const entry of this.rangeEntries) {
    assert.ok(
      displayed.includes(entry.description),
      `the arrangement must show "${entry.description}" before the range is applied`
    );
  }
});

When('the user opens the range picker and selects a start and an end day', async function () {
  const page = requirePage(this);
  this.rangeStart = '2026-03-12';
  this.rangeEnd = '2026-03-18';
  await datePicker.openRangePicker(page);
  await datePicker.typeRange(page, this.rangeStart, this.rangeEnd);
});

Then('the ledger filters to that inclusive range', async function () {
  const page = requirePage(this);
  const expected = ['Probe on the range end', 'Probe on the range start'];
  await waitFor(
    async () => {
      const displayed = await ledgerView.displayedTransactionDescriptions(page);
      return (
        displayed.length === expected.length &&
        expected.every((description) => displayed.includes(description))
      );
    },
    {
      timeoutMs: WAIT_MS,
      label: 'the ledger to show exactly the entries inside the inclusive range',
    }
  );

  const displayed = await ledgerView.displayedTransactionDescriptions(page);
  assert.deepStrictEqual(
    [...displayed].sort(),
    expected,
    'the ledger must show exactly the entries inside the inclusive range — both boundaries kept, the entry before it excluded'
  );
});

Then('the from and to fields show the chosen days', async function () {
  const page = requirePage(this);
  const values = await datePicker.rangeValues(page);
  assert.strictEqual(
    values.start,
    this.rangeStart,
    'the from field must show the chosen start day'
  );
  assert.strictEqual(
    values.end,
    this.rangeEnd,
    'the to field must show the chosen end day'
  );

  const triggerText = await datePicker.rangeTriggerText(page);
  assert.ok(
    triggerText.includes(this.rangeStart) && triggerText.includes(this.rangeEnd),
    `the range trigger must carry both chosen days; saw "${triggerText}"`
  );
});
