const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

// Stub the database, auth and storage modules before loading the router.
let rows = [];
const queries = [];
const pool = {
  query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.startsWith('SELECT 1 FROM maps')) {
      return { rows: rows.filter((row) => row.user_id === params[0]) };
    }
    if (sql.trim().startsWith('UPDATE maps')) {
      const row = rows.find((r) => r.user_id === params[1] && r.version === params[2]);
      if (!row) return { rows: [] };
      row.nodes = params[0];
      row.version = `${row.version}+`;
      return { rows: [{ id: row.id, nodes: row.nodes, updated_at: new Date(), version: row.version }] };
    }
    throw new Error(`unexpected query: ${sql}`);
  },
};
const stub = (relative, exports) => {
  const file = require.resolve(path.join(__dirname, relative));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
stub('../db/config', pool);
stub('../middleware/auth', { verifyToken: (req, res, next) => { req.userId = 7; next(); } });
stub('../utils/storage', {
  TOTAL_STORAGE_LIMIT_PER_USER: Infinity,
  ADMIN_EMAILS: [],
  getFileStorageUsage: async () => 0,
  isUserAdmin: async () => true,
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

const save = (url, body) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('a save with the current version updates the map and returns the new version', async () => {
  rows = [{ id: 1, user_id: 7, nodes: '[]', version: '2026-10-27 02:38:38.609' }];
  await withServer(async (url) => {
    const res = await save(url, { nodes: [{ id: 1 }], version: '2026-10-27 02:38:38.609' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.version, '2026-10-27 02:38:38.609+');
    assert.deepEqual(data.nodes, [{ id: 1 }]);
  });
  assert.match(queries.at(-1).sql, /updated_at::text = \$3/);
});

test('a save with an old version is refused with 409 and leaves the map alone', async () => {
  rows = [{ id: 1, user_id: 7, nodes: '[{"id":"newer"}]', version: 'newer' }];
  await withServer(async (url) => {
    const res = await save(url, { nodes: [{ id: 'stale' }], version: 'older' });
    assert.equal(res.status, 409);
  });
  assert.equal(rows[0].nodes, '[{"id":"newer"}]');
});

test('a save without a version is refused with 409', async () => {
  rows = [{ id: 1, user_id: 7, nodes: '[]', version: 'v1' }];
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
