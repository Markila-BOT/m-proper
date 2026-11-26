'use strict';

// The direct Supabase Data API probe.
//
// The project disables the Data API (design §4), so a browser carrying a
// landlord's access token cannot read `properties` through PostgREST. This
// module makes exactly the request such a browser would make: the public
// publishable/anon key as `apikey` and the landlord's real access token as the
// Bearer credential. Nothing here uses the service key — the point is that a
// landlord's own token is refused.
//
// The refusal is asserted over HTTP. The requirement's second half — that the
// `anon`/`authenticated` grants on `properties` are revoked — lives in the
// database catalog, and this harness has no SQL client (`psql` is absent and
// the project has no Postgres driver in Node); the API's privileged
// `DATABASE_URL` connection is the only SQL path, which is exactly the
// service-role-equivalent path the scenario must not lean on. The step
// therefore asserts the HTTP refusal and says so, rather than pretending to
// read grants it cannot see.

const { acceptanceEnv } = require('./env');
const { readPublicWebEnv } = require('./web-bundle');

function projectUrl() {
  return acceptanceEnv().SUPABASE_URL.replace(/\/+$/, '');
}

// The browser's public publishable key (web/.env). It is public by design and
// is the key a Data API request would carry; the service key never appears in
// this module.
function publishableKey() {
  const env = readPublicWebEnv();
  return env.VITE_SUPABASE_ANON_KEY || null;
}

// A browser-shaped Data API request for the properties table. Returns the raw
// status and body so the step can assert the refusal, not a shaped envelope:
// PostgREST's own error body is part of the evidence.
async function queryPropertiesDirectly({ accessToken, includeKey = true } = {}) {
  if (!accessToken) throw new Error('The direct Data API probe needs the landlord’s access token.');

  const headers = { authorization: `Bearer ${accessToken}` };
  const key = publishableKey();
  if (includeKey) {
    if (!key) {
      throw new Error('web/.env does not define the publishable key the Data API request needs.');
    }
    headers.apikey = key;
  }

  const url = `${projectUrl()}/rest/v1/properties?select=id,name,address,type,units,is_active,created_at`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  return { status: response.status, ok: response.ok, body, text };
}

module.exports = { projectUrl, publishableKey, queryPropertiesDirectly };
