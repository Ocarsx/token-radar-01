// token-radar-01 v2 — entrypoint (Node 22, standard library only).
// Reads /input/snapshot.json, ranks the pre-token protocols by implied value,
// writes /output/board.json, the dashboard data, copies dashboard/ and
// screenshots/, and writes /output/dossier.json via buildDossier.
// Fully deterministic: no clocks, no randomness, no network.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildDossier } from "./vendor/makefun-board.ts";
import {
  buildModel,
  isEligible,
  farmSteps,
  topComparables,
  type Snapshot,
  type Proto,
} from "./lib/model.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));

function arg(name: string, fallback: string): string {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name && i + 1 < argv.length) return argv[i + 1];
    if (argv[i].startsWith(name + "=")) return argv[i].slice(name.length + 1);
  }
  return fallback;
}

const inputPath = arg("--input", process.env.MAKEFUN_INPUT_DIR ? join(process.env.MAKEFUN_INPUT_DIR, "snapshot.json") : "/input/snapshot.json");
const outDir =
  process.env.MAKEFUN_OUTPUT_DIR ?? arg("--output", "/output");

const snap: Snapshot = JSON.parse(readFileSync(inputPath, "utf8"));
const model = buildModel(snap);

const eligible: Proto[] = snap.protocols.filter(isEligible);
const watch = new Set(snap.watchlist);

// Rank by implied value, ties broken by TVL then slug so the order is total.
const ranked = [...eligible]
  .map((p) => ({ p, v: model.impliedOf(p) }))
  .sort((a, b) => b.v - a.v || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1));

const rows = ranked.map(({ p, v }, i) => ({
  slug: p.slug,
  name: p.name,
  rank: i + 1,
  implied_value_usd: v,
  farm_steps: farmSteps(p),
  category: p.category,
  chains: p.chains,
  tvl_usd: p.tvl_usd,
  change_7d: p.change_7d,
  listed_at: p.listed_at,
  watchlist: watch.has(p.slug),
  ratio: Number(model.ratioOf(p).toFixed(6)),
  growth_factor: Number(model.growthOf(p).toFixed(6)),
  age_factor: Number(model.ageOf(p).toFixed(6)),
  concentration: Number(model.concentrationOf(p).toFixed(6)),
}));

const comps = topComparables(snap, 12);

// --- output ---------------------------------------------------------------
// Clear the output dir's contents, never the dir itself: on the grader
// /output's parent is read-only, so removing /output fails (EPERM).
if (existsSync(outDir)) for (const e of readdirSync(outDir)) rmSync(join(outDir, e), { recursive: true, force: true });
mkdirSync(join(outDir, "dashboard"), { recursive: true });
mkdirSync(join(outDir, "screenshots"), { recursive: true });

writeFileSync(
  join(outDir, "board.json"),
  JSON.stringify(
    {
      title: "Token Radar — pre-token protocols by implied launch value",
      model:
        "implied = TVL x ratio x growth x age x concentration; ratio is a size-aware multiple fitted by OLS on log10(mcap/TVL) vs log10(TVL) over the token-bearing comparables, bent by the category median (n>=3, shrunk); growth = 1 + clamp(change_7d,-30,100)/200; age = 0.70 + 0.15*min(years listed,4); concentration = 1 for the top 2 of a category by TVL, else 1.5/(k+1).",
      as_of: snap.as_of,
      floor_usd: snap.floor_usd,
      rows,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

// Dashboard data: rows as compact arrays so the dossier text stays whole.
// [slug, name, category, primaryChain, tvl, change_7d, listed_at, implied,
//  rank, watchlist, ratio, growth, age, concentration]
const dataRows = rows.map((r) => [
  r.slug,
  r.name,
  r.category,
  r.chains.length > 0 ? r.chains[0] : "Ethereum",
  r.tvl_usd,
  r.change_7d,
  r.listed_at,
  r.implied_value_usd,
  r.rank,
  r.watchlist ? 1 : 0,
  r.ratio,
  r.growth_factor,
  r.age_factor,
  r.concentration,
]);
const dataJs =
  "const DATA = " +
  JSON.stringify({
    meta: {
      asOf: snap.as_of,
      floorUsd: snap.floor_usd,
      nRows: rows.length,
      nEligible: eligible.length,
      nWatchlist: snap.watchlist.length,
      nComparables: model.meta.nComparables,
      fitA: Number(model.meta.fitA.toFixed(6)),
      fitB: Number(model.meta.fitB.toFixed(6)),
      globalMedian: Number(model.meta.globalMedian.toFixed(6)),
      model: "v2",
    },
    rows: dataRows,
    comps: comps.map((c) => [c.slug, c.category, c.tvl_usd, c.mcap_usd]),
  }) +
  ";\n";

// Copy the static dashboard files, then add the generated data.
for (const f of ["index.html", "app.css", "app.js"]) {
  cpSync(join(ROOT, "dashboard", f), join(outDir, "dashboard", f));
}
writeFileSync(join(outDir, "dashboard", "data.js"), dataJs, "utf8");

// Screenshots are static files committed with the repo.
const shotDir = join(ROOT, "screenshots");
cpSync(shotDir, join(outDir, "screenshots"), { recursive: true });

// Dossier: byte-identical to what the library writes from these files.
const dossier = buildDossier(outDir, { text_max_bytes: 65536 });
writeFileSync(join(outDir, "dossier.json"), dossier);

console.log(
  `token-radar v2: ${rows.length} rows, watchlist ${[...watch].filter((s) => rows.some((r) => r.slug === s)).length}/${snap.watchlist.length}, top implied $${rows[0].implied_value_usd.toLocaleString("en-US")}, dossier ${dossier.length} bytes`,
);
