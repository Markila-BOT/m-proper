//! Shared JWT fixtures for crate tests: one fixed P-256 keypair, its public
//! key set, and token builders. Nothing here touches the network.

use std::{
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::{SystemTime, UNIX_EPOCH},
};

use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use serde_json::{Value, json};

use crate::config::JwtConfig;

use super::verifier::{AuthError, KeyFetcher, TokenVerifier};

/// Fixed P-256 keypair (PKCS#8) so tests need no key-generation crate.
const PRIVATE_KEY_PEM: &str = "-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgLSk+Zso3iNtuhXgV
4Iz/ZUaAWPFKfDUZp7+NtQUGl6OhRANCAASdKILGNUkG2yaW/og6dBtgjRrRvnEk
fPsDkISYuZ5j5t1K6QRmCianPgGWngVxZGVtGgMkmNWw2D1Xe6xpZ4LQ
-----END PRIVATE KEY-----
";

/// A second keypair used only to sign forged tokens.
const OTHER_PRIVATE_KEY_PEM: &str = "-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg02D3FWSNieUIvD0u
9ULZdkN2ssrIfeaC6TIFiR3ChgyhRANCAAQQbhuavMtgzc5AhUq2qnTJP1C6wyv8
wRC7Vl3vHViYHF8FCL8i3p36V/xA1Jk1A3yowF2ro26KKq8NCyb5MXMf
-----END PRIVATE KEY-----
";

/// Public JWK for `PRIVATE_KEY_PEM`.
const JWKS_JSON: &str = r#"{
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "kid": "test-key-1",
      "x": "nSiCxjVJBtsmlv6IOnQbYI0a0b5xJHz7A5CEmLmeY-Y",
      "y": "3UrpBGYKJqc-AZaeBXFkZW0aAySY1bDYPVd7rGlngtA",
      "alg": "ES256",
      "use": "sig"
    }
  ]
}"#;

const KID: &str = "test-key-1";
const ISSUER: &str = "https://test.supabase.co/auth/v1";
const AUDIENCE: &str = "authenticated";

pub(crate) const USER_ID: &str = "0f8fad5b-d9cb-469f-a165-70867728950e";

pub(crate) fn jwt_config() -> JwtConfig {
    JwtConfig {
        issuer: ISSUER.into(),
        jwks_url: "https://test.supabase.co/auth/v1/.well-known/jwks.json".into(),
        audience: AUDIENCE.into(),
    }
}

pub(crate) fn key_set() -> JwkSet {
    serde_json::from_str(JWKS_JSON).expect("fixture key set should parse")
}

pub(crate) fn signing_key() -> EncodingKey {
    EncodingKey::from_ec_pem(PRIVATE_KEY_PEM.as_bytes()).expect("fixture private key should parse")
}

pub(crate) fn other_signing_key() -> EncodingKey {
    EncodingKey::from_ec_pem(OTHER_PRIVATE_KEY_PEM.as_bytes())
        .expect("forgery private key should parse")
}

pub(crate) fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock should be after the epoch")
        .as_secs()
}

pub(crate) fn valid_claims() -> Value {
    json!({
        "sub": USER_ID,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "role": "authenticated",
        "iat": now(),
        "exp": now() + 3_600,
    })
}

pub(crate) fn sign_with(
    alg: Algorithm,
    key: &EncodingKey,
    kid: Option<&str>,
    claims: &Value,
) -> String {
    let mut header = Header::new(alg);
    header.kid = kid.map(str::to_string);
    encode(&header, claims, key).expect("token should encode")
}

pub(crate) fn token(claims: &Value) -> String {
    sign_with(Algorithm::ES256, &signing_key(), Some(KID), claims)
}

pub(crate) fn verifier() -> TokenVerifier {
    TokenVerifier::with_key_set(&jwt_config(), key_set())
}

pub(crate) fn counting_fetcher(keys: JwkSet) -> (KeyFetcher, Arc<AtomicUsize>) {
    let calls = Arc::new(AtomicUsize::new(0));
    let counter = Arc::clone(&calls);
    let fetcher: KeyFetcher = Arc::new(move || {
        counter.fetch_add(1, Ordering::SeqCst);
        let keys = keys.clone();
        Box::pin(async move { Ok(keys) })
    });
    (fetcher, calls)
}

pub(crate) fn failing_fetcher() -> KeyFetcher {
    Arc::new(|| Box::pin(async { Err(AuthError::Unavailable("key set unreachable".into())) }))
}

pub(crate) fn base64url(input: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    let mut out = String::new();
    for chunk in input.chunks(3) {
        let bytes = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let value = (u32::from(bytes[0]) << 16) | (u32::from(bytes[1]) << 8) | u32::from(bytes[2]);
        out.push(ALPHABET[(value >> 18) as usize & 63] as char);
        out.push(ALPHABET[(value >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[(value >> 6) as usize & 63] as char);
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[value as usize & 63] as char);
        }
    }
    out
}
