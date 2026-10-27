const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

// Stub the database, auth and storage modules before loading the router.
// Each row's `version` stands in for its updated_at text; versions compare in order.
const ADMIN_EMAILS = ['a@admin', 'b@admin'];
let rows = [];
let userId = 7;
const own = (id) => rows.filter((row) => row.user_id === id);
const newestAdmin = () => rows
  .filter((row) => ADMIN_EMAILS.includes(row.email))
  .sort((a, b) => (a.version < b.version ? 1 : -1))[0];
const query = async (sql, params) => {
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
  if (sql.startsWith('SELECT id, nodes')) {
    return { rows: own(params[0]).map((row) => ({ ...row, updated_at: row.version })) };
  }
  if (sql.startsWith('SELECT m.nodes')) {
    const row = newestAdmin();
    return { rows: row ? [{ nodes: row.nodes, version: row.version }] : [] };
  }
  if (sql.startsWith('SELECT user_id, updated_at::text')) {
    const [id, emails] = params;
    return {
      rows: rows
        .filter((row) => row.user_id === id || emails.includes(row.email))
        .map((row) => ({ user_id: row.user_id, version: row.version })),
    };
  }
  if (sql.trim().startsWith('UPDATE maps')) {
    const [nodes, id] = params;
    const row = own(id)[0];
    row.nodes = nodes;
    row.version = `${rows.map((r) => r.version).sort().at(-1)}+`;
    return { rows: [{ id: row.id, nodes: row.nodes, updated_at: row.version, version: row.version }] };
  }
  throw new Error(`unexpected query: ${sql}`);
};
const pool = {
  query,
  connect: async () => ({ query, release: () => {} }),
};
const stub = (relative, exports) => {
  const file = require.resolve(path.join(__dirname, relative));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
stub('../db/config', pool);
stub('../middleware/auth', { verifyToken: (req, res, next) => { req.userId = userId; next(); } });
stub('../utils/storage', {
  TOTAL_STORAGE_LIMIT_PER_USER: Infinity,
  ADMIN_EMAILS,
  getFileStorageUsage: async () => 0,
  isUserAdmin: async (id) => own(id).some((row) => ADMIN_EMAILS.includes(row.email)),
});
const router = require('./maps');

const withServer = async (fn) => {
  const app = express();
  app.use(express.json());
  app.use('/api/maps', router);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}/api/maps`);
  } finally {
    server.close();
  }
};

const load = async (url) => (await fetch(url)).json();

const save = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('a save with the current version updates the map and returns the new version', async () => {
  rows = [{ id: 1, user_id: 7, email: 'user@x', nodes: '[]', version: '2026-10-27 02:38:38.609' }];
  await withServer(async (url) => {
    const res = await save(url, { nodes: [{ id: 1 }], version: '2026-10-27 02:38:38.609' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.version, '2026-10-27 02:38:38.609+');
    assert.deepEqual(data.nodes, [{ id: 1 }]);
  });
});

test('a save with an old version is refused with 409 and leaves the map alone', async () => {
  rows = [{ id: 1, user_id: 7, email: 'user@x', nodes: '[{"id":"newer"}]', version: 'newer' }];
  await withServer(async (url) => {
    const res = await save(url, { nodes: [{ id: 'stale' }], version: 'older' });
    assert.equal(res.status, 409);
  });
  assert.equal(rows[0].nodes, '[{"id":"newer"}]');
});

test('a save without a version is refused with 409', async () => {
  rows = [{ id: 1, user_id: 7, email: 'user@x', nodes: '[]', version: 'v1' }];
  await withServer(async (url) => {
    const res = await save(url, { nodes: [] });
    assert.equal(res.status, 409);
  });
  assert.equal(rows[0].nodes, '[]');
});

test('a save for a user with no map is still a 404', async () => {
  rows = [];
  await withServer(async (url) => {
    const res = await save(url, { nodes: [], version: 'v1' });
    assert.equal(res.status, 404);
  });
});

test('an admin save made before another admin saved is refused with 409', async () => {
  rows = [
    { id: 1, user_id: 7, email: 'a@admin', nodes: '[{"id":"a"}]', version: 't1' },
    { id: 2, user_id: 8, email: 'b@admin', nodes: '[{"id":"a"}]', version: 't0' },
  ];
  await withServer(async (url) => {
    userId = 7;
    const tabA = await load(url);
    userId = 8;
    const tabB = await load(url);
    assert.equal(tabA.version, 't1');
    assert.equal(tabB.version, 't1');
    const bSave = await save(url, { nodes: [{ id: 'b edit' }], version: tabB.version });
    assert.equal(bSave.status, 200);

    userId = 7;
    const aSave = await save(url, { nodes: [{ id: 'a stale' }], version: tabA.version });
    assert.equal(aSave.status, 409);
    assert.deepEqual((await load(url)).nodes, [{ id: 'b edit' }]);
  });
  userId = 7;
});

test('an admin save after reloading the newest global map goes through', async () => {
  rows = [
    { id: 1, user_id: 7, email: 'a@admin', nodes: '[]', version: 't1' },
    { id: 2, user_id: 8, email: 'b@admin', nodes: '[{"id":"b"}]', version: 't2' },
  ];
  await withServer(async (url) => {
    userId = 7;
    const tabA = await load(url);
    assert.equal(tabA.version, 't2');
    assert.deepEqual(tabA.nodes, [{ id: 'b' }]);
    const res = await save(url, { nodes: [{ id: 'a edit' }], version: tabA.version });
    assert.equal(res.status, 200);
  });
});
