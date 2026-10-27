const express = require('express');
const pool = require('../db/config');
const { verifyToken } = require('../middleware/auth');
const {
  TOTAL_STORAGE_LIMIT_PER_USER,
  ADMIN_EMAILS,
  getFileStorageUsage,
  isUserAdmin
} = require('../utils/storage');

const router = express.Router();

// Helper: get non-personal nodes from the most recently updated admin map, with
// the version (updated_at text) of the row they were read from
async function getLatestGlobalNodes(db = pool) {
  const result = await db.query(
    `SELECT m.nodes, m.updated_at::text AS version FROM maps m
     JOIN users u ON m.user_id = u.id
     WHERE u.email = ANY($1)
     ORDER BY m.updated_at DESC
     LIMIT 1`,
    [ADMIN_EMAILS]
  );
  if (result.rows.length === 0) return { nodes: [], version: null };

  let nodes = result.rows[0].nodes;
  if (typeof nodes === 'string') {
    try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
  }
  return {
    nodes: (nodes || []).filter(n => n.isPersonal !== true && n.label !== 'Personal'),
    version: result.rows[0].version,
  };
}

// Get global (non-personal) nodes — no auth required
// Returns the most recently saved admin map (minus Personal branch and notes).
router.get('/global', async (req, res) => {
  try {
    const { nodes: globalNodes } = await getLatestGlobalNodes();
    res.json({ nodes: globalNodes.map(({ notes, ...rest }) => rest) });
  } catch (err) {
    console.error('GET /api/maps/global error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user's map.
// For admin users: return the latest global nodes (from whichever admin saved most
// recently) merged with this admin's own personal nodes, so both admin accounts
// always start from the same up-to-date global state.
router.get('/', verifyToken, async (req, res) => {
  try {
    const admin = await isUserAdmin(req.userId);

    const client = await pool.connect();
    let result;
    let latest;
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      result = await client.query(
        'SELECT id, nodes, updated_at, updated_at::text AS version FROM maps WHERE user_id = $1',
        [req.userId]
      );
      // Get the latest global nodes (may be from a different admin account)
      if (admin) latest = await getLatestGlobalNodes(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Map not found' });
    }

    const map = result.rows[0];
    let nodes = map.nodes;
    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
    }
    nodes = nodes || [];

    if (latest?.version && latest.version !== map.version) {
      // Another admin saved more recently — use their global nodes as the base,
      // then add this admin's personal nodes on top.
      const personalNodes = nodes.filter(n => n.isPersonal === true || n.label === 'Personal');
      const merged = [...latest.nodes, ...personalNodes];
      return res.json({ id: map.id, nodes: merged, updatedAt: map.updated_at, version: latest.version });
    }

    res.json({ id: map.id, nodes, updatedAt: map.updated_at, version: map.version });
  } catch (err) {
    console.error('GET /api/maps error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save/update user's map.
// `version` is the updated_at text the client last read or saved. The update only
// applies while the map still has that version, so a tab holding an older copy of
// the map gets a 409 instead of overwriting newer changes. For admins the version
// is the newest updated_at across the admin rows, since that row is the global
// base GET serves, so a save from before another admin's save is refused too. It
// is compared as text because node-pg shifts tz-less timestamps into local time
// when parsing them.
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nodes, version } = req.body;

    if (!Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Nodes must be an array' });
    }

    // Check storage limit for non-admin users
    const isAdmin = await isUserAdmin(req.userId);
    if (!isAdmin) {
      const nodesJson = JSON.stringify(nodes);
      const newMapSize = Buffer.byteLength(nodesJson, 'utf8');
      const fileStorage = await getFileStorageUsage(req.userId);
      const newTotalSize = fileStorage + newMapSize;

      if (newTotalSize > TOTAL_STORAGE_LIMIT_PER_USER) {
        const limitGB = (TOTAL_STORAGE_LIMIT_PER_USER / (1024 * 1024 * 1024)).toFixed(1);
        const totalUsedGB = (newTotalSize / (1024 * 1024 * 1024)).toFixed(2);
        const fileUsedGB = (fileStorage / (1024 * 1024 * 1024)).toFixed(2);
        const mapUsedGB = (newMapSize / (1024 * 1024 * 1024)).toFixed(2);
        return res.status(413).json({
          error: `Storage limit exceeded. You have ${limitGB}GB total. This would use ${totalUsedGB}GB (${fileUsedGB}GB files + ${mapUsedGB}GB notes/nodes).`
        });
      }
    }

    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT user_id, updated_at::text AS version FROM maps
         WHERE user_id = $1 OR user_id IN (SELECT id FROM users WHERE email = ANY($2))
         ORDER BY user_id
         FOR UPDATE`,
        [req.userId, isAdmin ? ADMIN_EMAILS : []]
      );
      if (!locked.rows.some((row) => row.user_id === req.userId)) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Map not found' });
      }
      const newest = locked.rows.reduce((a, b) => (b.version > a.version ? b : a));
      if (newest.version !== version) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Map changed since it was loaded' });
      }
      result = await client.query(
        `UPDATE maps
         SET nodes = $1, updated_at = clock_timestamp()
         WHERE user_id = $2
         RETURNING id, nodes, updated_at, updated_at::text AS version`,
        [JSON.stringify(nodes), req.userId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    const map = result.rows[0];
    let responseNodes = map.nodes;
    if (typeof responseNodes === 'string') {
      try {
        responseNodes = JSON.parse(responseNodes);
      } catch (e) {
        console.error('Failed to parse nodes JSON:', responseNodes);
      }
    }
    res.json({ id: map.id, nodes: responseNodes, updatedAt: map.updated_at, version: map.version });
  } catch (err) {
    console.error('POST /api/maps error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
