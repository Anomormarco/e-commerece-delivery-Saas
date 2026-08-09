import { startService } from "@deliverhub/server-platform/runtime/start-service";
import { createAdminServiceApp } from "./app/admin.app.js";
import { adminSocket } from "./socket.js";

startService({
  app: createAdminServiceApp(),
  serviceName: "admin-service",
  port: Number(process.env.ADMIN_SERVICE_PORT ?? 3101),
  onUpgrade: adminSocket.handleUpgrade,
});
