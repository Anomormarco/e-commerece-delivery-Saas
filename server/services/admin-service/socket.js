import { createRealtimeSocket } from "@deliverhub/server-platform/realtime/websocket";

export const adminSocket = createRealtimeSocket({
  serviceName: "admin-service",
  heartbeatEvent: "admin.dashboard.refresh",
});

export function broadcastAdminDashboardRefresh(data = {}) {
  adminSocket.broadcast("admin.dashboard.refresh", data);
}

export function broadcastAdminNotificationsUpdated(data = {}) {
  adminSocket.broadcast("notifications.updated", data);
}
