import { createEventBus } from "@deliverhub/server-platform/messaging/event-bus";

export const storeEventBus = createEventBus({ serviceName: "store-service" });
