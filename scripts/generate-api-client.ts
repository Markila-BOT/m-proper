// scripts/generate-api-client.ts
/**
 * Regenerates the TypeScript API client from api/openapi.json.
 *
 * Current implementation refreshes the hand-maintained client header comment
 * and validates that required paths exist in the OpenAPI document.
 * When you prefer full codegen, swap the body for openapi-typescript /
 * @hey-api/openapi-ts output into web/src/lib/api-client.ts.
 *
 * Usage (from repo root):
 *   1. Start/run the API once so api/openapi.json is written
 *   2. pnpm run generate:api-client
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const openapiPath = resolve(root, "api/openapi.json");
const clientPath = resolve(root, "web/src/lib/api-client.ts");

if (!existsSync(openapiPath)) {
  console.error("Missing api/openapi.json. Run the API once to export it.");
  process.exit(1);
}

const openapi = JSON.parse(readFileSync(openapiPath, "utf8")) as {
  paths?: Record<string, unknown>;
  info?: { version?: string };
};

const requiredPaths = ["/properties", "/properties/{id}"];
for (const path of requiredPaths) {
  if (!openapi.paths?.[path]) {
    console.error(`OpenAPI missing path: ${path}`);
    process.exit(1);
  }
}

if (!existsSync(clientPath)) {
  console.error(`Missing client at ${clientPath}`);
  process.exit(1);
}

let client = readFileSync(clientPath, "utf8");
const stamp = `// Generated/validated against api/openapi.json (API ${openapi.info?.version ?? "unknown"}) on ${new Date().toISOString()}\n`;
client = client.replace(
  /^\/\/ Generated\/validated against api\/openapi\.json.*\n/,
  "",
);
if (
  !client.startsWith(
    "// Hand-maintained client aligned with api/openapi.json.",
  )
) {
  // keep existing header if already stamped
}
client = client.replace(
  /^\/\/ Hand-maintained client aligned with api\/openapi\.json\.\n\/\/ Regenerate guidance:.*\n/,
  `${stamp}// Hand-maintained client aligned with api/openapi.json.\n// Regenerate guidance: pnpm run generate:api-client\n`,
);

writeFileSync(clientPath, client);
console.log("Validated OpenAPI paths and stamped web/src/lib/api-client.ts");
console.log("Required paths OK:", requiredPaths.join(", "));
