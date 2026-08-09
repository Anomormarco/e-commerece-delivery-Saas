import {
  listNotificationsForRole,
  markNotificationsReadForRole,
} from "@deliverhub/server-platform/notifications/notification-center";

export async function listCustomerNotifications(_request, response) {
  response.json(await listNotificationsForRole("customer"));
}

export async function markCustomerNotificationsRead(_request, response) {
  response.json(await markNotificationsReadForRole("customer"));
}
