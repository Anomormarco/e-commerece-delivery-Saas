# DeliverHub RBAC UI Pages

Version: v0.1  
Date: 2026-07-28

## Rule

UI-г нэг дор холихгүй. Requirement-ийн 4 actor тус бүр өөрийн route shell, navigation, permission scope, workflow-той байна.

UI дээр хэрэглэгчид харагдах бүх текст Монгол хэл дээр бичигдэнэ. Role/permission code зэрэг системийн identifier-ууд code хэлбэрээр үлдэж болно.

| Actor | Prototype route | Production route group | Permission scope |
|---|---|---|---|
| Platform Admin | `http://127.0.0.1:5174` | `http://127.0.0.1:3101/api/admin/*` | `platform.*` |
| Store Owner/Admin | `http://127.0.0.1:5175` | `http://127.0.0.1:3102/api/store/*` | `store.*` |
| Delivery Employee | `http://127.0.0.1:5176` | `http://127.0.0.1:3103/api/courier/*` | `delivery.*` |
| Customer/User | `http://127.0.0.1:5177` | `http://127.0.0.1:3104/api/customer/*` | `customer.*` |

Public landing remains separate:

| Route | Purpose |
|---|---|
| `http://127.0.0.1:5173` | Landing, pricing entry, store signup, courier signup |

## Current Prototype Pages

### Platform Admin App

Platform-wide dashboard. Shows:

- tenant/verification queue
- platform delivery metrics
- payment/provider alerts
- audit/risk oriented sidebar

This page must not include customer order tracking UI or courier job acceptance UI.

### Store Owner App

Tenant-scoped store owner dashboard. Shows:

- orders
- dispatch board
- live delivery map
- employee verification review
- pickup confirmation action

This page only sees the active tenant's data.

### Delivery Employee App

Mobile-first delivery employee app. Shows:

- online/offline status
- nearby pickup jobs
- assigned delivery context
- identity/face/location status
- accept job action

This page only sees jobs available or assigned to the courier.

### Customer App

Customer tracking/order experience. Shows:

- tracking tabs
- order receipt
- delivery timeline
- courier information
- masked call action
- live location card
- secret delivery code

This page only sees the logged-in customer's own orders.

## Frontend Guard Plan

Every route must have metadata:

```ts
type RouteMeta = {
  path: string;
  role: "PLATFORM_ADMIN" | "STORE_ADMIN" | "DELIVERY_EMPLOYEE" | "CUSTOMER" | "PUBLIC";
  requiredPermission: string;
  tenantScoped: boolean;
};
```

Backend authorization is still mandatory. Frontend guards are UX only.
