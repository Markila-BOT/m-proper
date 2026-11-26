'use strict';

// Seeded identities and disposable accounts.
//
// The acceptance environment seeds three landlords through the Auth admin API
// (design §9): the bootstrap owner and two test owners, A and B. A is the
// suite's primary identity; B exists for cross-owner isolation. Those three
// accounts are shared and must never be deleted by the harness.
//
// Sign-up, sign-out, and password-reset scenarios use disposable identities
// instead: users created here through the admin API, confirmed (or deliberately
// left unconfirmed), and removed before the run ends. Every address carries
// the disposable prefix, and deleteDisposableUser refuses anything else — so a
// bug or a wrong argument can never remove a seeded identity.
//
// The admin key lives in acceptance-tests/.env.local (see support/env.js) and
// is used only by Node's fetch. It is never handed to a page or a storage
// state.

const { randomUUID } = require('node:crypto');

const { acceptanceEnv } = require('./env');
const { RUN_STAMP } = require('./harness');

const DISPOSABLE_EMAIL_PREFIX = 'acceptance-disposable-';
const DISPOSABLE_EMAIL_DOMAIN = 'm-proper.test';

// Run-unique so two runs (and the parent/child runs) never collide, and short
// enough to stay a legal local part.
const RUN_TAG = RUN_STAMP.toLowerCase().replace(/[^a-z0-9]/g, '');
let disposableCounter = 0;

// The accounts the operator seeded. These are the only identities the suite
// may sign in as for shared work, and the ones it must never remove.
let seededCache = null;

function seededIdentities() {
  if (seededCache) return seededCache;
  const env = acceptanceEnv();
  seededCache = Object.freeze({
    owner: Object.freeze({
      key: 'owner',
      label: 'bootstrap owner',
      email: env.SEED_OWNER_EMAIL,
      password: env.SEED_OWNER_PASSWORD,
      userId: null,
    }),
    primary: Object.freeze({
      key: 'primary',
      label: 'test owner A',
      email: env.SEED_A_EMAIL,
      password: env.SEED_A_PASSWORD,
      userId: env.TEST_OWNER_A_ID,
    }),
    second: Object.freeze({
      key: 'second',
      label: 'test owner B',
      email: env.SEED_B_EMAIL,
      password: env.SEED_B_PASSWORD,
      userId: env.TEST_OWNER_B_ID,
    }),
  });
  return seededCache;
}

function seededEmailList() {
  const seeded = seededIdentities();
  return [seeded.owner.email, seeded.primary.email, seeded.second.email].map((email) =>
    email.toLowerCase()
  );
}

function isSeededEmail(email) {
  return typeof email === 'string' && seededEmailList().includes(email.toLowerCase());
}

// Resolve a named seeded identity ('primary' | 'second' | 'owner').
function identityFor(name) {
  const seeded = seededIdentities();
  const identity = seeded[name];
  if (!identity) {
    throw new Error(
      `Unknown seeded identity "${name}". Use one of: ${Object.keys(seeded).join(', ')}.`
    );
  }
  return identity;
}

// ---------------------------------------------------------------------------
// The disposable-address guard
// ---------------------------------------------------------------------------

// Throws unless the address is one this harness is allowed to remove. This is
// the guard every delete path goes through — including the run-wide sweep.
function assertDisposableEmail(email) {
  if (typeof email !== 'string' || email.length === 0) {
    throw new Error('Refusing to delete a disposable account without an email address.');
  }

  if (isSeededEmail(email)) {
    throw new Error(
      `Refusing to delete ${email}: it is a seeded identity, not a disposable account.`
    );
  }

  const at = email.lastIndexOf('@');
  const localPart = at === -1 ? '' : email.slice(0, at);
  const domain = at === -1 ? '' : email.slice(at + 1);

  if (domain !== DISPOSABLE_EMAIL_DOMAIN || !localPart.startsWith(DISPOSABLE_EMAIL_PREFIX)) {
    throw new Error(
      `Refusing to delete ${email}: only addresses beginning "${DISPOSABLE_EMAIL_PREFIX}" ` +
        `at ${DISPOSABLE_EMAIL_DOMAIN} are disposable accounts created by the acceptance suite.`
    );
  }
}

