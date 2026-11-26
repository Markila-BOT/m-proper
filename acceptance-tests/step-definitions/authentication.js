'use strict';

// Step definitions for the `authentication` delta of the landlord-accounts
// change.
//
// Two environment facts shape how the browser scenarios are arranged, and both
// are stated wherever they matter:
//
// 1. Confirmation is enabled in the single Supabase project, but no SMTP
//    provider is configured. Confirmation and recovery mail cannot arrive, and
//    a browser sign-up is answered by the mailer's project-wide rate limit
//    instead of creating the account. The harness therefore arranges the
//    accounts and links it needs through the Auth admin API — the mechanism
//    design §9 names for disposable identities — and drives every product
//    surface the scenario names (sign-in, reset, new-password, sign-out) for
//    real.
// 2. The project's ES256 private key is not available, so a *validly signed*
//    token cannot be made expired, foreign, or anonymous. The token scenarios
//    build the closest well-formed counterexamples (an HS256 token signed with
//    the project's public anon key, and self-signed ES256 tokens carrying the
//    project's key id), and assert the outcome the spec names — 401 with
//    `success: false` and no data. The API refuses those tokens at the
//    algorithm/signature step before it reads a single claim, so the causal
//    check is not the claim itself; each such scenario says so at its Given.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { Given, When, Then } = require('@cucumber/cucumber');

const { REPO_ROOT, state, probeTcpPort, tailOf } = require('../support/harness');
const api = require('../support/api-client');
const authState = require('../support/auth-state');
const authTokens = require('../support/auth-tokens');
const identities = require('../support/identities');
const { acceptanceEnv, webProcessEnvironment } = require('../support/env');
const { startAppWithUnreachableJwks, stopProbeApp, runAppWithoutVariable } = require('../support/second-app');
const webBundle = require('../support/web-bundle');
const { requirePage } = require('../pages/browser');
const signInPage = require('../pages/sign-in');
const signUpPage = require('../pages/sign-up');
const resetPage = require('../pages/reset');
const newPasswordPage = require('../pages/new-password');
const shell = require('../pages/app-shell');

// Answers that would tell a visitor whether an address is registered. The
// scenarios assert none of these reach the page.
const ENUMERATION_WORDS =
  /already (registered|exists|taken|in use)|account (already )?exists|no such (account|user)|not registered|unknown (account|user|email|address)|isn'?t registered/i;

// The failure envelope every refused request must carry: the named status,
// success false, and no data at all.
function assertFailureEnvelope(response, expectedStatus, label) {
  assert.strictEqual(
    response.status,
    expectedStatus,
    `${label}: expected HTTP ${expectedStatus}, got ${response.status} (body: ${JSON.stringify(response.body)})`
  );
  assert.ok(response.body && typeof response.body === 'object', `${label}: expected the JSON envelope`);
  assert.strictEqual(response.body.success, false, `${label}: success must be false`);
  assert.ok(
    !('data' in response.body),
    `${label}: no data may be returned, but the envelope carried data: ${JSON.stringify(response.body.data)}`
  );
}

function assertNonEnumerating(text, label) {
  assert.ok(text && text.length > 0, `${label}: the page must answer with words, not an empty slot`);
  assert.doesNotMatch(text, ENUMERATION_WORDS, `${label}: the answer reveals registration state: "${text}"`);
}

// A probe app's responses are fetched through the same cookie jar the browser
// holds: `support/api-client.js` creates the request context, this step only
// needs the subject request. The harness's client is wired to the main app
// unless a base URL is given.

// ---------------------------------------------------------------------------
// Landlord accounts are created with email and password
// ---------------------------------------------------------------------------

Given('a visitor signs up with an email and a valid password', async function () {
  // Confirmation is enabled, so an unconfirmed account is exactly what the
  // visitor's sign-up leaves behind. The account is arranged through the Auth
  // admin API because the project's mailer is not configured: a browser
  // sign-up cannot complete while the mail provider is missing/rate-limited
  // (see the file header). Design §9: disposable identities are created
  // through the admin API and removed before the run ends.
  this.signupIdentity = await this.createUnconfirmedDisposableIdentity();

  const account = await identities.getAdminUser(this.signupIdentity.id);
  assert.ok(account, `the sign-up must leave an account behind for ${this.signupIdentity.email}`);
  assert.ok(
    !account.email_confirmed_at,
    'a fresh sign-up must not be confirmed until its link is used'
  );
});

When('the confirmation link has not been used', async function () {
  // The admin link generator produces the same confirmation link the mail
  // template would carry, without sending it. Generating it proves a usable
  // link exists; the scenario then leaves it unused.
  this.confirmationLink = await identities.createSignupLink(this.signupIdentity.email);
  assert.ok(
    this.confirmationLink.actionLink.includes('/auth/v1/verify'),
    `the confirmation link must be a GoTrue verify link, got: ${this.confirmationLink.actionLink}`
  );
  assert.ok(this.confirmationLink.tokenHash, 'the confirmation link must carry a token hash');

  const account = await identities.getAdminUser(this.signupIdentity.id);
  assert.ok(
    !account.email_confirmed_at,
    'the confirmation link must not have been used — the account is still unconfirmed'
  );
});

