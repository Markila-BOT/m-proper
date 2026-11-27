# deployable-artifact

## Purpose

Defines what "one deployable app" means once the Rust service is gone, in terms a test can execute: a production build that runs, the routes answering on that build, a configuration contract that fails before serving, and a bundle that carries only public values.

## ADDED Requirements

### Requirement: The build emits a runnable server

The production build MUST emit a Node server that serves the pages and the `/api` routes, using the deployment platform's documented adapter, so deploying needs configuration but no code change.

#### Scenario: The built server serves a page and a route

```gherkin
Given the repository at its committed state
When the production build runs and its server starts
Then a page request returns HTML
And a request to the properties route returns the JSON envelope
And the platform adapter's output directory is present
```

### Requirement: The routes answer on the built app

On the built app, `/api/properties` MUST answer 401 with the envelope when the request carries no session, and `/api/health` MUST answer 200 when the database is reachable and 503 when it is not. The process MUST keep serving other requests while the database is unreachable.

#### Scenario: No session is a 401 on the built app

```gherkin
Given the built app is running
When a client requests the properties list without a session cookie
Then the response is 401 with success false
```

#### Scenario: Health reports database readiness

```gherkin
Given the built app is running and the database is unreachable
When a client requests the health route
Then the response is 503 with success false
And a page request still answers
```

### Requirement: Missing configuration fails before serving

The app MUST refuse to serve when a required server-side value is absent — the database URL, the JWKS location, the token issuer, or the audience — and MUST fail with a message naming it. The browser bundle MUST NOT carry a service key, secret key, database URL, or JWKS location; because the session cookie is httpOnly and the routes are same-origin, the browser needs no Supabase credential of its own.

#### Scenario: A missing JWKS location is named

```gherkin
Given the app starts without a JWKS location
When it boots
Then it fails before serving any request
And the message names the missing variable
```

#### Scenario: The bundle carries only public values

```gherkin
Given the production build
When the client bundle is inspected
Then it carries no service key, secret key, database URL, or JWKS location
And it needs no Supabase credential to call the same-origin routes
```
