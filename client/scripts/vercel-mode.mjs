export function projectHintFromEnv(env = process.env) {
  return [
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
    env.VERCEL_PROJECT_NAME,
    env.VERCEL_GIT_REPO_SLUG,
    env.VERCEL_PROJECT_ID,
    env.npm_package_name,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function modeFromProjectHint(hint) {
  if (hint.includes("employee") || hint.includes("courier")) return "courier";
  if (hint.includes("store")) return "store";
  if (hint.includes("customer")) return "customer";
  if (hint.includes("admin")) return "admin";
  return "";
}

export function resolveVercelMode(env = process.env) {
  const projectMode = modeFromProjectHint(projectHintFromEnv(env));
  if (projectMode) return projectMode;

  const explicitMode = env.DELIVERHUB_APP_MODE || env.VITE_DELIVERHUB_APP_MODE || "";
  return explicitMode || "public";
}
