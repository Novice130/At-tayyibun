# Graph Report - apps  (2026-04-25)

## Corpus Check
- 142 files · ~335,954 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 420 nodes · 466 edges · 96 communities detected
- Extraction: 75% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin Ad & Campaign Services|Admin Ad & Campaign Services]]
- [[_COMMUNITY_Profile & Encryption Service|Profile & Encryption Service]]
- [[_COMMUNITY_Contact Request Flow|Contact Request Flow]]
- [[_COMMUNITY_DB Seeds & Audit Logging|DB Seeds & Audit Logging]]
- [[_COMMUNITY_Photo Upload & Storage|Photo Upload & Storage]]
- [[_COMMUNITY_Admin User Management|Admin User Management]]
- [[_COMMUNITY_Transactional Email Service|Transactional Email Service]]
- [[_COMMUNITY_Form Schema Admin|Form Schema Admin]]
- [[_COMMUNITY_Auth Controller & Service|Auth Controller & Service]]
- [[_COMMUNITY_Admin Ads Controller|Admin Ads Controller]]
- [[_COMMUNITY_Users Service|Users Service]]
- [[_COMMUNITY_Schema Editor UI|Schema Editor UI]]
- [[_COMMUNITY_Browse & Profile UI|Browse & Profile UI]]
- [[_COMMUNITY_Campaigns Controller|Campaigns Controller]]
- [[_COMMUNITY_Coupons Controller|Coupons Controller]]
- [[_COMMUNITY_Admin User Actions UI|Admin User Actions UI]]
- [[_COMMUNITY_Stub Mock Modules|Stub Mock Modules]]
- [[_COMMUNITY_Photo Moderation Controller|Photo Moderation Controller]]
- [[_COMMUNITY_MFA DTOs|MFA DTOs]]
- [[_COMMUNITY_Photos Controller|Photos Controller]]
- [[_COMMUNITY_Avatar Generation|Avatar Generation]]
- [[_COMMUNITY_Signup Form|Signup Form]]
- [[_COMMUNITY_JWT Auth Guard|JWT Auth Guard]]
- [[_COMMUNITY_Audit Log Interceptor|Audit Log Interceptor]]
- [[_COMMUNITY_Requests Dashboard UI|Requests Dashboard UI]]
- [[_COMMUNITY_Theme System|Theme System]]
- [[_COMMUNITY_BetterAuth Guard|BetterAuth Guard]]
- [[_COMMUNITY_Object Ownership Guard|Object Ownership Guard]]
- [[_COMMUNITY_Role-Based Access Guard|Role-Based Access Guard]]
- [[_COMMUNITY_Database Service|Database Service]]
- [[_COMMUNITY_Auth DTOs|Auth DTOs]]
- [[_COMMUNITY_OAuth Provider Interface|OAuth Provider Interface]]
- [[_COMMUNITY_Admin CRUD UI|Admin CRUD UI]]
- [[_COMMUNITY_Profile Setup Wizard|Profile Setup Wizard]]
- [[_COMMUNITY_Campaign Email Processor|Campaign Email Processor]]
- [[_COMMUNITY_Request DTOs|Request DTOs]]
- [[_COMMUNITY_Profile Filter Bar|Profile Filter Bar]]
- [[_COMMUNITY_App Bootstrap|App Bootstrap]]
- [[_COMMUNITY_Public Route Decorator|Public Route Decorator]]
- [[_COMMUNITY_Roles Decorator|Roles Decorator]]
- [[_COMMUNITY_Drizzle Module|Drizzle Module]]
- [[_COMMUNITY_Admin Module|Admin Module]]
- [[_COMMUNITY_Auth Module|Auth Module]]
- [[_COMMUNITY_Photos Module|Photos Module]]
- [[_COMMUNITY_Profiles Module|Profiles Module]]
- [[_COMMUNITY_Profile Update DTO|Profile Update DTO]]
- [[_COMMUNITY_Requests Module|Requests Module]]
- [[_COMMUNITY_Users Module|Users Module]]
- [[_COMMUNITY_Shared Services Module|Shared Services Module]]
- [[_COMMUNITY_Sentry Instrumentation|Sentry Instrumentation]]
- [[_COMMUNITY_Global Error Handler|Global Error Handler]]
- [[_COMMUNITY_Campaigns Admin Page|Campaigns Admin Page]]
- [[_COMMUNITY_Coupons Admin Page|Coupons Admin Page]]
- [[_COMMUNITY_Photo Moderation UI|Photo Moderation UI]]
- [[_COMMUNITY_MFA Challenge Page|MFA Challenge Page]]
- [[_COMMUNITY_MFA Setup Page|MFA Setup Page]]
- [[_COMMUNITY_Login Form|Login Form]]
- [[_COMMUNITY_Login Page|Login Page]]
- [[_COMMUNITY_Signup Page|Signup Page]]
- [[_COMMUNITY_Navigation Bar|Navigation Bar]]
- [[_COMMUNITY_Badge Component|Badge Component]]
- [[_COMMUNITY_API Client|API Client]]
- [[_COMMUNITY_Auth Client|Auth Client]]
- [[_COMMUNITY_BetterAuth Config|BetterAuth Config]]
- [[_COMMUNITY_CSS Utilities|CSS Utilities]]
- [[_COMMUNITY_Drizzle Config|Drizzle Config]]
- [[_COMMUNITY_API DB Relations|API DB Relations]]
- [[_COMMUNITY_API DB Schema|API DB Schema]]
- [[_COMMUNITY_Current User Decorator|Current User Decorator]]
- [[_COMMUNITY_Module Exports A|Module Exports A]]
- [[_COMMUNITY_Module Exports B|Module Exports B]]
- [[_COMMUNITY_Module Exports C|Module Exports C]]
- [[_COMMUNITY_Role Enum|Role Enum]]
- [[_COMMUNITY_Web DB Relations|Web DB Relations]]
- [[_COMMUNITY_Web DB Schema|Web DB Schema]]
- [[_COMMUNITY_NextJS Types|NextJS Types]]
- [[_COMMUNITY_NextJS Config|NextJS Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Client Instrumentation|Client Instrumentation]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Verify Email Page|Verify Email Page]]
- [[_COMMUNITY_Admin Layout|Admin Layout]]
- [[_COMMUNITY_Admin Dashboard|Admin Dashboard]]
- [[_COMMUNITY_Admin Users Page|Admin Users Page]]
- [[_COMMUNITY_Auth API Route|Auth API Route]]
- [[_COMMUNITY_Admin Photos Page|Admin Photos Page]]
- [[_COMMUNITY_Profile Setup Page|Profile Setup Page]]
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_Profile Card|Profile Card]]
- [[_COMMUNITY_Button Component|Button Component]]
- [[_COMMUNITY_Input Component|Input Component]]
- [[_COMMUNITY_Textarea Component|Textarea Component]]
- [[_COMMUNITY_Web DB Relations File|Web DB Relations File]]
- [[_COMMUNITY_Web DB Schema File|Web DB Schema File]]
- [[_COMMUNITY_Web DB Connection|Web DB Connection]]