function isDisposableEmail(email) {
  try {
    assertDisposableEmail(email);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Admin API (Node only)
// ---------------------------------------------------------------------------

function adminHeaders() {
  const env = acceptanceEnv();
  // The key is read here and placed only on requests made by Node's fetch.
  // Nothing in this module ever returns the headers or logs them.
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function adminRequest(path, { method = 'GET', body } = {}) {
  const env = acceptanceEnv();
  const headers = adminHeaders();
  const options = { method, headers, signal: AbortSignal.timeout(20_000) };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, options);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  return { status: response.status, ok: response.ok, body: parsed, text };
}

// The admin response's message, sanitized: a status and the Auth error's own
// message only, never a request header or a key.
function adminFailureMessage(action, response) {
  const detail = response.body && (response.body.msg || response.body.message || response.body.error_description);
  return `${action} failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`;
}

function nextDisposableEmail() {
  disposableCounter += 1;
  const unique = randomUUID().slice(0, 8);
  return `${DISPOSABLE_EMAIL_PREFIX}${RUN_TAG}-${disposableCounter}-${unique}@${DISPOSABLE_EMAIL_DOMAIN}`;
}

function generatePassword() {
  // Comfortably above the project's minimum; the disposable accounts never
  // outlive the scenario that made them.
  return `Acceptance-${randomUUID()}-Aa1!`;
}

// Every disposable user this process created, keyed by id, so the run-wide
// sweep can remove even accounts a failed scenario forgot. The registry holds
// no tokens, only the identity's own email/password/id.
const createdUsers = new Map();

async function createDisposableUser({ confirmed = true, email, password } = {}) {
  const address = email || nextDisposableEmail();
  assertDisposableEmail(address);
  const secret = password || generatePassword();

  const response = await adminRequest('/admin/users', {
    method: 'POST',
    body: { email: address, password: secret, email_confirm: confirmed },
  });

  if (!response.ok || !response.body || !response.body.id) {
    throw new Error(
      `${adminFailureMessage(`Creating disposable account ${address}`, response)} ` +
        '(the Supabase admin key and URL come from acceptance-tests/.env.local).'
    );
  }

  const identity = {
    id: response.body.id,
    email: address,
    password: secret,
    confirmed: Boolean(confirmed),
  };
  createdUsers.set(identity.id, identity);
  return identity;
}

// The unconfirmed counterpart: confirmation is enabled in the project, so
// sign-in must be refused until the address is confirmed.
function createUnconfirmedDisposableUser(options = {}) {
  return createDisposableUser({ ...options, confirmed: false });
}

// Arrangement credentials without creating the account: scenario 3 signs a
// brand-new address up through the real page, so the address must exist
// before the user does.
function nextDisposableCredentials() {
  return { email: nextDisposableEmail(), password: generatePassword() };
}

// The Auth admin API's link generator. Confirmation and recovery mail cannot
// arrive in this environment (no SMTP provider is configured), so the harness
// produces the same links the mail templates would carry:
//
//   - `signup` returns the confirmation link for an unconfirmed address (it
//     accepts an existing unconfirmed user, which is the arrangement case);
//   - `recovery` returns the recovery link for an existing address.
//
// The response's `user.id` is authoritative, so callers can register an
// account the browser created and have it swept at teardown.
async function createSignupLink(email) {
  const response = await adminRequest('/admin/generate_link', {
    method: 'POST',
    body: { type: 'signup', email },
  });
  if (!response.ok || !response.body || !response.body.action_link) {
    throw new Error(`${adminFailureMessage(`Generating a confirmation link for ${email}`, response)}`);
  }
  return {
    userId: response.body.id,
    email: response.body.email,
    actionLink: response.body.action_link,
    tokenHash: response.body.hashed_token,
    verificationType: response.body.verification_type,
  };
}

async function createRecoveryLink(email, redirectTo) {
  const response = await adminRequest('/admin/generate_link', {
    method: 'POST',
    body: { type: 'recovery', email, redirect_to: redirectTo },
  });
  if (!response.ok || !response.body || !response.body.action_link) {
    throw new Error(`${adminFailureMessage(`Generating a recovery link for ${email}`, response)}`);
  }
  return {
    userId: response.body.id,
    email: response.body.email,
    actionLink: response.body.action_link,
    tokenHash: response.body.hashed_token,
    verificationType: response.body.verification_type,
  };
}

// Register an account the browser created (or the admin link generator
// returned) so the run-wide sweep removes it even when its scenario failed.
// The disposable guard runs first; a seeded address can never be registered.
function registerDisposableUser({ id, email, password = null, confirmed = false }) {
  assertDisposableEmail(email);
  if (!id) {
    throw new Error(`Cannot register disposable account ${email} without its user id.`);
  }
  const identity = { id, email, password, confirmed: Boolean(confirmed) };
  createdUsers.set(id, identity);
  return identity;
}

// The admin list, filtered by address: used only to find an account the
// browser created so cleanup can remove it.
async function findAdminUserByEmail(email) {
  if (typeof email !== 'string' || email.length === 0) return null;
  const response = await adminRequest('/admin/users?page=1&per_page=1000');
  if (!response.ok || !response.body || !Array.isArray(response.body.users)) {
    throw new Error(adminFailureMessage('Listing Auth users', response));
  }
  return (
    response.body.users.find(
      (user) => String(user.email || '').toLowerCase() === email.toLowerCase()
    ) || null
  );
}

async function getAdminUser(id) {
  const response = await adminRequest(`/admin/users/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(adminFailureMessage(`Reading account ${id}`, response));
  }
  return response.body;
}

// Delete one disposable account. The guard runs before any request, and the
// registry entry is removed even when the account is already gone.
async function deleteDisposableUser(identityOrEmail) {
  const identity =
    typeof identityOrEmail === 'string' ? { email: identityOrEmail } : identityOrEmail || {};
  const email = identity.email;
  assertDisposableEmail(email);

  let id = identity.id;
  if (!id) {
    const registered = [...createdUsers.values()].find(
      (candidate) => candidate.email.toLowerCase() === email.toLowerCase()
    );
    id = registered ? registered.id : null;
  }

  if (!id) {
    throw new Error(
      `Cannot delete disposable account ${email}: its user id is unknown to this run.`
    );
  }

  // The id must belong to the guarded address: a mismatched pair can never
  // reach a seeded account even if a caller passes one by mistake.
  const existing = await getAdminUser(id);
  if (existing && String(existing.email).toLowerCase() !== email.toLowerCase()) {
    throw new Error(
      `Refusing to delete user ${id}: it belongs to ${existing.email}, not the disposable address ${email}.`
    );
  }

  const response = await adminRequest(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  // A 404 means the account is already gone — the cleanup goal is met.
  if (!response.ok && response.status !== 404) {
    throw new Error(adminFailureMessage(`Deleting disposable account ${email}`, response));
  }

  createdUsers.delete(id);
  return { id, email, deleted: true };
}

// Delete a list of identities (one scenario's), regardless of which one
// fails: every account is attempted, and failures are reported together.
async function deleteDisposableUsers(identities) {
  const summary = { deleted: [], failed: [] };
  for (const identity of identities || []) {
    try {
      const result = await deleteDisposableUser(identity);
      summary.deleted.push(result.email);
    } catch (error) {
      summary.failed.push({ email: identity && identity.email, message: error.message });
    }
  }
  return summary;
}

// The run-wide sweep: every still-registered disposable account, attempted
// even when one delete fails. Seeded identities are never in the registry and
// would be refused by the guard anyway.
async function removeAllDisposableUsers() {
  const remaining = [...createdUsers.values()];
  const summary = await deleteDisposableUsers(remaining);
  return summary;
}

function registeredDisposableUsers() {
  return [...createdUsers.values()].map(({ id, email, confirmed }) => ({ id, email, confirmed }));
}

module.exports = {
  DISPOSABLE_EMAIL_PREFIX,
  DISPOSABLE_EMAIL_DOMAIN,
  seededIdentities,
  identityFor,
  isDisposableEmail,
  isSeededEmail,
  assertDisposableEmail,
  nextDisposableCredentials,
  createDisposableUser,
  createUnconfirmedDisposableUser,
  createSignupLink,
  createRecoveryLink,
  registerDisposableUser,
  findAdminUserByEmail,
  getAdminUser,
  deleteDisposableUser,
  deleteDisposableUsers,
  removeAllDisposableUsers,
  registeredDisposableUsers,
};
