'use strict';

// Parser for cucumber-js 'message' format output (NDJSON envelopes). Joins
// each test case to its pickle (feature uri + scenario name) and derives the
// case's overall status from its step results, so steps can assert over
// exactly what a child run executed.

// Worst-of ranking: a case is as bad as its worst step result.
const STATUS_RANK = {
  FAILED: 5,
  AMBIGUOUS: 4,
  UNDEFINED: 3,
  PENDING: 2,
  SKIPPED: 1,
  PASSED: 0,
};

function parseMessages(ndjsonText) {
  const envelopes = ndjsonText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const picklesById = new Map(); // pickle id → { uri, name }
  const pickleIdByTestCaseId = new Map(); // test case id → pickle id
  const testCaseStartedEnvelopes = [];
  const stepStatusesByStartedId = new Map(); // testCaseStartedId → [status]

  for (const envelope of envelopes) {
    if (envelope.pickle) {
      picklesById.set(envelope.pickle.id, {
        uri: envelope.pickle.uri,
        name: envelope.pickle.name,
      });
    } else if (envelope.testCase) {
      pickleIdByTestCaseId.set(envelope.testCase.id, envelope.testCase.pickleId);
    } else if (envelope.testCaseStarted) {
      testCaseStartedEnvelopes.push(envelope.testCaseStarted);
    } else if (envelope.testStepFinished) {
      const startedId = envelope.testStepFinished.testCaseStartedId;
      if (!stepStatusesByStartedId.has(startedId)) stepStatusesByStartedId.set(startedId, []);
      stepStatusesByStartedId.get(startedId).push(envelope.testStepFinished.testStepResult.status);
    }
  }

  // Only scenarios that became test cases reached the runner — pickle
  // envelopes alone also cover scenarios a line-targeted path left out.
  const cases = testCaseStartedEnvelopes.map((started) => {
    const pickleId = pickleIdByTestCaseId.get(started.testCaseId);
    const pickle = picklesById.get(pickleId) || { uri: '(unknown feature)', name: '(unknown scenario)' };
    const stepStatuses = stepStatusesByStartedId.get(started.id) ?? [];
    const status = stepStatuses.reduce(
      (worst, current) => (STATUS_RANK[current] > STATUS_RANK[worst] ? current : worst),
      'PASSED'
    );
    return { uri: pickle.uri, name: pickle.name, status, stepStatuses };
  });
  return cases;
}

function summarizeCases(cases) {
  const counts = new Map();
  for (const testCase of cases) {
    counts.set(testCase.status, (counts.get(testCase.status) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([status, count]) => `${count} ${status}`);
  return `${cases.length} case(s): ${parts.join(', ') || 'none'}`;
}

module.exports = { parseMessages, summarizeCases };
