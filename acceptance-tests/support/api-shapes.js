'use strict';

// Shared HTTP-contract assertions: the { success, message, data? } envelope
// and the camelCase property row. Step files stay pure intent + assertions.

const assert = require('node:assert/strict');

const PROPERTY_TYPES = new Set(['residential', 'commercial', 'lot']);
const PROPERTY_ROW_KEYS = ['id', 'name', 'address', 'type', 'isActive', 'createdAt'];

function assertEnvelope(response, { status, success }) {
  assert.ok(response.body, `expected a JSON envelope, got: ${response.text?.slice(0, 200)}`);
  assert.strictEqual(response.status, status, `expected HTTP ${status}, got ${response.status}`);
  assert.strictEqual(
    response.body.success,
    success,
    `expected success ${success}, got ${JSON.stringify(response.body.success)}`
  );
  assert.strictEqual(typeof response.body.message, 'string', 'envelope message must be a string');
  assert.ok(response.body.message.length > 0, 'envelope message must be non-empty');
  for (const key of Object.keys(response.body)) {
    assert.ok(
      ['success', 'message', 'data'].includes(key),
      `envelope must carry only success/message/data, found "${key}"`
    );
  }
  return response.body;
}

function assertPropertyRow(row, { label = 'property row' } = {}) {
  assert.strictEqual(typeof row, 'object', `${label} must be an object`);
  for (const key of PROPERTY_ROW_KEYS) {
    assert.ok(key in row, `${label} must carry camelCase field "${key}"`);
  }
  assert.strictEqual(typeof row.id, 'string', `${label}.id must be a string (uuid)`);
  assert.strictEqual(typeof row.name, 'string', `${label}.name must be a string`);
  assert.strictEqual(typeof row.address, 'string', `${label}.address must be a string`);
  assert.ok(PROPERTY_TYPES.has(row.type), `${label}.type must be one of residential/commercial/lot`);
  assert.strictEqual(typeof row.isActive, 'boolean', `${label}.isActive must be a boolean`);
  assert.ok(!Number.isNaN(Date.parse(row.createdAt)), `${label}.createdAt must be a timestamp`);
  if ('units' in row) {
    assert.ok(
      typeof row.units === 'number' && Number.isInteger(row.units),
      `${label}.units must be an integer when present`
    );
  }
}

module.exports = { assertEnvelope, assertPropertyRow, PROPERTY_TYPES };