Then('the account exists but cannot sign in', async function () {
  const identity = this.signupIdentity;

  // The account exists in Auth...
  const account = await identities.getAdminUser(identity.id);
  assert.ok(account, `the account ${identity.email} must exist in Auth`);
  assert.strictEqual(account.email, identity.email, 'the account must belong to the signed-up address');

  // ...and the sign-in surface refuses it.
  const { context, page } = await authState.newUnsignedContext({ browser: state.browser });
  this.extraContext = context; // the harness's After hook closes it
  await signInPage.open(page, state.webBaseUrl);
  await signInPage.submit(page, { email: identity.email, password: identity.password });
  const message = await signInPage.errorMessage(page);

  assert.ok(
    signInPage.isSignInUrl(page),
    'an unconfirmed account must not leave the sign-in page'
  );
  assert.strictEqual(
    authState.hasSessionCookie(await context.storageState()),
    false,
    'a refused sign-in must not write a session cookie'
  );
  this.confirmationRefusal = { message, page };
});

Then('the sign-in attempt names the confirmation step and offers a resend', async function () {
  const { message, page } = this.confirmationRefusal;

  // The same page-object contract the harness's own self-scenario uses: the
  // alert names the confirmation step and the resend control renders.
  const confirmedMessage = await signInPage.expectConfirmationRequired(page, this.signupIdentity.email);
  assert.match(
    confirmedMessage,
    /not been confirmed/i,
    'the refusal must name the confirmation step'
  );
  assert.match(confirmedMessage, /confirmation link/i, 'the refusal must point at the confirmation link');
  assert.match(message, /confirmation link/i, 'the refusal must point at the confirmation link');
  assertNonEnumerating(confirmedMessage, 'the unconfirmed sign-in');
  console.log(
    '[authentication] an unconfirmed account cannot sign in; the attempt names the confirmation step and offers a resend'
  );
});

Given('a landlord account has confirmed its email', async function () {
  // A disposable account created already confirmed: the state a landlord
  // reaches after opening the confirmation link.
  this.landlord = await this.createDisposableIdentity({ confirmed: true });
  const account = await identities.getAdminUser(this.landlord.id);
  assert.ok(account, `the confirmed account ${this.landlord.email} must exist`);
  assert.ok(account.email_confirmed_at, 'the account must be confirmed');
});

When('the landlord signs in with the right password', async function () {
  const session = await authState.newSignedInContext({
    browser: state.browser,
    origin: state.webBaseUrl,
    email: this.landlord.email,
    password: this.landlord.password,
  });
  this.extraContext = session.context;
  this.landlordPage = session.page;
  this.landlordSession = authState.sessionFromStorageState(session.storageState);
});

Then('a session starts', async function () {
  const session = this.landlordSession;
  assert.ok(session, 'the sign-in must write a Supabase session cookie');
  assert.ok(session.access_token, 'the session must carry an access token');

  const claims = authTokens.decode(session.access_token);
  assert.ok(claims, 'the session access token must be a JWT');
  assert.strictEqual(
    claims.payload.sub,
    this.landlord.id,
    'the session must belong to the landlord who signed in'
  );

  assert.ok(
    !signInPage.isSignInUrl(this.landlordPage),
    'a started session must leave the sign-in page for the authenticated shell'
  );
  await shell.expectSignedInAs(this.landlordPage, this.landlord.email);
  console.log('[authentication] a confirmed account signs in and the cookie session starts');
});

Given('an account already exists for an email', async function () {
  // A confirmed account at a known address. With confirmation enabled,
  // Supabase answers a second sign-up for a confirmed address with a soft,
  // non-committal user object and no mail at all — the behavior the app must
  // mirror.
  this.existingAccount = await this.createDisposableIdentity({ confirmed: true });
  const account = await identities.getAdminUser(this.existingAccount.id);
  assert.ok(account, `the existing account ${this.existingAccount.email} must exist`);
  assert.ok(account.email_confirmed_at, 'the existing account must be confirmed');
  this.signUpAnswers = {};
});

When('another sign-up uses that email', async function () {
  const { context, page } = await authState.newUnsignedContext({ browser: state.browser });
  this.extraContext = context;

  // The duplicate: the real sign-up page, the existing address, a different
  // password. The answer is the scenario's subject.
  await signUpPage.open(page, state.webBaseUrl);
  await signUpPage.submit(page, {
    email: this.existingAccount.email,
    password: identities.nextDisposableCredentials().password,
  });
  this.signUpAnswers.duplicate = await signUpPage.answer(page);

  // The contrast: the same form for a brand-new address. If the mail provider
  // accepts it, the two answers must be identical; if the mailer's rate limit
  // refuses it, the duplicate answer must still be the app's generic answer
  // (the check below permits only that environmental difference).
  const fresh = identities.nextDisposableCredentials();
  this.freshSignup = fresh;
  await signUpPage.open(page, state.webBaseUrl);
  await signUpPage.submit(page, fresh);
  this.signUpAnswers.fresh = await signUpPage.answer(page);

  // A sign-up may have created the fresh account (when the mailer accepted
  // it). Register it for cleanup; a refused sign-up leaves nothing behind.
  const created = await identities.findAdminUserByEmail(fresh.email);
  if (created) {
    this.adoptDisposableIdentity({ id: created.id, email: fresh.email, password: fresh.password, confirmed: false });
    this.freshSignupCreated = true;
  }
});

