import { createServiceApp } from "@deliverhub/server-platform/http/create-service-app";
import { errorHandler, notFoundMiddleware } from "./middlewares/error-handler.middleware.js";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware.js";

const upstreams = {
  admin: process.env.ADMIN_SERVICE_URL ?? "http://127.0.0.1:3101",
  store: process.env.STORE_SERVICE_URL ?? "http://127.0.0.1:3102",
  courier: process.env.COURIER_SERVICE_URL ?? "http://127.0.0.1:3103",
  customer: process.env.CUSTOMER_SERVICE_URL ?? "http://127.0.0.1:3104",
};

const skippedProxyHeaders = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "expect",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function isCourierSessionRequest(request) {
  const path = request.originalUrl.split("?")[0];
  return (
    (request.method === "GET" && path === "/api/courier/dashboard")
    || (request.method === "POST" && path === "/api/courier/status")
  );
}

function fallbackCourierDashboard(online = true) {
  return {
    online,
    expectedEarningMnt: "0",
    employeeName: "Хүргэлтийн ажилтан",
    vehicleType: "WALK",
    vehicleLabel: "Явган хүргэлт",
    jobs: [],
    verificationText: "Dashboard мэдээлэл түр уншигдсангүй. Дахин шинэчилнэ үү.",
    verificationStatus: "ACTIVE",
    degraded: true,
  };
}

function fallbackCourierSession(request) {
  const requestedOnline = typeof request.body?.online === "boolean" ? request.body.online : true;
  return fallbackCourierDashboard(request.method === "POST" ? requestedOnline : true);
}

function setResponseHeaders(response, upstreamResponse) {
  const setCookies = typeof upstreamResponse.headers.getSetCookie === "function"
    ? upstreamResponse.headers.getSetCookie()
    : [];

  for (const [name, value] of upstreamResponse.headers.entries()) {
    const headerName = name.toLowerCase();
    if (skippedProxyHeaders.has(headerName) || headerName === "set-cookie") continue;
    response.setHeader(name, value);
  }

  if (setCookies.length) {
    response.setHeader("set-cookie", setCookies);
    return;
  }

  const setCookie = upstreamResponse.headers.get("set-cookie");
  if (setCookie) response.setHeader("set-cookie", setCookie);
}

function createProxyHandler(upstreamUrl) {
  return async (request, response, next) => {
    try {
      const target = new URL(request.originalUrl, upstreamUrl);
      const headers = new Headers();

      for (const [name, value] of Object.entries(request.headers)) {
        if (value === undefined || skippedProxyHeaders.has(name.toLowerCase())) continue;
        headers.set(name, Array.isArray(value) ? value.join(",") : value);
      }

      const upstreamResponse = await fetch(target, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : JSON.stringify(request.body ?? {}),
      });

      if (isCourierSessionRequest(request) && upstreamResponse.status >= 500) {
        console.error("[api-gateway] courier session upstream failed", {
          method: request.method,
          path: request.originalUrl,
          status: upstreamResponse.status,
          upstream: target.toString(),
        });
        response.status(200).json(fallbackCourierSession(request));
        return;
      }

      response.status(upstreamResponse.status);
      setResponseHeaders(response, upstreamResponse);
      response.send(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch (error) {
      if (isCourierSessionRequest(request)) {
        console.error("[api-gateway] courier session proxy fallback", {
          method: request.method,
          path: request.originalUrl,
          message: error?.message,
          code: error?.code,
        });
        response.status(200).json(fallbackCourierSession(request));
        return;
      }

      next(error);
    }
  };
}

export function createApiGatewayApp() {
  const app = createServiceApp({
    serviceName: "api-gateway",
    registerRoutes: (app) => {
      app.use(rateLimitMiddleware());

      app.use("/api/admin", createProxyHandler(upstreams.admin));
      app.use("/api/store", createProxyHandler(upstreams.store));
      app.use("/api/courier", createProxyHandler(upstreams.courier));
      app.use("/api/customer", createProxyHandler(upstreams.customer));

      app.get("/api/health", (_request, response) => {
        response.json({
          ok: true,
          service: "api-gateway",
          upstreams,
        });
      });
    },
  });

  app.use(notFoundMiddleware);
  app.use(errorHandler);

  return app;
}

export default createApiGatewayApp;
