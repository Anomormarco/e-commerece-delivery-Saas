import { createRealtimeSocket } from "@deliverhub/server-platform/realtime/websocket";

export const storeSocket = createRealtimeSocket({
  serviceName: "store-service",
  heartbeatEvent: "store.dashboard.refresh",
});

export function broadcastStoreDashboardRefresh(data = {}) {
  storeSocket.broadcast("store.dashboard.refresh", data);
}

export function broadcastStoreNotificationsUpdated(data = {}) {
  storeSocket.broadcast("notifications.updated", data);
}
