# Deployment Guide - HTTP-Only Cookie Auth

## Completed: Frontend & Backend Cookie Migration

**Date:** March 5, 2026  
**Commit:** `23cb1f2` - Migrate auth to HTTP-only cookies

### What Changed

#### Backend (`server/`)
- ✅ Added `cookie-parser` dependency
- ✅ Updated CORS to allow `credentials: true` and list origins
- ✅ Modified auth routes to set HTTP-only cookies (not return tokens)
- ✅ Added `/logout` endpoint to clear cookies
- ✅ Updated `verifyToken` middleware to read from `req.cookies.token`

#### Frontend (`src/`)
- ✅ Removed `getAuthToken()` and `setAuthToken()` functions from `api.js`
- ✅ Added `credentials: 'include'` to all fetch calls
- ✅ Removed all `Authorization: Bearer` headers
- ✅ Updated login/register handlers to use cookies
- ✅ Updated logout to call `/api/auth/logout` endpoint

### Testing (Local - localhost:5174)

**Backend validation (✅ verified):**
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c /tmp/cookies.txt

# Response includes: Set-Cookie header with HttpOnly, Secure, SameSite=Strict
# Response body: {"user":{"id":2,"email":"test@example.com"}} (NO token)
```

**Cookie verification (✅ verified):**
```bash
# Use the cookie from registration
curl -X GET http://localhost:5000/api/maps -b /tmp/cookies.txt

# Response: 200 OK with map data (cookie auto-sent)
```

### Production Deployment

**SSH into EC2 (13.57.40.79):**
```bash
ssh -i ~/.ssh/matthew_haney_key.pem ubuntu@13.57.40.79
```

**Pull latest code and rebuild:**
```bash
cd ~/project_everything
git pull
POSTGRES_PASSWORD=<your-database-password> docker compose -f docker-compose.prod.yml up -d --build
```

**Verify deployment:**
```bash
# Check containers running
docker ps | grep project_everything

# Check logs
docker compose -f docker-compose.prod.yml logs -f api
```

### Testing Production (https://matthew-haney.com)

1. **Sign up a test account**
   - Open https://matthew-haney.com
   - Click "Sign Up"
   - Enter email and password
   - Verify no token in DevTools > Application > Local Storage (should be empty)

2. **Check cookie was set**
   - DevTools > Application > Cookies > matthew-haney.com
   - Find `token` cookie
   - Verify it has:
     - ✅ `HttpOnly` flag (JavaScript cannot access)
     - ✅ `Secure` flag (HTTPS only, not sent over HTTP)
     - ✅ `SameSite=Strict` (CSRF protection)

3. **Test session persistence**
   - Refresh the page (F5)
   - Verify you're still logged in (cookie auto-sent)
   - Verify maps load from backend

4. **Test logout**
   - Click logout
   - Verify cookie is deleted
   - Refresh page → should show login screen

5. **Test login**
   - Sign back in with the test account
   - Verify maps load
   - Verify cookie is set again

### Security Benefits

- ✅ **No localStorage tokens** - Token invisible to browser F12 console
- ✅ **HttpOnly cookies** - Immune to XSS attacks (JavaScript cannot read)
- ✅ **Secure flag** - Only sent over HTTPS, never over HTTP
- ✅ **SameSite=Strict** - CSRF attack protection (cookie only sent in same-site requests)
- ✅ **Automatic transmission** - Browser handles cookie inclusion, no manual headers needed

### Rollback (if needed)

If you need to rollback to token-based auth:
```bash
cd ~/project_everything
git revert 23cb1f2
git push
# Then redeploy on EC2
```

### File Changes Summary

```
 src/api.js                          | 58 lines changed
 src/App.jsx                         | 35 lines changed
 server/index.js                     |  7 lines changed
 server/routes/auth.js               | 12 lines changed
 server/middleware/auth.js           |  3 lines changed
 server/package.json                 |  1 line added (cookie-parser)
 7 files changed, 89 insertions(+), 42 deletions(-)
```

### Next Steps (Optional)

1. Add security headers (CSP, HSTS, X-Frame-Options)
2. Implement refresh token rotation
3. Add token revocation system (logout all devices)
4. Set up rate limiting on auth endpoints
