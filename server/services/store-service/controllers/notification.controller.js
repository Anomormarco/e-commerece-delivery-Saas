import {
  listNotificationsForRole,
  markNotificationsReadForRole,
} from "@deliverhub/server-platform/notifications/notification-center";

export async function listStoreNotifications(_request, response) {
  response.json(await listNotificationsForRole("store"));
}

export async function markStoreNotificationsRead(_request, response) {
  response.json(await markNotificationsReadForRole("store"));
}
