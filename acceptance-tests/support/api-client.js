'use strict';

// Thin HTTP client for the running API. No step logic lives here — the World
// records each subject request so the Then steps can assert over exactly the
// client behavior the scenario names.
//
// The API verifies a Supabase access token on every property route. By
// default the client sends the primary owner's token from the run's signed-in
// session (support/auth-state.js); pass `token: null` to make an
// unauthenticated request and `token: '…'` to send a specific one. The token
// was obtained in Node from the cookie session the browser signed in with, so
// the harness never needs a second password grant.

const { state } = require('./harness');
const authState = require('./auth-state');

function apiBaseUrl() {
  if (!state.apiBaseUrl) {
    throw new Error('The API base URL is not set — the suite must boot the API before HTTP scenarios.');
  }
  return state.apiBaseUrl;
}

function defaultAccessToken() {
  if (!state.webBaseUrl) return null;
  const token = authState.accessTokenForOrigin(state.webBaseUrl);
  if (!token) {
    throw new Error(
      'No signed-in primary-owner session is available for API requests. The harness signs in ' +
        'through the real sign-in page at boot; if chromium is missing, install it with ' +
        '`npx playwright install chromium` inside acceptance-tests/.'
    );
  }
  return token;
}

async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const options = { method, signal: AbortSignal.timeout(20_000) };
  const headers = {};
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  // undefined → the primary session; null → no Authorization header.
  const bearer = token === undefined ? defaultAccessToken() : token;
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  if (Object.keys(headers).length > 0) options.headers = headers;

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

function getPropertiesList(options = {}) {
  return apiFetch('/properties', options);
}

function postProperty(payload, options = {}) {
  return apiFetch('/properties', { ...options, method: 'POST', body: payload });
}

function deletePropertyById(id, options = {}) {
  return apiFetch(`/properties/${encodeURIComponent(id)}`, { ...options, method: 'DELETE' });
}

function deletePropertyWithoutId(options = {}) {
  return apiFetch('/properties', { ...options, method: 'DELETE' });
}

function getApiHealth(options = {}) {
  return apiFetch('/health', options);
}

module.exports = {
  apiFetch,
  getPropertiesList,
  postProperty,
  deletePropertyById,
  deletePropertyWithoutId,
  getApiHealth,
};
