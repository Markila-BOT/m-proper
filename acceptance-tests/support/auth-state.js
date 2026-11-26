'use strict';

// Sign-in once per origin and reuse the browser session.
//
// A Supabase session is cookie-backed, and cookies do not cross origins. The
// suite signs the primary owner (test owner A) in through the real sign-in
// page once per origin it opens — the parent's web port and, in its own
// process, the suite-minus-self child's offset port — then caches the
// Playwright storage state under that origin for the rest of the run. Every
// scenario context is created from the cached state, so the suite pays for
// one sign-in per origin, not one per scenario.
//
// Test owner B is available through the same cache under its own identity
// key. A context is only ever created with one identity's state; the harness
// never mixes two identities in one context.
//
// The storage state carries the public cookie session only. The service key
// never enters a page: the admin calls live in support/identities.js and are
// made by Node. The assertions here read the page's own storage (cookies,
// localStorage, sessionStorage) and check it in Node — the secret is never
// passed into page.evaluate.

const { acceptanceEnv } = require('./env');
const identities = require('./identities');
const signInPage = require('../pages/sign-in');

// key = `${origin}::${identity}` → session record.
const sessions = new Map();
const signInCounts = new Map();

function originOf(url) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function cacheKey(origin, identity) {
  return `${originOf(origin)}::${identity}`;
}

// Decode the @supabase/ssr cookie session. The cookie is named
// `sb-<project-ref>-auth-token` (possibly chunked as `.0`, `.1`, …) and holds
// either raw JSON or `base64-` + base64url(JSON) of the auth-js session.
function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function sessionFromStorageState(storageState) {
  const groups = new Map();
  for (const cookie of (storageState && storageState.cookies) || []) {
    const match = /^(sb-.+-auth-token)(?:\.(\d+))?$/.exec(cookie.name);
    if (!match) continue;
    const base = match[1];
    const index = match[2] === undefined ? -1 : Number(match[2]);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ index, value: cookie.value });
  }

  for (const chunks of groups.values()) {
    chunks.sort((a, b) => a.index - b.index);
    let raw = chunks.map((chunk) => chunk.value).join('');
    if (raw.startsWith('base64-')) {
      try {
        raw = decodeBase64Url(raw.slice('base64-'.length));
      } catch {
        continue;
      }
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.access_token) return parsed;
    } catch {
      // A partial or mismatched chunk set: not a session.
    }
  }
  return null;
}

function accessTokenFromStorageState(storageState) {
  const session = sessionFromStorageState(storageState);
  return session ? { accessToken: session.access_token, session } : null;
}

// ---------------------------------------------------------------------------
// Stored-session rewriting (the web-app token scenarios)
// ---------------------------------------------------------------------------
//
// The project's ES256 private key is not available, so the harness cannot mint
// an access token that is *validly signed* and deliberately expired, and it
// cannot revoke a token the API will still refuse. It can, however, rewrite the
// session the browser already stored, because the @supabase/ssr cookie carries
// the two facts the client reads:
//
//   - `expires_at`, which is what supabase-js compares to decide a session is
//     stale (the JWT's own `exp` is not consulted for that decision);
//   - the `refresh_token`, which it exchanges at `…/auth/v1/token`.
//
// Moving `expires_at` into the past therefore forces exactly the refresh a
// genuinely expired access token forces, with the real refresh token; replacing
// the access token's signature (keeping its header and claims) forces exactly
// the 401 a genuinely rejected token forces. Each step says which was used and
// why; neither fabricates a token the project would have issued.

const AUTH_COOKIE_PATTERN = /^(sb-.+-auth-token)(?:\.(\d+))?$/;
// @supabase/ssr's chunk bound; a value longer than this is split into `.0`, `.1`, …
const AUTH_COOKIE_CHUNK_SIZE = 3180;

function authCookieGroups(cookies) {
  const groups = new Map();
  for (const cookie of cookies || []) {
    const match = AUTH_COOKIE_PATTERN.exec(cookie.name);
    if (!match) continue;
    const base = match[1];
    const index = match[2] === undefined ? -1 : Number(match[2]);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push({ index, cookie });
  }

  return [...groups.entries()].map(([base, entries]) => {
    const ordered = entries.sort((a, b) => a.index - b.index);
    return { base, chunks: ordered, cookies: ordered.map((entry) => entry.cookie) };
  });
}

