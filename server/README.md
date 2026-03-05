# Everything Backend Server

Node.js + Express + PostgreSQL backend for storing and managing user knowledge maps.

## Setup

1. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Create database**
   ```bash
   # Install PostgreSQL if you haven't already
   # Create a new database
   createdb everything_db
   
   # Load schema
   psql everything_db < db/schema.sql
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and JWT secret
   ```

4. **Start server**
   ```bash
   npm run dev    # Development (with nodemon)
   npm start      # Production
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login

### Maps
- `GET /api/maps` - Get user's map (requires auth token)
- `POST /api/maps` - Save/update user's map (requires auth token)

## Database Schema

- **users** - User accounts with email and hashed passwords
- **maps** - One map per user, stores node data as JSONB

## Environment Variables

See `.env.example` for required variables.
