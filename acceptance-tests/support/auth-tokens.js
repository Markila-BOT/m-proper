'use strict';

// JWT construction for the token-verification scenarios.
//
// The API verifies Supabase access tokens against the project JWKS with ES256
// only. The project's signing key is private to Supabase, so this harness
// cannot mint a token that is *validly signed* and then deliberately expired,
// foreign, or anonymous. What it can do — and what these helpers do — is build
// the closest well-formed counterexamples: HS256 tokens (including the
// project's own anon key, which is a real project-issued HS256 token), and
// self-signed ES256 tokens carrying the project's `kid` plus whatever claims a
// scenario needs. The API refuses them at the algorithm/signature step before
// it reads the claims, so the observable outcome the scenarios assert is the
// 401/no-data envelope; the token-verification step files name that causal
// difference rather than implying the claim was the deciding check.
//
// No token or key here is a project secret: the anon key is public by design
// and the ES256 key pair is generated fresh per run in Node and never leaves
// this process.

const crypto = require('node:crypto');

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
// counterexamples need so they look like tokens the API would otherwise know.
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

// HS256: symmetric, signed with a value the API treats as a public key (the
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

module.exports = {
  decode,
  signHs256,
  signEs256,
  generateEs256KeyPair,
  replaceSignature,
};