## God Nodes (most connected - your core abstractions)
1. `set()` - 19 edges
2. `EmailService` - 12 edges
3. `AdminController` - 11 edges
4. `AdminService` - 11 edges
5. `AdminSchemasController` - 10 edges
6. `AdminSchemasService` - 10 edges
7. `RequestsService` - 9 edges
8. `AuditService` - 9 edges
9. `RequestsController` - 8 edges
10. `StorageService` - 8 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `set()`  [INFERRED]
  apps\api\src\db\seed-admin.ts → apps\web\src\app\profile\setup\page.tsx
- `ThemeToggle()` --calls--> `useTheme()`  [INFERRED]
  apps\web\src\components\ThemeToggle.tsx → apps\web\src\components\ThemeProvider.tsx

## Communities

### Community 0 - "Admin Ad & Campaign Services"
Cohesion: 0.07
Nodes (8): AdminAdsService, AdminCampaignsService, AdminCouponsService, AdminPhotosService, AdminSchemasService, AdminService, set(), main()

### Community 1 - "Profile & Encryption Service"
Cohesion: 0.12
Nodes (3): EncryptionService, ProfilesController, ProfilesService

### Community 2 - "Contact Request Flow"
Cohesion: 0.13
Nodes (2): RequestsController, RequestsService

### Community 3 - "DB Seeds & Audit Logging"
Cohesion: 0.15
Nodes (6): AuditService, checkAdmin(), bootstrap(), generatePhoneNumber(), main(), main()

### Community 4 - "Photo Upload & Storage"
Cohesion: 0.13
Nodes (3): ImageProcessorService, PhotosService, StorageService

### Community 5 - "Admin User Management"
Cohesion: 0.17
Nodes (1): AdminController

### Community 6 - "Transactional Email Service"
Cohesion: 0.35
Nodes (1): EmailService

### Community 7 - "Form Schema Admin"
Cohesion: 0.18
Nodes (1): AdminSchemasController

### Community 8 - "Auth Controller & Service"
Cohesion: 0.18
Nodes (2): AuthController, AuthService

### Community 9 - "Admin Ads Controller"
Cohesion: 0.25
Nodes (1): AdminAdsController

### Community 10 - "Users Service"
Cohesion: 0.32
Nodes (1): UsersService

