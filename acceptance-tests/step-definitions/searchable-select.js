'use strict';

// Step definitions for liquid-glass-ledger's searchable category select
// (tasks 3.1–3.3). One scenario describes it: searching narrows the
// category list, a query with no matches prints a message that names it,
// and the narrowed list still answers the keyboard. The other glass
// scenarios (the four-condition fallback Outline, the text floor, the
// scrolling subtree) belong to later batches and stay undefined here.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

const { requirePage } = require('../pages/browser');
const searchableSelect = require('../pages/searchable-select');

const WAIT_MS = 20_000;

// --- Searching narrows the category list ---

Given("the transaction form's category select is open", async function () {
  const page = requirePage(this);
  await searchableSelect.open(page);
  this.categoryQuery = 'rep';
});

When('the user types part of a category name', async function () {
  const page = requirePage(this);
  await searchableSelect.typeSearch(page, this.categoryQuery);
});

Then('only matching categories remain listed', async function () {
  const page = requirePage(this);
  const labels = await searchableSelect.optionLabels(page);

  assert.ok(
    labels.length > 0,
    `the narrowed list must still hold the match; saw ${JSON.stringify(labels)}`
  );
  for (const label of labels) {
    assert.match(
      label.toLowerCase(),
      new RegExp(this.categoryQuery.toLowerCase()),
      `every listed category must contain "${this.categoryQuery}"; saw "${label}"`
    );
  }
  assert.ok(
    labels.includes('Maintenance & Repairs'),
    `the one expense category matching "rep" must stay listed; saw ${JSON.stringify(labels)}`
  );
});

Then('when nothing matches, a no-match message appears', async function () {
  const page = requirePage(this);
  this.noMatchQuery = 'zzz';
  await searchableSelect.typeSearch(page, this.noMatchQuery);

  const message = await searchableSelect.noMatchMessage(page);
  assert.ok(
    message.includes(this.noMatchQuery),
    `the no-match message must name the query; saw "${message}"`
  );
  assert.match(
    message,
    /no categories match/i,
    `the message must say the list is empty; saw "${message}"`
  );
  assert.strictEqual(
    await searchableSelect.optionCount(page),
    0,
    'a no-match query must leave zero options listed'
  );
});

Then('keyboard selection still works on the narrowed list', async function () {
  const page = requirePage(this);
  await searchableSelect.typeSearch(page, this.categoryQuery);
  await searchableSelect.pressKey(page, 'ArrowDown');

  const activeOptionId = await searchableSelect.activeOptionId(page);
  assert.ok(
    activeOptionId,
    'ArrowDown must move the active option, announced through aria-activedescendant'
  );

  await searchableSelect.pressKey(page, 'Enter');
  await searchableSelect.expectClosed(page);

  const label = await searchableSelect.triggerLabel(page);
  assert.strictEqual(
    label,
    'Maintenance & Repairs',
    'Enter must select the active category on the narrowed list'
  );
  assert.strictEqual(
    await searchableSelect.storedValue(page),
    'Maintenance & Repairs',
    'the form must store the chosen category, not just print its name'
  );
});
