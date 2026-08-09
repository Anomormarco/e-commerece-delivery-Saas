import { startService } from "@deliverhub/server-platform/runtime/start-service";
import { createCourierServiceApp } from "./app/courier.app.js";
import { courierSocket } from "./socket.js";

startService({
  app: createCourierServiceApp(),
  serviceName: "courier-service",
  port: Number(process.env.COURIER_SERVICE_PORT ?? 3103),
  onUpgrade: courierSocket.handleUpgrade,
});