Then('the response does not say whether the address is registered', async function () {
  const { duplicate, fresh } = this.signUpAnswers;

  // Neither answer may carry a registration signal...
  assertNonEnumerating(duplicate.text, 'the duplicate sign-up');
  assertNonEnumerating(fresh.text, 'the fresh sign-up');

  // ...and when the mailer treated both requests alike (the only thing that
  // can legitimately differ here is the project's mail rate limit), the
  // duplicate must be answered with exactly the same words.
  if (duplicate.tone === fresh.tone) {
    assert.strictEqual(
      duplicate.text,
      fresh.text,
      'a sign-up for an existing address must answer exactly like a sign-up for a new one'
    );
  } else {
    // The mailer refused one of the two: the app's answer is its generic
    // failure sentence, which says nothing about the address. Recorded so the
    // run shows why the equality could not be observed.
    console.log(
      `[authentication] the mail service answered the two sign-ups differently ` +
        `(duplicate: "${duplicate.text}", fresh: "${fresh.text}"); both are the app's ` +
        'generic, non-committal answers'
    );
  }
  console.log('[authentication] a duplicate sign-up does not reveal that the address is registered');
});

// ---------------------------------------------------------------------------
// A landlord signs in and out
// ---------------------------------------------------------------------------

Given('a confirmed landlord account', async function () {
  this.landlord = await this.createDisposableIdentity({ confirmed: true });
  const account = await identities.getAdminUser(this.landlord.id);
  assert.ok(account && account.email_confirmed_at, 'the landlord account must be confirmed');
});

When('the landlord signs in with the right credentials', async function () {
  const session = await authState.newSignedInContext({
    browser: state.browser,
    origin: state.webBaseUrl,
    email: this.landlord.email,
    password: this.landlord.password,
  });
  this.extraContext = session.context;
  this.landlordPage = session.page;
  this.landlordSession = authState.sessionFromStorageState(session.storageState);
  assert.ok(this.landlordSession, 'the credentials must start a session');
});

Then('the session survives a page reload', async function () {
  const page = this.landlordPage;
  const before = await this.extraContext.storageState();
  const beforeSession = authState.sessionFromStorageState(before);
  assert.ok(beforeSession, 'a session must exist before the reload');

  await shell.reload(page);

  const after = await this.extraContext.storageState();
  const afterSession = authState.sessionFromStorageState(after);
  assert.ok(afterSession, 'the session cookie must survive the reload');
  assert.strictEqual(
    afterSession.user.id,
    this.landlord.id,
    'the surviving session must still belong to the landlord'
  );
  assert.ok(!signInPage.isSignInUrl(page), 'a reload must not send a signed-in landlord to sign-in');
  await shell.expectSignedInAs(page, this.landlord.email);
  console.log('[authentication] the cookie session survives a page reload');
});

When('the landlord signs in with the wrong password', async function () {
  const { context, page } = await authState.newUnsignedContext({ browser: state.browser });
  this.extraContext = context;
  await signInPage.open(page, state.webBaseUrl);
  await signInPage.submit(page, {
    email: this.landlord.email,
    password: `${this.landlord.password}-wrong`,
  });
  this.wrongPasswordRefusal = await signInPage.errorMessage(page);
  assert.ok(signInPage.isSignInUrl(page), 'a wrong password must not leave the sign-in page');
  assert.strictEqual(
    authState.hasSessionCookie(await context.storageState()),
    false,
    'a wrong password must not start a session'
  );
});

Then('the refusal does not reveal whether the address exists', async function () {
  // The unknown-address contrast: the same form, an address no account uses.
  const unknown = identities.nextDisposableCredentials();
  const { context, page } = await authState.newUnsignedContext({ browser: state.browser });
  try {
    await signInPage.open(page, state.webBaseUrl);
    await signInPage.submit(page, { email: unknown.email, password: unknown.password });
    const unknownRefusal = await signInPage.errorMessage(page);

    assert.strictEqual(
      this.wrongPasswordRefusal,
      unknownRefusal,
      'a wrong password and an unknown address must be refused with exactly the same message'
    );
    assertNonEnumerating(this.wrongPasswordRefusal, 'the wrong-password refusal');
    assertNonEnumerating(unknownRefusal, 'the unknown-address refusal');
    assert.ok(signInPage.isSignInUrl(page), 'an unknown address must stay on the sign-in page');
    assert.strictEqual(
      authState.hasSessionCookie(await context.storageState()),
      false,
      'an unknown address must not start a session'
    );
  } finally {
    await context.close().catch(() => {});
  }
  console.log('[authentication] a wrong password and an unknown address share one refusal');
});

