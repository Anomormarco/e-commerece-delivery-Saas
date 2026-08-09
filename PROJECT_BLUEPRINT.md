# DeliverHub Project Blueprint

Version: v0.1  
Date: 2026-07-28  
Architecture: TypeScript micro service  + React client + real PostgreSQL backend

## 1. Project Goal

DeliverHub нь олон дэлгүүр буюу tenant-тэй e-commerce delivery SaaS платформ байна. Систем нь бараа, захиалга, хүргэлт, courier баталгаажуулалт, GPS tracking, QPay төлбөр, wallet/ledger, subscription, audit зэргийг нэг backend дотор module boundary-тайгаар хөгжүүлнэ.

MVP-ийн гол зарчим:

- Multi-tenant өгөгдлийн тусгаарлалт заавал байна.
- Backend нь mock биш, бодит PostgreSQL database дээр ажиллана.
- Frontend нь React дээр role тус бүрийн тусдаа workflow-той байна.
- RBAC болон tenant authorization backend дээр enforced байна.
- External integration-ууд adapter interface-ээр тусгаарлагдана.

## 2. Recommended Stack

| Layer | Technology | Reason |
|---|---|---|
| Client | React + TypeScript + Vite | SPA/PWA client-ийг хурдан, цэвэр хөгжүүлэх |
| Admin/Store/Employee UI | React Router | Role-based route guarding хийхэд энгийн |
| Backend | NestJS + TypeScript | Modular monolith-д хамгийн тохиромжтой structure |
| Database | PostgreSQL + PostGIS | Tenant data, order, payment, location point хадгалах |
| ORM | Prisma | Type-safe schema/migration, хурдан MVP |
| Cache/Queue | Redis + BullMQ | Payment reconciliation, notification, location job |
| Realtime | WebSocket or SSE | Delivery tracking, notification |
| Storage | S3-compatible storage | Evidence зураг, document attachment |
| Map | MapLibre | GPS map, route visualization |
| Payment | QPay adapter | Invoice/callback/reconciliation |
| Identity | DAN/e-Mongolia adapter | Courier identity verification |
| Face | Face/liveness provider adapter | 1:1 verification, liveness |

## 3. Repository Structure

Project root дээр зөвхөн хоёр үндсэн application folder байна:

```text
client/
  src/
    components/
    features/
    shared/
  index.html
  package.json
  tsconfig.json
  vite.config.ts

server/
  prisma/
    schema.prisma
    seed.ts
  src/
    main.ts
    database/
    modules/
  package.json
  tsconfig.json

docs/
```

`apps/*` structure ашиглахгүй. Frontend бол `client/`, backend бол `server/` гэж шууд ойлгомжтой тусгаарлана. Shared contracts шаардлагатай болох үед `packages/shared` нэмнэ.

## 4. Modular Monolith Backend

Backend нь нэг deployable service байна. Гэхдээ module бүр өөрийн domain logic, repository/service, DTO, controller boundary-той байна.

| Module | Responsibility |
|---|---|
| Auth | Login, session, refresh token, MFA, password policy |
| RBAC | Roles, permissions, route/action authorization |
| Tenant | Store tenant, branch, tenant membership |
| Identity | DAN/e-Mongolia verification session |
| Biometric | Face/liveness verification, consent, device trust |
| Catalog | Products, variants, categories, media |
| Inventory | Stock, warehouse, movement |
| Order | Cart checkout, order lifecycle, order status history |
| Delivery | Assignment, accept/reject, pickup, handover, attempts |
| Tracking | GPS session, location points, live tracking |
| Pricing | Delivery zone, pricing rules, quotes |
| Payment | QPay invoice, callback, refund |
| Ledger | Double-entry accounting, settlement breakdown |
| Wallet | Courier expected/pending/available earning |
| Payout | Bank account, payout request, approval |
| Subscription | SaaS plan, active subscription, quota |
| Notification | Web/push/SMS/email notification |
| Audit | Immutable audit log |
| Dispute | Customer/store dispute, return workflow |
| Reporting | Dashboard metrics, export |

## 5. Backend Rules

