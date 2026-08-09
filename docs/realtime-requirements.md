# Realtime Requirements

## Functional Requirements

- Admin dashboard must receive live refresh signals for platform dashboard changes.
- Store dashboard must receive live refresh signals when delivery requests or order-facing state changes.
- Courier dashboard must receive live refresh signals for online status, verification changes, and job state changes.
- Customer tracking must receive live refresh signals for order and courier tracking changes.
- Each service owns its own `/realtime` WebSocket endpoint and `socket.js` entry.
- UI pages refetch their existing REST resource after a matching realtime event.

## Non-Functional Requirements

- WebSocket ownership stays inside each microservice boundary.
- REST remains the source of truth; sockets only notify clients to refresh.
- Socket disconnects must clean up server-side clients.
- Browser reconnect should happen automatically after transient disconnects.
- Docker is intentionally out of scope for this change.

## Local Socket URLs

- Admin: `ws://127.0.0.1:3101/realtime`
- Store: `ws://127.0.0.1:3102/realtime`
- Courier: `ws://127.0.0.1:3103/realtime`
- Customer: `ws://127.0.0.1:3104/realtime`
