# Local Backend Setup - Development Guide

## Prerequisites

1. **Node.js 20+**
   ```bash
   node --version  # Should be v20.x.x or higher
   ```

2. **PostgreSQL 14+**
   ```bash
   # macOS with Homebrew
   brew install postgresql@16
   brew services start postgresql@16
   
   # Linux (Ubuntu/Debian)
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql
   
   # Or use Docker
   docker run -d \
     --name postgres \
     -e POSTGRES_PASSWORD=devpassword \
     -e POSTGRES_USER=messenger \
     -e POSTGRES_DB=messenger_dev \
     -p 5432:5432 \
     postgres:16
   ```

3. **Redis 6+**
   ```bash
   # macOS with Homebrew
   brew install redis
   brew services start redis
   
   # Linux (Ubuntu/Debian)
   sudo apt-get install redis-server
   sudo systemctl start redis-server
   
   # Or use Docker
   docker run -d \
     --name redis \
     -p 6379:6379 \
     redis:7-alpine
   ```

## Setup Steps

### 1. Install Dependencies

```bash
cd /home/claude/messenger-secure/backend
npm install
```

### 2. Create Database

```bash
# Create database
createdb -U messenger messenger_dev

# Or via psql
psql -U postgres
CREATE DATABASE messenger_dev;
CREATE USER messenger WITH PASSWORD 'devpassword';
ALTER ROLE messenger WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE messenger_dev TO messenger;
```

### 3. Run Schema Migration

```bash
# Option A: Using psql
psql -U messenger -d messenger_dev -f schema.sql

# Option B: Using TypeScript (if Prisma works)
npx prisma db push
```

### 4. Build TypeScript

```bash
npm run build
```

Check for any compilation errors. All should compile successfully.

### 5. Start Backend Server

```bash
npm run dev
# or for production
npm start
```

The server will start on `http://localhost:3001`

## Testing API

### 1. Health Check

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-09-23T..."
}
```

### 2. Register Phone Number

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79991234567"}'
```

Expected response:
```json
{
  "data": {
    "smsRequired": true,
    "sessionToken": "abc123...",
    "phoneHash": "sha256hash...",
    "expiresAt": "2024-09-23T...",
    "message": "SMS code sent to your phone"
  }
}
```

**Note**: In development mode with SMS disabled, the SMS code will be logged to console.

### 3. Verify Code

```bash
# Get the SMS code from logs (format: SMS Code for +7999...: 123456)

curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "abc123...",
    "code": "123456",
    "publicKey": "base64encodedpublickey"
  }'
```

Expected response:
```json
{
  "data": {
    "user": {
      "id": "uuid...",
      "phoneHash": "sha256...",
      "publicKey": "base64...",
      "displayName": null
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresAt": "2024-09-23T..."
  }
}
```

## Development Commands

```bash
# Build TypeScript
npm run build

# Start dev server (with auto-reload)
npm run dev

# Start production server
npm start

# Run TypeScript compiler check
npx tsc --noEmit

# Format code
npx prettier --write src/

# Lint code
npx eslint src/
```

## Database Management

### View Database

```bash
# Connect to database
psql -U messenger -d messenger_dev

# List tables
\dt

# View users
SELECT * FROM "User";

# View messages
SELECT * FROM "Message";

# View groups
SELECT * FROM "Group";
```

### Reset Database

```bash
# Drop database (WARNING: deletes all data)
dropdb -U messenger messenger_dev

# Recreate
createdb -U messenger messenger_dev

# Apply schema
psql -U messenger -d messenger_dev -f schema.sql
```

## Troubleshooting

### "connection refused" to PostgreSQL

```bash
# Check if PostgreSQL is running
ps aux | grep postgres

# Start PostgreSQL
brew services start postgresql@16
# or
sudo systemctl start postgresql
```

### "ECONNREFUSED" to Redis

```bash
# Check if Redis is running
ps aux | grep redis

# Start Redis
brew services start redis
# or
sudo systemctl start redis-server
```

### Port 3001 already in use

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

### "no database selected"

Make sure `.env` has correct DATABASE_URL:
```
DATABASE_URL="postgresql://messenger:devpassword@localhost:5432/messenger_dev"
```

### Prisma engine issues

If `npx prisma` fails with 403 errors, set:
```bash
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
```

Or use the SQL schema directly instead of Prisma.

## Next Steps

1. ✅ Backend TypeScript compiles
2. ✅ Database schema created
3. ⏭️ Run local tests (see E2E_TESTING.md)
4. ⏭️ Integrate mobile app with API
5. ⏭️ Test P2P messaging
6. ⏭️ Deploy to VPS

## Architecture

- **Port**: 3001
- **API Base**: `http://localhost:3001/api`
- **WebSocket**: `ws://localhost:3001`
- **Database**: PostgreSQL (local or Docker)
- **Cache**: Redis (for presence, sessions)

## Environment Variables

See `.env.example` or create `.env` with:

```env
DATABASE_URL=postgresql://messenger:devpassword@localhost:5432/messenger_dev
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev-secret-change-in-production
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000,http://localhost:8081
```

For SMS (optional):
```env
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
FEATURE_SMS_VERIFICATION_ENABLED=true
```
