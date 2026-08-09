import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createSourceBackup } from "./backup-source.js";

const services = [
  { name: "gateway", cwd: "server/services/gateway", port: 3000, command: process.execPath, args: ["--watch", "main.js"] },
  { name: "admin-api", cwd: "server/services/admin-service", port: 3101, command: process.execPath, args: ["--watch", "main.js"] },
  { name: "store-api", cwd: "server/services/store-service", port: 3102, command: process.execPath, args: ["--watch", "main.js"] },
  { name: "courier-api", cwd: "server/services/courier-service", port: 3103, command: process.execPath, args: ["--watch", "main.js"] },
  { name: "customer-api", cwd: "server/services/customer-service", port: 3104, command: process.execPath, args: ["--watch", "main.js"] },
  { name: "admin-ui", cwd: ".", port: 5174, command: "npm", args: ["run", "dev:admin", "--workspace", "client"] },
  { name: "store-ui", cwd: ".", port: 5175, command: "npm", args: ["run", "dev:store", "--workspace", "client"] },
  { name: "courier-ui", cwd: ".", port: 5176, command: "npm", args: ["run", "dev:courier", "--workspace", "client"] },
  { name: "customer-ui", cwd: ".", port: 5177, command: "npm", args: ["run", "dev:customer", "--workspace", "client"] },
];

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const children = new Map();
let shuttingDown = false;

await createSourceBackup({ reason: "before-dev-start" }).catch((error) => {
  console.warn(`[backup] skipped: ${error.message}`);
});

function prefixOutput(serviceName, stream, chunk) {
  String(chunk)
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((line) => stream.write(`[${serviceName}] ${line}\n`));
}

function stopChild(child) {
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }

  child.kill("SIGTERM");
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nStopping DeliverHub services...");

  for (const child of children.values()) {
    stopChild(child);
  }
}

function isPortOpen(port) {
  return new Promise((resolvePort) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolvePort(true);
    });
    socket.once("error", () => resolvePort(false));
    socket.setTimeout(700, () => {
      socket.destroy();
      resolvePort(false);
    });
  });
}

async function startService(service) {
  if (await isPortOpen(service.port)) {
    console.log(`[${service.name}] already running on port ${service.port}`);
    return;
  }

  const child = spawn(service.command, service.args, {
    cwd: resolve(projectRoot, service.cwd),
    env: process.env,
    shell: process.platform === "win32" && service.command === "npm",
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.set(service.name, child);
  console.log(`[${service.name}] starting on port ${service.port} from ${service.cwd}`);
  child.stdout.on("data", (chunk) => prefixOutput(service.name, process.stdout, chunk));
  child.stderr.on("data", (chunk) => prefixOutput(service.name, process.stderr, chunk));
  child.on("error", (error) => {
    console.error(`[${service.name}] failed to start: ${error.message}`);
    shutdown();
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    children.delete(service.name);
    if (!shuttingDown && code !== 0) {
      console.error(`[${service.name}] exited with ${signal ?? `code ${code}`}`);
      shutdown();
      process.exitCode = code ?? 1;
    }
  });
}

for (const service of services) {
  await startService(service);
}

if (!children.size) {
  console.log("All DeliverHub dev services are already running.");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
