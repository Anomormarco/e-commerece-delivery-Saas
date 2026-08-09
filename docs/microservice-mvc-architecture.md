# DeliverHub Microservice MVC Architecture

DeliverHub API is organized as microservice-ready bounded contexts. Each context owns its API routes, controllers, and services so it can later be extracted into a standalone service without changing the client contract.

## Server Layout

```text
server
  main.js                        Default API gateway bootstrap
  prisma/                        Prisma schema and seed data
  src/
    database/prisma.js           Shared database adapter
    platform/
      http/
        async-handler.js         Express async error wrapper
        create-service-app.js    Shared HTTP service factory
        request-context.js       Header/context extraction helpers
      runtime/
        start-service.js         Shared service process bootstrap
  services/
    gateway/
      main.js                    Standalone gateway entrypoint
      app.js                     API gateway composition
    admin-service/
      main.js                    Standalone admin-service entrypoint
      app/
        admin.app.js             Admin service HTTP app
      routes/
        admin.routes.js          Admin HTTP routes
      controllers/
        admin.controller.js      Admin request/response controller
      services/
        admin.service.js         Admin business/data logic
      repositories/
        admin.repository.js      Admin Prisma/data access
      utils/                     Admin-only helpers when needed
    store-service/
      main.js
      app/store.app.js
      routes/store.routes.js
      controllers/store.controller.js
      services/store.service.js
      repositories/store.repository.js
      utils/
    courier-service/
      main.js
      app/courier.app.js
      routes/courier.routes.js
      controllers/courier.controller.js
      services/courier.service.js
      repositories/courier.repository.js
      utils/
    customer-service/
      main.js
      app/customer.app.js
      routes/customer.routes.js
      controllers/customer.controller.js
      services/customer.service.js
      repositories/customer.repository.js
      utils/customer-formatting.js
```

## MVC Responsibility

| Layer | Responsibility |
|---|---|
| Route | Defines URL, HTTP method, middleware, and controller binding |
| Controller | Reads request context, calls one service method, returns HTTP response |
| Service | Owns business rules, DTO shaping, and domain decisions |
| Repository | Owns Prisma queries and database access for one service boundary |
| Utils | Small service-local formatting or helper functions |
| App | Creates one standalone HTTP server per bounded context |
| API Gateway | Composes or fronts service routes behind the current `/api/*` contract |

## Run Modes

| Command | Process | Port |
|---|---|---:|
| `npm run dev --workspace server` | API gateway service | `3000` |
| `npm run dev:admin --workspace server` | Standalone admin service | `3101` |
| `npm run dev:store --workspace server` | Standalone store service | `3102` |
| `npm run dev:courier --workspace server` | Standalone courier service | `3103` |
| `npm run dev:customer --workspace server` | Standalone customer service | `3104` |

## Extraction Path

The current implementation can run as one gateway-composed API, but each service boundary also has its own process entrypoint:

| Context | Current route prefix | Future service |
|---|---|---|
| Admin | `/api/admin/*` | `admin-service` |
| Store | `/api/store/*` | `store-service` |
| Courier | `/api/courier/*` | `courier-service` |
| Customer | `/api/customer/*` | `customer-service` |

When extracting, keep controllers and service logic intact, move the service boundary into its own package, and replace direct shared database access with service-owned database credentials or service-to-service APIs.
