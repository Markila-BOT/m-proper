'use strict';

// Thin HTTP client for the running app. No step logic lives here — the World
// records each subject request so the Then steps can assert over exactly the
// client behavior the scenario names.
//
// The app serves the properties routes on its own origin and establishes
// identity from the Supabase session cookie. The client therefore sends the
// same signed-in storage state the browser holds: a Playwright
// `request.newContext({ storageState })` per identity (the primary owner, the
// second owner, a forged state). No request carries an `Authorization`
// header — that path is gone from the product.
//
// `session: false` makes an unauthenticated request (no cookie jar at all);
// `storageState: …` sends a specific signed-in state; `baseUrl` points at a
// second app instance when a scenario owns one. The state was obtained in
// Node from the cookie session the browser signed in with, so the harness
// never needs a second password grant.

const { request } = require('@playwright/test');

const { state } = require('./harness');
const authState = require('./auth-state');

// The cookie belongs on the app's own origin, so a state-changing request must
// carry the same-origin signal the app's CSRF gate requires. A real browser
// sends `Origin` on POST/DELETE; the headless request context does not, so it
// is stated here. `Sec-Fetch-Site` also satisfies the gate.
const SAME_ORIGIN_HEADERS = { 'sec-fetch-site': 'same-origin' };

const cachedContexts = new Map();
const openContexts = new Set();

function appBaseUrl() {
  if (!state.webBaseUrl) {
    throw new Error('The app base URL is not set — the suite must boot the app before HTTP scenarios.');
  }
  return state.webBaseUrl;
}

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || appBaseUrl()).replace(/\/+$/, '');
}

function sameOriginHeaders(baseUrl) {
  return {
    ...SAME_ORIGIN_HEADERS,
    origin: normalizeBaseUrl(baseUrl),
  };
}

function storageStateForIdentity(identity) {
  const storageState = authState.getStorageState({ origin: appBaseUrl(), identity });
  if (!storageState) {
    throw new Error(
      `No signed-in ${identity} session is available for app requests. The harness signs in ` +
        'through the real sign-in page at boot; if chromium is missing, install it with ' +
        '`npx playwright install chromium` inside acceptance-tests/.'
    );
  }
  return storageState;
}

// Creates (and registers) one request context. `storageState` wins over
// `identity`; `session: false` creates a jar with no session cookie.
async function createContext({ baseUrl, identity = 'primary', storageState, session = true } = {}) {
  const resolvedBase = normalizeBaseUrl(baseUrl);
  const context = await request.newContext({
    baseURL: resolvedBase,
    ...(session
      ? { storageState: storageState || storageStateForIdentity(identity) }
      : {}),
    extraHTTPHeaders: sameOriginHeaders(resolvedBase),
    timeout: 20_000,
  });
  openContexts.add(context);
  return context;
}

async function closeContext(context) {
  if (!context) return;
  openContexts.delete(context);
  await context.dispose().catch(() => {});
}

// The cached context for an identity (or the anonymous jar), so a scenario's
// repeated requests reuse one cookie jar instead of building one per call.
async function contextFor({ baseUrl, identity = 'primary', storageState, session = true } = {}) {
  const resolvedBase = normalizeBaseUrl(baseUrl);
  const key = `${resolvedBase}::${session ? (storageState ? 'forged' : identity) : 'anonymous'}`;
  if (!storageState && cachedContexts.has(key)) return cachedContexts.get(key);
  const context = await createContext({ baseUrl: resolvedBase, identity, storageState, session });
  if (!storageState) cachedContexts.set(key, context);
  return context;
}

async function fetchWith(context, path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['content-type'] = 'application/json';

  const response = await context.fetch(path, {
    method,
    headers: requestHeaders,
    ...(body === undefined ? {} : { data: body }),
    failOnStatusCode: false,
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null; // non-envelope bodies (a crash page, plain text) stay raw
  }
  return { status: response.status(), ok: response.ok(), body: parsed, text };
}

// One request against the app (or a named app instance). `options.context`
// reuses a caller-owned jar; the rest select one.
async function apiFetch(path, { method = 'GET', body, headers, context, baseUrl, identity, storageState, session } = {}) {
  const resolvedContext =
    context || (await contextFor({ baseUrl, identity, storageState, session }));
  return fetchWith(resolvedContext, path, { method, body, headers });
}

function getPropertiesList(options = {}) {
  return apiFetch('/api/properties', options);
}

function postProperty(payload, options = {}) {
  return apiFetch('/api/properties', { ...options, method: 'POST', body: payload });
}

function deletePropertyById(id, options = {}) {
  return apiFetch(`/api/properties/${encodeURIComponent(id)}`, { ...options, method: 'DELETE' });
}

function deletePropertyWithoutId(options = {}) {
  return apiFetch('/api/properties', { ...options, method: 'DELETE' });
}

function getApiHealth(options = {}) {
  return apiFetch('/api/health', options);
}

// Closes every context this module opened. The After hook closes a scenario's
// forged jars; AfterAll closes whatever remains (the cached identity jars).
async function closeAllContexts() {
  const contexts = [...openContexts];
  openContexts.clear();
  cachedContexts.clear();
  await Promise.all(contexts.map((context) => context.dispose().catch(() => {})));
}

function openContextCount() {
  return openContexts.size;
}

module.exports = {
  createContext,
  closeContext,
  contextFor,
  fetchWith,
  apiFetch,
  getPropertiesList,
  postProperty,
  deletePropertyById,
  deletePropertyWithoutId,
  getApiHealth,
  closeAllContexts,
  openContextCount,
};
