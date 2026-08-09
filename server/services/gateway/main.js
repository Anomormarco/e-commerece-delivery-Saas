import { startService } from "@deliverhub/server-platform/runtime/start-service";
import { createApiGatewayApp } from "./app.js";

startService({
  app: createApiGatewayApp(),
  serviceName: "api-gateway",
  port: Number(process.env.PORT ?? 3000),
});
