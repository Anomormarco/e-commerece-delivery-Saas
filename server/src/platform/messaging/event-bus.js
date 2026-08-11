const defaultEventEndpoints = [
  "http://127.0.0.1:3101/internal/events",
  "http://127.0.0.1:3102/internal/events",
  "http://127.0.0.1:3103/internal/events",
  "http://127.0.0.1:3104/internal/events",
];

function eventEndpointsFromEnv() {
  const raw = process.env.MQ_EVENT_ENDPOINTS ?? "";
  return raw
    ? raw.split(",").map((endpoint) => endpoint.trim()).filter(Boolean)
    : defaultEventEndpoints;
}

function createEventId(serviceName) {
  return `${serviceName}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let rabbitChannelPromise;

async function rabbitChannel() {
  if (!process.env.RABBITMQ_URL) return null;
  if (rabbitChannelPromise) return rabbitChannelPromise;

  rabbitChannelPromise = import("amqplib")
    .then(async ({ default: amqp }) => {
      const connection = await amqp.connect(process.env.RABBITMQ_URL);
      const channel = await connection.createChannel();
      await channel.assertExchange(process.env.RABBITMQ_EXCHANGE ?? "deliverhub.events", "topic", { durable: true });
      return channel;
    })
    .catch((error) => {
      rabbitChannelPromise = null;
      console.warn(`[event-bus] RabbitMQ connection failed: ${error.message}`);
      return null;
    });

  return rabbitChannelPromise;
}

async function publishRabbitEvent(event) {
  const channel = await rabbitChannel();
  if (!channel) return;

  channel.publish(
    process.env.RABBITMQ_EXCHANGE ?? "deliverhub.events",
    event.type,
    Buffer.from(JSON.stringify(event)),
    {
      contentType: "application/json",
      deliveryMode: 2,
      messageId: event.id,
      timestamp: Math.floor(Date.now() / 1000),
    },
  );
}

async function subscribeRabbitEvents({ serviceName, patterns, handler }) {
  const channel = await rabbitChannel();
  if (!channel) return null;

  const queueName = process.env.RABBITMQ_QUEUE_PREFIX
    ? `${process.env.RABBITMQ_QUEUE_PREFIX}.${serviceName}`
    : `${serviceName}.events`;

  await channel.assertQueue(queueName, { durable: true });
  for (const pattern of patterns) {
    await channel.bindQueue(queueName, process.env.RABBITMQ_EXCHANGE ?? "deliverhub.events", pattern);
  }

  await channel.consume(queueName, async (message) => {
    if (!message) return;
    try {
      const event = JSON.parse(message.content.toString("utf8"));
      await handler(event);
      channel.ack(message);
    } catch (error) {
      console.warn(`[${serviceName}] RabbitMQ event consume failed: ${error.message}`);
      channel.nack(message, false, false);
    }
  });

  console.log(`[${serviceName}] RabbitMQ queue bound: ${queueName} -> ${patterns.join(", ")}`);
  return queueName;
}

export function internalEventSecret() {
  return process.env.INTERNAL_EVENT_SECRET ?? "deliverhub-local-events";
}

export function requireInternalEvent(request, _response, next) {
  const token = request.header("x-internal-event-secret") ?? "";

  if (token !== internalEventSecret()) {
    const error = new Error("Internal event permission denied.");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    next(error);
    return;
  }

  next();
}

export function createEventBus({ serviceName, endpoints = eventEndpointsFromEnv() }) {
  async function publish(type, payload = {}) {
    const event = {
      id: createEventId(serviceName),
      type,
      source: serviceName,
      occurredAt: new Date().toISOString(),
      payload,
    };

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-internal-event-secret": internalEventSecret(),
    };

    const results = await Promise.allSettled([
      publishRabbitEvent(event),
      ...endpoints.map((endpoint) =>
        fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(event),
        }),
      ),
    ]);

    for (const [index, result] of results.slice(1).entries()) {
      if (result.status === "rejected") {
        console.warn(`[${serviceName}] MQ event send failed: ${endpoints[index]}`, result.reason?.message ?? result.reason);
      }
    }

    return event;
  }

  function publishSoon(type, payload = {}) {
    void publish(type, payload);
  }

  function subscribe(patterns, handler) {
    if (!process.env.RABBITMQ_URL) return null;
    const patternList = Array.isArray(patterns) ? patterns : [patterns];
    return subscribeRabbitEvents({ serviceName, patterns: patternList, handler });
  }

  return { publish, publishSoon, subscribe };
}