### Community 11 - "Schema Editor UI"
Cohesion: 0.43
Nodes (7): activateSchema(), fetchFields(), fetchSchemas(), handleDeleteField(), handleSaveField(), handleSaveSchema(), selectSchema()

### Community 12 - "Browse & Profile UI"
Cohesion: 0.32
Nodes (5): fetchActiveRequest(), fetchProfile(), fetchProfiles(), handleFilter(), handleRequestContact()

### Community 13 - "Campaigns Controller"
Cohesion: 0.29
Nodes (1): AdminCampaignsController

### Community 14 - "Coupons Controller"
Cohesion: 0.29
Nodes (1): AdminCouponsController

### Community 15 - "Admin User Actions UI"
Cohesion: 0.29
Nodes (1): demote()

### Community 16 - "Stub Mock Modules"
Cohesion: 0.33
Nodes (5): AdsModule, CampaignsModule, CouponsModule, MembershipsModule, MessagesModule

### Community 17 - "Photo Moderation Controller"
Cohesion: 0.33
Nodes (1): AdminPhotosController

### Community 18 - "MFA DTOs"
Cohesion: 0.33
Nodes (5): Disable2FADto, Enable2FADto, Enable2FAResponseDto, TwoFactorSetupResponseDto, Verify2FADto

### Community 19 - "Photos Controller"
Cohesion: 0.33
Nodes (1): PhotosController

### Community 20 - "Avatar Generation"
Cohesion: 0.53
Nodes (1): AvatarService

### Community 21 - "Signup Form"
Cohesion: 0.33
Nodes (0): 

### Community 22 - "JWT Auth Guard"
Cohesion: 0.4
Nodes (1): JwtAuthGuard

### Community 23 - "Audit Log Interceptor"
Cohesion: 0.4
Nodes (1): AuditLogInterceptor

### Community 24 - "Requests Dashboard UI"
Cohesion: 0.5
Nodes (2): fetchRequests(), handleRespond()

### Community 25 - "Theme System"
Cohesion: 0.4
Nodes (2): useTheme(), ThemeToggle()

### Community 26 - "BetterAuth Guard"
Cohesion: 0.5
Nodes (1): BetterAuthGuard

### Community 27 - "Object Ownership Guard"
Cohesion: 0.5
Nodes (1): ObjectOwnerGuard

### Community 28 - "Role-Based Access Guard"
Cohesion: 0.5
Nodes (1): RolesGuard

### Community 29 - "Database Service"
Cohesion: 0.5
Nodes (1): DrizzleService

### Community 30 - "Auth DTOs"
Cohesion: 0.5
Nodes (3): LoginDto, SignupDto, VerifyPhoneDto

### Community 31 - "OAuth Provider Interface"
Cohesion: 0.5
Nodes (0): 

### Community 32 - "Admin CRUD UI"
Cohesion: 0.5
Nodes (0): 

### Community 33 - "Profile Setup Wizard"
Cohesion: 0.83
Nodes (3): handleNext(), handleSubmit(), validate()

### Community 34 - "Campaign Email Processor"
Cohesion: 0.67
Nodes (1): EmailCampaignProcessor

### Community 35 - "Request DTOs"
Cohesion: 0.67
Nodes (2): CreateRequestDto, RespondRequestDto

### Community 36 - "Profile Filter Bar"
Cohesion: 0.67
Nodes (0): 

### Community 37 - "App Bootstrap"
Cohesion: 1.0
Nodes (1): AppModule

### Community 38 - "Public Route Decorator"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Roles Decorator"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Drizzle Module"
Cohesion: 1.0
Nodes (1): DrizzleModule

### Community 41 - "Admin Module"
Cohesion: 1.0
Nodes (1): AdminModule

### Community 42 - "Auth Module"
Cohesion: 1.0
Nodes (1): AuthModule

### Community 43 - "Photos Module"
Cohesion: 1.0
Nodes (1): PhotosModule

### Community 44 - "Profiles Module"
Cohesion: 1.0
Nodes (1): ProfilesModule

### Community 45 - "Profile Update DTO"
Cohesion: 1.0
Nodes (1): UpdateProfileDto

### Community 46 - "Requests Module"
Cohesion: 1.0
Nodes (1): RequestsModule

### Community 47 - "Users Module"
Cohesion: 1.0
Nodes (1): UsersModule

### Community 48 - "Shared Services Module"
Cohesion: 1.0
Nodes (1): SharedServicesModule

