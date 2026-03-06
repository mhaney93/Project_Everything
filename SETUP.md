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

In the frontend, the API URL defaults to `http://localhost:5000/api`.

To change it, add to `.env`:
```
REACT_APP_API_URL=http://your-server:5000/api
```

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

### Frontend (`.env`)
```
REACT_APP_API_URL=http://localhost:5000/api
```

### Backend (`server/.env`)
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

## Deploy to AWS (Recommended: EC2 + RDS)

This repo now includes production Docker files and `docker-compose.prod.yml`.

### 1) Provision AWS resources

- Create an Ubuntu EC2 instance (t3.small or larger)
- Security Group inbound:
  - `22` from your IP
  - `80` from `0.0.0.0/0`
  - `443` from `0.0.0.0/0` (if using SSL)
- Create PostgreSQL on Amazon RDS (or use existing)
- Allow EC2 security group to access RDS port `5432`

### 2) Install Docker on EC2

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 3) Deploy app

```bash
git clone <your-repo-url>
cd project_everything
cp server/.env.example server/.env
```

Edit `server/.env` for production values:

```dotenv
DB_HOST=<rds-endpoint>
DB_PORT=5432
DB_NAME=everything_db
DB_USER=<db-user>
DB_PASSWORD=<db-password>
JWT_SECRET=<long-random-secret>
PORT=5000
NODE_ENV=production
```

Start stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

### 4) Initialize database schema

Run once against your RDS database:

```bash
psql "host=<rds-endpoint> port=5432 dbname=everything_db user=<db-user> password=<db-password>" -f server/db/schema.sql
```

### 5) Verify

- App: `http://<ec2-public-ip>`
- API health: `http://<ec2-public-ip>/health`

### 6) Optional SSL + domain

- Point your domain A record to EC2 public IP
- Install Caddy or Nginx+Certbot on host for automatic HTTPS termination
- Proxy HTTPS traffic to container port `80`
