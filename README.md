# At-Tayyibun - Muslim Matrimony Platform

> A privacy-first, halal-oriented matrimony platform designed for Muslims in the United States.

## 🏗️ Architecture

This is a monorepo powered by [Turborepo](https://turbo.build/) containing:

- **`apps/web`** - Next.js 14 frontend (App Router + TypeScript + TailwindCSS)
- **`apps/api`** - NestJS backend (REST API + Drizzle ORM + PostgreSQL)
- **`packages/shared`** - Shared TypeScript types and utilities
- **`jobs/`** - Cloud Run background jobs
- **`infra/`** - Terraform infrastructure-as-code

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 8
- Docker & Docker Compose (for local development)
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/your-org/at-tayyibun.git
   cd at-tayyibun
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your local values
   ```

3. **Start infrastructure with Docker:**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations:**
   ```bash
   pnpm --filter api db:migrate
   pnpm --filter api db:generate
   ```

5. **Start development servers:**
   ```bash
   pnpm dev
   ```

   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - API Docs: http://localhost:3001/api/docs

## 📁 Project Structure

```
at-tayyibun/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── api/                  # NestJS backend
├── packages/
│   └── shared/               # Shared types & utilities
├── jobs/                     # Background jobs
├── infra/                    # Terraform IaC
├── docs/                     # Documentation
├── docker-compose.yml        # Local dev infrastructure
└── turbo.json               # Turborepo config
```

## 🔐 Security

- **Passwords**: Hashed with Argon2id
- **Biodata**: Encrypted with AES-256-GCM before storage
- **Photos**: Private by default, accessed via signed URLs
- **Auth**: JWT with Firebase/Identity Platform
- **Rate Limiting**: Redis-backed per-endpoint limits
- **Headers**: HSTS, CSP, X-Frame-Options configured

See [docs/security-checklist.md](docs/security-checklist.md) for full OWASP ASVS L2 compliance details.

## 📚 Documentation

- [API Specification](docs/api-spec.md)
- [Deployment Guide](docs/deployment.md)
- [Security Checklist](docs/security-checklist.md)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run API tests only
pnpm --filter api test

# Run e2e tests
pnpm --filter api test:e2e
```

## 🚢 Deployment

See [docs/deployment.md](docs/deployment.md) for GCP deployment instructions using Terraform.

## 📜 License

Private - All rights reserved.
