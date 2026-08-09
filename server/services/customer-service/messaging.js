import { createEventBus } from "@deliverhub/server-platform/messaging/event-bus";

export const customerEventBus = createEventBus({ serviceName: "customer-service" });
