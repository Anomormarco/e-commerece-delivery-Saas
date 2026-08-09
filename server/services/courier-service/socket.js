import { createRealtimeSocket } from "@deliverhub/server-platform/realtime/websocket";

export const courierSocket = createRealtimeSocket({
  serviceName: "courier-service",
  heartbeatEvent: "courier.dashboard.refresh",
});

export function broadcastCourierDashboardRefresh(data = {}) {
  courierSocket.broadcast("courier.dashboard.refresh", data);
}

export function broadcastCourierJobUpdate(data = {}) {
  courierSocket.broadcast("courier.job.updated", data);
}

export function broadcastCourierNotificationsUpdated(data = {}) {
  courierSocket.broadcast("notifications.updated", data);
}
