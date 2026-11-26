# authentication

## Purpose

Defines the identity contract: landlord account creation and confirmation, sign-in and sign-out, password reset without enumeration, the cookie-backed session, access-token verification against the project JWKS, and the security configuration that keeps only the publishable key public.

## ADDED Requirements

### Requirement: Landlord accounts are created with email and password

The system MUST create a **Landlord account** from an email and password through Supabase Auth and MUST require email confirmation before the account can sign in. An unconfirmed account MUST be refused at sign-in with a message naming the confirmation step and offering a resend; an expired confirmation link MUST be refused with a recovery path. A duplicate email and a weak password MUST be refused without revealing whether an account exists.

#### Scenario: A new account must confirm before signing in

```gherkin
Given a visitor signs up with an email and a valid password
When the confirmation link has not been used
Then the account exists but cannot sign in
And the sign-in attempt names the confirmation step and offers a resend
```

#### Scenario: A confirmed account signs in

```gherkin
Given a landlord account has confirmed its email
When the landlord signs in with the right password
Then a session starts
```

#### Scenario: A duplicate email does not reveal itself

```gherkin
Given an account already exists for an email
When another sign-up uses that email
Then the response does not say whether the address is registered
```

### Requirement: A landlord signs in and out

The system MUST start a cookie-backed **Session** on a valid sign-in and MUST end it on sign-out. An invalid password MUST be refused with a generic message that does not distinguish a wrong password from an unknown address. A reload MUST keep the session; an explicit sign-out MUST clear it.

#### Scenario: A valid sign-in starts a session

```gherkin
Given a confirmed landlord account
When the landlord signs in with the right credentials
Then the session survives a page reload
```

#### Scenario: A wrong password is generic

```gherkin
Given a confirmed landlord account
When the landlord signs in with the wrong password
Then the refusal does not reveal whether the address exists
```

#### Scenario: Sign-out ends the session

```gherkin
Given a signed-in landlord
When the landlord signs out
Then the session is gone
And a protected page sends the visitor to sign in
```

### Requirement: Password reset does not enumerate accounts

A reset request MUST return the same generic response for a known and an unknown address, and MUST send a recovery link only for a known one. A recovery **Session** MUST allow setting a new password, after which the old password MUST fail and the new one MUST succeed. Recovery links MUST only redirect to an allowed origin.

#### Scenario: Reset requests look identical

```gherkin
Given the landlord enters an email for reset
When the address is unknown
Then the response is the same as for a known address
```

#### Scenario: A recovery session sets a new password

```gherkin
Given a landlord follows a valid recovery link
When the landlord submits a new password
Then the new password signs in
And the old password is refused
```

### Requirement: Access tokens are verified against the project JWKS

Every API request MUST carry a valid **Access token**. The Rust API MUST verify the signature against the project **JWKS** using ES256 only, with a pinned issuer and audience, an expiry check with a small leeway, a non-empty subject, the `authenticated` role, and no anonymous-user claim. It MUST reject `none` and HS-family algorithms and any token without a subject. It MUST cache the JWKS for no longer than ten minutes, refetch once when an unknown key id appears, and fail closed when no key is available.

#### Scenario: A valid access token is accepted

```gherkin
Given a signed-in landlord sends a request with its access token
Then the API accepts the token and uses its subject as the owner
```

#### Scenario: A missing or forged token is refused

```gherkin
Given a request has no token or a token with an invalid signature
Then the API responds 401 with success false
And no data is returned
```

#### Scenario: The wrong issuer, audience, or role is refused

```gherkin
Given a token was issued by another project, for another audience, or for an anonymous user
Then the API responds 401 with success false
```

#### Scenario: An expired token is refused

```gherkin
Given a token whose expiry has passed beyond the leeway
Then the API responds 401 with success false
```

#### Scenario: A JWKS outage fails closed

```gherkin
Given the JWKS cannot be reached and no cached key verifies the token
Then the API responds 503 with success false
And it never accepts the token
```

### Requirement: The auth configuration keeps secrets server-side

The API MUST require its issuer, JWKS location, and audience configuration and MUST refuse to start without them. Only the publishable key and project URL MAY reach the browser. Production sign-up MUST be protected by Supabase's rate limits and a CAPTCHA provider, and confirmation and reset mail MUST use a configured SMTP provider.

#### Scenario: The API refuses to start without auth configuration

```gherkin
Given the API starts without an issuer or JWKS location
Then it does not serve requests
```

#### Scenario: Only public auth material reaches the browser

```gherkin
Given the built web bundle and its environment
Then it carries the project URL and publishable key
And it carries no secret or service key
```
