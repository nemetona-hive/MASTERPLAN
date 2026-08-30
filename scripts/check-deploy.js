"use strict";

// Answers "is what I have online?" by fetching the deployed version.js and
// comparing its build id to the local one.
//
// Because the id is a content hash of the served files, a match is proof the
// live bytes are the local bytes — not an inference from a date. A mismatch
// says nothing about *which* is newer: Pages may still be building, or the
// working tree may have moved on since the last push.

const fs = require("fs");
const path = require("path");
const { buildId } = require("./build-version.js");

const ROOT = path.resolve(__dirname, "..");
const SITE = process.env.MASTERPLAN_SITE || "https://nemetona-hive.github.io/MASTERPLAN";
const TIMEOUT_MS = 15000;

/** Pull the id out of a version.js without evaluating it. */
function parseId(source) {
  const m = source.match(/const BUILD = \{ id: "([0-9a-f]+)" \}/);
  return m ? m[1] : null;
}

async function main() {
  // The local id is recomputed rather than read out of version.js, so an
  // uncommitted rebuild cannot make a stale file look current.
  const local = buildId();
  const committed = fs.existsSync(path.join(ROOT, "version.js"))
    ? parseId(fs.readFileSync(path.join(ROOT, "version.js"), "utf8"))
    : null;

  if (committed !== local) {
    process.stdout.write(
      `!  version.js is stale — it says ${committed || "nothing"}, the tree hashes to ${local}.\n` +
      `   Run 'npm run build' and commit the result before comparing to the live site.\n`);
    process.exitCode = 1;
    return;
  }

  const url = `${SITE.replace(/\/$/, "")}/version.js`;
  let live;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    live = parseId(await res.text());
  } catch (err) {
    process.stdout.write(`?  Could not read ${url} — ${err.message}\n`);
    process.exitCode = 2;
    return;
  }

  if (!live) {
    process.stdout.write(`?  ${url} carries no build id. A deploy older than versioning would look like this.\n`);
    process.exitCode = 2;
    return;
  }

  if (live === local) {
    process.stdout.write(`OK live matches local — ${local}\n`);
    return;
  }

  process.stdout.write(
    `X  live is ${live}, local is ${local}\n` +
    `   Either the push has not deployed yet (Pages takes a minute), or there are\n` +
    `   local commits still to push.\n`);
  process.exitCode = 1;
}

main();
