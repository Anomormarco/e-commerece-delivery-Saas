import { startService } from "@deliverhub/server-platform/runtime/start-service";
import { createStoreServiceApp } from "./app/store.app.js";
import { storeSocket } from "./socket.js";

startService({
  app: createStoreServiceApp(),
  serviceName: "store-service",
  port: Number(process.env.STORE_SERVICE_PORT ?? 3102),
  onUpgrade: storeSocket.handleUpgrade,
});
