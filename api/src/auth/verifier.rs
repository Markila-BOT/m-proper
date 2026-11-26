use std::{
    future::Future,
    pin::Pin,
    sync::Arc,
    time::{Duration, Instant},
};

use jsonwebtoken::{
    Algorithm, DecodingKey, Validation, decode, decode_header,
    jwk::{AlgorithmParameters, EllipticCurve, Jwk, JwkSet, KeyAlgorithm},
};
use serde::Deserialize;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::JwtConfig;

/// The key set is cached no longer than the platform's ten-minute edge cache.
pub const JWKS_CACHE_TTL: Duration = Duration::from_secs(600);

/// Tolerated clock skew when checking `exp`.
pub const CLOCK_LEEWAY_SECS: u64 = 60;

/// How long a JWKS request may take before verification fails closed.
const JWKS_TIMEOUT: Duration = Duration::from_secs(10);

const AUTHENTICATED_ROLE: &str = "authenticated";

/// A verified caller: the JWT subject, used as the owner of every row.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Identity {
    pub user_id: Uuid,
}

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    /// The token is bad: refuse with 401.
    #[error("invalid access token: {0}")]
    InvalidToken(String),

    /// The key set cannot be reached: fail closed with 503, never accept.
    #[error("token verification unavailable: {0}")]
    Unavailable(String),
}

pub type FetchFuture = Pin<Box<dyn Future<Output = Result<JwkSet, AuthError>> + Send>>;

/// Supplies the project key set. Production fetches over HTTPS; tests inject a
/// fixed set or a failing fake so no test touches the network.
pub type KeyFetcher = Arc<dyn Fn() -> FetchFuture + Send + Sync>;

/// The claims this API reads after the signature and registered claims pass.
/// `iss`, `aud`, and `exp` are enforced by `Validation` against the raw payload.
#[derive(Debug, Deserialize)]
struct Claims {
    #[serde(default)]
    sub: Option<String>,
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    is_anonymous: Option<bool>,
}

struct CachedKeys {
    keys: JwkSet,
    fetched_at: Instant,
}

#[derive(Clone)]
pub struct TokenVerifier {
    issuer: String,
    audience: String,
    fetcher: KeyFetcher,
    cache: Arc<Mutex<Option<CachedKeys>>>,
}

impl TokenVerifier {
    /// Production verifier: fetches the configured key set over HTTPS.
    pub fn new(config: &JwtConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(JWKS_TIMEOUT)
            .build()
            .expect("the JWKS HTTP client should build");
        let url = config.jwks_url.clone();
        let fetcher: KeyFetcher = Arc::new(move || {
            let client = client.clone();
            let url = url.clone();
            Box::pin(async move { fetch_jwks(&client, &url).await })
        });

        Self::with_fetcher(config, fetcher)
    }

    /// Test seam: verify against a fixed key set with no network access.
    #[cfg(test)]
    pub fn with_key_set(config: &JwtConfig, keys: JwkSet) -> Self {
        let fetcher: KeyFetcher = Arc::new(move || {
            let keys = keys.clone();
            Box::pin(async move { Ok(keys) })
        });

        Self::with_fetcher(config, fetcher)
    }

