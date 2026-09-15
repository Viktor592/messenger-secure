# Setup & Deployment Guide

Полная инструкция по локальной разработке и production deployment.

## 🏠 Local Development Setup

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Git
- Twilio account (optional, for SMS testing)

### 1. Clone Repository

```bash
git clone https://github.com/viktor592/messenger-secure.git
cd messenger-secure
```

### 2. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Edit .env with your Twilio credentials (optional)
# TWILIO_ACCOUNT_SID=...
# TWILIO_AUTH_TOKEN=...
# TWILIO_PHONE_NUMBER=...
```

### 3. Start Docker Services

```bash
# From project root
docker-compose -f docker-compose.dev.yml up -d

# Verify containers are running
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend
```

### 4. Setup Database

```bash
cd backend

# Run migrations
npx prisma migrate dev --name init

# Seed database (optional)
npm run db:seed

# Open Prisma Studio to view data
npx prisma studio
```

### 5. Start Backend

```bash
cd backend
npm run dev

# Should output: 🚀 Messenger Secure Server running at http://localhost:3001
```

### 6. Setup Mobile/Web Apps

```bash
# Mobile (React Native)
cd mobile
npm install
npm start

# Web App
cd web
npm install
npm start
```

### 7. Access Services

- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Prisma Studio**: http://localhost:5555 (when running `npx prisma studio`)
- **PgAdmin**: http://localhost:5050
  - Email: admin@example.com
  - Password: admin

---

## 🚀 Production Deployment (Hetzner VPS)

### Prerequisites

- Hetzner VPS (CAX11 or better)
- Ubuntu 24.04 LTS
- Domain name
- Twilio account (for SMS)

### 1. Initial VPS Setup

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add current user to docker group
usermod -aG docker $USER

# Install additional tools
apt install -y git curl nano

# Create app directory
mkdir -p /opt/messenger-secure
cd /opt/messenger-secure
```

### 2. Clone Repository

```bash
git clone https://github.com/viktor592/messenger-secure.git .
```

### 3. Setup Environment

```bash
# Create .env file for production
cat > .env.prod << 'EOF'
# Database
DB_PASSWORD=$(openssl rand -base64 32)

# JWT
JWT_SECRET=$(openssl rand -base64 32)

# Twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Domain
DOMAIN=messenger.your-domain.com
EOF

# Secure the file
chmod 600 .env.prod
```

### 4. Setup SSL with Let's Encrypt

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate
certbot certonly --standalone \
  -d messenger.your-domain.com \
  -d api.messenger.your-domain.com \
  --email your-email@example.com

# Verify certificate
ls /etc/letsencrypt/live/messenger.your-domain.com/
```

### 5. Configure Nginx

```bash
# Create nginx config directory
mkdir -p nginx/ssl

# Copy certificates
cp /etc/letsencrypt/live/messenger.your-domain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/messenger.your-domain.com/privkey.pem nginx/ssl/

# Create nginx.conf (see below)
```

### 6. Create Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    # Upstream backend
    upstream backend {
        server backend:3001;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name messenger.your-domain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer" always;

        # Rate limiting
        limit_req zone=general burst=20 nodelay;
        limit_req zone=auth burst=5 nodelay;

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
}
```

### 7. Start Services

```bash
# Load environment
source .env.prod

# Start docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Verify services
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

### 8. Setup Database

```bash
# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Or if deploying for first time
docker-compose -f docker-compose.prod.yml exec backend npx prisma db push
```

### 9. Verify Deployment

```bash
# Health check
curl https://messenger.your-domain.com/health

# Should return:
# {"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

### 10. Setup Automatic Updates

Create `update.sh`:

```bash
#!/bin/bash
set -e

cd /opt/messenger-secure

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build --no-cache backend
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

# Cleanup
docker system prune -f

echo "✅ Update complete"
```

Make executable and add to crontab:

```bash
chmod +x update.sh

# Add to crontab for daily updates at 2 AM
0 2 * * * cd /opt/messenger-secure && ./update.sh >> /var/log/messenger-update.log 2>&1
```

---

## 🔒 Security Hardening

### 1. Firewall Setup

```bash
# Enable UFW
ufw enable

# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Deny everything else
ufw default deny incoming
ufw default allow outgoing
```

### 2. Fail2Ban (Brute Force Protection)

```bash
apt install -y fail2ban

# Configure
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true
EOF

systemctl restart fail2ban
```

### 3. Automated Backups

Create `scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/messenger"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump \
  -U messenger messenger | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup Redis
docker-compose -f docker-compose.prod.yml exec -T redis redis-cli \
  --rdb $BACKUP_DIR/redis_$DATE.rdb

# Keep only last 30 days
find $BACKUP_DIR -mtime +30 -delete

echo "✅ Backup complete: $DATE"
```

Make executable and add to crontab:

```bash
chmod +x scripts/backup.sh

# Daily backup at 3 AM
0 3 * * * /opt/messenger-secure/scripts/backup.sh
```

### 4. Monitoring & Alerts

Install Prometheus + Grafana (optional but recommended):

```bash
# Add to docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml up -d prometheus grafana
```

---

## 🛠 Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Rebuild
docker-compose -f docker-compose.prod.yml build --no-cache backend
docker-compose -f docker-compose.prod.yml up -d
```

### Database connection error

```bash
# Check PostgreSQL
docker-compose -f docker-compose.prod.yml logs postgres

# Check connection string in .env
docker-compose -f docker-compose.prod.yml exec backend env | grep DATABASE_URL
```

### SSL certificate issues

```bash
# Renew certificate
certbot renew --dry-run

# Manually renew
certbot renew --force-renewal

# Copy new certificates to nginx
cp /etc/letsencrypt/live/messenger.your-domain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/messenger.your-domain.com/privkey.pem nginx/ssl/
```

---

## 📊 Monitoring Commands

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# Container stats
docker stats

# Database size
docker-compose -f docker-compose.prod.yml exec postgres du -sh /var/lib/postgresql/data

# Redis memory
docker-compose -f docker-compose.prod.yml exec redis redis-cli info memory

# Disk usage
df -h /

# Process check
ps aux | grep docker
```

---

## 🔄 Rolling Updates

```bash
# Pull latest code
git pull origin main

# Rebuild without cache
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop current version gracefully (10 sec timeout)
docker-compose -f docker-compose.prod.yml down --timeout 10

# Run migrations
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Verify
curl https://messenger.your-domain.com/health
```

---

For additional help, see [ARCHITECTURE.md](./ARCHITECTURE.md) and [API.md](./API.md).
