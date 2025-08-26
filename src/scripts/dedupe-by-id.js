#!/usr/bin/env node
/**
 * Firestore de-duplication by "id" (fallback placeId/place_id).
 * Dry-run by default. Use --apply to delete.
 *
 * New flags:
 *   --whoami            Print resolved project info and list top-level collections
 *   --collectionGroup   Use a collection group query (e.g. ideas subcollections)
 */
const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const admin = require("firebase-admin");

function initFirebase(argv) {
  if (argv.credentials) {
    const p = path.resolve(process.cwd(), argv.credentials);
    const raw = fs.readFileSync(p, "utf8");
    const json = JSON.parse(raw);
    console.log(`🔐 Using credentials: ${p}`);
    console.log(`   project_id: ${json.project_id}`);
    admin.initializeApp({ credential: admin.credential.cert(json), projectId: json.project_id });
  } else if (!admin.apps.length) {
    admin.initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS
  }
}

function toMillisMaybe(t) {
  if (!t) return undefined;
  if (typeof t.toMillis === "function") return t.toMillis();
  const d = new Date(t);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function extractTime(docSnap, timeField) {
  const data = docSnap.data() || {};
  return (
    toMillisMaybe(data?.[timeField]) ??
    docSnap.updateTime?.toMillis?.() ??
    docSnap.createTime?.toMillis?.() ??
    Date.now()
  );
}

function pickWinner(a, b, keep) {
  if (keep === "oldest") return a.time <= b.time ? a : b;
  return a.time >= b.time ? a : b;
}

function groupKey(data) {
  const val = data?.id ?? data?.placeId ?? data?.place_id ?? "__undefined__";
  return String(val);
}

async function listTopCollections(db, limit = 25) {
  const cols = await db.listCollections();
  return cols.slice(0, limit).map((c) => c.id);
}

async function scan(db, argv) {
  const hasWhere = argv.whereField && argv.whereOp && typeof argv.whereValue !== "undefined";
  if (argv.collectionGroup) {
    let q = db.collectionGroup(argv.collectionGroup);
    if (hasWhere) q = q.where(argv.whereField, argv.whereOp, argv.whereValue);
    if (argv.limit) q = q.limit(Number(argv.limit));
    console.log(`🔎 collectionGroup("${argv.collectionGroup}")${hasWhere ? ` where ${argv.whereField} ${argv.whereOp} ${JSON.stringify(argv.whereValue)}` : ""}`);
    return await q.get();
  } else {
    let q = db.collection(argv.collection);
    if (hasWhere) q = q.where(argv.whereField, argv.whereOp, argv.whereValue);
    if (argv.limit) q = q.limit(Number(argv.limit));
    console.log(`🔎 collection("${argv.collection}")${hasWhere ? ` where ${argv.whereField} ${argv.whereOp} ${JSON.stringify(argv.whereValue)}` : ""}`);
    return await q.get();
  }
}

async function maybeBackfillIds(db, snap, apply) {
  const toUpdate = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (!d.id && (d.placeId || d.place_id)) {
      toUpdate.push({ ref: doc.ref, newId: String(d.placeId || d.place_id) });
    }
  }
  if (!toUpdate.length) return { updated: 0 };

  console.log(`🩹 Missing id backfill candidates: ${toUpdate.length}`);
  if (!apply) {
    console.log("   (dry-run) Would set id from placeId/place_id. Use --apply to write.");
    return { updated: 0, candidates: toUpdate.length };
  }
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += 400) {
    const batch = db.batch();
    for (const u of toUpdate.slice(i, i + 400)) batch.update(u.ref, { id: u.newId });
    await batch.commit();
    updated += Math.min(400, toUpdate.length - i);
    console.log(`   …backfilled id on ${updated}/${toUpdate.length}`);
  }
  return { updated };
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("collection", { type: "string", describe: "Top-level collection (e.g., ideas)" })
    .option("collectionGroup", { type: "string", describe: "Collection group name (e.g., ideas)" })
    .conflicts("collection", "collectionGroup")
    .option("whoami", { type: "boolean", default: false, describe: "Print project/collections and exit" })
    .option("apply", { type: "boolean", default: false })
    .option("force", { type: "boolean", default: false })
    .option("batchSize", { type: "number", default: 300 })
    .option("timeField", { type: "string", default: "updatedAt" })
    .option("keep", { choices: ["newest", "oldest"], default: "newest" })
    .option("whereField", { type: "string" })
    .option("whereOp", { type: "string" })
    .option("whereValue", {})
    .option("limit", { type: "number", describe: "Limit documents scanned (debugging)" })
    .option("fixId", { type: "boolean", default: false })
    .option("credentials", { type: "string" })
    .demandOption(["collection"], "Provide --collection or use --collectionGroup")
    .help()
    .strict()
    .parse();

  initFirebase(argv);
  const db = admin.firestore();

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    admin.app().options.projectId ||
    "(unknown)";

  console.log(
    `\n🧭 Project="${projectId}" | key=id (fallback placeId/place_id) | keep=${argv.keep} | timeField=${argv.timeField} | mode=${argv.apply ? "APPLY" : "DRY-RUN"}`
  );

  if (argv.whoami) {
    const cols = await listTopCollections(db);
    console.log(`📚 Top-level collections (${cols.length > 25 ? "first 25" : cols.length} shown): ${cols.join(", ") || "(none)"}`);
    console.log("ℹ️  If your data is in subcollections, use --collectionGroup=<name>.");
    return;
  }

  const snap = await scan(db, argv);
  console.log(`📄 Fetched ${snap.size} docs`);

  if (argv.fixId) {
    const res = await maybeBackfillIds(db, snap, argv.apply);
    console.log(argv.apply ? `✅ backfilled id on ${res.updated} docs` : "📝 backfill simulated (dry-run)");
  }

  console.log("🔗 Grouping by id (with placeId/place_id fallback)...");
  const groups = new Map();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const k = groupKey(data);
    const time = extractTime(doc, argv.timeField);
    const entry = { id: doc.id, ref: doc.ref, data, time };
    if (!groups.has(k)) groups.set(k, [entry]);
    else groups.get(k).push(entry);
  }

  let dupGroups = 0;
  const deletions = [];
  for (const [k, arr] of groups.entries()) {
    if (!k || k === "__undefined__") continue;
    if (arr.length <= 1) continue;
    dupGroups += 1;
    let winner = arr[0];
    for (let i = 1; i < arr.length; i++) winner = pickWinner(winner, arr[i], argv.keep);
    for (const doc of arr) if (doc.id !== winner.id) deletions.push(doc);
  }

  console.log(`\n📊 Duplicate groups (id): ${dupGroups} | Docs to delete: ${deletions.length}`);
  if (deletions.length) {
    console.log("🧪 Sample deletions:");
    deletions.slice(0, 10).forEach((d) =>
      console.log(`  - ${argv.collection || argv.collectionGroup}/${d.id}  (key=${groupKey(d.data)}, time=${new Date(d.time).toISOString()})`)
    );
  }

  if (!argv.apply) {
    console.log(`\n✅ Dry-run complete. Re-run with --apply to delete. (--force to skip prompt)`);
    return;
  }

  if (!argv.force) {
    const readline = require("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const confirm = await new Promise((res) =>
      rl.question(`\n⚠️ This will delete ${deletions.length} docs. Type "DELETE" to proceed: `, res)
    );
    rl.close();
    if (confirm.trim() !== "DELETE") {
      console.log("❎ Aborted.");
      return;
    }
  }

  const batchSize = Math.max(1, Math.min(500, argv.batchSize || 300));
  console.log(`\n🚀 Deleting in batches of ${batchSize}…`);
  let deleted = 0;
  while (deleted < deletions.length) {
    const batch = db.batch();
    const chunk = deletions.slice(deleted, deleted + batchSize);
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
    deleted += chunk.length;
    console.log(`   …deleted ${deleted}/${deletions.length}`);
  }

  console.log(`\n🎉 Done. Deleted ${deletions.length} docs.`);
}

main().catch((err) => {
  console.error("❌ Failed:", err?.stack || err?.message || String(err));
  process.exit(1);
});
