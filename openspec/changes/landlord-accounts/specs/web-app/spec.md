# web-app

## Purpose

Adds the landlord sign-in surfaces, route protection, authenticated API client, and per-account browser ledger; every existing ledger, picker, and honesty behavior stands.

## ADDED Requirements

### Requirement: The shell requires a signed-in landlord

The shell MUST expose public sign-in, sign-up, confirmation, reset-request, and new-password surfaces, and MUST protect every ledger screen. An unauthenticated visit MUST be sent to sign-in and returned afterwards. The return target MUST be a same-origin relative path beginning with a single `/`; an absolute URL, a protocol-relative path, a scheme, or a backslash-prefixed path MUST fall back to the default page. The header MUST show the signed-in landlord and a sign-out control.

#### Scenario: An unauthenticated visit is sent to sign-in

```gherkin
Given the visitor is signed out
When the visitor opens a ledger screen
Then the app sends the visitor to sign in
And after a successful sign-in it returns to the intended screen
```

#### Scenario: A tampered return target is refused

```gherkin
Given the visitor is signed out
When the return target is an absolute URL, a protocol-relative path, or has a scheme
Then after sign-in the app lands on the default screen, not the target
```

#### Scenario: The header identifies the landlord and signs out

```gherkin
Given a signed-in landlord
Then the header shows the landlord's email
When the landlord signs out
Then the session ends and a protected screen sends the visitor to sign in
```

### Requirement: API requests carry the landlord's access token

Every API request MUST carry the landlord's **Access token** as a Bearer credential. On a 401 the client MUST refresh the session once and retry; a second 401, or a refresh failure, MUST sign the landlord out. A server-side auth outage MUST surface as the app's unreachable state, not as a sign-out or an empty record.

#### Scenario: A valid token reaches the API

```gherkin
Given a signed-in landlord
When the app requests the properties list
Then the request carries the access token
And the response is accepted
```

#### Scenario: An expired token refreshes once and retries

```gherkin
Given the access token has expired and the refresh token is valid
When the app makes a request
Then the client refreshes once and retries
And the retried request succeeds
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

### Requirement: The local ledger is scoped to the landlord account

The browser transaction ledger MUST be stored per **Local ledger scope**, keyed by the signed-in account. The pre-auth legacy ledger MUST NOT be attributed to whoever signs in: it is preserved in a legacy namespace and imported only after an explicit confirmation into the signed-in account. Sign-out MUST clear the visible ledger, the query cache, and the in-memory property and filter state.

#### Scenario: Two accounts on one browser do not see each other's ledger

```gherkin
Given landlord A signs in on a browser and records a transaction
When A signs out and landlord B signs in
Then B's ledger is empty
And A's entries return when A signs in again
```

#### Scenario: The legacy ledger is offered, not claimed

```gherkin
Given the browser holds a ledger from before accounts existed
When a landlord signs in
Then the entries are not shown until the landlord confirms an import
And another account never receives them automatically
```

#### Scenario: Sign-out clears the visible state

```gherkin
Given a signed-in landlord with properties and a ledger on screen
When the landlord signs out
Then the visible ledger, property list, and cached queries are cleared
And the next account does not see the previous landlord's data flash on screen
```
