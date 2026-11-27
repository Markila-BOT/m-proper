# acceptance-suite

## Purpose

Adds the main-spec profile a release can trust while other changes are still unimplemented: the profile and its suite-minus-self child share one composition, so active deltas cannot leak into the gate.

## ADDED Requirements

### Requirement: A source-of-truth profile gates releases

The **Acceptance suite** MUST provide a main-spec-only profile, `npm run test:specs`, that executes only the specs under `openspec/specs/` with no active-change delta. It MUST name every excluded active change in its composition report and MUST pass the same scope to its suite-minus-self child so the child cannot reintroduce those deltas. A pending or undefined step in that profile MUST fail the run.

#### Scenario: The specs profile excludes active deltas

```gherkin
Given active changes have delta scenarios under openspec/changes
When the landlord runs the specs profile
Then only main-spec scenarios execute
And every excluded active change is named in the composition report
```

#### Scenario: The self-check child shares the parent scope

```gherkin
Given the specs profile starts its suite-minus-self child
When the child composes its scenario set
Then it uses the same main-spec scope as its parent
And no active-change delta executes in the child
```

#### Scenario: A main-spec failure still fails the run

```gherkin
Given a main spec whose scenario fails
When the landlord runs the specs profile
Then the run fails
And the failure names the failing main-spec scenario
```
