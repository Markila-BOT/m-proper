# web-app Specification

## Purpose

Defines the landlord web application shell that manages properties via the HTTP API and keeps transaction bookkeeping available in the browser for this change.

## Requirements

### Requirement: Property management UI
The web application MUST allow the user to view the list of properties from the properties API, create a new property, and delete a property. Property mutations MUST refresh the visible property list from the API after success.

#### Scenario: View properties from API

```gherkin
Given the user opens the application with the properties API available
Then the application displays properties returned by the API
```

#### Scenario: Create property from UI

```gherkin
Given the user submits a valid new property form
Then the application creates the property through the API
And the new property appears in the list
```

#### Scenario: Delete property from UI

```gherkin
Given the user deletes a property
Then the application removes it through the API
And it no longer appears in the list
```

### Requirement: Client-side transactions retained
For this change the web application MUST continue to store and display transactions in browser local storage (or equivalent client-only persistence). Transaction create/list/filter/summary behavior MUST remain available without requiring a transactions HTTP API.

#### Scenario: Transactions survive reload

```gherkin
Given the user has recorded transactions and reloads the application
Then those transactions are still available in the UI
```

### Requirement: An unreachable API is named, not zeroed

When the properties API is unreachable, the web application MUST distinguish that condition from an empty ledger: one shared unreachable state MUST appear at the property rail, the properties register, and the totals strip, naming the problem and the recovery in the application's own voice. The state MUST NOT be a modal or a transient notification, and the silent zero — empty lists with ₱0.00 figures as though the ledger were merely empty — MUST NOT render unaccompanied by that state.

#### Scenario: The unreachable state speaks where the silent zero used to

```gherkin
Given the web application is open and the properties API is unreachable
When the properties fetch rejects
Then the shared unreachable state appears at the property rail
And the same state appears at the properties register
And the same state appears at the totals strip
And the state names the problem and the recovery
And the empty ledger's zeroed figures do not render as though the ledger were merely empty
```

### Requirement: The ledger shows a running balance
The web application MUST show a running balance column on the ledger, derived client-side from the transactions displayed on the page, with no opening-balance concept and no API changes.

#### Scenario: The ledger shows a running balance

```gherkin
Given the ledger shows its recorded transactions
When the user reads down the ledger
Then a running balance accumulates along the ledger's right edge in displayed order
And it is derived from the transactions on the page with no opening balance
```

### Requirement: The ledger can be sorted by its columns
The web application MUST let the user sort the ledger by its columns, and the running balance MUST follow the displayed order after a sort.

#### Scenario: The ledger can be sorted by its columns

```gherkin
Given the ledger showing its transactions
When the user sorts by a column
Then the rows reorder by that column
And the running balance follows the new displayed order
```

### Requirement: Dates are chosen from calendar pickers

The web application MUST offer calendar pickers for date entry: a single-day picker in the transaction form and one range picker for the filter's from/to pair. Each picker MUST accept typed entry of a local calendar date (or range) and MUST reject an invalid or impossible value with a message that names the problem and the recovery, leaving the stored value unchanged. The calendar MUST be fully keyboard-operable, and closing the picker MUST restore focus to its trigger.

#### Scenario: The calendar is keyboard-operable

```gherkin
Given the transaction form is open
When the user opens the date picker and moves by arrow keys, PageUp, and PageDown, then presses Enter
Then a date is chosen and the picker closes
And focus returns to the picker's trigger
```

#### Scenario: An impossible typed date is rejected

```gherkin
Given the transaction form's date picker is open
When the user types an impossible calendar date and confirms
Then the picker shows a message naming the problem and the recovery
And the stored date is unchanged
```

#### Scenario: The filter pair accepts a typed range

```gherkin
Given the ledger filters are visible
When the user opens the range picker and selects a start and an end day
Then the ledger filters to that inclusive range
And the from and to fields show the chosen days
```

#### Scenario: The calendar's month controls work with a pointer

```gherkin
Given the transaction form's date picker is open
When the user clicks the next-month control
Then the calendar shows the following month
```

### Requirement: Long option lists are searchable

The transaction category select MUST offer search over its options, including a visible no-match state, and MUST remain fully keyboard-operable; the property filter MAY keep the plain select.

#### Scenario: Searching narrows the category list

```gherkin
Given the transaction form's category select is open
When the user types part of a category name
Then only matching categories remain listed
And when nothing matches, a no-match message appears
And keyboard selection still works on the narrowed list
```

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

### Requirement: Sign-out clears the visible state

Sign-out MUST clear the visible ledger, the query cache, and the in-memory property and filter state, so no previous landlord's data is left on screen after the session ends. Where the browser ledger is stored, and how a pre-auth ledger is offered for import, belong to the server-transactions change, which retires the local ledger in favour of the server's.

#### Scenario: Sign-out clears the visible state

```gherkin
Given a signed-in landlord with properties and a ledger on screen
When the landlord signs out
Then the visible ledger, property list, and cached queries are cleared
And the next account does not see the previous landlord's data flash on screen
```

### Requirement: Property calls stay on the app's origin

The web application MUST call the properties routes on its own origin, so no API host or port is configured for a deployment, and local development MUST work without a base URL. No runtime override MAY redirect the calls.

#### Scenario: Same-origin calls need no configured host

```gherkin
Given the web application is deployed at its production origin
When the app requests the properties list
Then the request targets the same origin
And no separate API base URL was configured
```