- Tenant scoped table бүр `tenant_id` талбартай байна.
- Platform-wide table-ууд дээр `tenant_id` nullable эсвэл байхгүй байна: `subscription_plans`, `platform_users`, `global_settings`.
- Backend service бүр request context-оос `actor_id`, `role`, `tenant_id` авч authorization шалгана.
- DB migration нь Prisma migration-аар versioned байна.
- Payment callback, pickup QR, delivery OTP зэрэг critical action бүр idempotency болон replay protection-той байна.
- Money value-г floating number-оор хадгалахгүй. `amount_mnt` integer эсвэл PostgreSQL `numeric` ашиглана.
- Audit log нь update/delete хийхгүй append-only байна.

## 6. Core Database Tables

```text
tenants
tenant_members
users
roles
permissions
role_permissions
user_roles
sessions
trusted_devices

subscription_plans
subscriptions
subscription_usage

identity_profiles
identity_verification_sessions
biometric_consents
face_verification_sessions

stores
branches
warehouses
categories
products
product_variants
product_media
inventory_items
inventory_movements

customers
customer_addresses
carts
cart_items
orders
order_items
order_status_history

delivery_zones
delivery_pricing_rules
delivery_quotes
delivery_assignments
pickup_verifications
handover_evidence
tracking_sessions
location_points
delivery_attempts

payment_invoices
payment_transactions
refunds
ledger_accounts
ledger_entries
courier_wallets
wallet_transactions
bank_accounts
payout_requests

notifications
disputes
attachments
audit_logs
risk_events
```

## 7. RBAC Roles

| Role | Scope | Description |
|---|---|---|
| `PLATFORM_ADMIN` | Platform | SaaS owner/admin, бүх tenant, subscription, dispute, monitoring |
| `STORE_ADMIN` | Tenant | Дэлгүүрийн бараа, захиалга, ажилтан, хүргэлт, тайлан |
| `DELIVERY_EMPLOYEE` | Tenant/Assigned Job | Courier onboarding, ажил авах, pickup/delivery, wallet |
| `CUSTOMER` | Own Data | Бараа харах, захиалах, төлөх, tracking, dispute |

## 8. RBAC Permission Groups

```text
platform.tenants.manage
platform.subscriptions.manage
platform.users.manage
platform.disputes.manage
platform.payments.monitor
platform.audit.view
platform.settings.manage

store.dashboard.view
store.products.manage
store.inventory.manage
store.orders.manage
store.deliveries.manage
store.employees.manage
store.customers.view
store.pricing.manage
store.payments.view
store.settlements.view
store.reports.view
store.settings.manage
store.audit.view

delivery.jobs.view
delivery.jobs.accept
delivery.jobs.reject
delivery.pickup.verify
delivery.location.share
delivery.delivery.complete
delivery.history.view
delivery.wallet.view
delivery.payout.request
delivery.profile.manage

customer.catalog.view
customer.orders.create
customer.orders.view
customer.payments.create
customer.delivery.track
customer.delivery.confirm
customer.disputes.create
customer.profile.manage
customer.notifications.view
```

## 9. Client URL And RBAC Matrix

### Public Routes

| URL | Page | Allowed Roles | Notes |
|---|---|---|---|
| `/` | Landing | Public | SaaS intro, store signup, courier signup |
| `/pricing` | Pricing | Public | Subscription plans |
| `/login` | Login | Public | Role-aware login |
| `/register/store` | Store registration | Public | Creates tenant + store admin pending state |
| `/register/courier` | Courier registration | Public | Starts identity verification |
| `/auth/verify` | Auth verification | Public | OTP/email/phone verification |
| `/privacy` | Privacy | Public | Consent/privacy |
| `/terms` | Terms | Public | Service terms |

### Platform Admin Routes

| URL | Page | Permission |
|---|---|---|
| `/admin` | Platform dashboard | `platform.audit.view` |
| `/admin/tenants` | Tenant management | `platform.tenants.manage` |
| `/admin/tenants/:tenantId` | Tenant detail | `platform.tenants.manage` |
| `/admin/subscriptions/plans` | Subscription plans | `platform.subscriptions.manage` |
| `/admin/subscriptions/active` | Active subscriptions | `platform.subscriptions.manage` |
| `/admin/users` | Platform users | `platform.users.manage` |
| `/admin/identity` | Identity monitoring | `platform.audit.view` |
| `/admin/payments` | Payment monitoring | `platform.payments.monitor` |
| `/admin/payouts` | Settlement/payout monitoring | `platform.payments.monitor` |
| `/admin/disputes` | Disputes | `platform.disputes.manage` |
| `/admin/risk` | Fraud/risk alerts | `platform.audit.view` |
| `/admin/audit` | System audit | `platform.audit.view` |
| `/admin/integrations` | Integration health | `platform.settings.manage` |
| `/admin/feature-flags` | Feature flags | `platform.settings.manage` |
| `/admin/settings` | Global settings | `platform.settings.manage` |
| `/admin/reports` | System reports | `platform.audit.view` |

