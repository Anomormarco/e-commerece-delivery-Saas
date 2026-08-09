import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import { resolve } from "node:path";
import { config } from "dotenv";

function findServerRoot() {
  const cwd = process.cwd();
  if (existsSync(resolve(cwd, "prisma/schema.prisma"))) return cwd;

  const serviceServerRoot = resolve(cwd, "../..");
  if (existsSync(resolve(serviceServerRoot, "prisma/schema.prisma"))) return serviceServerRoot;

  return resolve(cwd, "server");
}

function isStudioResponding(port) {
  return new Promise((resolveResponse) => {
    const request = http.get({ hostname: "127.0.0.1", port, path: "/", timeout: 1200 }, (response) => {
      response.resume();
      resolveResponse(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on("error", () => resolveResponse(false));
    request.on("timeout", () => {
      request.destroy();
      resolveResponse(false);
    });
  });
}

const serverRoot = findServerRoot();
const port = Number(process.env.PRISMA_STUDIO_PORT ?? 5555);

if (await isStudioResponding(port)) {
  console.log(`Prisma Studio is already up on http://localhost:${port}`);
  process.exit(0);
}

config({ path: resolve(serverRoot, ".env") });

const prismaCli = resolve(serverRoot, "../node_modules/prisma/build/index.js");
const result = spawnSync(
  process.execPath,
  [prismaCli, "studio", "--schema", resolve(serverRoot, "prisma/schema.prisma"), "--port", String(port), "--browser", "none"],
  {
    cwd: serverRoot,
    env: process.env,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
