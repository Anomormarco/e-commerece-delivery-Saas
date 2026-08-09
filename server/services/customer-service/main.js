import { startService } from "@deliverhub/server-platform/runtime/start-service";
import { createCustomerServiceApp } from "./app/customer.app.js";
import { customerSocket } from "./socket.js";

startService({
  app: createCustomerServiceApp(),
  serviceName: "customer-service",
  port: Number(process.env.PORT ?? process.env.CUSTOMER_SERVICE_PORT ?? 3104),
  onUpgrade: customerSocket.handleUpgrade,
});
