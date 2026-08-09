export function tenantIdFromRequest(request) {
  return request.auth?.tenantId ?? request.header("x-tenant-id") ?? "";
}

export function userIdFromRequest(request) {
  return request.auth?.userId ?? request.header("x-user-id") ?? "";
}

export function authFromRequest(request) {
  return request.auth ?? {
    tenantId: tenantIdFromRequest(request),
    userId: userIdFromRequest(request),
    token: "",
    roles: [],
    strategy: "anonymous",
  };
}

