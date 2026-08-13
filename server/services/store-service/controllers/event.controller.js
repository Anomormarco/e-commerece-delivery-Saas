import { createNotificationFromEvent } from "@deliverhub/server-platform/notifications/notification-center";
import { appCache } from "@deliverhub/server-platform/cache/memory-cache";
import { broadcastStoreDashboardRefresh, broadcastStoreNotificationsUpdated } from "../socket.js";

export async function handleStoreEvent(event = {}) {
  if (event.type === "courier.location.updated" && event.payload?.employeeId) {
    const lat = Number(event.payload.lat);
    const lng = Number(event.payload.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      await appCache.set(`courier:live-location:${event.payload.employeeId}`, {
        lat,
        lng,
        userId: event.payload.userId ?? null,
        updatedAt: event.payload.updatedAt ?? new Date().toISOString(),
      }, 60_000);
    }
  }

  appCache.clearByPrefix("store:dashboard:");

  if (event.type !== "courier.location.updated") {
    await createNotificationFromEvent("store", event).catch((error) => {
      console.warn("[store-service] notification create failed", error.message);
    });
  }

  broadcastStoreDashboardRefresh({
    action: event.type,
    eventId: event.id,
    source: event.source,
    ...(event.payload ?? {}),
  });
  if (event.type !== "courier.location.updated") {
    broadcastStoreNotificationsUpdated({ eventId: event.id, action: event.type });
  }
}

export async function receiveInternalEvent(request, response) {
  const event = request.body ?? {};
  await handleStoreEvent(event);

  response.json({ ok: true, service: "store-service", eventId: event.id });
}
