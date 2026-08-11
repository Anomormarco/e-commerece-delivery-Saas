import { createNotificationFromEvent } from "@deliverhub/server-platform/notifications/notification-center";
import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import { broadcastStoreDashboardRefresh, broadcastStoreNotificationsUpdated } from "../socket.js";

export async function handleStoreEvent(event = {}) {
  appCache.clearByPrefix("store:dashboard:");

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
}

export async function receiveInternalEvent(request, response) {
  const event = request.body ?? {};
  await handleStoreEvent(event);

  response.json({ ok: true, service: "store-service", eventId: event.id });
}
