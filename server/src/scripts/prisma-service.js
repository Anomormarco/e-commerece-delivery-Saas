import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

const prismaCli = resolve(process.cwd(), "../../../node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
