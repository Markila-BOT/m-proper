// scripts/generate-api-client.test.ts
/**
 * Unit tests for the OpenAPI client stamp.
 *
 * Run: node --experimental-strip-types --test scripts/generate-api-client.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { stampClient } from "./generate-api-client.ts";

const client = [
  "// web/src/lib/api-client.ts",
  "// Hand-maintained client aligned with api/openapi.json.",
  "// Regenerate guidance: pnpm run generate:api-client",
  "",
  "export type Property = { id: string };",
  "",
].join("\n");

const firstRun = new Date("2026-11-24T09:00:00.000Z");
const secondRun = new Date("2026-11-25T09:00:00.000Z");

test("the stamp is the first line of the client", () => {
  const stamped = stampClient(client, "0.1.0", firstRun);

  assert.equal(
    stamped.split("\n")[0],
    "// Generated/validated against api/openapi.json (API 0.1.0) on 2026-11-24T09:00:00.000Z",
  );
});

test("the rest of the client is left untouched", () => {
  const stamped = stampClient(client, "0.1.0", firstRun);

  assert.ok(stamped.endsWith(client), "the client body should survive stamping");
});

test("re-stamping replaces the previous stamp", () => {
  const stamped = stampClient(
    stampClient(client, "0.1.0", firstRun),
    "0.1.0",
    secondRun,
  );

  assert.deepEqual(
    stamped
      .split("\n")
      .filter((line) => line.startsWith("// Generated/validated against")),
    [
      "// Generated/validated against api/openapi.json (API 0.1.0) on 2026-11-25T09:00:00.000Z",
    ],
  );
});
