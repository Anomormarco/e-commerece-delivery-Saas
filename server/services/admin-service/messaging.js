import { createEventBus } from "@deliverhub/server-platform/messaging/event-bus";

export const adminEventBus = createEventBus({ serviceName: "admin-service" });
