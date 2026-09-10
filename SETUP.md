# Everything - Knowledge Mapping App

Full-stack application for creating and managing interconnected knowledge maps.

## Project Structure

```
project_everything/
├── src/               # React frontend
│   ├── App.jsx
│   ├── App.css
│   └── api.js         # API utilities
├── server/            # Express backend
│   ├── index.js       # Server entry point
│   ├── package.json
│   ├── .env.example
│   ├── db/
│   │   ├── config.js  # Database connection
│   │   └── schema.sql # Database schema
│   ├── routes/
│   │   ├── auth.js    # Authentication endpoints
│   │   └── maps.js    # Map save/load endpoints
│   └── middleware/
│       └── auth.js    # JWT verification
└── public/            # Static assets
```

## Quick Start

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm start
```

### Backend Setup

```bash
# Navigate to server folder
cd server

# Install dependencies
npm install

# Create PostgreSQL database
createdb everything_db

# Load database schema
psql everything_db < db/schema.sql

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Start backend server
npm run dev    # Development
npm start      # Production
```

### Configure Frontend API

The frontend API base URL (`src/api.js`) resolves to:
- `VITE_API_URL` if set, else
- `/api` in a production build (same-origin serverless function), else
- `http://localhost:5000/api` in dev

## Features

### Frontend
- Interactive node tree visualization
- Click to select/center nodes
- Drag to pan
- Expand nodes to view relationships
- Settings for animations and panning preferences
- User auth (sign in/sign up)
- Profile management

### Backend
- User registration and login with JWT tokens
- Save/load knowledge maps per user
- PostgreSQL database persistence
- CORS support for cross-origin requests

## Database Schema

**users**
- id (Primary Key)
- email (Unique)
- password_hash
- created_at, updated_at

**maps**
- id (Primary Key)
- user_id (Foreign Key to users)
- nodes (JSONB array)
- created_at, updated_at

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
  - Body: `{ email, password }`
  - Returns: `{ user, token }`

- `POST /api/auth/login` - Login
  - Body: `{ email, password }`
  - Returns: `{ user, token }`

### Maps (require Bearer token)
- `GET /api/maps` - Get user's map
  - Returns: `{ id, nodes, updatedAt }`

- `POST /api/maps` - Save user's map
  - Body: `{ nodes }`
  - Returns: `{ id, nodes, updatedAt }`

## Environment Variables

### Local development (`server/.env`)
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=everything_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
PORT=5000
NODE_ENV=development
```

Frontend dev needs no `.env` (it defaults to `http://localhost:5000/api`). Set
`VITE_API_URL` only to point at a non-default API.

### Production

Runs on Vercel; env vars are managed there, not in a file. `server/db/config.js`
prefers a single `DATABASE_URL` (with SSL) over the discrete `DB_*` vars above.
See [DEPLOYMENT.md](DEPLOYMENT.md#environment-variables) for the full list.

## Development Notes

- Frontend runs on port 3000 by default
- Backend runs on port 5000 by default
- JWT tokens expire after 7 days
- Passwords are hashed with bcrypt before storage
- Maps are stored as JSONB for flexible schema

## Data Migrations

Node label migrations are handled in `src/App.jsx` through a versioned map:

- `LABEL_MIGRATIONS_BY_VERSION`
- `applyLabelMigrations(...)`

When a user map loads from the backend, migrations are applied before rendering. If any labels change, the app automatically saves the migrated nodes back to the backend so the fix is permanent.

### Add a new label rename

1. Open `src/App.jsx`.
2. Add a new numeric version entry in `LABEL_MIGRATIONS_BY_VERSION`.
3. Put `oldLabel: 'New Label'` pairs in that version map.
4. Keep existing versions unchanged.

Example:

```js
const LABEL_MIGRATIONS_BY_VERSION = {
  1: {
    Art: 'Arts',
  },
  2: {
    'Natural Science': 'Sciences',
  },
}
```

## Deployment

Production runs on Vercel (frontend + serverless API), Neon (Postgres), and Vercel
Blob (file storage). Push to `main` and Vercel deploys automatically.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full workflow, env vars, rollback, and
database access.

> The repo still contains `Dockerfile`, `server/Dockerfile`, `docker-compose.prod.yml`,
> and `deploy/nginx/` from the old self-hosted AWS EC2 setup (retired Sept 2026). They
> are no longer used and kept only for reference.