### Store Admin Routes

| URL | Page | Permission |
|---|---|---|
| `/store` | Store dashboard | `store.dashboard.view` |
| `/store/products` | Products | `store.products.manage` |
| `/store/products/new` | Create product | `store.products.manage` |
| `/store/products/:productId` | Product detail/edit | `store.products.manage` |
| `/store/categories` | Categories | `store.products.manage` |
| `/store/inventory` | Inventory | `store.inventory.manage` |
| `/store/warehouses` | Warehouses/branches | `store.inventory.manage` |
| `/store/orders` | Orders | `store.orders.manage` |
| `/store/orders/:orderId` | Order detail | `store.orders.manage` |
| `/store/dispatch` | Dispatch board | `store.deliveries.manage` |
| `/store/deliveries/map` | Delivery live map | `store.deliveries.manage` |
| `/store/deliveries/history` | Delivery history | `store.deliveries.manage` |
| `/store/employees` | Employees | `store.employees.manage` |
| `/store/employees/:employeeId` | Employee detail | `store.employees.manage` |
| `/store/employees/review` | Employee verification review | `store.employees.manage` |
| `/store/customers` | Customers | `store.customers.view` |
| `/store/pricing-rules` | Pricing rules | `store.pricing.manage` |
| `/store/delivery-zones` | Delivery zones | `store.pricing.manage` |
| `/store/payments` | Payments | `store.payments.view` |
| `/store/settlements` | Settlements | `store.settlements.view` |
| `/store/refunds` | Refunds | `store.payments.view` |
| `/store/reports` | Reports | `store.reports.view` |
| `/store/audit` | Audit logs | `store.audit.view` |
| `/store/subscription` | Subscription and billing | `store.settings.manage` |
| `/store/integrations` | Integration/API settings | `store.settings.manage` |
| `/store/notifications/templates` | Notification templates | `store.settings.manage` |
| `/store/disputes` | Disputes and returns | `store.orders.manage` |
| `/store/settings` | Store settings | `store.settings.manage` |

### Delivery Employee Routes

| URL | Page | Permission |
|---|---|---|
| `/courier/onboarding` | Onboarding status | `delivery.profile.manage` |
| `/courier/identity` | DAN/e-Mongolia verification | `delivery.profile.manage` |
| `/courier/face` | Face/liveness verification | `delivery.profile.manage` |
| `/courier` | Courier dashboard | `delivery.jobs.view` |
| `/courier/jobs/available` | Available delivery jobs | `delivery.jobs.view` |
| `/courier/jobs/assigned` | Assigned jobs | `delivery.jobs.view` |
| `/courier/jobs/:assignmentId` | Delivery job detail | `delivery.jobs.view` |
| `/courier/jobs/:assignmentId/route` | Route/navigation | `delivery.jobs.view` |
| `/courier/jobs/:assignmentId/pickup` | Pickup verification | `delivery.pickup.verify` |
| `/courier/jobs/:assignmentId/active` | Active delivery | `delivery.location.share` |
| `/courier/jobs/:assignmentId/handover` | Customer handover | `delivery.delivery.complete` |
| `/courier/history` | Delivery history | `delivery.history.view` |
| `/courier/earnings` | Earnings | `delivery.wallet.view` |
| `/courier/wallet` | Wallet transactions | `delivery.wallet.view` |
| `/courier/payouts` | Payout request | `delivery.payout.request` |
| `/courier/bank-accounts` | Bank accounts | `delivery.profile.manage` |
| `/courier/notifications` | Notifications | `delivery.jobs.view` |
| `/courier/profile` | Profile and documents | `delivery.profile.manage` |
| `/courier/support` | Support/dispute | `delivery.jobs.view` |
| `/courier/privacy-consent` | Privacy and tracking consent | `delivery.profile.manage` |

### Customer Routes

