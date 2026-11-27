'use strict';

// The stub production world a release or a live smoke talks to.
//
// The release pipeline reaches three things the acceptance run cannot touch
// for real: the production origin, the Vercel REST API, and the production
// Supabase project. This server answers all three on one local port and
// records every request, so a scenario can assert both what the command
// reported and what it actually did (how many properties it created, which
// rows it deleted, whether a marker-less row was ever touched).
//
// It is started in the acceptance process (not as a child), so the recorded
// state is read directly and the port is closed in the scenario's finally.

const http = require('node:http');

const SESSION_COOKIE_RE = /(?:^|;\s*)sb-.+-auth-token(?:\.\d+)?=/;

function hasSessionCookie(header = '') {
  return SESSION_COOKIE_RE.test(header);
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

// The stub's world: the plan's smoke section decides what it answers.
function createWorld(plan) {
  const smoke = plan.smoke || {};
  const runMarker = smoke.runMarker || 'm-proper-smoke';
  const rows = new Map();
  for (const row of smoke.existingRows || []) {
    rows.set(row.id, {
      id: row.id,
      name: row.name,
      marker: row.marker === undefined ? row.name.includes(runMarker) : row.marker,
    });
  }
  return {
    plan,
    smoke,
    runMarker,
    rows,
    requests: [],
    posts: [],
    deletes: [],
    listAnswers: [],
    nextRow: 0,
    smokeUserId: 'stub-smoke-user',
  };
}

function handleHealth(world, res) {
  const status = Number(world.smoke.health || 200);
  if (status === 200) {
    json(res, 200, {
      success: true,
      data: { database: 'connected', stub: true },
    });
    return true;
  }
  json(res, status, {
    success: false,
    message: `production health route answered ${status}`,
  });
  return true;
}

async function handleProperties(world, req, res, url) {
  const signedIn = hasSessionCookie(req.headers.cookie || '');
  const expected = Number(world.smoke.propertiesUnauthenticated || 401);
  if (!signedIn) {
    json(res, expected, { success: false, message: 'Unauthorized' });
    return true;
  }

  if (req.method === 'GET') {
    let listed = [...world.rows.values()];
    if (world.smoke.failStep === 'round-trip') {
      // The round trip's failure: the property that was just created is not
      // listed back, so the smoke's list assertion fails.
      listed = listed.filter((row) => !row.createdBySmoke);
    }
    world.listAnswers.push({ ids: listed.map((row) => row.id) });
    json(res, 200, { success: true, data: listed.map((row) => ({ id: row.id, name: row.name })) });
    return true;
  }

  if (req.method === 'POST') {
    const body = (await readBody(req)) || {};
    world.nextRow += 1;
    const row = {
      id: `stub-created-${world.nextRow}`,
      name: String(body.name || ''),
      marker: String(body.name || '').includes(world.runMarker),
      createdBySmoke: true,
    };
    world.rows.set(row.id, row);
    world.posts.push(row);
    json(res, 201, { success: true, data: { id: row.id, name: row.name } });
    return true;
  }

  if (req.method === 'DELETE') {
    const id = decodeURIComponent(url.pathname.split('/').pop() || '');
    const row = world.rows.get(id);
    if (!row) {
      json(res, 404, { success: false, message: 'Not found' });
      return true;
    }
    if (world.smoke.failStep === 'delete') {
      json(res, 500, { success: false, message: 'stub refused the delete' });
      return true;
    }
    world.rows.delete(id);
    world.deletes.push({ id, name: row.name, marker: row.marker, createdBySmoke: row.createdBySmoke });
    json(res, 200, { success: true, message: 'Property deleted' });
    return true;
  }

  json(res, 405, { success: false, message: 'Method not allowed' });
  return true;
}

async function handleAuth(world, req, res, url) {
  if (url.pathname === '/auth/v1/admin/generate_link') {
    await readBody(req);
    json(res, 200, {
      action_link: `${world.stubUrl}/auth/v1/verify?token=stub-token-hash&type=magiclink`,
      hashed_token: 'stub-token-hash',
      email_otp: '000000',
      verification_type: 'magiclink',
      user: {
        id: world.smokeUserId,
        email: world.smoke.accountEmail || 'smoke-account@m-proper.example',
      },
    });
    return true;
  }

  if (url.pathname === '/auth/v1/verify') {
    const user = {
      id: world.smokeUserId,
      email: world.smoke.accountEmail || 'smoke-account@m-proper.example',
      aud: 'authenticated',
      role: 'authenticated',
    };
    json(res, 200, {
      access_token: 'stub-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'stub-refresh-token',
      user,
    });
    return true;
  }

  if (url.pathname === '/auth/v1/signup') {
    await readBody(req);
    if (world.smoke.signUp === 'refused') {
      json(res, 422, {
        code: 422,
        error_code: 'signup_disabled',
        msg: 'Signups not allowed for this instance',
      });
      return true;
    }
    json(res, 200, { user: { id: 'stub-signup-user', email: 'stub-signup@m-proper.example' } });
    return true;
  }

  return false;
}

function handleVercel(world, res, url) {
  // The deployment wait polls deployments by project and sha; a single
  // deployment lookup is answered too.
  const single = /^\/v\d+\/deployments\/([^/]+)$/.exec(url.pathname);
  const described = (deployment) => ({
    uid: deployment.id,
    id: deployment.id,
    name: world.plan.vercelProject || 'm-proper',
    url: `${world.stubUrl.replace(/^https?:\/\//, '')}`,
    readyState: deployment.state || 'READY',
    target: 'production',
    createdAt: Date.now(),
    meta: { githubCommitSha: deployment.sha },
  });

  if (single) {
    const deployment = (world.plan.deployments || []).find(
      (entry) => entry.id === single[1]
    );
    if (!deployment) {
      json(res, 404, { error: { code: 'not_found' } });
      return true;
    }
    json(res, 200, described(deployment));
    return true;
  }

  if (/^\/v\d+\/deployments\/?$/.test(url.pathname)) {
    json(res, 200, {
      deployments: (world.plan.deployments || []).map(described),
      pagination: { count: (world.plan.deployments || []).length, next: null },
    });
    return true;
  }

  return false;
}

function createStubReleaseServer({ plan }) {
  const world = createWorld(plan);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://stub.invalid');
    world.requests.push({
      method: req.method,
      path: url.pathname,
      query: url.search,
      hasSession: hasSessionCookie(req.headers.cookie || ''),
    });

    try {
      if (url.pathname === '/api/health') return void handleHealth(world, res);
      if (url.pathname === '/api/properties' || url.pathname.startsWith('/api/properties/')) {
        return void (await handleProperties(world, req, res, url));
      }
      if (url.pathname.startsWith('/auth/v1/')) {
        if (await handleAuth(world, req, res, url)) return;
      }
      if (handleVercel(world, res, url)) return;
      json(res, 404, { success: false, message: `stub has no route ${url.pathname}` });
    } catch (error) {
      json(res, 500, { success: false, message: `stub error: ${error.message}` });
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      world.stubUrl = `http://127.0.0.1:${port}`;
      resolve({
        url: world.stubUrl,
        world,
        snapshot() {
          return {
            rows: [...world.rows.values()].map((row) => ({ ...row })),
            requests: world.requests.slice(),
            posts: world.posts.map((row) => ({ ...row })),
            deletes: world.deletes.map((entry) => ({ ...entry })),
            listAnswers: world.listAnswers.slice(),
          };
        },
        close() {
          return new Promise((done) => server.close(() => done()));
        },
      });
    });
  });
}

module.exports = { createStubReleaseServer, hasSessionCookie };
