// One-off: give every store's tenant an ACTIVE subscription that ends exactly
// N days from now (default 300), so the store + admin dashboards show "paid".
// Usage: node scripts/backfill-subscriptions.mjs [days]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DAYS = Math.max(1, Number(process.argv[2] || 300));

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const p of [path.join(ROOT, "server/.env"), path.join(ROOT, ".env")]) {
    try {
      const m = fs.readFileSync(p, "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\n\r]+)"?/m);
      if (m) return m[1].trim();
    } catch {}
  }
  throw new Error("DATABASE_URL not found");
}

const PLAN_CODE = "store-monthly-50000";
const PLAN_NAME = "Store monthly";
const PLAN_PRICE = 50000;

const u = new URL(databaseUrl());
const client = new pg.Client({
  host: u.hostname,
  port: u.port ? Number(u.port) : 5432,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
});

function cuid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

try {
  await client.connect();

  const planRes = await client.query(`SELECT id FROM "subscription_plans" WHERE code = $1`, [PLAN_CODE]);
  let planId = planRes.rows[0]?.id;
  if (!planId) {
    planId = cuid("plan_");
    await client.query(
      `INSERT INTO "subscription_plans" (id, code, name, "monthlyPriceMnt", "maxStoreUsers", "maxCouriers", "maxMonthlyOrders", features, "isActive")
       VALUES ($1,$2,$3,$4,5,10,500,$5,true)`,
      [planId, PLAN_CODE, PLAN_NAME, PLAN_PRICE, JSON.stringify({ dashboard: true, orders: true, products: true, delivery: true })],
    );
    console.log(`created plan ${PLAN_CODE}`);
  }

  const tenants = await client.query(
    `SELECT DISTINCT t.id, t.name FROM "tenants" t JOIN "stores" s ON s."tenantId" = t.id ORDER BY t.name`,
  );
  console.log(`${tenants.rows.length} store tenants -> ${DAYS} days remaining`);

  const now = new Date();
  const endsAt = new Date(now.getTime() + DAYS * 24 * 60 * 60 * 1000);

  let done = 0;
  for (const t of tenants.rows) {
    await client.query("BEGIN");
    try {
      await client.query(`UPDATE "tenants" SET status = 'ACTIVE', "updatedAt" = now() WHERE id = $1`, [t.id]);
      await client.query(`DELETE FROM "subscriptions" WHERE "tenantId" = $1`, [t.id]);
      await client.query(
        `INSERT INTO "subscriptions" (id, "tenantId", "planId", status, "startsAt", "endsAt", "createdAt")
         VALUES ($1,$2,$3,'ACTIVE',$4,$5, now())`,
        [cuid("sub_"), t.id, planId, now.toISOString(), endsAt.toISOString()],
      );
      await client.query("COMMIT");
      done += 1;
      console.log(`  ✓ ${t.name}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  ✗ ${t.name}: ${err.message}`);
    }
  }

  console.log(`\nDone. ${done}/${tenants.rows.length} tenants ACTIVE until ${endsAt.toISOString().slice(0, 10)} (${DAYS} days).`);
} catch (err) {
  console.error("FAILED:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
