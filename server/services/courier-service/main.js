import { startService } from "@deliverhub/server-platform/runtime/start-service";
import { createCourierServiceApp } from "./app/courier.app.js";
import { handleCourierEvent } from "./controllers/event.controller.js";
import { courierEventBus } from "./messaging.js";
import { courierSocket } from "./socket.js";

startService({
  app: createCourierServiceApp(),
  serviceName: "courier-service",
  port: Number(process.env.PORT ?? process.env.COURIER_SERVICE_PORT ?? 3103),
  onUpgrade: courierSocket.handleUpgrade,
});

courierEventBus.subscribe?.([
  "delivery.request.created",
  "delivery.job.accepted",
  "delivery.job.rejected",
  "delivery.job.arrived_store",
  "delivery.job.pickup_verified",
  "delivery.job.dropoff_verified",
  "courier.location.updated",
], handleCourierEvent);
