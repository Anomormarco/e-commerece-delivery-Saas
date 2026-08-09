import { createEventBus } from "@deliverhub/server-platform/messaging/event-bus";

export const courierEventBus = createEventBus({ serviceName: "courier-service" });
