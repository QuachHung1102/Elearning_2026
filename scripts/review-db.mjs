// Isolated local review database. Uses the PGlite packages already installed
// transitively with Prisma; this never connects to a remote database.
import { readdir, readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const store = resolve(root, "node_modules/.pnpm");
const entries = await readdir(store);
async function installed(name) {
  const prefix = name.replace("/", "+") + "@";
  const folder = entries.find((entry) => entry.startsWith(prefix));
  if (!folder)
    throw new Error(name + " is not installed. Run pnpm install first.");
  return import(
    pathToFileURL(resolve(store, folder, "node_modules", name, "dist/index.js"))
      .href
  );
}
const { PGlite } = await installed("@electric-sql/pglite");
const { PGLiteSocketServer } = await installed("@electric-sql/pglite-socket");
await mkdir(resolve(root, ".local-review"), { recursive: true });
const db = await PGlite.create(resolve(root, ".local-review/database"));
await db.exec(
  "CREATE TABLE IF NOT EXISTS codingbuddy_review_migrations (name TEXT PRIMARY KEY)",
);
const migrationRoot = resolve(root, "apps/api/prisma/migrations");
for (const name of (await readdir(migrationRoot))
  .filter((name) => /^\d/.test(name))
  .sort()) {
  const applied = await db.query(
    "SELECT name FROM codingbuddy_review_migrations WHERE name = $1",
    [name],
  );
  if (applied.rows.length) continue;
  await db.exec(
    await readFile(resolve(migrationRoot, name, "migration.sql"), "utf8"),
  );
  await db.query(
    "INSERT INTO codingbuddy_review_migrations (name) VALUES ($1)",
    [name],
  );
  console.log("Applied local migration: " + name);
}
const server = new PGLiteSocketServer({
  db,
  host: "127.0.0.1",
  port: 55435,
  maxConnections: 30,
});
await server.start();
console.log("CodingBuddy local review database ready on 127.0.0.1:55435");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
