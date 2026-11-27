# authentication

## Purpose

Moves the access token's transport from an `Authorization` header to the Supabase session cookie now that the API routes run on the web's own origin. The verification rules are unchanged; only where the token is read from changes.

## MODIFIED Requirements

### Requirement: Access tokens are verified against the project JWKS

The API MUST derive the caller's identity from the Supabase session cookie set for the web's own origin, and MUST answer 401 with the standard envelope when that cookie is absent. It MUST verify the cookie's access token against the project **JWKS** using ES256 only, with a pinned issuer and audience, an expiry check with a small leeway, a non-empty subject, the `authenticated` role, and no anonymous-user claim. It MUST reject `none` and HS-family algorithms and any token without a subject. It MUST cache the JWKS for no longer than ten minutes, refetch once when an unknown key id appears, and fail closed when no key is available. An `Authorization` header MUST NOT be required or trusted for these routes.

#### Scenario: A valid access token is accepted

```gherkin
Given a signed-in landlord whose browser holds the session cookie
When the app requests the properties list
Then the API accepts the cookie's access token and uses its subject as the owner
```

#### Scenario: A missing or forged token is refused

```gherkin
Given a request has no session cookie or a cookie whose token has an invalid signature
Then the API responds 401 with success false
And no data is returned
```

#### Scenario: The wrong issuer, audience, or role is refused

```gherkin
Given a cookie carries a token issued for another project, another audience, or an anonymous user
Then the API responds 401 with success false
```

#### Scenario: An expired token is refused

```gherkin
Given a cookie carries a token whose expiry has passed beyond the leeway
Then the API responds 401 with success false
```

#### Scenario: A JWKS outage fails closed

```gherkin
Given the JWKS cannot be reached and no cached key verifies the token
Then the API responds 503 with success false
And it never accepts the token
```

### Requirement: The auth configuration keeps secrets server-side

The app MUST require its issuer, JWKS location, audience, and database URL in its server-side environment, and MUST fail before serving when one is absent, naming the missing variable. Only the project URL and the publishable key MAY reach the browser; no service key, secret key, database URL, or JWKS location MAY appear in the client bundle. Production sign-up MUST be protected by Supabase's rate limits and a CAPTCHA provider, and confirmation and reset mail MUST use a configured SMTP provider.

#### Scenario: The API refuses to start without auth configuration

```gherkin
Given the app starts without an issuer or JWKS location
Then it fails before serving
And the failure names the missing variable
```

#### Scenario: Only public auth material reaches the browser

```gherkin
Given the built web bundle and its environment
Then it carries no secret or service key
And it carries no database URL or key-set location
```
