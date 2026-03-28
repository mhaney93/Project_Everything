const pool = require('../db/config');

// Total storage limit per user (files + map data): 10GB
const TOTAL_STORAGE_LIMIT_PER_USER = 10 * 1024 * 1024 * 1024; // 10GB
const ADMIN_EMAIL = 'matthew.haney1993@gmail.com';
const ADMIN_EMAILS = ['matthew.haney1993@gmail.com', 'preveil.llc@gmail.com'];

// Get user's file storage usage
const getFileStorageUsage = async (userId) => {
  const result = await pool.query(
    'SELECT COALESCE(SUM(file_size), 0) as total_size FROM files WHERE user_id = $1',
    [userId]
  );
  return parseInt(result.rows[0].total_size, 10);
};

// Get user's map data storage usage
const getMapStorageUsage = async (userId) => {
  const result = await pool.query(
    'SELECT nodes FROM maps WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return 0;
  }
  
  const nodes = result.rows[0].nodes;
  const jsonString = typeof nodes === 'string' ? nodes : JSON.stringify(nodes);
  return Buffer.byteLength(jsonString, 'utf8');
};

// Get user's total storage usage (files + map data)
const getTotalStorageUsage = async (userId) => {
  const fileStorage = await getFileStorageUsage(userId);
  const mapStorage = await getMapStorageUsage(userId);
  return {
    fileStorage,
    mapStorage,
    total: fileStorage + mapStorage
  };
};

// Check if user is admin
const isUserAdmin = async (userId) => {
  const result = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
  return ADMIN_EMAILS.includes(result.rows[0]?.email);
};

module.exports = {
  TOTAL_STORAGE_LIMIT_PER_USER,
  ADMIN_EMAIL,
  ADMIN_EMAILS,
  getFileStorageUsage,
  getMapStorageUsage,
  getTotalStorageUsage,
  isUserAdmin
};
