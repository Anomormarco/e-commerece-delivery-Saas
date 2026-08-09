import { createNotificationFromEvent } from "@deliverhub/server-platform/notifications/notification-center";
import { broadcastAdminDashboardRefresh, broadcastAdminNotificationsUpdated } from "../socket.js";

export async function receiveInternalEvent(request, response) {
  const event = request.body ?? {};
  await createNotificationFromEvent("admin", event).catch((error) => {
    console.warn("[admin-service] notification create failed", error.message);
  });

  broadcastAdminDashboardRefresh({
    action: event.type,
    eventId: event.id,
    source: event.source,
    ...(event.payload ?? {}),
  });
  broadcastAdminNotificationsUpdated({ eventId: event.id, action: event.type });

  response.json({ ok: true, service: "admin-service", eventId: event.id });
}
