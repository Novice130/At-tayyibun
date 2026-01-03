# At-Tayyibun - Orthodox Muslim Matrimony Web App

A production-grade, privacy-first, halal-oriented matrimony platform designed for Muslims in the United States.

## 🌙 Project Overview

At-Tayyibun is built with a focus on:
- **Privacy**: Real photos are private by default; AI avatars are used publicly
- **Consent**: Timed consent-based sharing of restricted information (24h expiry)
- **Security**: OWASP ASVS Level 2 controls, field-level encryption, deny-by-default auth
- **Islamic Values**: Marriage-focused (nikah), not casual dating

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), TypeScript, TailwindCSS |
| **Backend** | NestJS, TypeScript, Prisma ORM |
| **Database** | PostgreSQL (Cloud SQL) |
| **Cache** | Redis (Memorystore) |
| **Storage** | Google Cloud Storage |
| **Auth** | Firebase Authentication |
| **Email** | SendGrid |
| **Infrastructure** | Google Cloud Platform, Terraform |

## 📁 Repository Structure

```
at-tayyibun/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   └── shared/       # Shared types and utilities
├── infrastructure/
│   └── terraform/    # GCP infrastructure as code
├── docs/             # Documentation
└── docker-compose.yml
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Google Cloud SDK (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/at-tayyibun.git
   cd at-tayyibun
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start infrastructure (PostgreSQL, Redis, MinIO, MailHog)**
   ```bash
   docker-compose up -d
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - MailHog: http://localhost:8025

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

## 🔐 Security Features

- **Deny-by-default authentication** - All endpoints require auth unless explicitly marked `@Public()`
- **RBAC** - Role-based access control (USER, ADMIN, SUPER_ADMIN)
- **Field-level encryption** - Biodata encrypted with AES-256-GCM
- **Signed URLs** - Photo access via expiring signed URLs
- **Rate limiting** - Redis-backed rate limits on sensitive endpoints
- **Audit logging** - Sensitive actions logged (without PII)

## 📦 Deployment

### Using Terraform

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan
terraform plan -var-file=environments/prod.tfvars

# Apply
terraform apply -var-file=environments/prod.tfvars
```

### Manual Cloud Run Deployment

```bash
# Build and push images
gcloud builds submit --config cloudbuild.yaml

# Deploy
gcloud run deploy at-tayyibun-api --image gcr.io/PROJECT_ID/at-tayyibun-api
gcloud run deploy at-tayyibun-web --image gcr.io/PROJECT_ID/at-tayyibun-web
```

## 📝 License

Proprietary - All rights reserved.

## 🤝 Contributing

This is a private project. Please contact the maintainers for contribution guidelines.
