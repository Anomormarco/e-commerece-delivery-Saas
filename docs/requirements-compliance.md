# DeliverHub requirements compliance

Last checked: 2026-08-04

## Covered

- Core PostgreSQL/Prisma schema covers tenants, users, roles, stores, branches, products, orders, delivery assignments, OTP/evidence, tracking, wallet, ledger, audit, subscriptions, tariffs, and disputes.
- Admin login/register flow uses username/password, cookie session, protected dashboard, logout, and editable profile.
- Store admin has login/register UI, dashboard shell, product/order/report sections, dark/light mode, and API-backed dashboard data.
- Public landing page is React-based and includes the 3D delivery scene.
- Courier and customer pages now use Mongolian UI text and gateway API URLs.

## Improved in this pass

- Fixed malformed Prisma schema header so `prisma validate` passes.
- Fixed courier/customer API base URLs to use the gateway at `http://127.0.0.1:3000`.
- Added courier backend actions:
  - `POST /api/courier/status`
  - `POST /api/courier/jobs/:assignmentId/accept`
- Courier accept now uses a transaction and only accepts an `OFFERED` assignment with `employeeId: null`, preventing duplicate assignment.
- Courier cannot switch offline while an active delivery is assigned.
- Fixed mojibake fallback API and page error text.

## Partial or still missing

- Full JWT access/refresh rotation is not implemented yet; admin currently uses a cookie session.
- QPay, webhook idempotency, payout approval, and full ledger reconciliation need production handlers.
- Store product/order CRUD UI is partly static and needs full create/update/delete API wiring.
- Customer public store page `/store/{slug}`, QR order entry, and SMS deep-link tracking need full implementation.
- Courier route map, real-time location streaming, OTP pickup/drop-off verification, cancellation policy, and wallet payout flow need full workflow endpoints.
- Admin CRUD for subscriptions, tariffs, disputes, payouts, audit filters, and employee verification is not fully wired.
- Automated tests for RBAC isolation, order flow, courier race conditions, and payment idempotency are still needed.
