## 1. Specs zone — the delta rides the change (one commit)

- [ ] 1.1 Confirm the delta's ADDED requirement carries no name collision with the redesign change's MODIFIED rules (it adds one new requirement; they modify three existing ones)

## 2. Code zone — the shared state (one commit)

- [ ] 2.1 Build the shared unreachable state component: an ink-grounded status line in the passbook caption voice, `data-unreachable="properties"` marker, naming problem and recovery — red → green → commit
- [ ] 2.2 Mount it at the three silent-zero locations (property rail, properties register, totals strip scope note); suppress the strip's ₱0.00 figures while the state shows — red → green → commit
- [ ] 2.3 Set `retry: 1` on the properties query — red → green → commit

## 3. Step definitions — the unreachable scenario (red → green → commit)

- [ ] 3.1 Given the app open with the properties API unreachable: boot a page load with the base URL pointed at an unbound port (`http://localhost:9`) — red → green → commit
- [ ] 3.2 Then the shared state appears at the rail, the register, and the totals strip: assert the `data-unreachable` marker at all three mount points — red → green → commit
- [ ] 3.3 And the state names the problem and the recovery: assert problem-and-recovery copy presence, never exact strings — red → green → commit
- [ ] 3.4 And the zeroed figures do not render unaccompanied: assert the strip's ₱0.00 figures are absent while the state shows — red → green → commit

## 4. Completion

- [ ] 4.1 Full suite green at 32 scenarios, zero pending or undefined, HTML report generated
- [ ] 4.2 The redesign change's suite-minus-self run green at 30 scenarios (no new failures introduced there)
- [ ] 4.3 `openspec validate` non-strict clean; the state recorded in DESIGN.md's honesty signals so any future parity pass sees an explained difference
