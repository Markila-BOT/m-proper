'use strict';

// Thin HTTP client for the running API. No step logic lives here — the World
// records each subject request so the Then steps can assert over exactly the
// client behavior the scenario names.

const { state } = require('./harness');

function apiBaseUrl() {
  if (!state.apiBaseUrl) {
    throw new Error('The API base URL is not set — the suite must boot the API before HTTP scenarios.');
  }
  return state.apiBaseUrl;
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  const options = { method, signal: AbortSignal.timeout(20_000) };
  if (body !== undefined) {
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${apiBaseUrl()}${path}`, options);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null; // non-envelope bodies (e.g. plain-text rejections) stay raw
  }
  return { status: response.status, ok: response.ok, body: parsed, text };
}

function getPropertiesList() {
  return apiFetch('/properties');
}

function postProperty(payload) {
  return apiFetch('/properties', { method: 'POST', body: payload });
}

function deletePropertyById(id) {
  return apiFetch(`/properties/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

function deletePropertyWithoutId() {
  return apiFetch('/properties', { method: 'DELETE' });
}

function getApiHealth() {
  return apiFetch('/health');
}

module.exports = {
  apiFetch,
  getPropertiesList,
  postProperty,
  deletePropertyById,
  deletePropertyWithoutId,
  getApiHealth,
};
