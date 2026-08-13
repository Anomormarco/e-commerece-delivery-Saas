import { apiErrorMessage } from "./errors";

const roleApiModes = ["admin", "store", "courier", "customer"];
const mode = import.meta.env.MODE;
const productionGatewayUrl = "https://deliverhub-gateway.onrender.com/api";
const localGatewayUrl = "http://127.0.0.1:3000/api";
const defaultGatewayUrl = import.meta.env.PROD ? productionGatewayUrl : localGatewayUrl;
const defaultApiBaseUrl = roleApiModes.includes(mode) ? `${defaultGatewayUrl}/${mode}` : defaultGatewayUrl;
function enforceSecureUrl(url: string) {
  if (!import.meta.env.PROD) return url;
  if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) return defaultApiBaseUrl;
  return url.replace(/^http:\/\//, "https://");
}

function enforceSecureRealtimeUrl(url: string) {
  if (!import.meta.env.PROD) return url;
  const fallback = defaultRealtimeBaseUrls[mode] ?? "";
  if (url.startsWith("ws://localhost") || url.startsWith("ws://127.0.0.1")) return fallback;
  return url.replace(/^http:\/\//, "https://").replace(/^ws:\/\//, "wss://");
}

const API_BASE_URL = enforceSecureUrl(import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl);
const accessTokenStorageKeys: Record<string, string> = {
  admin: "deliverhub-admin-access-token",
  courier: "deliverhub-courier-access-token",
};

const defaultRealtimeBaseUrls: Record<string, string> = {
  admin: import.meta.env.PROD ? "wss://deliverhub-admin-service.onrender.com/realtime" : "ws://127.0.0.1:3101/realtime",
  store: import.meta.env.PROD ? "wss://deliverhub-store-service.onrender.com/realtime" : "ws://127.0.0.1:3102/realtime",
  courier: import.meta.env.PROD ? "wss://deliverhub-courier-service.onrender.com/realtime" : "ws://127.0.0.1:3103/realtime",
  customer: import.meta.env.PROD ? "wss://deliverhub-customer-service.onrender.com/realtime" : "ws://127.0.0.1:3104/realtime",
};

export const REALTIME_URL = enforceSecureRealtimeUrl(import.meta.env.VITE_REALTIME_URL ?? defaultRealtimeBaseUrls[mode] ?? "");

function currentAccessToken() {
  const storageKey = accessTokenStorageKeys[mode];
  return storageKey ? localStorage.getItem(storageKey) ?? sessionStorage.getItem(storageKey) : null;
}

export function saveAccessToken(token: string, remember = false) {
  const storageKey = accessTokenStorageKeys[mode];
  if (!storageKey) return;
  const targetStorage = remember ? localStorage : sessionStorage;
  const otherStorage = remember ? sessionStorage : localStorage;
  targetStorage.setItem(storageKey, token);
  otherStorage.removeItem(storageKey);
}

export function clearAccessToken() {
  const storageKey = accessTokenStorageKeys[mode];
  if (!storageKey) return;
  localStorage.removeItem(storageKey);
  sessionStorage.removeItem(storageKey);
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = currentAccessToken();

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Сервертэй холбогдож чадсангүй. Local server-үүд ассан эсэхийг шалгана уу.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(apiErrorMessage(body, response.status));
  }

  return response.json() as Promise<T>;
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return requestJson<T>(path, { signal });
}

export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}
