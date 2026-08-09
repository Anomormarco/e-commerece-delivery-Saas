import { createRealtimeSocket } from "@deliverhub/server-platform/realtime/websocket";

export const customerSocket = createRealtimeSocket({
  serviceName: "customer-service",
  heartbeatEvent: "customer.tracking.refresh",
});

export function broadcastCustomerTrackingRefresh(data = {}) {
  customerSocket.broadcast("customer.tracking.refresh", data);
}

export function broadcastCustomerNotificationsUpdated(data = {}) {
  customerSocket.broadcast("notifications.updated", data);
}
