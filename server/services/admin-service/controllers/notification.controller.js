import {
  listNotificationsForRole,
  markNotificationsReadForRole,
} from "@deliverhub/server-platform/notifications/notification-center";

export async function listAdminNotifications(_request, response) {
  response.json(await listNotificationsForRole("admin"));
}

export async function markAdminNotificationsRead(_request, response) {
  response.json(await markNotificationsReadForRole("admin"));
}
