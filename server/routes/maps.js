const express = require('express');
const pool = require('../db/config');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

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