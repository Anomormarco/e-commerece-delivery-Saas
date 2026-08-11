import { spawnSync } from "node:child_process";
import { resolveVercelMode } from "./vercel-mode.mjs";

const mode = resolveVercelMode();
const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;
const currentSha = process.env.VERCEL_GIT_COMMIT_SHA || "HEAD";

if (mode === "courier") {
  console.log("[deliverhub] courier: employee app deploys every commit.");
  process.exit(1);
}

const modeSpecificPaths = {
  admin: [
    "client/src/apps/admin/",
    "client/src/features/admin/",
  ],
  store: [
    "client/src/apps/store/",
    "client/src/features/store/",
    "client/src/shared/nominCatalog",
  ],
  courier: [
    "client/src/apps/courier/",
    "client/src/features/courier/",
  ],
  customer: [
    "client/src/features/customer/",
  ],
  public: [
    "client/src/features/public/",
    "client/public/",
  ],
};

const sharedPaths = [
  "client/package.json",
  "client/package-lock.json",
  "client/index.html",
  "client/vite.config",
  "client/tsconfig",
  "client/vercel.json",
  "client/scripts/",
  "client/src/main",
  "client/src/App",
  "client/src/components/",
  "client/src/shared/",
  "client/src/styles.css",
  "package.json",
  "package-lock.json",
  "vercel.json",
];

const publicSharedPaths = [
  "client/package.json",
  "client/package-lock.json",
  "client/index.html",
  "client/vercel.json",
  "client/scripts/",
  "client/src/apps/public/",
  "client/src/main",
  "client/src/App",
  "package.json",
  "package-lock.json",
  "vercel.json",
];

function changedFiles() {
  if (!previousSha) return null;
  const result = spawnSync("git", ["diff", "--name-only", previousSha, currentSha], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function pathMatches(file, prefixes) {
  return prefixes.some((prefix) => file === prefix || file.startsWith(prefix));
}

const files = changedFiles();

if (!files) {
  console.log(`[deliverhub] ${mode}: no previous commit found, building.`);
  process.exit(1);
}

const relevantPrefixes = mode === "public"
  ? [...publicSharedPaths, ...modeSpecificPaths.public]
  : [...sharedPaths, ...(modeSpecificPaths[mode] ?? modeSpecificPaths.public)];
const shouldBuild = files.some((file) => pathMatches(file, relevantPrefixes));

if (shouldBuild) {
  console.log(`[deliverhub] ${mode}: relevant change found, building.`);
  process.exit(1);
}

console.log(`[deliverhub] ${mode}: no relevant changes, skipping deploy.`);
process.exit(0);
