import { createHash } from "node:crypto";

const websocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function websocketAcceptKey(key) {
  return createHash("sha1").update(`${key}${websocketGuid}`).digest("base64");
}

function encodeFrame(payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const header = body.length < 126 ? Buffer.from([0x81, body.length]) : Buffer.from([0x81, 126, body.length >> 8, body.length & 255]);
  return Buffer.concat([header, body]);
}

export function createRealtimeSocket({ serviceName, heartbeatEvent, heartbeatMs = 15000 }) {
  const clients = new Set();

  function broadcast(event, data = {}) {
    const frame = encodeFrame({
      event,
      service: serviceName,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const socket of clients) {
      if (socket.destroyed) {
        clients.delete(socket);
        continue;
      }

      socket.write(frame);
    }
  }

  function handleUpgrade(request, socket) {
    if (request.url !== "/realtime") return false;

    const key = request.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return true;
    }

    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${websocketAcceptKey(key)}`,
        "",
        "",
      ].join("\r\n"),
    );

    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
    socket.on("data", (chunk) => {
      const opcode = chunk[0] & 0x0f;
      if (opcode === 0x08) {
        clients.delete(socket);
        socket.end(Buffer.from([0x88, 0x00]));
      }
    });
    broadcast("connection.ready", { clients: clients.size });
    return true;
  }

  const heartbeat = setInterval(() => broadcast(heartbeatEvent, { reason: "heartbeat" }), heartbeatMs);
  heartbeat.unref?.();

  return {
    broadcast,
    handleUpgrade,
  };
}
