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
 *   1. Export the document: `cd api && cargo run -- --dump-openapi`
 *      (the API also writes api/openapi.json on every normal start)
 *   2. pnpm run generate:api-client
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const STAMP_LINE = /^\/\/ Generated\/validated against api\/openapi\.json[^\n]*\n/m;

/**
 * Places the generated stamp as the first line, replacing the previous one so
 * repeated runs never stack stamps.
 */
export function stampClient(
  source: string,
  version: string,
  generatedAt: Date,
): string {
  const stamp = `// Generated/validated against api/openapi.json (API ${version}) on ${generatedAt.toISOString()}\n`;

  return `${stamp}${source.replace(STAMP_LINE, "")}`;
}

function main(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const openapiPath = resolve(root, "api/openapi.json");
  const clientPath = resolve(root, "web/src/lib/api-client.ts");

  if (!existsSync(openapiPath)) {
    console.error(
      "Missing api/openapi.json. Run `cd api && cargo run -- --dump-openapi`.",
    );
    process.exitCode = 1;
    return;
  }

  const openapi = JSON.parse(readFileSync(openapiPath, "utf8")) as {
    paths?: Record<string, unknown>;
    info?: { version?: string };
  };

  const requiredPaths = ["/properties", "/properties/{id}"];
  for (const path of requiredPaths) {
    if (!openapi.paths?.[path]) {
      console.error(`OpenAPI missing path: ${path}`);
      process.exitCode = 1;
      return;
    }
  }

  if (!existsSync(clientPath)) {
    console.error(`Missing client at ${clientPath}`);
    process.exitCode = 1;
    return;
  }

  const client = readFileSync(clientPath, "utf8");
  writeFileSync(
    clientPath,
    stampClient(client, openapi.info?.version ?? "unknown", new Date()),
  );

  console.log("Validated OpenAPI paths and stamped web/src/lib/api-client.ts");
  console.log("Required paths OK:", requiredPaths.join(", "));
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  main();
}
