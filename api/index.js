// Vercel serverless entry point. All /api/* and /health requests are rewritten
// here by vercel.json; the Express app does its own routing on req.url.
const app = require('../server/app');

module.exports = (req, res) => app(req, res);
