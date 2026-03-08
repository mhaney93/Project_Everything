const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/config');
const { verifyToken } = require('../middleware/auth');
const { 
  TOTAL_STORAGE_LIMIT_PER_USER, 
  getTotalStorageUsage, 
  isUserAdmin 
} = require('../utils/storage');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
      'video/x-flv', 'video/x-matroska', 'video/webm', 'video/3gpp', 'video/ogg'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Deprecated: use getTotalStorageUsage from utils/storage.js instead

// Upload file
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { nodeId } = req.body;
    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId is required' });
    }

    // Check storage limit for non-admin users
    const isAdmin = await isUserAdmin(req.userId);
    if (!isAdmin) {
      const storageUsage = await getTotalStorageUsage(req.userId);
      const newTotalSize = storageUsage.total + req.file.size;

      if (newTotalSize > TOTAL_STORAGE_LIMIT_PER_USER) {
        // Clean up uploaded file
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.error('Failed to delete file:', unlinkErr);
        });
        const limitGB = (TOTAL_STORAGE_LIMIT_PER_USER / (1024 * 1024 * 1024)).toFixed(1);
        const usedGB = (storageUsage.total / (1024 * 1024 * 1024)).toFixed(2);
        const fileUsedGB = (storageUsage.fileStorage / (1024 * 1024 * 1024)).toFixed(2);
        const mapUsedGB = (storageUsage.mapStorage / (1024 * 1024 * 1024)).toFixed(2);
        return res.status(413).json({ 
          error: `Storage limit exceeded. You have ${limitGB}GB total. Currently using ${usedGB}GB (${fileUsedGB}GB files + ${mapUsedGB}GB notes/nodes).` 
        });
      }
    }

    // Save file metadata to database
    const result = await pool.query(
      `INSERT INTO files (user_id, node_id, filename, original_filename, file_type, file_size, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, filename, original_filename, file_type, file_size, created_at`,
      [req.userId, nodeId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.file.path]
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
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Failed to delete file:', unlinkErr);
      });
    }
    console.error('File upload error:', err);
    
    // Handle disk full error specifically
    if (err.code === 'ENOSPC' || err.message.includes('no space left on device')) {
      return res.status(507).json({ error: 'Server storage is full. Please contact support.' });
    }
    
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

// Download file
router.get('/download/:fileId', verifyToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const result = await pool.query(
      `SELECT filename, original_filename, file_path FROM files 
       WHERE id = $1 AND user_id = $2`,
      [fileId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];
    res.download(file.file_path, file.original_filename);
  } catch (err) {
    console.error('Download file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete file
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

    // Delete from database
    await pool.query('DELETE FROM files WHERE id = $1', [fileId]);

    // Delete from filesystem
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file from disk:', err);
    });

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