    /// Test seam: verify against a custom key source, e.g. a failing transport.
    pub fn with_fetcher(config: &JwtConfig, fetcher: KeyFetcher) -> Self {
        Self {
            issuer: config.issuer.clone(),
            audience: config.audience.clone(),
            fetcher,
            cache: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn verify(&self, token: &str) -> Result<Identity, AuthError> {
        let header = decode_header(token)
            .map_err(|error| AuthError::InvalidToken(format!("malformed header: {error}")))?;

        // ES256 only: `none`, HS-family, and every other algorithm are refused
        // before a key is even selected.
        if header.alg != Algorithm::ES256 {
            return Err(AuthError::InvalidToken(format!(
                "algorithm {:?} is not allowed",
                header.alg
            )));
        }

        let kid = header
            .kid
            .filter(|kid| !kid.trim().is_empty())
            .ok_or_else(|| AuthError::InvalidToken("the token names no key id".into()))?;

        let jwk = self.select_key(&kid).await?;
        let key = DecodingKey::from_jwk(&jwk)
            .map_err(|error| AuthError::InvalidToken(format!("unusable key: {error}")))?;

        let claims = decode::<Claims>(token, &key, &self.validation())
            .map_err(|error| AuthError::InvalidToken(error.to_string()))?
            .claims;

        let subject = claims
            .sub
            .as_deref()
            .map(str::trim)
            .filter(|subject| !subject.is_empty())
            .ok_or_else(|| AuthError::InvalidToken("the token has no subject".into()))?;
        let user_id = Uuid::parse_str(subject)
            .map_err(|_| AuthError::InvalidToken("the subject is not a UUID".into()))?;

        if claims.is_anonymous == Some(true) {
            return Err(AuthError::InvalidToken(
                "anonymous users are not allowed".into(),
            ));
        }

        match claims.role.as_deref() {
            Some(AUTHENTICATED_ROLE) => {}
            other => {
                return Err(AuthError::InvalidToken(format!(
                    "role {other:?} is not allowed"
                )));
            }
        }

        Ok(Identity { user_id })
    }

    fn validation(&self) -> Validation {
        let mut validation = Validation::new(Algorithm::ES256);
        validation.leeway = CLOCK_LEEWAY_SECS;
        validation.validate_exp = true;
        validation.set_required_spec_claims(&["exp", "sub"]);
        validation.set_issuer(&[self.issuer.as_str()]);
        validation.set_audience(&[self.audience.as_str()]);
        validation
    }

    /// The cached key for `kid`; an unknown key id triggers exactly one refetch.
    async fn select_key(&self, kid: &str) -> Result<Jwk, AuthError> {
        let cached = self.cached_or_fetch().await?;
        if let Some(jwk) = usable_key(&cached, kid) {
            return Ok(jwk.clone());
        }

        tracing::debug!("unknown key id {kid}; refetching the key set once");
        let refreshed = self.fetch_and_cache().await?;
        usable_key(&refreshed, kid)
            .cloned()
            .ok_or_else(|| AuthError::InvalidToken(format!("unknown key id {kid}")))
    }

    async fn cached_or_fetch(&self) -> Result<JwkSet, AuthError> {
        {
            let cache = self.cache.lock().await;
            if let Some(cached) = cache.as_ref()
                && cached.fetched_at.elapsed() < JWKS_CACHE_TTL
            {
                return Ok(cached.keys.clone());
            }
        }

        self.fetch_and_cache().await
    }

    async fn fetch_and_cache(&self) -> Result<JwkSet, AuthError> {
        let mut cache = self.cache.lock().await;

        // A failed fetch leaves any previous cache untouched; it is never
        // extended, so a key set older than the TTL cannot verify a token.
        let keys = (self.fetcher)().await?;
        if keys.keys.is_empty() {
            return Err(AuthError::Unavailable("the key set is empty".into()));
        }

        *cache = Some(CachedKeys {
            keys: keys.clone(),
            fetched_at: Instant::now(),
        });

        Ok(keys)
    }
}

/// Finds a key by id, accepting only EC P-256 material. A token can never
/// contribute key material: only the fetched key set is consulted.
fn usable_key<'a>(keys: &'a JwkSet, kid: &str) -> Option<&'a Jwk> {
    keys.keys.iter().find(|jwk| {
        jwk.common.key_id.as_deref() == Some(kid)
            && matches!(jwk.common.key_algorithm, None | Some(KeyAlgorithm::ES256))
            && matches!(
                &jwk.algorithm,
                AlgorithmParameters::EllipticCurve(params) if params.curve == EllipticCurve::P256
            )
    })
}

async fn fetch_jwks(client: &reqwest::Client, url: &str) -> Result<JwkSet, AuthError> {
    let response =
        client.get(url).send().await.map_err(|error| {
            AuthError::Unavailable(format!("the key set request failed: {error}"))
        })?;

    let status = response.status();
    if !status.is_success() {
        return Err(AuthError::Unavailable(format!(
            "the key set responded with {status}"
        )));
    }

    response.json::<JwkSet>().await.map_err(|error| {
        AuthError::Unavailable(format!("the key set body could not be parsed: {error}"))
    })
}