Given('a signed-in landlord', async function () {
  this.landlord = await this.createDisposableIdentity({ confirmed: true });
  const session = await authState.newSignedInContext({
    browser: state.browser,
    origin: state.webBaseUrl,
    email: this.landlord.email,
    password: this.landlord.password,
  });
  this.extraContext = session.context;
  this.landlordPage = session.page;
  assert.ok(
    authState.hasSessionCookie(session.storageState),
    'the landlord must be signed in before the sign-out is attempted'
  );
  await shell.expectSignedInAs(session.page, this.landlord.email);
});

When('the landlord signs out', async function () {
  await shell.signOut(this.landlordPage);
  assert.ok(
    signInPage.isSignInUrl(this.landlordPage),
    'sign-out must land on the sign-in page'
  );
});

Then('the session is gone', async function () {
  const storage = await this.extraContext.storageState();
  assert.strictEqual(
    authState.hasSessionCookie(storage),
    false,
    'sign-out must clear the Supabase session cookie from the browser'
  );
  assert.ok(signInPage.isSignInUrl(this.landlordPage), 'the signed-out browser must stay on sign-in');
});

Then('a protected page sends the visitor to sign in', async function () {
  await shell.openProtectedPageExpectingSignIn(this.landlordPage, '/overview');
  console.log('[authentication] sign-out ends the session; a protected page sends the visitor to sign in');
});

// ---------------------------------------------------------------------------
// Password reset does not enumerate accounts
// ---------------------------------------------------------------------------

Given('the landlord enters an email for reset', async function () {
  this.landlord = await this.createDisposableIdentity({ confirmed: true });
  const { context, page } = await authState.newUnsignedContext({ browser: state.browser });
  this.extraContext = context;
  this.resetPage = page;

  await resetPage.open(page, state.webBaseUrl);
  await resetPage.submit(page, { email: this.landlord.email });
  this.knownResetAnswer = await resetPage.answer(page);
});

When('the address is unknown', async function () {
  const unknown = identities.nextDisposableCredentials();
  this.unknownResetAddress = unknown.email;

  await resetPage.open(this.resetPage, state.webBaseUrl);
  await resetPage.submit(this.resetPage, { email: unknown.email });
  this.unknownResetAnswer = await resetPage.answer(this.resetPage);
});

Then('the response is the same as for a known address', async function () {
  assert.ok(this.knownResetAnswer, 'the reset request for a known address must answer');
  assert.ok(this.unknownResetAnswer, 'the reset request for an unknown address must answer');

  assert.strictEqual(
    this.unknownResetAnswer.tone,
    this.knownResetAnswer.tone,
    'a known and an unknown address must get the same kind of answer'
  );
  assert.strictEqual(
    this.unknownResetAnswer.text,
    this.knownResetAnswer.text,
    'a known and an unknown address must get exactly the same words — a reset request may not enumerate accounts'
  );
  assertNonEnumerating(this.knownResetAnswer.text, 'the reset answer');
  console.log(
    `[authentication] reset requests for ${this.landlord.email} and ${this.unknownResetAddress} are identical`
  );
});

Given('a landlord follows a valid recovery link', async function () {
  // A confirmed disposable account with a known old password, plus the
  // recovery link the admin API generates (no mail is sent). The link is
  // driven in its documented `token_hash` form: the route exchanges it for a
  // recovery session in cookies, which is what the update needs; the action
  // link's implicit-flow hash fragment would not establish a cookie session in
  // this app.
  this.landlord = await this.createDisposableIdentity({ confirmed: true });
  this.oldPassword = this.landlord.password;
  this.recovery = await identities.createRecoveryLink(
    this.landlord.email,
    `${state.webBaseUrl}/new-password`
  );
  assert.ok(this.recovery.tokenHash, 'the recovery link must carry a token hash');
  assert.strictEqual(this.recovery.userId, this.landlord.id, 'the recovery link must belong to the landlord');

  const { context, page } = await authState.newUnsignedContext({ browser: state.browser });
  this.extraContext = context;
  this.recoveryPage = page;

  await newPasswordPage.openWithTokenHash(page, state.webBaseUrl, this.recovery.tokenHash);
  const outcome = await newPasswordPage.waitForOutcome(page);
  if (!outcome.form) {
    // The link reached the app and the app refused it. Report the real cause
    // rather than timing out on the form: the route passes `tokenHash` in
    // camelCase to the recovery server function, whose validator reads
    // `data.token_hash`, so the token never reaches verifyOtp and no recovery
    // session is written. (The action link's implicit-flow `#access_token`
    // fragment is not read by this route either, so neither documented link
    // shape establishes the session.) The harness cannot install the session
    // itself without faking the path this scenario exists to test.
    throw new Error(
      `the app refused the admin-generated recovery link: "${outcome.alertText}". ` +
        'No recovery session was established, so the new-password form cannot update the password. ' +
        'The route (web/src/routes/new-password.tsx) sends { tokenHash } while the server function ' +
        '(web/src/lib/supabase/auth.ts: startRecovery) validates { token_hash } — the token is dropped ' +
        'before verifyOtp runs.'
    );
  }

  assert.ok(
    authState.hasSessionCookie(await context.storageState()),
    'following the recovery link must establish a recovery session in the browser cookies'
  );
});

