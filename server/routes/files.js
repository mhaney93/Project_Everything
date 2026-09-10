const express = require('express');
const { handleUpload } = require('@vercel/blob/client');
const { del } = require('@vercel/blob');
const jwt = require('jsonwebtoken');
const pool = require('../db/config');
const { verifyToken } = require('../middleware/auth');
const {
  TOTAL_STORAGE_LIMIT_PER_USER,
  getTotalStorageUsage,
  isUserAdmin
} = require('../utils/storage');

const router = express.Router();

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
  'video/x-flv', 'video/x-matroska', 'video/webm', 'video/3gpp', 'video/ogg'
];

// Hard per-file ceiling for a single Blob upload.
const MAX_SINGLE_FILE_BYTES = 500 * 1024 * 1024; // 500MB

function userIdFromCookie(req) {
  const token = req.cookies && req.cookies.token;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).userId;
  } catch {
    return null;
  }
}

// --- Client-upload token endpoint -------------------------------------------
// The browser uploads the file bytes straight to Vercel Blob. This route only
// (a) authorizes the upload and mints a scoped token, and (b) is pinged by
// Blob when the upload finishes. Metadata is persisted via POST /complete.
router.post('/upload', async (req, res) => {
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const userId = userIdFromCookie(req);
        if (!userId) throw new Error('Not authenticated');

        let payload = {};
        try { payload = clientPayload ? JSON.parse(clientPayload) : {}; } catch { /* ignore */ }
        const { nodeId, size } = payload;
        if (!nodeId) throw new Error('nodeId is required');

        // Approximate storage check up front (exact re-check happens in /complete).
        const isAdmin = await isUserAdmin(userId);
        if (!isAdmin && typeof size === 'number') {
          const usage = await getTotalStorageUsage(userId);
          if (usage.total + size > TOTAL_STORAGE_LIMIT_PER_USER) {
            throw new Error('Storage limit exceeded');
          }
        }

        return {
          allowedContentTypes: ALLOWED_MIMES,
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_SINGLE_FILE_BYTES,
          tokenPayload: JSON.stringify({ userId, nodeId }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Metadata is written by POST /complete (which returns the row to the
        // client). Nothing required here; log for observability.
        console.log('Blob upload completed:', blob.pathname);
      },
    });
    return res.json(jsonResponse);
  } catch (err) {
    console.error('File upload token error:', err);
    return res.status(400).json({ error: err.message });
  }
});

