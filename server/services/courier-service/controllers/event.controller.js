import { createNotificationFromEvent } from "@deliverhub/server-platform/notifications/notification-center";
import { broadcastCourierDashboardRefresh, broadcastCourierJobUpdate, broadcastCourierNotificationsUpdated } from "../socket.js";

const jobEvents = new Set([
  "delivery.request.created",
  "delivery.job.accepted",
  "delivery.job.arrived_store",
  "delivery.job.pickup_verified",
  "delivery.job.arrived_dropoff",
  "delivery.job.dropoff_verified",
]);

export async function handleCourierEvent(event = {}) {
  if (event.type !== "courier.location.updated") {
    await createNotificationFromEvent("courier", event).catch((error) => {
      console.warn("[courier-service] notification create failed", error.message);
    });
  }
  const payload = {
    action: event.type,
    eventId: event.id,
    source: event.source,
    ...(event.payload ?? {}),
  };

  if (jobEvents.has(event.type)) {
    broadcastCourierJobUpdate(payload);
  } else {
    broadcastCourierDashboardRefresh(payload);
  }
  if (event.type !== "courier.location.updated") {
    broadcastCourierNotificationsUpdated({ eventId: event.id, action: event.type });
  }
}

export async function receiveInternalEvent(request, response) {
  const event = request.body ?? {};
  await handleCourierEvent(event);

  response.json({ ok: true, service: "courier-service", eventId: event.id });
}
