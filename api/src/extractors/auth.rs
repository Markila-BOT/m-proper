use axum::{
    extract::FromRequestParts,
    http::{HeaderMap, header, request::Parts},
};

use crate::{auth::Identity, errors::AppError, state::AppState};

/// Authenticates the request: the verified token subject becomes the caller's
/// `Identity`, and every failure is the API's 401/503 envelope.
impl FromRequestParts<AppState> for Identity {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = bearer_token(&parts.headers).ok_or(AppError::Unauthorized)?;

        state.verifier.verify(token).await.map_err(AppError::from)
    }
}

/// Parses `Authorization: Bearer <token>`. The scheme is case-insensitive,
/// whitespace around the value is ignored, and anything after the token is
/// refused so a junk header cannot smuggle a prefix match.
fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    let header = headers.get(header::AUTHORIZATION)?.to_str().ok()?.trim();
    let (scheme, token) = header.split_once(char::is_whitespace)?;

    if !scheme.eq_ignore_ascii_case("Bearer") {
        return None;
    }

    let token = token.trim();
    if token.is_empty() || token.chars().any(char::is_whitespace) {
        return None;
    }

    Some(token)
}

#[cfg(test)]
mod tests {
    use axum::http::{HeaderMap, HeaderValue, header};

    use super::bearer_token;

    fn headers(value: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_str(value).expect("the fixture header should be valid"),
        );
        headers
    }

    #[test]
    fn parses_a_bearer_token() {
        assert_eq!(bearer_token(&headers("Bearer abc")), Some("abc"));
    }

    #[test]
    fn accepts_any_scheme_case() {
        assert_eq!(bearer_token(&headers("bEaReR abc")), Some("abc"));
    }

    #[test]
    fn ignores_surrounding_whitespace() {
        assert_eq!(bearer_token(&headers("  bearer   abc  ")), Some("abc"));
    }

    #[test]
    fn refuses_trailing_junk() {
        assert_eq!(bearer_token(&headers("Bearer abc def")), None);
    }

    #[test]
    fn refuses_another_scheme() {
        assert_eq!(bearer_token(&headers("Basic abc")), None);
    }

    #[test]
    fn refuses_a_missing_header() {
        assert_eq!(bearer_token(&HeaderMap::new()), None);
    }

    #[test]
    fn refuses_an_empty_token() {
        assert_eq!(bearer_token(&headers("Bearer   ")), None);
    }
}