function decodeAuthCookieGroup(group) {
  let raw = group.chunks.map((chunk) => chunk.cookie.value).join('');
  if (raw.startsWith('base64-')) {
    raw = decodeBase64Url(raw.slice('base64-'.length));
  }
  const session = JSON.parse(raw);
  if (!session || !session.access_token) {
    throw new Error(`The ${group.base} cookie does not hold a Supabase session.`);
  }
  return session;
}

function encodeAuthCookieGroup(base, session) {
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  if (value.length <= AUTH_COOKIE_CHUNK_SIZE) {
    return [{ name: base, value }];
  }

  const chunks = [];
  for (let index = 0, offset = 0; offset < value.length; index += 1, offset += AUTH_COOKIE_CHUNK_SIZE) {
    chunks.push({ name: `${base}.${index}`, value: value.slice(offset, offset + AUTH_COOKIE_CHUNK_SIZE) });
  }
  return chunks;
}

// Rewrites the session inside a Playwright storage state without touching a
// browser context. The forged-cookie scenarios use this: they take the real
// signed-in state and change one fact about the access token, then hand the
// result to a headless request context — the same cookie jar the browser
// would carry.
function rewriteStorageStateSession(storageState, mutate) {
  if (!storageState || !Array.isArray(storageState.cookies)) {
    throw new Error('Cannot rewrite the session: the storage state carries no cookies.');
  }
  const groups = authCookieGroups(storageState.cookies);
  if (groups.length === 0) {
    throw new Error('No Supabase session cookie is stored; the browser is signed out.');
  }
  if (groups.length > 1) {
    throw new Error(
      `The storage state holds ${groups.length} Supabase session cookie groups; expected one.`
    );
  }

  const group = groups[0];
  const session = decodeAuthCookieGroup(group);
  mutate(session);

  const template = group.cookies[0];
  const names = new Set(group.cookies.map((cookie) => cookie.name));
  const replacement = encodeAuthCookieGroup(group.base, session);
  const others = storageState.cookies.filter((cookie) => !names.has(cookie.name));

  return {
    ...storageState,
    cookies: [
      ...others,
      ...replacement.map(({ name, value }) => ({
        name,
        value,
        domain: template.domain,
        path: template.path,
        expires: template.expires,
        httpOnly: template.httpOnly,
        secure: template.secure,
        sameSite: template.sameSite,
      })),
    ],
  };
}

// The session the browser currently holds, decoded from its cookie, or null
// when the origin is signed out.
async function storedSession(context, origin) {
  const resolvedOrigin = originOf(origin);
  if (!resolvedOrigin) throw new Error(`Cannot read the session: "${origin}" is not an origin.`);
  const groups = authCookieGroups(await context.cookies(resolvedOrigin));
  if (groups.length === 0) return null;
  if (groups.length > 1) {
    throw new Error(
      `The browser holds ${groups.length} Supabase session cookie groups at ${resolvedOrigin}; expected one.`
    );
  }
  return decodeAuthCookieGroup(groups[0]);
}

// Rewrite the stored session in place. `mutate` receives the decoded session
// object and may change any field; the refresh token is untouched unless the
// caller changes it.
async function rewriteStoredSession(context, { origin, mutate }) {
  const resolvedOrigin = originOf(origin);
  if (!resolvedOrigin) throw new Error(`Cannot rewrite the session: "${origin}" is not an origin.`);

  const groups = authCookieGroups(await context.cookies(resolvedOrigin));
  if (groups.length === 0) {
    throw new Error(`No Supabase session cookie is stored at ${resolvedOrigin}; the browser is signed out.`);
  }
  if (groups.length > 1) {
    throw new Error(
      `The browser holds ${groups.length} Supabase session cookie groups at ${resolvedOrigin}; expected one.`
    );
  }

  const group = groups[0];
  const session = decodeAuthCookieGroup(group);
  mutate(session);

  const template = group.cookies[0];
  const replacement = encodeAuthCookieGroup(group.base, session);
  for (const chunk of group.chunks) {
    await context.clearCookies({ name: chunk.cookie.name });
  }
  await context.addCookies(
    replacement.map(({ name, value }) => ({
      name,
      value,
      domain: template.domain,
      path: template.path,
      expires: template.expires,
      httpOnly: template.httpOnly,
      secure: template.secure,
      sameSite: template.sameSite,
    }))
  );

  return session;
}

