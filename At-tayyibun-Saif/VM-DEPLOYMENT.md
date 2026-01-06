# VM Deployment Guide for attayyibun.com

Complete step-by-step guide to deploy At-Tayyibun on a fresh Ubuntu VM with Nginx.

---

## Prerequisites

- Fresh Ubuntu 22.04+ VM instance
- SSH access to the VM
- Domain `attayyibun.com` A records pointing to VM's IP address
- Git repository URL for the project

---

## Step 1: SSH into the VM

```bash
ssh your-username@YOUR_VM_IP_ADDRESS
```

---

## Step 2: Update the System

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Step 3: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y
```

**⚠️ IMPORTANT: Log out and log back in for group changes to take effect:**

```bash
exit
```

Then SSH back into the VM:

```bash
ssh your-username@YOUR_VM_IP_ADDRESS
```

Verify Docker is working:

```bash
docker --version
docker compose version
```

---

## Step 4: Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

Verify Nginx is running:

```bash
sudo systemctl status nginx
```

---

## Step 5: Install Certbot for SSL

```bash
sudo apt install certbot python3-certbot-nginx -y
```

---

## Step 6: Clone the Project

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/At-tayyibun-Saif.git
cd At-tayyibun-Saif
```

---

## Step 7: Create Environment File

Generate a secure JWT secret:

```bash
openssl rand -base64 32
```

**Copy the output - you'll need it below.**

Create the `.env` file:

```bash
nano .env
```

Paste the following (replace placeholder values with real ones):

```env
# Database
POSTGRES_USER=tayyibun
POSTGRES_PASSWORD=REPLACE_WITH_SECURE_PASSWORD
POSTGRES_DB=at_tayyibun
DATABASE_URL=postgresql://tayyibun:REPLACE_WITH_SECURE_PASSWORD@postgres:5432/at_tayyibun

# Redis
REDIS_URL=redis://redis:6379

# App
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://attayyibun.com/api

# JWT Secret (paste the generated secret from above)
JWT_SECRET=PASTE_YOUR_GENERATED_SECRET_HERE
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

---

## Step 8: Create Production Docker Compose File

```bash
nano docker-compose.prod.yml
```

Paste the following:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    container_name: at-tayyibun-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: at-tayyibun-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: at-tayyibun-api
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: at-tayyibun-web
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: https://attayyibun.com/api
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      - api
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

---

## Step 9: Build and Start Containers

This will take several minutes on first run:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Verify containers are running:

```bash
docker ps
```

You should see 4 containers: `postgres`, `redis`, `api`, `web`

---

## Step 10: Run Database Migrations

```bash
docker exec at-tayyibun-api npx prisma migrate deploy
```

---

## Step 11: Configure Nginx for attayyibun.com

Create the Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/attayyibun.com
```

Paste the following:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name attayyibun.com www.attayyibun.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

---

## Step 12: Enable the Site

```bash
# Create symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/attayyibun.com /etc/nginx/sites-enabled/

# Test nginx configuration for errors
sudo nginx -t

# Reload nginx to apply changes
sudo systemctl reload nginx
```

---

## Step 13: Get SSL Certificate

```bash
sudo certbot --nginx -d attayyibun.com -d www.attayyibun.com
```

When prompted:

1. Enter email address for renewal notifications
2. Agree to terms of service (Y)
3. Choose whether to share email with EFF (Y/N)
4. Select option **2** to redirect HTTP to HTTPS (recommended)

---

## Step 14: Verify Deployment

Test the site:

```bash
curl -I https://attayyibun.com
```

You should see `HTTP/2 200` response.

Open in browser: **https://attayyibun.com**

---

## Troubleshooting Commands

### View Container Status

```bash
docker ps
```

### View Container Logs

```bash
# Web app logs
docker logs at-tayyibun-web

# API logs
docker logs at-tayyibun-api

# Database logs
docker logs at-tayyibun-postgres

# Follow logs in real-time
docker logs -f at-tayyibun-api
```

### View Nginx Logs

```bash
# Error log
sudo tail -f /var/log/nginx/error.log

# Access log
sudo tail -f /var/log/nginx/access.log
```

### Restart Services

```bash
# Restart all containers
docker compose -f docker-compose.prod.yml restart

# Restart specific container
docker restart at-tayyibun-web

# Restart nginx
sudo systemctl restart nginx
```

### Rebuild After Code Changes

```bash
cd ~/At-tayyibun-Saif
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Check Disk Space

```bash
df -h
```

### Check Memory Usage

```bash
free -h
```

---

## Updating the Application

When new code is pushed to the repository:

```bash
cd ~/At-tayyibun-Saif
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker exec at-tayyibun-api npx prisma migrate deploy
```

---

## Backup Database

```bash
docker exec at-tayyibun-postgres pg_dump -U tayyibun at_tayyibun > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## SSL Certificate Auto-Renewal

Certbot sets up automatic renewal. Test it with:

```bash
sudo certbot renew --dry-run
```

---

## Firewall Configuration (Optional but Recommended)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Summary Checklist

- [ ] SSH into VM
- [ ] System updated
- [ ] Docker installed
- [ ] Logged out and back in (for docker group)
- [ ] Nginx installed
- [ ] Certbot installed
- [ ] Project cloned
- [ ] `.env` file created with secure passwords
- [ ] `docker-compose.prod.yml` created
- [ ] Containers built and running
- [ ] Database migrations applied
- [ ] Nginx configured for attayyibun.com
- [ ] Site enabled in nginx
- [ ] SSL certificate obtained
- [ ] Site accessible at https://attayyibun.com

---

**Deployment Complete! 🎉**