| URL | Page | Permission |
|---|---|---|
| `/store/:storeSlug` | Store/catalog | `customer.catalog.view` |
| `/store/:storeSlug/products/:productId` | Product detail | `customer.catalog.view` |
| `/cart` | Cart | `customer.orders.create` |
| `/checkout` | Checkout | `customer.orders.create` |
| `/checkout/address` | Address and map pin | `customer.orders.create` |
| `/checkout/delivery-quote` | Delivery quote | `customer.orders.create` |
| `/checkout/payment/qpay` | QPay payment | `customer.payments.create` |
| `/checkout/payment/result` | Payment result | `customer.orders.view` |
| `/orders` | My orders | `customer.orders.view` |
| `/orders/:orderId` | Order detail | `customer.orders.view` |
| `/orders/:orderId/tracking` | Live delivery tracking | `customer.delivery.track` |
| `/orders/:orderId/confirm` | Delivery confirmation | `customer.delivery.confirm` |
| `/orders/:orderId/review` | Rating/review | `customer.orders.view` |
| `/orders/:orderId/dispute` | Returns and disputes | `customer.disputes.create` |
| `/notifications` | Notifications | `customer.notifications.view` |
| `/addresses` | Saved addresses | `customer.profile.manage` |
| `/profile` | Profile | `customer.profile.manage` |
| `/profile/privacy` | Privacy settings | `customer.profile.manage` |

## 10. Route Guard Rules

- Public route нь auth шаардахгүй.
- Authenticated route бүр `requiredPermission` metadata-тэй байна.
- `PLATFORM_ADMIN` нь tenant context шаардахгүй platform route ашиглана.
- `STORE_ADMIN` route бүр active `tenant_id`-тай байна.
- `DELIVERY_EMPLOYEE` нь зөвхөн өөрт оноогдсон assignment болон tenant-ийн хүрээнд ажиллана.
- `CUSTOMER` нь зөвхөн өөрийн order/customer profile руу хандана.
- Backend API дээр route guard-оос гадна service-level ownership check заавал давхар байна.

## 11. API Namespace Plan

```text
/api/auth/*
/api/admin/*
/api/store/*
/api/courier/*
/api/customer/*
/api/webhooks/qpay
/api/realtime/*
```

Жишээ:

| API | Module | Auth |
|---|---|---|
| `POST /api/auth/login` | Auth | Public |
| `GET /api/admin/tenants` | Tenant | `platform.tenants.manage` |
| `POST /api/store/products` | Catalog | `store.products.manage` |
| `POST /api/store/orders/:id/assign` | Delivery | `store.deliveries.manage` |
| `POST /api/courier/jobs/:id/accept` | Delivery | `delivery.jobs.accept` |
| `POST /api/courier/jobs/:id/pickup` | Delivery | `delivery.pickup.verify` |
| `POST /api/customer/orders` | Order | `customer.orders.create` |
| `POST /api/customer/orders/:id/confirm` | Delivery | `customer.delivery.confirm` |
| `POST /api/webhooks/qpay` | Payment | Signature + idempotency |

## 12. MVP Implementation Order

1. Folder scaffold: `client`, `server`
2. PostgreSQL + Prisma setup
3. Auth, session, RBAC, tenant context
4. Platform admin tenant/subscription foundation
5. Store catalog, inventory, order
6. Customer catalog/cart/checkout
7. Delivery assignment and courier dashboard
8. Pickup QR/OTP, chain-of-custody evidence
9. GPS tracking and customer tracking page
10. QPay adapter, callback, payment reconciliation
11. Ledger, wallet, payout approval
12. Audit logs, reports, dispute workflow

## 13. Development Standards

- TypeScript strict mode enabled.
- Backend DTO validation with `class-validator` or Zod.
- API response contracts shared through `packages/shared`.
- Database migrations reviewed before deploy.
- Seed data for local development: platform admin, demo tenant, store admin, courier, customer.
- Unit tests for domain services.
- Integration tests for auth/RBAC/payment/order state transition.
- E2E smoke test for login, product create, order create, courier pickup, delivery confirmation.

## 14. Client Design Pending

Client-ийн visual design ирэхээр энэ blueprint дээрх URL/RBAC matrix-ийг route structure болгон буулгана. Design ирэх хүртэл frontend scaffold нь layout, route guard, API client, placeholder pages гэсэн түвшинд эхэлж болно.
