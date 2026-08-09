import { cp, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const backupRoot = resolve(projectRoot, "backups/source");
const backupId = process.argv[2];
const confirmed = process.argv.includes("--yes");

function usage() {
  console.log("Usage: node server/src/scripts/restore-source.js <backup-id|latest> --yes");
}

async function resolveBackupId(id) {
  if (id === "latest") {
    return (await readFile(resolve(backupRoot, "latest.txt"), "utf8")).trim();
  }
  return id;
}

if (!backupId) {
  usage();
  process.exitCode = 1;
} else if (!confirmed) {
  console.log("Restore is protected. Add --yes to overwrite current source files from backup.");
  usage();
  process.exitCode = 1;
} else {
  const resolvedId = await resolveBackupId(backupId);
  const backupPath = resolve(backupRoot, resolvedId);
  const entries = await readdir(backupPath).catch(() => null);

  if (!entries) {
    console.error(`Backup not found: ${resolvedId}`);
    process.exitCode = 1;
  } else {
    for (const entry of entries) {
      if (entry === "backup-manifest.json") continue;
      await cp(resolve(backupPath, entry), resolve(projectRoot, entry), {
        recursive: true,
        force: true,
      });
    }
    console.log(`Source restored from backups/source/${resolvedId}`);
  }
}