// Force the client to treat the access token as expired: the real token and the
// real refresh token stay, only the stored `expires_at` moves into the past.
// This is the realistic simulation the scenario's comment names — the expiry is
// forced by rewriting the stored session, never by waiting an hour.
async function expireStoredSession(context, { origin, secondsAgo = 3600 } = {}) {
  return rewriteStoredSession(context, {
    origin,
    mutate: (session) => {
      session.expires_at = Math.floor(Date.now() / 1000) - secondsAgo;
    },
  });
}

// Replace the stored access token while keeping the refresh token: the app
// answers the next request exactly as it would for a rejected cookie.
// Used where a refresh must be attempted (the project key cannot mint one).
async function replaceStoredAccessToken(context, { origin, token } = {}) {
  if (!token) throw new Error('replaceStoredAccessToken needs the token to store.');
  return rewriteStoredSession(context, {
    origin,
    mutate: (session) => {
      session.access_token = token;
    },
  });
}

// ---------------------------------------------------------------------------
// Secret hygiene
// ---------------------------------------------------------------------------

function assertNoServiceKey(where, serialized) {
  const key = acceptanceEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  if (serialized.includes(key)) {
    // Never echo the key or the storage value that carried it.
    throw new Error(
      `The Supabase service key reached ${where}. The harness must keep admin calls in Node; ` +
        'nothing the browser holds may contain the key.'
    );
  }
}

function assertNoServiceKeyInStorageState(storageState) {
  assertNoServiceKey('the browser storage state', JSON.stringify(storageState));
}

// Reads the page's storage in the page and checks the returned text in Node.
// The secret is never an argument to page.evaluate.
async function assertNoServiceKeyInBrowser(page) {
  const surface = await page.evaluate(() => {
    const dump = (storage) => {
      const entries = {};
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        entries[key] = storage.getItem(key);
      }
      return entries;
    };
    return {
      cookie: document.cookie,
      localStorage: dump(window.localStorage),
      sessionStorage: dump(window.sessionStorage),
    };
  });
  assertNoServiceKey(`the browser at ${page.url()}`, JSON.stringify(surface));
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

async function signInOnce({ browser, origin, identity, credentials }) {
  const resolvedOrigin = originOf(origin);
  if (!resolvedOrigin) throw new Error(`Cannot sign in: "${origin}" is not an origin.`);
  if (!credentials || !credentials.email || !credentials.password) {
    throw new Error(`Cannot sign in ${identity} at ${resolvedOrigin}: credentials are missing.`);
  }

  // A fresh context with no state: this is the one real sign-in per origin,
  // and it must not inherit anybody else's cookies.
  const context = await browser.newContext();
  const page = await context.newPage();
  // The sign-in page is often the web dev server's first real request, so it
  // may pay for an on-demand compile. Give navigation and locators the same
  // generous bound the page object uses.
  page.setDefaultTimeout(signInPage.WAIT_MS);
  page.setDefaultNavigationTimeout(signInPage.WAIT_MS);
  try {
    await signInPage.signIn(page, credentials, { origin: resolvedOrigin });

    const storageState = await context.storageState();
    assertNoServiceKeyInStorageState(storageState);
    await assertNoServiceKeyInBrowser(page);

    const token = accessTokenFromStorageState(storageState);
    if (!token) {
      throw new Error(
        `Sign-in for ${credentials.email} at ${resolvedOrigin} succeeded on screen but wrote no ` +
          'Supabase session cookie; the harness cannot reuse the session.'
      );
    }

    const signedInAt = new Date().toISOString();
    const record = {
      origin: resolvedOrigin,
      identity,
      email: credentials.email,
      userId: token.session.user ? token.session.user.id : null,
      storageState,
      accessToken: token.accessToken,
      expiresAt: token.session.expires_at || null,
      signedInAt,
    };
    sessions.set(cacheKey(resolvedOrigin, identity), record);
    signInCounts.set(
      cacheKey(resolvedOrigin, identity),
      (signInCounts.get(cacheKey(resolvedOrigin, identity)) || 0) + 1
    );

    // The parent run's self-check reads the child run's stderr for this line,
    // proving the child signed in on its own origin. No token, no key.
    console.error(`[harness] signed in ${credentials.email} on ${resolvedOrigin}`);
    return record;
  } finally {
    await context.close().catch(() => {});
  }
}

