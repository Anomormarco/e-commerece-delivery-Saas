import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const backupRoot = resolve(projectRoot, "backups/source");
const maxBackups = Number(process.env.SOURCE_BACKUP_KEEP ?? 30);

const excludedDirectories = new Set([
  ".git",
  ".vite",
  "backups",
  "coverage",
  "dist",
  "node_modules",
]);

const excludedExtensions = new Set([
  ".log",
  ".tmp",
]);

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function isExcluded(pathname) {
  const relativePath = relative(projectRoot, pathname);
  if (!relativePath || relativePath.startsWith("..")) return false;

  const parts = relativePath.split(sep);
  if (parts.some((part) => excludedDirectories.has(part))) return true;
  if (excludedExtensions.has(pathname.slice(pathname.lastIndexOf(".")))) return true;
  return false;
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (isExcluded(fullPath)) continue;

    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function sha256(pathname) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, reject) => {
    createReadStream(pathname)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", resolvePromise);
  });
  return hash.digest("hex");
}

async function latestBackupManifestHash() {
  try {
    const latestPath = resolve(backupRoot, "latest.txt");
    const latestId = (await readFile(latestPath, "utf8")).trim();
    const manifest = JSON.parse(await readFile(resolve(backupRoot, latestId, "backup-manifest.json"), "utf8"));
    return manifest.projectHash ?? "";
  } catch {
    return "";
  }
}

async function removeOldBackups() {
  const entries = await readdir(backupRoot, { withFileTypes: true }).catch(() => []);
  const backups = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const backup of backups.slice(maxBackups)) {
    await rm(resolve(backupRoot, backup), { recursive: true, force: true });
  }
}

export async function createSourceBackup({ reason = "manual" } = {}) {
  await mkdir(backupRoot, { recursive: true });

  const files = await walkFiles(projectRoot);
  const manifestFiles = [];

  for (const file of files) {
    const fileStat = await stat(file);
    manifestFiles.push({
      path: relative(projectRoot, file).replaceAll("\\", "/"),
      size: fileStat.size,
      sha256: await sha256(file),
    });
  }

  manifestFiles.sort((left, right) => left.path.localeCompare(right.path));
  const projectHash = createHash("sha256")
    .update(JSON.stringify(manifestFiles))
    .digest("hex");

  if (projectHash === await latestBackupManifestHash()) {
    console.log(`[backup] source unchanged, latest backup is still valid (${projectHash.slice(0, 12)})`);
    return null;
  }

  const backupId = timestamp();
  const backupPath = resolve(backupRoot, backupId);

  for (const file of files) {
    const relativePath = relative(projectRoot, file);
    await mkdir(resolve(backupPath, dirname(relativePath)), { recursive: true });
    await cp(file, resolve(backupPath, relativePath));
  }

  const manifest = {
    backupId,
    reason,
    projectRoot,
    projectHash,
    createdAt: new Date().toISOString(),
    files: manifestFiles,
  };

  await writeFile(resolve(backupPath, "backup-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(backupRoot, "latest.txt"), `${backupId}\n`);
  await removeOldBackups();

  console.log(`[backup] source backup created: backups/source/${backupId}`);
  return { backupId, backupPath, manifest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await createSourceBackup({ reason: process.argv[2] ?? "manual" });
}
