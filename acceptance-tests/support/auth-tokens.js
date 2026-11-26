'use strict';

// Forged *cookies* for the token-verification scenarios.
//
// The app derives identity from the Supabase session cookie and verifies its
// access token against the project JWKS with ES256 only. The project's signing
// key is private to Supabase, so this harness cannot mint a token that is
// *validly signed* and then deliberately expired, foreign, or anonymous. What
// it can do — and what these helpers do — is take the real signed-in storage
// state and put the closest well-formed counterexamples in its cookie: HS256
// tokens (including the project's own anon key, which is a real project-issued
// HS256 token), and self-signed ES256 tokens carrying the project's `kid` plus
// whatever claims a scenario needs. The app refuses them at the
// algorithm/signature step before it reads the claims, so the observable
// outcome the scenarios assert is the 401/no-data envelope.
//
// A cookie, not a header: the helpers return a Playwright storage state, which
// `support/api-client.js` hands to `request.newContext` — the same signed-in
// jar the browser would carry.
//
// No token or key here is a project secret: the anon key is public by design
// and the ES256 key pair is generated fresh per run in Node and never leaves
// this process.

const crypto = require('node:crypto');

const authState = require('./auth-state');

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function encodeSegment(value) {
  return base64Url(JSON.stringify(value));
}

function signInput(header, payload) {
  return `${encodeSegment(header)}.${encodeSegment(payload)}`;
}

// Decode structurally only — no signature check. Used to read the real access
// token's header (`kid`, `alg`) and claims (`iss`, `aud`, `sub`), which the
// counterexamples need so they look like tokens the app would otherwise know.
function decode(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return {
      header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')),
      payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
      signature: parts[2],
    };
  } catch {
    return null;
  }
}

// HS256: symmetric, signed with a value the app treats as a public key (the
// project's anon key). A well-formed token whose algorithm is not allowed.
function signHs256(payload, secret) {
  const data = signInput({ alg: 'HS256', typ: 'JWT' }, payload);
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

// A fresh ES256 key pair, so a token can be "ES256 and shaped right" without
// the project's private key. Signing uses the JOSE raw R||S form (ieee-p1363),
// which is what a JWS ES256 signature is.
function generateEs256KeyPair() {
  return crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
}

function signEs256(payload, { kid, privateKey }) {
  const header = { alg: 'ES256', typ: 'JWT' };
  if (kid !== undefined) header.kid = kid;
  const data = signInput(header, payload);
  const signature = crypto
    .sign('sha256', Buffer.from(data), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `${data}.${signature}`;
}

// Keep the algorithm and key id but replace the signature: a token that would
// otherwise parse and select a real key id, refused because the bytes no
// longer verify.
function replaceSignature(token, signature = 'not-the-real-signature') {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Cannot forge a signature on a non-JWT.');
  return `${parts[0]}.${parts[1]}.${base64Url(signature)}`;
}

// ---------------------------------------------------------------------------
// The forged storage states each scenario feeds to the app
// ---------------------------------------------------------------------------

function realAccessToken(storageState) {
  const session = authState.sessionFromStorageState(storageState);
  if (!session || !session.access_token) {
    throw new Error('The forged-cookie scenario needs a real signed-in storage state.');
  }
  return session.access_token;
}

function withAccessToken(storageState, token) {
  return authState.rewriteStorageStateSession(storageState, (session) => {
    session.access_token = token;
  });
}

// A cookie whose token is not a JWT at all: the session looks present, the
// token cannot be verified.
function forgeGarbage(storageState) {
  return withAccessToken(storageState, 'not-a-jwt');
}

// A cookie whose token keeps its header and claims but no longer verifies.
function forgeSignature(storageState) {
  return withAccessToken(storageState, replaceSignature(realAccessToken(storageState)));
}

// A cookie whose token is HS256, signed with a value the app treats as public
// (the project's anon key). The claims are the real landlord's.
function forgeHs256(storageState, secret) {
  const claims = decode(realAccessToken(storageState));
  if (!claims) throw new Error('Cannot forge the HS256 cookie from a non-JWT access token.');
  return withAccessToken(storageState, signHs256(claims.payload, secret));
}

// A cookie whose token is ES256 with the project's key id but self-signed, and
// whose claims carry the changes the scenario names (foreign issuer/audience,
// wrong role, anonymous claim, or a past expiry).
function forgeClaims(storageState, changes = {}) {
  const real = realAccessToken(storageState);
  const claims = decode(real);
  if (!claims) throw new Error('Cannot forge a claims cookie from a non-JWT access token.');
  const now = Math.floor(Date.now() / 1000);
  const { privateKey } = generateEs256KeyPair();
  const payload = {
    iss: claims.payload.iss,
    aud: claims.payload.aud,
    sub: claims.payload.sub,
    role: 'authenticated',
    iat: now,
    exp: now + 600,
    ...changes,
  };
  return withAccessToken(
    storageState,
    signEs256(payload, { kid: claims.header.kid, privateKey })
  );
}

// One hour past expiry, far beyond the app's one-minute leeway.
function forgeExpired(storageState) {
  const now = Math.floor(Date.now() / 1000);
  const expiredAt = now - 3600;
  return forgeClaims(storageState, {
    iat: expiredAt - 3600,
    exp: expiredAt,
  });
}

module.exports = {
  decode,
  signHs256,
  signEs256,
  generateEs256KeyPair,
  replaceSignature,
  realAccessToken,
  withAccessToken,
  forgeGarbage,
  forgeSignature,
  forgeHs256,
  forgeClaims,
  forgeExpired,
};
