import { createNotificationFromEvent } from "@deliverhub/server-platform/notifications/notification-center";
import { broadcastStoreDashboardRefresh, broadcastStoreNotificationsUpdated } from "../socket.js";

export async function receiveInternalEvent(request, response) {
  const event = request.body ?? {};
  await createNotificationFromEvent("store", event).catch((error) => {
    console.warn("[store-service] notification create failed", error.message);
  });

  broadcastStoreDashboardRefresh({
    action: event.type,
    eventId: event.id,
    source: event.source,
    ...(event.payload ?? {}),
  });
  broadcastStoreNotificationsUpdated({ eventId: event.id, action: event.type });

  response.json({ ok: true, service: "store-service", eventId: event.id });
}
