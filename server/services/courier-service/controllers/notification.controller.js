import {
  listNotificationsForRole,
  markNotificationsReadForRole,
} from "@deliverhub/server-platform/notifications/notification-center";

export async function listCourierNotifications(_request, response) {
  response.json(await listNotificationsForRole("courier"));
}

export async function markCourierNotificationsRead(_request, response) {
  response.json(await markNotificationsReadForRole("courier"));
}