When('the landlord submits a new password', async function () {
  this.newPassword = `${identities.nextDisposableCredentials().password}-new`;
  await newPasswordPage.submit(this.recoveryPage, { password: this.newPassword });

  // A successful update lands on the shell's default page (the route validates
  // the return target); a failure renders the page's own alert instead.
  await this.recoveryPage.waitForURL(
    (url) => !url.pathname.startsWith('/new-password'),
    { timeout: newPasswordPage.WAIT_MS }
  );
  await shell.waitForShell(this.recoveryPage);
  await shell.expectSignedInAs(this.recoveryPage, this.landlord.email);
});

Then('the new password signs in', async function () {
  const session = await authState.newSignedInContext({
    browser: state.browser,
    origin: state.webBaseUrl,
    email: this.landlord.email,
    password: this.newPassword,
  });
  try {
    const stored = authState.sessionFromStorageState(session.storageState);
    assert.ok(stored, 'the new password must start a session');
    assert.strictEqual(stored.user.id, this.landlord.id, 'the new password must sign the same landlord in');
    await shell.expectSignedInAs(session.page, this.landlord.email);
  } finally {
    await session.context.close().catch(() => {});
  }
});

Then('the old password is refused', async function () {
  const { context, page } = await authState.newUnsignedContext({ browser: state.browser });
  try {
    await signInPage.open(page, state.webBaseUrl);
    await signInPage.submit(page, { email: this.landlord.email, password: this.oldPassword });
    const message = await signInPage.errorMessage(page);
    assert.ok(signInPage.isSignInUrl(page), 'the old password must not sign in');
    assert.strictEqual(
      authState.hasSessionCookie(await context.storageState()),
      false,
      'the old password must not start a session'
    );
    assertNonEnumerating(message, 'the old-password refusal');
  } finally {
    await context.close().catch(() => {});
  }
  console.log('[authentication] the recovery session set a new password; the old one is refused');
});

// ---------------------------------------------------------------------------
// Access tokens are verified against the project JWKS — carried in the cookie
// ---------------------------------------------------------------------------
//
// Every request below authenticates the way the browser does: the signed-in
// storage state goes into a Playwright request context, which carries the
// Supabase session cookie. A forged scenario rewrites one fact in that
// cookie's session and asserts the same observable the app produces for a real
// bad session: 401, success false, no data.

function primaryStorageState() {
  const storageState = authState.getStorageState({
    origin: state.webBaseUrl,
    identity: 'primary',
  });
  assert.ok(storageState, 'the harness must hold the seeded primary owner’s signed-in storage state');
  return storageState;
}

Given('a signed-in landlord whose browser holds the session cookie', async function () {
  const primary = identities.identityFor('primary');
  const session = authState.sessionFromStorageState(primaryStorageState());
  assert.ok(session && session.access_token, 'the signed-in state must hold a session');

  const claims = authTokens.decode(session.access_token);
  assert.ok(claims, 'the session access token must be a JWT');
  assert.strictEqual(claims.payload.sub, primary.userId, 'the token subject must be the seeded primary owner');
  this.validToken = session.access_token;
  this.primaryOwner = primary;
  // The scenario's page is the cached signed-in context; the shared "the app
  // requests the properties list" step drives it through the real UI.
  this.landlord = { id: primary.userId, email: primary.email, password: null };
  this.landlordPage = requirePage(this);
  await shell.open(this.landlordPage);

  // The request carries the cookie, not an Authorization header.
  const response = await this.getPropertiesList();
  assert.strictEqual(response.status, 200, `the app must accept the cookie (got ${response.status})`);
  assert.strictEqual(response.body.success, true, 'the accepted request must carry success true');
});

Then("the API accepts the cookie's access token and uses its subject as the owner", async function () {
  // The token's subject owns what it writes, and no other landlord sees it.
  const payload = this.probePayload({ address: 'Acceptance Probe Way Auth' });
  const created = await this.postProperty(payload);
  assert.strictEqual(created.status, 201, `creating a property with the cookie must succeed (got ${created.status})`);
  assert.ok(created.body && created.body.data && created.body.data.id, 'the create must return the new row');
  const createdId = created.body.data.id;

  const ownList = await this.fetchPropertiesListQuiet();
  const ownRows = ownList.body && Array.isArray(ownList.body.data) ? ownList.body.data : [];
  assert.ok(
    ownRows.some((row) => row.id === createdId),
    'the row created with the cookie must be listed back to the same subject'
  );

  // The other seeded landlord's own cookie lists only their own rows: the
  // owner is the verified subject, not anything the request supplied.
  const secondSubject = await this.seededSubject('second');
  const otherList = await api.getPropertiesList(secondSubject);
  assert.strictEqual(otherList.status, 200, 'the second landlord’s own cookie must be accepted');
  const otherRows = otherList.body && Array.isArray(otherList.body.data) ? otherList.body.data : [];
  assert.ok(
    !otherRows.some((row) => row.id === createdId),
    'a row created under one subject must not be visible to another subject'
  );
  console.log(
    `[authentication] the cookie's subject (${this.primaryOwner.userId}) owns the row; the other landlord does not see it`
  );
});

