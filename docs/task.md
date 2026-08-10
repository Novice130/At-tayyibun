# At-Tayyibun Muslim Matrimony Web App - Task Breakdown

## Phase 1: Planning & Architecture
- [x] Create comprehensive implementation plan
- [x] Document assumptions and design decisions
- [x] Define system architecture with component diagram
- [x] Finalize technology choices and dependencies

## Phase 2: Database Schema & Migrations
- [x] Design normalized PostgreSQL schema
- [x] Create Prisma schema with all entities
- [x] Define encryption strategy for biodata fields
- [ ] Create migration files

## Phase 3: Backend API (NestJS)
- [x] Initialize NestJS project structure
- [x] Implement authentication module (Email/Password, Google, Facebook, OAuth interface)
- [x] Implement user/profile management APIs
- [x] Implement browse/filter/sort endpoints
- [x] Implement info request workflow APIs
- [ ] Implement messaging APIs
- [x] Implement admin RBAC endpoints
- [ ] Implement ad/coupon management APIs
- [x] Add rate limiting and security middleware
- [x] Add field-level encryption service

## Phase 4: Background Jobs
- [ ] Request expiration job (24h auto-deny)
- [ ] Email notification job on approval
- [ ] Gold member weekly boost job
- [ ] Image processing pipeline job

## Phase 5: Frontend (Next.js App Router)
- [x] Initialize Next.js project with TypeScript + TailwindCSS
- [x] Create public landing page (/)
- [ ] Create profile viewer with client-side transitions
- [x] Create signup/login pages
- [x] Create browse page with filters
- [ ] Create requests management page
- [ ] Create messaging page
- [ ] Create pricing page (conditional)
- [ ] Create admin dashboard

## Phase 6: Admin Dashboard
- [ ] Admin user management (RBAC)
- [ ] Signup form schema editor
- [ ] Membership toggle and pricing
- [ ] Ad inventory management
- [ ] Coupon management
- [ ] Analytics (user counts by gender, paid users)
- [ ] Rank boost controls
- [ ] Email campaign management

## Phase 7: Security Implementation
- [ ] OWASP ASVS Level 2 controls checklist
- [ ] Deny-by-default authorization
- [ ] Object-level authorization guards
- [ ] Password hashing (Argon2)
- [ ] Field-level encryption (AES-256-GCM)
- [ ] Secure headers (HSTS, CSP)
- [ ] Rate limiting implementation
- [ ] Audit logging system

## Phase 8: Testing
- [ ] Unit tests for authorization (IDOR/BOLA)
- [ ] Integration tests for request expiration
- [ ] Tests for "one active request" constraint
- [ ] Image pipeline tests
- [ ] Rate limit tests

## Phase 9: Infrastructure & Deployment
- [ ] Terraform/gcloud scripts for GCP resources
- [ ] Cloud Run configuration
- [ ] Cloud SQL setup
- [ ] Memorystore (Redis) setup
- [ ] GCS bucket configuration
- [ ] Secret Manager integration
- [ ] Cloud Tasks/Scheduler setup
- [ ] Cloud Armor configuration

## Phase 10: Documentation
- [ ] Local development setup instructions
- [ ] Staging deployment guide
- [ ] Production deployment guide
- [ ] API documentation
