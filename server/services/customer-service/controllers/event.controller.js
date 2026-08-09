import { createNotificationFromEvent } from "@deliverhub/server-platform/notifications/notification-center";
import { broadcastCustomerNotificationsUpdated, broadcastCustomerTrackingRefresh } from "../socket.js";

export async function receiveInternalEvent(request, response) {
  const event = request.body ?? {};
  await createNotificationFromEvent("customer", event).catch((error) => {
    console.warn("[customer-service] notification create failed", error.message);
  });

  broadcastCustomerTrackingRefresh({
    action: event.type,
    eventId: event.id,
    source: event.source,
    ...(event.payload ?? {}),
  });
  broadcastCustomerNotificationsUpdated({ eventId: event.id, action: event.type });

  response.json({ ok: true, service: "customer-service", eventId: event.id });
}
