# authentication

## Purpose

Records the private production posture: the first production **Landlord account** is created by an operator while public sign-up remains closed, and public sign-up can open only after the CAPTCHA provider the auth configuration already requires is configured. Development and preview environments keep the existing sign-up behaviour.

## MODIFIED Requirements

### Requirement: Landlord accounts are created with email and password

The system MUST create a **Landlord account** from an email and password through Supabase Auth in development and preview environments, and MUST require email confirmation before the account can sign in. In the production environment, public sign-up MUST be closed at Supabase Auth and the first **Landlord account** MUST be created by an operator; production sign-up MUST remain closed until the CAPTCHA provider required by the auth configuration requirement is configured, and the production declaration MUST record that posture. An unconfirmed account MUST be refused at sign-in with a message naming the confirmation step and offering a resend; an expired confirmation link MUST be refused with a recovery path. A duplicate email and a weak password MUST be refused without revealing whether an account exists.

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

#### Scenario: Production sign-up is closed

```gherkin
Given the production declaration records public sign-up as closed
When the deployment check runs
Then it reports production sign-up closed
```

#### Scenario: An open production sign-up is refused before CAPTCHA

```gherkin
Given the production declaration opens public sign-up without a CAPTCHA provider
When the deployment check runs
Then it fails naming the missing CAPTCHA configuration
```
