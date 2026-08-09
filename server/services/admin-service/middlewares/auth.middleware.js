import { verifyJwt } from "@deliverhub/server-platform/http/jwt";

function bearerTokenFromRequest(request) {
  const authorization = request.header("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : "";
}

function rolesFromRequest(request) {
  return (request.header("x-role") ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

function createHttpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function devHeaderAuthFromRequest(request) {
  if (process.env.ALLOW_DEV_AUTH_HEADERS !== "true") return null;
  const userId = request.header("x-user-id") ?? "";
  if (!userId) return null;
  return {
    userId,
    tenantId: request.header("x-tenant-id") ?? "",
    token: "",
    roles: rolesFromRequest(request),
    strategy: "dev-headers",
  };
}

export function optionalAuth(request, _response, next) {
  const token = bearerTokenFromRequest(request);
  const devAuth = devHeaderAuthFromRequest(request);

  request.auth = {
    userId: "",
    tenantId: "",
    token,
    roles: [],
    strategy: "anonymous",
  };

  if (token) {
    try {
      const payload = verifyJwt(token);
      request.auth = {
        userId: String(payload.sub ?? ""),
        tenantId: String(payload.tenantId ?? ""),
        token,
        roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [],
        strategy: "jwt",
        payload,
      };
    } catch (error) {
      next(error);
      return;
    }
  } else if (devAuth) {
    request.auth = devAuth;
  }

  next();
}

export function requireAuth(request, _response, next) {
  if (!request.auth) optionalAuth(request, _response, () => {});
  if (!request.auth.userId) return next(createHttpError(401, "Нэвтрэх шаардлагатай.", "UNAUTHENTICATED"));
  return next();
}

