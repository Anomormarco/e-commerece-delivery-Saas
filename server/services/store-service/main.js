import { startService } from "@deliverhub/server-platform/runtime/start-service";
import { createStoreServiceApp } from "./app/store.app.js";
import { handleStoreEvent } from "./controllers/event.controller.js";
import { storeEventBus } from "./messaging.js";
import { storeSocket } from "./socket.js";

startService({
  app: createStoreServiceApp(),
  serviceName: "store-service",
  port: Number(process.env.PORT ?? process.env.STORE_SERVICE_PORT ?? 3102),
  onUpgrade: storeSocket.handleUpgrade,
});

storeEventBus.subscribe?.([
  "order.paid",
  "order.status.updated",
  "delivery.request.created",
  "delivery.job.accepted",
  "delivery.job.rejected",
  "delivery.job.arrived_store",
  "delivery.job.pickup_verified",
  "delivery.job.dropoff_verified",
  "courier.location.updated",
], handleStoreEvent);
