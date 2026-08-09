import { useEffect, useState } from "react";
import { REALTIME_URL } from "./api";
import { useApiResource } from "./useApiResource";
import type { ApiState } from "./types";

type RealtimeMessage = {
  event?: string;
  service?: string;
  timestamp?: string;
};

type RealtimeState<T> = ApiState<T> & {
  live: boolean;
  lastEvent: string | null;
  refetch: () => Promise<T | null>;
};

export function useRealtimeResource<T>(path: string, events: string[]): RealtimeState<T> {
  const resource = useApiResource<T>(path) as ApiState<T> & { refetch: () => Promise<T | null> };
  const { refetch } = resource;
  const [live, setLive] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const eventKey = events.join("|");

  useEffect(() => {
    if (!REALTIME_URL) return;

    let closed = false;
    let retryId = 0;
    let socket: WebSocket | null = null;

    function connect() {
      socket = new WebSocket(REALTIME_URL);

      socket.addEventListener("open", () => setLive(true));
      socket.addEventListener("message", (message) => {
        const payload = JSON.parse(String(message.data)) as RealtimeMessage;
        if (!payload.event || !eventKey.split("|").includes(payload.event)) return;

        setLastEvent(payload.event);
        void refetch();
      });
      socket.addEventListener("close", () => {
        setLive(false);
        if (!closed) retryId = window.setTimeout(connect, 1800);
      });
      socket.addEventListener("error", () => setLive(false));
    }

    connect();

    return () => {
      closed = true;
      window.clearTimeout(retryId);
      socket?.close();
    };
  }, [eventKey, refetch]);

  return { data: resource.data, loading: resource.loading, error: resource.error, live, lastEvent, refetch };
}
