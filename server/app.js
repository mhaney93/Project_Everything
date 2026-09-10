const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const mapRoutes = require('./routes/maps');
const fileRoutes = require('./routes/files');

const app = express();

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://matthew-haney.com',
  'https://www.matthew-haney.com',
].filter(Boolean);

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, cb) => {
        // Same-origin requests (no Origin header) and any allow-listed origin.
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      }
    : /^http:\/\/localhost:\d+$/,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/files', fileRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