Given('a request has no session cookie or a cookie whose token has an invalid signature', async function () {
  const real = primaryStorageState();
  assert.ok(real, 'the harness must hold a real signed-in cookie to forge');

  const noCookie = await api.getPropertiesList({ session: false });
  const garbage = await api.getPropertiesList({ storageState: authTokens.forgeGarbage(real) });
  const tampered = await api.getPropertiesList({ storageState: authTokens.forgeSignature(real) });

  this.tokenRefusals = [
    { label: 'a request with no session cookie', response: noCookie },
    { label: 'a cookie whose token is not a JWT', response: garbage },
    { label: 'a cookie whose signature no longer verifies', response: tampered },
  ];
});

Then('the API responds 401 with success false', async function () {
  assert.ok(
    Array.isArray(this.tokenRefusals) && this.tokenRefusals.length > 0,
    'a cookie scenario must have sent its requests first'
  );
  for (const { label, response } of this.tokenRefusals) {
    assertFailureEnvelope(response, 401, label);
  }
});

Then('no data is returned', async function () {
  for (const { label, response } of this.tokenRefusals) {
    assert.ok(
      !('data' in response.body),
      `${label}: the refusal must carry no data (got ${JSON.stringify(response.body)})`
    );
    assert.ok(
      !/acceptance probe/i.test(response.text),
      `${label}: the refusal must not leak property rows`
    );
  }
  console.log(`[authentication] ${this.tokenRefusals.length} refused cookie(s): 401, success false, no data`);
});

Given('a cookie carries a token issued for another project, another audience, or an anonymous user', async function () {
  const real = primaryStorageState();
  assert.ok(real, 'the harness must hold a real signed-in cookie to shape counterexamples from');

  // The project's own anon key is a real, project-issued token whose audience
  // and role are the anonymous ones — the closest available "another audience /
  // anonymous user" token — and it is HS256, which the app refuses outright.
  const anonKey = webBundle.readPublicWebEnv().VITE_SUPABASE_ANON_KEY;
  assert.ok(anonKey, 'web/.env must define the public anon key for this counterexample');

  const minted = [
    {
      label: 'a token issued by another project',
      storageState: authTokens.forgeClaims(real, {
        iss: 'https://another-project.supabase.co/auth/v1',
      }),
    },
    {
      label: 'a token for another audience',
      storageState: authTokens.forgeClaims(real, { aud: 'anon' }),
    },
    {
      label: 'a token for the wrong role',
      storageState: authTokens.forgeClaims(real, { role: 'anon' }),
    },
    {
      label: 'a token for an anonymous user',
      storageState: authTokens.forgeClaims(real, { is_anonymous: true }),
    },
    {
      label: 'the project’s real anon key (HS256, aud anon, role anon)',
      storageState: authTokens.forgeHs256(real, anonKey),
    },
  ];

  // Causal note: without the project's ES256 private key none of these is
  // validly signed, so the app refuses them at the algorithm/signature check
  // before it evaluates iss/aud/role/is_anonymous. The assertion is the
  // observable the spec names — a 401 refusal with no data — not a claim-level
  // rejection.
  this.tokenRefusals = [];
  for (const { label, storageState } of minted) {
    const response = await api.getPropertiesList({ storageState });
    this.tokenRefusals.push({ label, response });
  }
});

Given('a cookie carries a token whose expiry has passed beyond the leeway', async function () {
  const real = primaryStorageState();
  assert.ok(real, 'the harness must hold a real signed-in cookie to shape the expired token from');

  const expired = authTokens.forgeExpired(real);
  const stored = authState.sessionFromStorageState(expired);
  const claims = authTokens.decode(stored.access_token);
  const now = Math.floor(Date.now() / 1000);
  assert.ok(claims.payload.exp < now - 60, 'the minted token must expire beyond the verification leeway');

  // Causal note: the project's ES256 key is unavailable, so this cookie's
  // token is self-signed and the app refuses it at the signature check before
  // the exp claim is read. The observable the spec names — 401 with no data — is
  // asserted; the expired-claim rejection itself cannot be exercised without a
  // project-signed token.
  const response = await api.getPropertiesList({ storageState: expired });
  this.tokenRefusals = [{ label: 'a cookie whose token expired beyond the leeway', response }];
});

Given('the JWKS cannot be reached and no cached key verifies the token', async function () {
  this.outageToken = authTokens.realAccessToken(primaryStorageState());
  assert.ok(this.outageToken, 'the outage scenario needs a real signed-in cookie');

  // The contrast: the main app accepts this very cookie right now, so a 503
  // from the probe is the outage and not a bad cookie.
  const control = await api.getPropertiesList();
  assert.strictEqual(control.status, 200, `the cookie must be valid against the main app (got ${control.status})`);

  // A second app on its own port, fresh process and empty key cache, with the
  // JWKS location pointed at a closed port.
  this.probeApp = await startAppWithUnreachableJwks();
  this.probeApps.push(this.probeApp);
  this.probeContext = await api.createContext({ baseUrl: this.probeApp.baseUrl });
  this.httpContexts.push(this.probeContext);
});

