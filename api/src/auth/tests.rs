use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::{Algorithm, EncodingKey};
use serde_json::json;
use uuid::Uuid;

use super::test_support::{
    USER_ID, base64url, counting_fetcher, failing_fetcher, jwt_config, key_set, now,
    other_signing_key, sign_with, signing_key, token, valid_claims, verifier,
};
use super::{AuthError, Identity, TokenVerifier};

async fn assert_invalid(verifier: &TokenVerifier, token: &str) {
    let error = verifier
        .verify(token)
        .await
        .expect_err("token should be refused");

    assert!(
        matches!(error, AuthError::InvalidToken(_)),
        "expected an invalid-token refusal, got {error:?}"
    );
}

#[tokio::test]
async fn accepts_a_valid_es256_token() {
    let identity: Identity = verifier()
        .verify(&token(&valid_claims()))
        .await
        .expect("a valid token should be accepted");

    assert_eq!(
        identity.user_id,
        Uuid::parse_str(USER_ID).expect("fixture subject is a UUID")
    );
}

#[tokio::test]
async fn refuses_a_token_with_a_bad_signature() {
    let forged = sign_with(
        Algorithm::ES256,
        &other_signing_key(),
        Some("test-key-1"),
        &valid_claims(),
    );

    assert_invalid(&verifier(), &forged).await;
}

#[tokio::test]
async fn refuses_an_expired_token() {
    let mut claims = valid_claims();
    claims["exp"] = json!(now() - 120);

    assert_invalid(&verifier(), &token(&claims)).await;
}

#[tokio::test]
async fn accepts_a_token_expired_within_the_leeway() {
    let mut claims = valid_claims();
    claims["exp"] = json!(now() - 30);

    verifier()
        .verify(&token(&claims))
        .await
        .expect("a token inside the 60s leeway should be accepted");
}

#[tokio::test]
async fn refuses_a_token_from_another_issuer() {
    let mut claims = valid_claims();
    claims["iss"] = json!("https://other.supabase.co/auth/v1");

    assert_invalid(&verifier(), &token(&claims)).await;
}

#[tokio::test]
async fn refuses_a_token_for_another_audience() {
    let mut claims = valid_claims();
    claims["aud"] = json!("another-project");

    assert_invalid(&verifier(), &token(&claims)).await;
}

#[tokio::test]
async fn refuses_a_token_without_a_subject() {
    let mut claims = valid_claims();
    claims
        .as_object_mut()
        .expect("claims are an object")
        .remove("sub");

    assert_invalid(&verifier(), &token(&claims)).await;
}

#[tokio::test]
async fn refuses_a_token_with_a_blank_subject() {
    let mut claims = valid_claims();
    claims["sub"] = json!("   ");

    assert_invalid(&verifier(), &token(&claims)).await;
}

#[tokio::test]
async fn refuses_a_token_whose_subject_is_not_a_uuid() {
    let mut claims = valid_claims();
    claims["sub"] = json!("not-a-uuid");

    assert_invalid(&verifier(), &token(&claims)).await;
}

#[tokio::test]
async fn refuses_a_token_without_the_authenticated_role() {
    let mut claims = valid_claims();
    claims["role"] = json!("anon");

    assert_invalid(&verifier(), &token(&claims)).await;
}

#[tokio::test]
async fn refuses_an_anonymous_user_token() {
    let mut claims = valid_claims();
    claims["is_anonymous"] = json!(true);

    assert_invalid(&verifier(), &token(&claims)).await;
}

#[tokio::test]
async fn refuses_an_hs256_token_without_touching_the_key_set() {
    let (fetcher, calls) = counting_fetcher(key_set());
    let verifier = TokenVerifier::with_fetcher(&jwt_config(), fetcher);
    let forged = sign_with(
        Algorithm::HS256,
        &EncodingKey::from_secret(b"shared-secret"),
        Some("test-key-1"),
        &valid_claims(),
    );

    assert_invalid(&verifier, &forged).await;
    assert_eq!(
        calls.load(std::sync::atomic::Ordering::SeqCst),
        0,
        "a symmetric token must be refused before any key is fetched"
    );
}

#[tokio::test]
async fn refuses_an_unsigned_none_token() {
    let (fetcher, calls) = counting_fetcher(key_set());
    let verifier = TokenVerifier::with_fetcher(&jwt_config(), fetcher);
    let unsigned = format!(
        "{}.{}.",
        base64url(br#"{"alg":"none","typ":"JWT","kid":"test-key-1"}"#),
        base64url(serde_json::to_string(&valid_claims()).unwrap().as_bytes())
    );

    assert_invalid(&verifier, &unsigned).await;
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 0);
}

#[tokio::test]
async fn refetches_the_key_set_exactly_once_for_an_unknown_kid() {
    let (fetcher, calls) = counting_fetcher(key_set());
    let verifier = TokenVerifier::with_fetcher(&jwt_config(), fetcher);

    verifier
        .verify(&token(&valid_claims()))
        .await
        .expect("the first token warms the cache");
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);

    let unknown_kid = sign_with(
        Algorithm::ES256,
        &signing_key(),
        Some("rotated-key"),
        &valid_claims(),
    );

    assert_invalid(&verifier, &unknown_kid).await;
    assert_eq!(
        calls.load(std::sync::atomic::Ordering::SeqCst),
        2,
        "an unknown kid should trigger one refetch and no more"
    );
}

#[tokio::test]
async fn reuses_the_cached_key_set() {
    let (fetcher, calls) = counting_fetcher(key_set());
    let verifier = TokenVerifier::with_fetcher(&jwt_config(), fetcher);
    let token = token(&valid_claims());

    verifier.verify(&token).await.expect("first token accepted");
    verifier
        .verify(&token)
        .await
        .expect("second token accepted");

    assert_eq!(
        calls.load(std::sync::atomic::Ordering::SeqCst),
        1,
        "a fresh cache should be reused, not refetched"
    );
}

#[tokio::test]
async fn fails_closed_when_the_key_set_cannot_be_fetched() {
    let verifier = TokenVerifier::with_fetcher(&jwt_config(), failing_fetcher());

    let error = verifier
        .verify(&token(&valid_claims()))
        .await
        .expect_err("an unreachable key set must not accept the token");

    assert!(
        matches!(error, AuthError::Unavailable(_)),
        "an outage should be unavailable, not invalid; got {error:?}"
    );
}

#[tokio::test]
async fn fails_closed_when_the_key_set_is_empty() {
    let (fetcher, _calls) = counting_fetcher(JwkSet { keys: Vec::new() });
    let verifier = TokenVerifier::with_fetcher(&jwt_config(), fetcher);

    let error = verifier
        .verify(&token(&valid_claims()))
        .await
        .expect_err("an empty key set must not accept the token");

    assert!(
        matches!(error, AuthError::Unavailable(_)),
        "an empty key set should be unavailable, not invalid; got {error:?}"
    );
}
