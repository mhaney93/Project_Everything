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

// Helper: get non-personal nodes from the most recently updated admin map
async function getLatestGlobalNodes() {
  const result = await pool.query(
    `SELECT m.nodes FROM maps m
     JOIN users u ON m.user_id = u.id
     WHERE u.email = ANY($1)
     ORDER BY m.updated_at DESC
     LIMIT 1`,
    [ADMIN_EMAILS]
  );
  if (result.rows.length === 0) return [];

  let nodes = result.rows[0].nodes;
  if (typeof nodes === 'string') {
    try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
  }
  return (nodes || []).filter(n => n.isPersonal !== true && n.label !== 'Personal');
}

// Get global (non-personal) nodes — no auth required
// Returns the most recently saved admin map (minus Personal branch and notes).
router.get('/global', async (req, res) => {
  try {
    const globalNodes = await getLatestGlobalNodes();
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
    const result = await pool.query(
      'SELECT id, nodes, updated_at FROM maps WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Map not found' });
    }

    const map = result.rows[0];
    let nodes = map.nodes;
    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
    }
    nodes = nodes || [];

    const admin = await isUserAdmin(req.userId);
    if (admin) {
      // Get the latest global nodes (may be from a different admin account)
      const latestGlobal = await getLatestGlobalNodes();

      // Check if another admin's map is newer than this admin's map
      const latestResult = await pool.query(
        `SELECT m.updated_at FROM maps m
         JOIN users u ON m.user_id = u.id
         WHERE u.email = ANY($1)
         ORDER BY m.updated_at DESC
         LIMIT 1`,
        [ADMIN_EMAILS]
      );
      const latestUpdatedAt = latestResult.rows[0]?.updated_at;

      if (latestUpdatedAt && latestUpdatedAt > map.updated_at) {
        // Another admin saved more recently — use their global nodes as the base,
        // then add this admin's personal nodes on top.
        const personalNodes = nodes.filter(n => n.isPersonal === true || n.label === 'Personal');
        const merged = [...latestGlobal, ...personalNodes];
        return res.json({ id: map.id, nodes: merged, updatedAt: map.updated_at });
      }
    }

    res.json({ id: map.id, nodes, updatedAt: map.updated_at });
  } catch (err) {
    console.error('GET /api/maps error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save/update user's map
router.post('/', verifyToken, async (req, res) => {
  try {
    const { nodes } = req.body;

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

    const result = await pool.query(
      `UPDATE maps
       SET nodes = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING id, nodes, updated_at`,
      [JSON.stringify(nodes), req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Map not found' });
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
    res.json({ id: map.id, nodes: responseNodes, updatedAt: map.updated_at });
  } catch (err) {
    console.error('POST /api/maps error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
