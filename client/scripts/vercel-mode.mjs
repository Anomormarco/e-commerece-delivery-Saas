export function projectHintFromEnv(env = process.env) {
  return [
    env.DELIVERHUB_APP_MODE,
    env.VITE_DELIVERHUB_APP_MODE,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
    env.VERCEL_GIT_REPO_SLUG,
    env.VERCEL_PROJECT_ID,
    env.npm_package_name,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function modeFromProjectHint(hint) {
  if (hint.includes("store")) return "store";
  if (hint.includes("employee") || hint.includes("courier")) return "courier";
  if (hint.includes("customer")) return "customer";
  if (hint.includes("admin")) return "admin";
  return "public";
}

export function resolveVercelMode(env = process.env) {
  const explicitMode = env.DELIVERHUB_APP_MODE || env.VITE_DELIVERHUB_APP_MODE || "";
  return explicitMode || modeFromProjectHint(projectHintFromEnv(env));
}
