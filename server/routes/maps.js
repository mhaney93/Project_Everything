const express = require('express');
const pool = require('../db/config');
const { verifyToken } = require('../middleware/auth');
const {
  TOTAL_STORAGE_LIMIT_PER_USER,
  ADMIN_EMAIL,
  getFileStorageUsage,
  isUserAdmin
} = require('../utils/storage');

const router = express.Router();

// Get global (non-personal) custom nodes — no auth required
router.get('/global', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT m.nodes FROM maps m JOIN users u ON m.user_id = u.id WHERE u.email = $1',
      [ADMIN_EMAIL]
    );

    if (result.rows.length === 0) {
      return res.json({ nodes: [] });
    }

    let nodes = result.rows[0].nodes;
    if (typeof nodes === 'string') {
      try { nodes = JSON.parse(nodes); } catch (e) { nodes = []; }
    }

    const globalNodes = (nodes || [])
      .filter((n) => n.isPersonal !== true && n.label !== 'Personal')
      .map(({ notes, ...rest }) => rest);

    res.json({ nodes: globalNodes });
  } catch (err) {
    console.error('GET /api/maps/global error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user's map
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
      try {
        nodes = JSON.parse(nodes);
      } catch (e) {
        // If parsing fails, return as is
        console.error('Failed to parse nodes JSON:', nodes);
      }
    }
    res.json({
      id: map.id,
      nodes,
      updatedAt: map.updated_at,
    });
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
        // If parsing fails, return as is
        console.error('Failed to parse nodes JSON:', responseNodes);
      }
    }
    res.json({
      id: map.id,
      nodes: responseNodes,
      updatedAt: map.updated_at,
    });
  } catch (err) {
    console.error('POST /api/maps error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;