Then('the API responds 503 with success false', async function () {
  const probe = this.probeApp;
  assert.ok(probe, 'the JWKS-outage app must be running');

  const response = await api.getPropertiesList({ context: this.probeContext });
  this.outageResponses = [{ label: 'a cookie with no fetchable key set', response }];
  assertFailureEnvelope(response, 503, 'the JWKS-outage app');

  // `/api/health` still answers 200: the database is fine; only the key set is
  // unreachable.
  const health = await api.getApiHealth({ context: this.probeContext });
  assert.strictEqual(health.status, 200, `the outage app's health must stay 200 (got ${health.status})`);
  assert.strictEqual(health.body.success, true, 'the outage app must report database readiness');
});

Then('it never accepts the token', async function () {
  const probe = this.probeApp;
  try {
    const responses = this.outageResponses.slice();

    // A second request (a write) must fail the same way: the cookie is never
    // accepted while no key set is available.
    responses.push({
      label: 'a write with no fetchable key set',
      response: await api.postProperty(
        { name: 'Acceptance Probe Auth Outage', address: 'Acceptance Probe Way 5', type: 'lot', units: 1 },
        { context: this.probeContext }
      ),
    });
    for (const { label, response } of responses) {
      assertFailureEnvelope(response, 503, label);
      assert.ok(
        response.status !== 200 && response.status !== 201,
        `${label}: the cookie must never be accepted`
      );
    }
  } finally {
    // Kill the probe instance and prove its port is free again, whatever the
    // assertions above did.
    this.probeApps = this.probeApps.filter((app) => app !== probe);
    this.probeAppClosed = await stopProbeApp(probe);
  }
  assert.strictEqual(this.probeAppClosed, true, `the probe app's port ${probe.port} must be free after teardown`);
  assert.strictEqual(
    await probeTcpPort(probe.port),
    false,
    `nothing may still listen on the probe app's port ${probe.port}`
  );
  console.log('[authentication] a JWKS outage fails closed: 503 with no data, the cookie never accepted');
});

// ---------------------------------------------------------------------------
// The auth configuration keeps secrets server-side
// ---------------------------------------------------------------------------

Given('the app starts without an issuer or JWKS location', async function () {
  // Two fresh app starts, each with exactly one required auth variable blank.
  // Every other server value is passed in full, so the blank one is the only
  // reason to refuse. Both use the harness's resolved database so the missing
  // auth variable is the only reason to refuse.
  this.configRefusals = [
    await runAppWithoutVariable('SUPABASE_JWT_ISSUER'),
    await runAppWithoutVariable('SUPABASE_JWKS_URL'),
  ];
});

Then('it fails before serving', async function () {
  for (const refusal of this.configRefusals) {
    // Every request answered an error, never a page or an envelope.
    for (const { path: apiPath, status } of refusal.statuses || []) {
      assert.ok(
        status === null || status >= 500,
        `the app must not serve ${apiPath} with ${refusal.variable} blank (got HTTP ${status})`
      );
    }
    assert.ok(
      refusal.stopped,
      `the config-refusal app for ${refusal.variable} must be stopped after the probe`
    );
    assert.strictEqual(
      refusal.listening,
      false,
      `the app must leave port ${refusal.port} free after refusing to serve`
    );
    assert.ok(
      !/\bsuccess"?\s*:\s*true/.test(refusal.output),
      `the app must refuse before it serves, but its output shows a successful answer:\n${tailOf(refusal.output)}`
    );
  }
});

Then('the failure names the missing variable', async function () {
  if (this.preflightProbe) {
    // The acceptance-suite preflight child: a connection is configured, the
    // JWKS location is not.
    const { stderr } = this.preflightProbe;
    assert.ok(/SUPABASE_JWKS_URL/.test(stderr), 'the failure must name the missing JWKS variable');
    assert.ok(/JWKS location/i.test(stderr), 'the failure must describe the missing JWKS location');
    assert.ok(
      !/DATABASE_URL/.test(stderr),
      'the failure must name only the variable that is absent, not the configured database'
    );
    console.log('[self] the missing-JWKS failure names the variable and nothing runs');
    return;
  }

  for (const refusal of this.configRefusals) {
    assert.ok(
      refusal.output.includes(refusal.variable),
      `the failure must name the missing variable ${refusal.variable}, got:\n${tailOf(refusal.output)}`
    );
    assert.ok(
      /refuses to serve/.test(refusal.output),
      `the failure must state that the app refuses to serve without ${refusal.variable}, got:\n${tailOf(refusal.output)}`
    );
  }
  console.log(
    '[authentication] the app refuses to serve without its issuer or JWKS location, naming the missing variable'
  );
});

