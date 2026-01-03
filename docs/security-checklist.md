# At-Tayyibun Security Controls Checklist

This document maps implemented security controls to OWASP ASVS Level 2 requirements.

## Authentication (V2)

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| V2.1 | Password length requirements | Signup DTO: min 8 chars, max 128 | ✅ |
| V2.2 | Password complexity | Regex: uppercase, lowercase, number, special char | ✅ |
| V2.3 | Password hashing | Firebase Auth (scrypt) + Argon2 for custom flows | ✅ |
| V2.4 | Rate limiting on login | Redis-backed: 5 attempts/min | ✅ |
| V2.5 | Multi-factor authentication | Phone verification via Firebase | ✅ |
| V2.6 | Account lockout | Firebase handles after failed attempts | ✅ |

## Session Management (V3)

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| V3.1 | Session tokens are random | Firebase ID tokens (JWT) | ✅ |
| V3.2 | Session expiration | Configurable JWT expiry (default 7d) | ✅ |
| V3.3 | Session invalidation on logout | Redis session cleanup + Firebase revoke | ✅ |
| V3.4 | Secure session cookies | HttpOnly, Secure, SameSite=Strict | ✅ |

## Access Control (V4)

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| V4.1 | Deny-by-default | Global AuthGuard, @Public() required for exceptions | ✅ |
| V4.2 | Principle of least privilege | Role-based access (USER, ADMIN, SUPER_ADMIN) | ✅ |
| V4.3 | Access control on every request | AuthGuard + RolesGuard in AppModule | ✅ |
| V4.4 | Object-level authorization | Resource ownership checks in services | ✅ |
| V4.5 | Admin authorization | @Roles() decorator with RBAC checks | ✅ |

## Input Validation (V5)

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| V5.1 | Input validation | class-validator DTOs on all endpoints | ✅ |
| V5.2 | Allow-list validation | Enums for eth, gender, status | ✅ |
| V5.3 | Structured data validation | Prisma schema types + DTO validation | ✅ |
| V5.4 | Reject unexpected input | ValidationPipe with whitelist: true | ✅ |

## Cryptography (V6)

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| V6.1 | Strong encryption | AES-256-GCM for biodata | ✅ |
| V6.2 | Secure key storage | Google Secret Manager | ✅ |
| V6.3 | Key rotation support | Key ID versioning in encrypted data | ✅ |
| V6.4 | TLS for data in transit | Cloud Load Balancer with managed SSL | ✅ |

## Data Protection (V8)

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| V8.1 | Sensitive data identification | Encrypted fields: lastName, DOB, biodata, messages | ✅ |
| V8.2 | Encryption at rest | Cloud SQL encryption + field-level encryption | ✅ |
| V8.3 | Secure backups | Cloud SQL automated backups (encrypted) | ✅ |
| V8.4 | Data retention policies | GCS lifecycle rules (365 days) | ✅ |

## Communications (V9)

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| V9.1 | TLS everywhere | HTTPS-only via Cloud Load Balancer | ✅ |
| V9.2 | Strong TLS configuration | TLS 1.2+ with modern cipher suites | ✅ |
| V9.3 | HSTS | Helmet middleware: maxAge 1 year, includeSubDomains | ✅ |
| V9.4 | Certificate validity | Google-managed SSL certificates | ✅ |

## Configuration (V14)

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| V14.1 | Secure headers | CSP, X-Frame-Options, X-Content-Type via Helmet | ✅ |
| V14.2 | Secrets management | Environment variables + Secret Manager | ✅ |
| V14.3 | Error handling | HttpExceptionFilter (no stack traces in prod) | ✅ |
| V14.4 | Dependency security | npm audit in CI/CD | 🔄 |

## Business Logic (V10)

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| V10.1 | Request expiration | 24h TTL, Cloud Scheduler job | ✅ |
| V10.2 | One active request | Redis lock + DB constraint | ✅ |
| V10.3 | Consent-based sharing | Explicit approval workflow | ✅ |
| V10.4 | Phone uniqueness | Firebase + DB unique constraint | ✅ |

## API Security

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| API.1 | Rate limiting | Throttler + custom Redis limits | ✅ |
| API.2 | Parameterized queries | Prisma ORM (no raw SQL) | ✅ |
| API.3 | Input size limits | Multer 10MB, ValidationPipe | ✅ |
| API.4 | CORS configuration | Explicit origin whitelist | ✅ |

## Logging & Monitoring

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| LOG.1 | Audit logging | AuditLogInterceptor for sensitive actions | ✅ |
| LOG.2 | No secrets in logs | Metadata sanitization | ✅ |
| LOG.3 | No PII in logs | Biodata/messages excluded | ✅ |
| LOG.4 | Log retention | Cloud Logging default retention | 🔄 |

## Photo Security

| # | Control | Implementation | Status |
|---|---------|----------------|--------|
| PHOTO.1 | Private by default | Real photos isPublic=false | ✅ |
| PHOTO.2 | Signed URLs | GCS V4 signed URLs (15min expiry) | ✅ |
| PHOTO.3 | One-time access tokens | SignedUrlToken table with isUsed flag | ✅ |
| PHOTO.4 | Image sanitization | Sharp processing removes EXIF | ✅ |

---

**Legend:**
- ✅ Implemented
- 🔄 Planned/In Progress
- ❌ Not Implemented