// --- Persist metadata after the browser finished uploading to Blob ----------
router.post('/complete', verifyToken, async (req, res) => {
  const { nodeId, url, pathname, size, contentType, originalName } = req.body || {};
  if (!nodeId || !url || !pathname) {
    return res.status(400).json({ error: 'nodeId, url and pathname are required' });
  }

  try {
    const fileSize = Number(size) || 0;

    const isAdmin = await isUserAdmin(req.userId);
    if (!isAdmin) {
      const usage = await getTotalStorageUsage(req.userId);
      if (usage.total + fileSize > TOTAL_STORAGE_LIMIT_PER_USER) {
        // Roll back the orphaned blob.
        try { await del(url); } catch (e) { console.error('Failed to delete orphan blob:', e); }
        const limitGB = (TOTAL_STORAGE_LIMIT_PER_USER / (1024 ** 3)).toFixed(1);
        const usedGB = (usage.total / (1024 ** 3)).toFixed(2);
        return res.status(413).json({
          error: `Storage limit exceeded. You have ${limitGB}GB total and are using ${usedGB}GB.`
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO files (user_id, node_id, filename, original_filename, file_type, file_size, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, filename, original_filename, file_type, file_size, created_at`,
      [req.userId, nodeId, pathname, originalName || pathname, contentType || 'application/octet-stream', fileSize, url]
    );

    const file = result.rows[0];
    res.json({
      id: file.id,
      filename: file.filename,
      originalFilename: file.original_filename,
      fileType: file.file_type,
      fileSize: file.file_size,
      createdAt: file.created_at,
      downloadUrl: `/api/files/download/${file.id}`
    });
  } catch (err) {
    console.error('File complete error:', err);
    try { await del(url); } catch (e) { console.error('Failed to delete orphan blob:', e); }
    res.status(500).json({ error: err.message });
  }
});

// Get files for a node
router.get('/node/:nodeId', verifyToken, async (req, res) => {
  try {
    const { nodeId } = req.params;

    const result = await pool.query(
      `SELECT id, filename, original_filename, file_type, file_size, created_at
       FROM files
       WHERE user_id = $1 AND node_id = $2
       ORDER BY created_at DESC`,
      [req.userId, nodeId]
    );

    res.json(result.rows.map(file => ({
      id: file.id,
      filename: file.filename,
      originalFilename: file.original_filename,
      fileType: file.file_type,
      fileSize: file.file_size,
      createdAt: file.created_at,
      downloadUrl: `/api/files/download/${file.id}`
    })));
  } catch (err) {
    console.error('Get files error:', err);
    res.status(500).json({ error: err.message });
  }
});

// View file inline (left-click open in tab) — auth-check then redirect to Blob.
router.get('/view/:fileId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT file_path FROM files WHERE id = $1 AND user_id = $2`,
      [req.params.fileId, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' });
    res.redirect(result.rows[0].file_path);
  } catch (err) {
    console.error('View file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download file — auth-check then redirect to Blob with forced attachment.
router.get('/download/:fileId', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT file_path FROM files WHERE id = $1 AND user_id = $2`,
      [req.params.fileId, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' });
    const url = result.rows[0].file_path;
    const sep = url.includes('?') ? '&' : '?';
    res.redirect(`${url}${sep}download=1`);
  } catch (err) {
    console.error('Download file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Rename file (update original_filename only)
router.patch('/:fileId/rename', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { newName } = req.body;
    if (!newName || !newName.trim()) {
      return res.status(400).json({ error: 'newName is required' });
    }

    const result = await pool.query(
      `UPDATE files SET original_filename = $1 WHERE id = $2 AND user_id = $3 RETURNING id, original_filename`,
      [newName.trim(), fileId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ id: result.rows[0].id, originalFilename: result.rows[0].original_filename });
  } catch (err) {
    console.error('Rename file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete file — remove DB row and the Blob object.
router.delete('/:fileId', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    const result = await pool.query(
      `SELECT file_path FROM files WHERE id = $1 AND user_id = $2`,
      [fileId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = result.rows[0].file_path;

    await pool.query('DELETE FROM files WHERE id = $1', [fileId]);

    try {
      await del(filePath);
    } catch (e) {
      console.error('Failed to delete blob object:', e);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user's storage usage
router.get('/storage/usage', verifyToken, async (req, res) => {
  try {
    const storageUsage = await getTotalStorageUsage(req.userId);
    const totalBytes = storageUsage.total;
    const limitGB = TOTAL_STORAGE_LIMIT_PER_USER / (1024 * 1024 * 1024);
    const usedGB = totalBytes / (1024 * 1024 * 1024);
    const remainingGB = (TOTAL_STORAGE_LIMIT_PER_USER - totalBytes) / (1024 * 1024 * 1024);

    res.json({
      used: totalBytes,
      usedGB: usedGB.toFixed(2),
      fileStorage: storageUsage.fileStorage,
      fileStorageGB: (storageUsage.fileStorage / (1024 * 1024 * 1024)).toFixed(2),
      mapStorage: storageUsage.mapStorage,
      mapStorageGB: (storageUsage.mapStorage / (1024 * 1024 * 1024)).toFixed(2),
      limit: TOTAL_STORAGE_LIMIT_PER_USER,
      limitGB: limitGB.toFixed(2),
      remaining: Math.max(0, TOTAL_STORAGE_LIMIT_PER_USER - totalBytes),
      remainingGB: Math.max(0, remainingGB).toFixed(2),
      percentUsed: ((totalBytes / TOTAL_STORAGE_LIMIT_PER_USER) * 100).toFixed(1)
    });
  } catch (err) {
    console.error('Get storage usage error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