// The cached session for an origin+identity, signing in once when absent.
async function ensureSession({ browser, origin, identity = 'primary', credentials }) {
  const resolvedOrigin = originOf(origin);
  const key = cacheKey(resolvedOrigin, identity);
  if (sessions.has(key)) return sessions.get(key);

  const resolvedCredentials = credentials || identities.identityFor(identity);
  return signInOnce({
    browser,
    origin: resolvedOrigin,
    identity,
    credentials: resolvedCredentials,
  });
}

// One-off sign-in with arbitrary credentials (a disposable identity, for
// example). Cached under a disposable identity key so a repeated helper call
// reuses the session; the owning scenario deletes the account.
async function signInWithCredentials({ browser, origin, email, password }) {
  return signInOnce({
    browser,
    origin,
    identity: `disposable:${email}`,
    credentials: { email, password },
  });
}

function getStorageState({ origin, identity = 'primary' }) {
  const record = sessions.get(cacheKey(origin, identity));
  return record ? record.storageState : null;
}

// The primary owner's access token for Node-side API calls, or null when this
// origin has not signed in.
function accessTokenForOrigin(origin, identity = 'primary') {
  const record = sessions.get(cacheKey(origin, identity));
  return record ? record.accessToken : null;
}

// A new context for one identity. Isolation scenarios use this for test owner
// B: the state is attached when the context is created, so two identities are
// never signed in simultaneously in the same context.
async function newContextForIdentity(browser, { origin, identity }) {
  const record = await ensureSession({ browser, origin, identity });
  return browser.newContext({ storageState: record.storageState });
}

// ---------------------------------------------------------------------------
// Scenario-owned contexts for disposable identities
// ---------------------------------------------------------------------------
//
// Sign-up, sign-out, and password flows must never run as the shared owner, so
// those scenarios drive a disposable account in a context of their own. These
// helpers create the context, give it the page object's generous bounds, and
// hand both back; the caller closes the context (the harness's After hook also
// closes a context stashed on `world.extraContext`).

function configurePage(page) {
  page.setDefaultTimeout(signInPage.WAIT_MS);
  page.setDefaultNavigationTimeout(signInPage.WAIT_MS);
  return page;
}

async function newUnsignedContext({ browser }) {
  const context = await browser.newContext();
  const page = configurePage(await context.newPage());
  return { context, page };
}

// Sign in as arbitrary credentials in a fresh context, asserting the flow lands
// on the authenticated shell as that address.
async function newSignedInContext({ browser, origin, email, password }) {
  const { context, page } = await newUnsignedContext({ browser });
  try {
    await signInPage.signIn(page, { email, password }, { origin: originOf(origin) });
    return { context, page, storageState: await context.storageState() };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}

function hasSessionCookie(storageState) {
  return sessionFromStorageState(storageState) !== null;
}

// Summaries for the suite's own checks — no tokens, no cookies.
function sessionSummaries() {
  return [...sessions.values()].map(({ origin, identity, email, userId, expiresAt, signedInAt }) => ({
    origin,
    identity,
    email,
    userId,
    expiresAt,
    signedInAt,
  }));
}

function signInCount({ origin, identity = 'primary' }) {
  return signInCounts.get(cacheKey(origin, identity)) || 0;
}

module.exports = {
  originOf,
  sessionFromStorageState,
  accessTokenFromStorageState,
  storedSession,
  rewriteStoredSession,
  rewriteStorageStateSession,
  expireStoredSession,
  replaceStoredAccessToken,
  assertNoServiceKeyInStorageState,
  assertNoServiceKeyInBrowser,
  ensureSession,
  signInWithCredentials,
  getStorageState,
  accessTokenForOrigin,
  newContextForIdentity,
  newUnsignedContext,
  newSignedInContext,
  hasSessionCookie,
  sessionSummaries,
  signInCount,
};
