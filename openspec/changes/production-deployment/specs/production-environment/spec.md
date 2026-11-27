# production-environment

## Purpose

Defines the production runtime as a testable configuration contract: a Hobby Vercel project pinned to one root, one framework, one branch, and one region; a dedicated Free Supabase project with a runtime transaction pooler and a session-pooler migration connection; and an explicit production origin that the app, Supabase redirects, and the live smoke all share.

## ADDED Requirements

### Requirement: The production declaration is complete

The repository MUST contain one checked-in production declaration naming the Vercel team and plan, the project, root directory, framework, production branch, function region, production origin, the Supabase plan and production and preview project references, the runtime connection shape, the migration connection shape, and the production sign-up posture. A deployment check MUST fail, naming every absent field, when a required value is missing or still a placeholder.

#### Scenario: A complete declaration passes

```gherkin
Given a production declaration with every required field
When the deployment check runs
Then it reports the project, region, branch, and production origin
And it exits successfully
```

#### Scenario: A missing field is named

```gherkin
Given a production declaration without a function region
When the deployment check runs
Then it fails naming the region
```

### Requirement: The free-tier posture is declared

The production declaration MUST record `hobby` for the Vercel plan and `free` for the Supabase plan. The deployment check MUST refuse a paid plan until the declaration is deliberately changed, so an accidental upgrade does not enter the release path unnoticed.

#### Scenario: A paid plan is refused

```gherkin
Given a production declaration whose Vercel plan is pro
When the deployment check runs
Then it fails naming the Vercel plan
```

#### Scenario: The free plans pass

```gherkin
Given a production declaration with the Vercel plan hobby and the Supabase plan free
When the deployment check runs
Then it accepts both plans
```

### Requirement: The production contract is internally consistent

The deployment check MUST fail, naming the offending value, when the production origin is not HTTPS or contains a path, query, or wildcard, when the region is not `sin1`, when the production branch is not `release`, or when the framework or root directory differs from `tanstack-start` and `web`.

#### Scenario: A wildcard production origin is refused

```gherkin
Given a production declaration whose origin contains a wildcard
When the deployment check runs
Then it fails naming the production origin
```

#### Scenario: The wrong region or root is refused

```gherkin
Given a production declaration whose region is not sin1
When the deployment check runs
Then it fails naming the region
```

### Requirement: Production and preview data planes are distinct

The production and preview environments MUST name different Supabase project references. The deployment check MUST fail when they are equal, so a preview deployment cannot share the production database by configuration.

#### Scenario: A shared project reference is refused

```gherkin
Given a declaration whose production and preview project references are the same
When the deployment check runs
Then it fails naming both environments
```

### Requirement: The runtime and migration connections are split

`DATABASE_URL` MUST be a `postgresql://` transaction-pooler URL on port 6543, and `DIRECT_DATABASE_URL` MUST be a `postgresql://` session-pooler URL on port 5432. The two URLs MUST differ. The deployment check MUST refuse a runtime URL on port 5432, a migration URL on port 6543, or identical URLs.

#### Scenario: The split connection passes

```gherkin
Given a transaction-pooler runtime URL on port 6543
And a session-pooler migration URL on port 5432
When the deployment check runs
Then it reports both connections as valid
And it reports that they differ
```

#### Scenario: Identical runtime and migration URLs are refused

```gherkin
Given the same URL for the runtime and the migration connection
When the deployment check runs
Then it fails naming both variables
```

#### Scenario: The wrong pooler mode is refused

```gherkin
Given a migration URL on port 6543
When the deployment check runs
Then it fails naming the migration connection
```

### Requirement: The production origin is the only production auth origin

The production Supabase Site URL and redirect allowlist MUST use the exact production origin, with no wildcard. Preview origins MUST belong to the development project, not the production one. The deployment check MUST fail when a wildcard production auth origin is declared.

#### Scenario: An exact production auth origin passes

```gherkin
Given the production origin is https://m-proper.vercel.app
And the production auth origin is the same exact origin
When the deployment check runs
Then it accepts the production auth origin
```

#### Scenario: A wildcard production auth origin is refused

```gherkin
Given the production auth origin admits a wildcard preview origin
When the deployment check runs
Then it fails naming the production auth origin
```

### Requirement: A missing production variable is named before release

The deployment check MUST name every required production variable that is absent from the production environment, and MUST NOT print any variable's value. It MUST run before the backup, the migration, and any deployment.

#### Scenario: A missing production variable is named

```gherkin
Given the production environment lacks the Supabase JWKS location
When the deployment check runs
Then it fails naming that variable
And no configured value appears in the output
```
