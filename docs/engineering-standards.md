# DeliverHub Engineering Standards

Version: v0.1  
Date: 2026-07-28

## Frontend

- React component дотор dashboard/order/tracking data hardcode хийхгүй.
- Page component нь hook ашиглаж API-аас data татна.
- Reusable component нь data-г зөвхөн props-оор авна.
- API байхгүй, data хоосон, эсвэл алдаа гарсан үед loading/error/empty state харуулна.
- Mock fallback ашиглахгүй. Seed/dev data хэрэгтэй бол backend database seed-ээр үүсгэнэ.
- UI дээр хэрэглэгчид харагдах бүх текст Монгол хэл дээр байна.
- Technical identifier (`RBAC`, `QPay`, permission code, API path) code хэлбэрээр үлдэж болно.

## Current Frontend Structure

```text
client/src/
  App.tsx
  components/
  features/
    admin/
    store/
    courier/
    customer/
    public/
    navigation/
  shared/
    api.ts
    types.ts
    useApiResource.ts
```

## Backend

- Backend нь modular monolith байна.
- Module бүр өөрийн service layer-тэй байна.
- Controller/route layer нь request/response routing л хийнэ.
- Business/data logic service дотор байна.
- Service нь Prisma-гаар PostgreSQL-оос уншина.
- Dashboard response hardcode хийхгүй.
- RBAC, tenant ownership, user ownership шалгалт backend дээр заавал хийгдэнэ.

## Current Backend Structure

```text
server/src/
  main.ts
  database/
    prisma.ts
  modules/
    admin/
    store/
    courier/
    customer/
    dashboard/
```

## API Contract Direction

Frontend одоо дараах endpoint-уудыг ашиглана:

```text
GET /api/admin/dashboard
GET /api/store/dashboard
GET /api/courier/dashboard
GET /api/customer/orders/current/tracking
```

Жинхэнэ auth/tenant context орох хүртэл request header дээр:

```text
x-tenant-id
x-user-id
```

ашиглаж түр context дамжуулна. Production дээр secure session/JWT-аас context уншина.
