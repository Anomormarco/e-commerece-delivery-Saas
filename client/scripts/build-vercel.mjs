import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientDir = join(scriptDir, "..");
const repoDir = join(clientDir, "..");

const explicitMode = process.env.DELIVERHUB_APP_MODE || process.env.VITE_DELIVERHUB_APP_MODE || "";
const projectHint = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL,
  process.env.VERCEL_GIT_REPO_SLUG,
  process.env.npm_package_name,
].filter(Boolean).join(" ").toLowerCase();

function modeFromProjectHint(hint) {
  if (hint.includes("store")) return "store";
  if (hint.includes("employee") || hint.includes("courier")) return "courier";
  if (hint.includes("customer")) return "customer";
  if (hint.includes("admin")) return "admin";
  return "public";
}

const mode = explicitMode || modeFromProjectHint(projectHint);

function binPath(packageName, binaryPath) {
  const candidates = [
    join(clientDir, "node_modules", packageName, binaryPath),
    join(repoDir, "node_modules", packageName, binaryPath),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    console.error(`[deliverhub] Missing ${packageName}. Run npm install from the repository root.`);
    process.exit(1);
  }
  return found;
}

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`[deliverhub] Vercel build mode: ${mode}`);
run([binPath("typescript", "bin/tsc"), "-b"]);
run([binPath("vite", "bin/vite.js"), "build", "--mode", mode, "--outDir", "dist"]);