### Community 49 - "Sentry Instrumentation"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Global Error Handler"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Campaigns Admin Page"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Coupons Admin Page"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Photo Moderation UI"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "MFA Challenge Page"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "MFA Setup Page"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Login Form"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Login Page"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Signup Page"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Navigation Bar"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Badge Component"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "API Client"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Auth Client"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "BetterAuth Config"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "CSS Utilities"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Drizzle Config"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "API DB Relations"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "API DB Schema"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Current User Decorator"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Module Exports A"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Module Exports B"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Module Exports C"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Role Enum"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Web DB Relations"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Web DB Schema"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "NextJS Types"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "NextJS Config"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Client Instrumentation"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Root Layout"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "Verify Email Page"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "Admin Layout"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "Admin Dashboard"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "Admin Users Page"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "Auth API Route"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "Admin Photos Page"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Profile Setup Page"
Cohesion: 1.0
Nodes (0): 

### Community 88 - "Home Page"
Cohesion: 1.0
Nodes (0): 

### Community 89 - "Profile Card"
Cohesion: 1.0
Nodes (0): 

### Community 90 - "Button Component"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "Input Component"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "Textarea Component"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "Web DB Relations File"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "Web DB Schema File"
Cohesion: 1.0
Nodes (0): 

### Community 95 - "Web DB Connection"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **25 isolated node(s):** `AppModule`, `DrizzleModule`, `MessagesModule`, `AdsModule`, `CouponsModule` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Bootstrap`** (2 nodes): `AppModule`, `app.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Public Route Decorator`** (2 nodes): `public.decorator.ts`, `Public()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Roles Decorator`** (2 nodes): `roles.decorator.ts`, `Roles()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Drizzle Module`** (2 nodes): `drizzle.module.ts`, `DrizzleModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Module`** (2 nodes): `AdminModule`, `admin.module.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Module`** (2 nodes): `auth.module.ts`, `AuthModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Photos Module`** (2 nodes): `photos.module.ts`, `PhotosModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profiles Module`** (2 nodes): `profiles.module.ts`, `ProfilesModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Update DTO`** (2 nodes): `index.ts`, `UpdateProfileDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Requests Module`** (2 nodes): `requests.module.ts`, `RequestsModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Users Module`** (2 nodes): `users.module.ts`, `UsersModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Services Module`** (2 nodes): `shared-services.module.ts`, `SharedServicesModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sentry Instrumentation`** (2 nodes): `instrumentation.ts`, `register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Global Error Handler`** (2 nodes): `global-error.tsx`, `GlobalError()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Campaigns Admin Page`** (2 nodes): `page.tsx`, `AdminCampaignsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Coupons Admin Page`** (2 nodes): `page.tsx`, `AdminCouponsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Photo Moderation UI`** (2 nodes): `page.tsx`, `handleAction()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MFA Challenge Page`** (2 nodes): `page.tsx`, `MFAChallengePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MFA Setup Page`** (2 nodes): `page.tsx`, `MFASetupPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Form`** (2 nodes): `LoginForm.tsx`, `handleSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Page`** (2 nodes): `page.tsx`, `LoginPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Signup Page`** (2 nodes): `page.tsx`, `SignupPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Navigation Bar`** (2 nodes): `Navbar.tsx`, `handleLogout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Badge Component`** (2 nodes): `badge.tsx`, `Badge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Client`** (2 nodes): `fetchWithAuth()`, `api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Client`** (2 nodes): `auth-client.ts`, `getBaseUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `BetterAuth Config`** (2 nodes): `auth.ts`, `generateId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CSS Utilities`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Drizzle Config`** (1 nodes): `drizzle.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API DB Relations`** (1 nodes): `relations.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API DB Schema`** (1 nodes): `schema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Current User Decorator`** (1 nodes): `current-user.decorator.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Exports A`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Exports B`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Exports C`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Role Enum`** (1 nodes): `role.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web DB Relations`** (1 nodes): `relations.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web DB Schema`** (1 nodes): `schema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `NextJS Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `NextJS Config`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Client Instrumentation`** (1 nodes): `instrumentation-client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Layout`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Verify Email Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Layout`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Dashboard`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Users Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth API Route`** (1 nodes): `route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Photos Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Setup Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Card`** (1 nodes): `ProfileCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Button Component`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Input Component`** (1 nodes): `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Textarea Component`** (1 nodes): `textarea.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web DB Relations File`** (1 nodes): `db-relations.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web DB Schema File`** (1 nodes): `db-schema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web DB Connection`** (1 nodes): `db.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `set()` connect `Admin Ad & Campaign Services` to `Auth Controller & Service`, `Profile Setup Wizard`, `Contact Request Flow`, `Profile & Encryption Service`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `set()` (e.g. with `main()` and `.updateUser()`) actually correct?**
  _`set()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AppModule`, `DrizzleModule`, `MessagesModule` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Ad & Campaign Services` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Profile & Encryption Service` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Contact Request Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Photo Upload & Storage` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._