const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/config');
const { verifyToken } = require('../middleware/auth');

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

module.exports = router;
