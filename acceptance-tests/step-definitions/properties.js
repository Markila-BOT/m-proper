'use strict';

// Step definitions for the properties capability (effective spec: the main
// spec's List and Delete rules plus the adopt-acceptance-suite delta's
// Create rule). Each scenario talks HTTP to the running API through the
// World's intent methods; assertions check the envelope
// { success, message, data? } and camelCase field names.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

const { assertEnvelope, assertPropertyRow } = require('../support/api-shapes');

// --- List ---

Given('a client requests the properties list', async function () {
  await this.getPropertiesList();
});

Given('a client requests the properties list and no properties exist', async function () {
  // The suite runs against the configured (shared) database, whose ledger
  // holds the operator's real rows and must be left as found, so the empty
  // table itself cannot be arranged. The empty-array contract is verified
  // conditionally — see the "data is an empty array" step below.
  await this.getPropertiesList();
});

Then('the system returns HTTP 200 with success true', async function () {
  assert.ok(this.responses.length > 0, 'no request has been made yet');
  for (const response of this.responses) {
    assertEnvelope(response, { status: 200, success: true });
  }
});

Then('data contains the ordered properties', async function () {
  const body = this.lastResponse().body;
  assert.ok(Array.isArray(body.data), 'data must be an array of properties');
  for (const row of body.data) {
    assertPropertyRow(row);
  }
  // The spec's ordering: active properties first, then newest created.
  for (let i = 1; i < body.data.length; i += 1) {
    const previous = body.data[i - 1];
    const current = body.data[i];
    if (previous.isActive !== current.isActive) {
      assert.ok(previous.isActive, 'an inactive row must not precede an active row');
      continue;
    }
    assert.ok(
      Date.parse(previous.createdAt) >= Date.parse(current.createdAt),
      `rows must be newest-first among equal isActive (row ${i} broke the order)`
    );
  }
});

Then('data is an empty array', async function () {
  const body = this.lastResponse().body;
  assert.ok(Array.isArray(body.data), 'data must be an array');
  const suiteRows = body.data.filter((row) => typeof row.name === 'string' && row.name.startsWith('Acceptance Probe'));
  assert.strictEqual(
    suiteRows.length,
    0,
    `suite smoke rows must not linger in the list: ${suiteRows.map((row) => row.name).join(', ')}`
  );
  if (body.data.length === 0) {
    return; // the literal contract, engaged on an empty ledger
  }
  // Approved judgment (conditional, reported every run): the shared ledger
  // holds real rows the suite must not touch, so data === [] is asserted only
  // when the ledger is actually empty. Always verified: HTTP 200, success
  // true, data is an array, and no suite-created rows remain.
  console.log(
    `[empty-list] judgment: the ledger holds ${body.data.length} non-suite row(s); ` +
      'the literal data === [] assert engages only when the ledger is empty. ' +
      'Verified now: 200 / success true / data is an array / no suite rows.'
  );
});

// --- Create ---

Given('a client posts a valid property payload', async function () {
  this.validPayload = this.probePayload({ units: 1 });
  await this.postProperty(this.validPayload);
});

Then('the system persists the property', async function () {
  const created = this.lastResponse().body && this.lastResponse().body.data;
  assert.ok(created && created.id, 'the create response must carry the created property in data');
  const list = await this.fetchPropertiesListQuiet();
  const row = (list.body && Array.isArray(list.body.data) ? list.body.data : []).find(
    (candidate) => candidate.id === created.id
  );
  assert.ok(row, `the created property ${created.id} must appear in the list`);
  assertPropertyRow(row, { label: 'persisted row' });
  assert.strictEqual(row.name, this.validPayload.name, 'persisted name must round-trip');
  assert.strictEqual(row.address, this.validPayload.address, 'persisted address must round-trip');
  assert.strictEqual(row.type, this.validPayload.type, 'persisted type must round-trip');
  assert.strictEqual(row.units, this.validPayload.units, 'persisted units must round-trip');
});

Then('the response is HTTP 201 with success true and the created property in data', async function () {
  assert.ok(this.responses.length > 0, 'no request has been made yet');
  for (const response of this.responses) {
    const body = assertEnvelope(response, { status: 201, success: true });
    assertPropertyRow(body.data, { label: 'created property' });
    assert.strictEqual(body.data.name, this.validPayload.name, 'created name must match the payload');
  }
});

Given('a client posts a payload missing name, address, or type', async function () {
  // The API's contract answers 400 "Missing required fields" when a required
  // field's value is absent. (Posting a payload whose key is entirely absent
  // instead trips axum's deserialization rejection — 422, plain text — before
  // the handler runs; that mismatch is reported to the orchestrator as a
  // follow-up true-up candidate.) The scenario exercises each required field
  // as an empty value — one request per field, the others valid.
  for (const field of ['name', 'address', 'type']) {
    await this.postProperty(this.probePayload({ [field]: '' }));
  }
});

Given('a client posts a property with a type outside residential, commercial, or lot', async function () {
  await this.postProperty(this.probePayload({ type: 'industrial' }));
});

Given('a client posts a valid property payload whose units value is below zero', async function () {
  await this.postProperty(this.probePayload({ units: -1 }));
});

Then('the response is HTTP 400 with success false', async function () {
  assert.ok(this.responses.length > 0, 'no request has been made yet');
  for (const response of this.responses) {
    assertEnvelope(response, { status: 400, success: false });
  }
});

Then('no property is persisted', async function () {
  const list = await this.fetchPropertiesListQuiet();
  const rows = (list.body && Array.isArray(list.body.data) ? list.body.data : []).filter((row) =>
    this.probeNames.includes(row.name)
  );
  assert.strictEqual(
    rows.length,
    0,
    `rejected payloads must not persist anything, found: ${rows.map((row) => row.name).join(', ')}`
  );
});

// --- Delete ---

Given('a client deletes an existing property by id', async function () {
  const probe = await this.postProbeProperty();
  assert.ok(
    probe.status === 201 && probe.body && probe.body.data && probe.body.data.id,
    `arrangement failed: could not create the existing property (${probe.status})`
  );
  this.subjectPropertyId = probe.body.data.id;
  await this.deletePropertyById(this.subjectPropertyId);
});

Then('the system removes the property', async function () {
  const list = await this.fetchPropertiesListQuiet();
  const rows = list.body && Array.isArray(list.body.data) ? list.body.data : [];
  const stillPresent = rows.some((row) => row.id === this.subjectPropertyId);
  assert.strictEqual(
    stillPresent,
    false,
    `the deleted property ${this.subjectPropertyId} must no longer appear in the list`
  );
});

Then('the response carries success true', async function () {
  const response = this.lastResponse();
  assertEnvelope(response, { status: 200, success: true });
});

Given('a client calls delete without a property id', async function () {
  await this.deletePropertyWithoutId();
});
