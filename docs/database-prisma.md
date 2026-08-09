# DeliverHub PostgreSQL + Prisma Setup

Version: v0.1  
Date: 2026-07-28

## Current Database

Render PostgreSQL database:

- Name: `DeliveryHubSaas`
- PostgreSQL: `18`
- Region: Singapore

Do not commit the database password or connection URL.

## Files

| File | Purpose |
|---|---|
| `server/prisma/schema.prisma` | Main database entity schema |
| `server/prisma/seed.ts` | Initial RBAC permissions, roles, Starter plan |
| `server/.env.example` | Example database URL only |

## Local Secret

Create `server/.env` locally:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

Use Render's **External Database URL** for local development. The internal hostname only works from Render services.

## Commands

```bash
npm install
npm run db:validate
npm run db:generate
npm run db:push
npm run db:seed --workspace server
```

## Entity Coverage

The first schema covers:

- tenant and subscription
- users, sessions, trusted devices
- RBAC roles and permissions
- identity and face verification
- store, branch, warehouse
- catalog and inventory
- customer, cart, order
- order status history
- delivery assignment, pickup, handover, tracking
- QPay invoice/transaction/refund
- double-entry ledger
- courier wallet and payout
- notification, dispute, attachment, audit log, risk event

## Important Production Rules

- All tenant-owned data must include `tenant_id`.
- Money is stored as `BigInt` MNT values, not JavaScript floating numbers.
- Payment callback and delivery verification flows must be idempotent.
- Audit logs are append-only.
- Customer, courier, store, and platform admin UI/API boundaries remain separated by RBAC.
