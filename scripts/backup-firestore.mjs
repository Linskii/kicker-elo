/**
 * Firestore backup script — dumps users, matches, seasons, and config to a local JSON file.
 *
 * Usage:
 *   1. Download service account key from Firebase Console →
 *      Project Settings → Service Accounts → Generate new private key
 *      Save as `serviceAccount.json` in the project root (it's gitignored)
 *   2. Run:
 *      node --experimental-vm-modules scripts/backup-firestore.mjs
 *      (or with nvm:  nvm use 22 && node scripts/backup-firestore.mjs)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, "../serviceAccount.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
} catch {
  console.error("❌  Could not read serviceAccount.json");
  console.error("    Download it from Firebase Console → Project Settings → Service Accounts");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function dumpCollection(name) {
  const snap = await db.collection(name).get();
  const docs = {};
  snap.forEach((d) => {
    docs[d.id] = d.data();
  });
  console.log(`  ✓ ${name}: ${snap.size} documents`);
  return docs;
}

async function main() {
  console.log("📦  Starting Firestore backup...\n");

  const backup = {
    timestamp: new Date().toISOString(),
    collections: {},
  };

  backup.collections.users   = await dumpCollection("users");
  backup.collections.matches = await dumpCollection("matches");
  backup.collections.seasons = await dumpCollection("seasons");

  // Config is a single doc, not a real collection — handle separately
  const configSnap = await db.collection("config").get();
  backup.collections.config = {};
  configSnap.forEach((d) => { backup.collections.config[d.id] = d.data(); });
  console.log(`  ✓ config: ${configSnap.size} documents`);

  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const outPath = join(__dirname, "../" + filename);
  writeFileSync(outPath, JSON.stringify(backup, null, 2));

  console.log(`\n✅  Backup saved to: ${filename}`);
  console.log(`    Users backed up: ${Object.keys(backup.collections.users).length}`);
}

main().catch((err) => {
  console.error("❌  Backup failed:", err.message);
  process.exit(1);
});