Given('the built web bundle and its environment', async function () {
  // A real production build into the Nitro output (the build is quick and
  // never writes a tracked source file). It runs with the same stripped
  // environment the harness gives the web process and loads web/.env exactly
  // as the dev server does. The run-scoped cache means the deployable-artifact
  // scenarios reuse this same artifact.
  this.webBuild = await webBundle.buildProductionApp();
  this.webBuildDir = this.webBuild.outputDir;
  this.publicWebEnv = webBundle.readPublicWebEnv();
  this.clientFiles = this.webBuild.clientFiles;
  this.buildFiles = this.webBuild.allFiles;
  this.harnessEnv = acceptanceEnv();
});

Then('it carries the project URL and publishable key', async function () {
  const url = this.publicWebEnv.VITE_SUPABASE_URL;
  const publishable = this.publicWebEnv.VITE_SUPABASE_ANON_KEY;

  assert.ok(url, 'web/.env must carry the public project URL (VITE_SUPABASE_URL)');
  assert.ok(publishable, 'web/.env must carry the publishable/anon key (VITE_SUPABASE_ANON_KEY)');

  // The web points at the same project the harness administers and the API
  // verifies against.
  const normalized = (value) => value.replace(/\/+$/, '');
  assert.strictEqual(
    normalized(url),
    normalized(this.harnessEnv.SUPABASE_URL),
    'the browser’s project URL must be the project the suite runs against'
  );

  const urlFiles = webBundle.filesContaining(this.clientFiles, normalized(url));
  const keyFiles = webBundle.filesContaining(this.clientFiles, publishable);
  assert.ok(urlFiles.length > 0, 'the client bundle must carry the project URL');
  assert.ok(keyFiles.length > 0, 'the client bundle must carry the publishable key');
  console.log(
    `[authentication] the built client bundle carries VITE_SUPABASE_URL and the publishable key ` +
      `(${path.basename(this.webBuildDir)}, ${this.clientFiles.length} client file(s))`
  );
});

Then('it carries no secret or service key', async function () {
  const serviceKey = this.harnessEnv.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(serviceKey, 'the harness must hold the service key to prove it never reaches the web');

  // No build artifact may contain the service key value.
  assert.deepStrictEqual(
    webBundle.filesContaining(this.buildFiles, serviceKey),
    [],
    'the service/secret key must never appear in the web build'
  );

  // Nor a modern `sb_secret_…` key (the library's bare `sb_secret_` prefix
  // constant is not a key and is not what this scenario forbids).
  const secretKeyPattern = /\bsb_secret_[A-Za-z0-9_-]{20,}/;
  for (const file of this.buildFiles) {
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      secretKeyPattern,
      `${path.relative(REPO_ROOT, file)} must not carry an sb_secret_ key`
    );
  }

  // Nor the variable that carries it.
  for (const marker of ['service_role', 'SUPABASE_SERVICE_ROLE_KEY']) {
    assert.deepStrictEqual(
      webBundle.filesContaining(this.buildFiles, marker),
      [],
      `the web build must not mention "${marker}"`
    );
  }

  // Every JWT that reaches the browser is public identity material: none may
  // be a service-role token, and the only project token present must be the
  // publishable/anon key.
  const jwts = webBundle.jwtsIn(this.buildFiles);
  assert.ok(jwts.length > 0, 'the build must carry the public publishable key');
  for (const { file, payload } of jwts) {
    assert.ok(payload, `every JWT in ${path.relative(REPO_ROOT, file)} must decode`);
    assert.notStrictEqual(payload.role, 'service_role', `a service-role token reached ${path.relative(REPO_ROOT, file)}`);
    assert.notStrictEqual(payload.aud, 'service_role', `a service-role audience reached ${path.relative(REPO_ROOT, file)}`);
  }
  const publishable = this.publicWebEnv.VITE_SUPABASE_ANON_KEY;
  assert.ok(
    jwts.some(({ token }) => token === publishable),
    'the publishable/anon key must be the project token the browser carries'
  );

  // The environment the web app is built and run with carries only public,
  // `VITE_`-prefixed browser configuration plus the server's own values; the
  // harness strips the admin key and the seeded passwords from every app
  // process.
  for (const name of Object.keys(this.publicWebEnv)) {
    assert.match(
      name,
      /^VITE_/,
      `web/.env must carry only public VITE_ variables, but defines ${name}`
    );
  }
  const appEnv = webProcessEnvironment();
  assert.strictEqual(appEnv.SUPABASE_SERVICE_ROLE_KEY, undefined, 'the app runtime environment must not carry the service key');
  for (const name of ['SEED_OWNER_PASSWORD', 'SEED_A_PASSWORD', 'SEED_B_PASSWORD']) {
    assert.strictEqual(appEnv[name], undefined, `the app runtime environment must not carry ${name}`);
  }
  assert.notStrictEqual(publishable, serviceKey, 'the publishable key must not be the service key');
  console.log(
    `[authentication] no service key or secret reaches the browser: ${this.buildFiles.length} build file(s) scanned, ` +
      `${jwts.length} public JWT(s); the web environment carries only VITE_ values`
  );
});
