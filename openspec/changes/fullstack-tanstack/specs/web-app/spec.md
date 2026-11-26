# web-app

## Purpose

The properties routes now live on the web's own origin, so the browser sends its session cookie instead of attaching an access token, the server owns token refresh, and no API host is configured.

## REMOVED Requirements

### Requirement: API base configuration

**Reason**: The properties routes are served by the same app, so there is no API host or port to configure and no runtime override to keep.

**Migration**: Same-origin `/api` calls need no configuration. The unreachable state is exercised from the test side rather than by a product affordance.

## MODIFIED Requirements

### Requirement: API requests carry the landlord's access token

Every properties request MUST carry the landlord's Supabase session cookie, and the server MUST resolve the identity from it. When the access token has expired, the **server** MUST refresh the session and answer with rotated cookies before serving the request; the browser does not refresh, and no token is readable from script. A session that cannot be refreshed MUST sign the landlord out. A server-side auth outage — including an unreachable key set — MUST surface as the app's unreachable state, not as a sign-out or an empty record.

#### Scenario: A valid token reaches the API

```gherkin
Given a signed-in landlord
When the app requests the properties list
Then the request carries the session cookie
And the response is accepted
```

#### Scenario: An expired token refreshes once and retries

```gherkin
Given the session's access token has expired and the refresh token is valid
When the app makes a request
Then the server refreshes the session once and answers with rotated cookies
And the request succeeds without a second client round trip
```

#### Scenario: A revoked session signs out

```gherkin
Given the session can no longer be refreshed
When the app makes a request
Then the landlord is signed out and sent to sign in
```

#### Scenario: An auth outage is not a sign-out

```gherkin
Given the API cannot verify tokens because the key set is unavailable
When the app makes a request
Then the app shows the unreachable state
And the session is not cleared
```

## ADDED Requirements

### Requirement: Property calls stay on the app's origin

The web application MUST call the properties routes on its own origin, so no API host or port is configured for a deployment, and local development MUST work without a base URL. No runtime override MAY redirect the calls.

#### Scenario: Same-origin calls need no configured host

```gherkin
Given the web application is deployed at its production origin
When the app requests the properties list
Then the request targets the same origin
And no separate API base URL was configured
```
