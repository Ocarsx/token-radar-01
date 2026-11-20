// Token Radar dashboard. Pure part first: the farm-plan generator, kept
// identical to lib/model.ts so the page's plans match board.json exactly.
const GAS = {
  Ethereum: [4.0, 30, "expensive L1"], Bitcoin: [2.0, 20, "expensive L1"],
  Solana: [0.01, 2, "cheap"], Base: [0.02, 3, "cheap L2"],
  Arbitrum: [0.05, 3, "cheap L2"], Optimism: [0.03, 3, "cheap L2"],
  Polygon: [0.02, 3, "cheap L2"], Avalanche: [0.1, 5, "mid"],
  Binance: [0.1, 5, "mid"], Sui: [0.01, 2, "cheap"], Aptos: [0.01, 2, "cheap"],
  Tron: [0.5, 5, "mid"], Near: [0.01, 2, "cheap"], Cosmos: [0.05, 3, "cheap"],
  "Hyperliquid L1": [0.01, 2, "cheap"], Monad: [0.02, 3, "cheap L2"],
  "zkSync Era": [0.05, 3, "cheap L2"], Linea: [0.03, 3, "cheap L2"],
  Scroll: [0.04, 3, "cheap L2"], Berachain: [0.05, 3, "cheap"],
  Sonic: [0.02, 3, "cheap"], Plasma: [0.05, 3, "cheap"], TON: [0.05, 3, "cheap"],
  Unichain: [0.02, 3, "cheap L2"], Blast: [0.02, 3, "cheap L2"],
  Mantle: [0.02, 3, "cheap L2"], Starknet: [0.05, 3, "cheap L2"],
  Sei: [0.01, 2, "cheap"], Injective: [0.01, 2, "cheap"],
  Fantom: [0.05, 3, "cheap"], Gnosis: [0.05, 3, "cheap"],
  Celo: [0.02, 3, "cheap L2"], "Arbitrum Nova": [0.02, 3, "cheap L2"],
  Ripple: [0.01, 2, "cheap"], Litecoin: [0.05, 3, "cheap"],
  Doge: [0.05, 3, "cheap"], Cardano: [0.2, 5, "mid"],
  Polkadot: [0.05, 3, "cheap"], "EthereumPoW": [0.1, 5, "mid"],
  Kava: [0.05, 3, "cheap"], Klaytn: [0.05, 3, "cheap"],
  Cronos: [0.05, 3, "cheap"], Metis: [0.02, 3, "cheap L2"],
  Mode: [0.02, 3, "cheap L2"], "Robinhood Chain": [0.02, 3, "cheap L2"],
  Arc: [0.02, 3, "cheap L2"], Katana: [0.02, 3, "cheap L2"],
  Corn: [0.05, 3, "cheap"], Ink: [0.02, 3, "cheap L2"],
  Tempo: [0.02, 3, "cheap L2"], MegaETH: [0.01, 2, "cheap"],
  Worldchain: [0.02, 3, "cheap L2"], "World Chain": [0.02, 3, "cheap L2"]
};
function gasFor(chain) {
  const g = GAS[chain] || [0.5, 5, "mid"];
  return { gasUsd: g[0], fundUsd: g[1], tier: g[2] };
}
const PLAYBOOK = {
  "Risk Curators": ["Deposit into a curator vault whose strategy matches your risk appetite, starting with $100-$500", "Open the vault page and confirm your deposit shows under allocations or points, and note the vault fee and any lock-up", "Reallocate between vaults when a new strategy opens, and keep at least one vault position live the whole time"],
  "Onchain Capital Allocator": ["Allocate capital to an allocator vault and keep the position for at least one full epoch, starting with $100-$500", "Confirm the allocation receipt and the epoch's points multiplier on the vault page", "Roll the allocation into the next epoch instead of withdrawing, so the streak is not broken"],
  Yield: ["Deposit the base asset into the highest-APY yield pool and enable auto-compounding if it is offered, starting with $100-$500", "Verify the deposit appears in your dashboard and the yield accrues daily", "Compound or top up the position weekly so the balance keeps growing"],
  "Yield Aggregator": ["Deposit into the aggregator vault and let it rotate strategies automatically, starting with $100-$500", "Confirm the vault share balance and the strategy's current APY on the vault page", "Leave the deposit in place for at least a month so the rotation history builds"],
  Dexs: ["Provide liquidity to the most active pool and keep the position in range, starting with $100-$500 split across the pair", "Confirm the LP position and the trading fees accruing, and record the pool's 7-day volume", "Rebalance the range after each large price move instead of withdrawing"],
  Lending: ["Supply collateral and borrow a small amount against it to activate both sides of the market, starting with $100-$500 of collateral", "Confirm the supply and borrow balances and keep the health factor above 1.5", "Top up collateral whenever the health factor drifts down, and never let it near liquidation"],
  CDP: ["Mint the protocol's stable asset against collateral at a safe collateral ratio, starting with $100-$500 of collateral", "Confirm the minted amount, the collateral ratio and the liquidation price", "Repay a small part of the minted amount each month to show active management"],
  "CDP Manager": ["Open a managed CDP vault and set an automation rule for the collateral ratio, starting with $100-$500 of collateral", "Confirm the vault's collateral ratio and that the automation rule is armed", "Review the automation log weekly and adjust the target ratio if the market moves"],
  RWA: ["Complete any whitelist or KYC step, then buy the tokenized asset in the primary market, starting with $100-$500", "Confirm the purchase receipt and that the asset shows in your portfolio", "Hold the asset through at least one payout or distribution cycle"],
  Derivatives: ["Open a small hedged position and hold it through one full funding cycle, starting with $100-$500 of margin", "Confirm the position, the funding payments and the liquidation price", "Roll the position into the next funding cycle rather than closing it outright"],
  "Basis Trading": ["Open a delta-neutral basis position and collect funding for at least two weeks, starting with $100-$500", "Confirm the funding-rate history and that the net delta stays near zero", "Rebalance the hedge weekly so the position stays delta-neutral"],
  Restaking: ["Restake the base asset and delegate to an operator with a track record, starting with $100-$500", "Confirm the restaked balance and the operator's slashing history", "Keep the stake delegated for a full reward epoch before switching operators"],
  "Staking Pool": ["Stake into the pool and keep the stake for a full reward epoch, starting with $100-$500", "Confirm the staked balance and the epoch's reward rate", "Restake the rewards each epoch instead of withdrawing them"],
  "Prediction Market": ["Take positions on at least three live markets and hold them to resolution, starting with $20-$50 per market", "Confirm the open positions and their resolution dates", "Enter one new market a week so the activity history keeps growing"],
  Payments: ["Route at least one real payment through the protocol each week, starting with a $20-$50 payment", "Confirm the payment settles and the volume counts toward your activity", "Keep a weekly payment cadence for at least a month"],
  Chain: ["Bridge assets to the chain and use its native apps for at least two transactions a week, starting with $100-$500 bridged", "Confirm the bridged balance and that the chain's activity record shows your transactions", "Use a different native app each week so the activity is varied"],
  Privacy: ["Use the privacy pool for at least one full deposit and withdrawal cycle, starting with $100-$500", "Confirm the deposit note is saved offline and the withdrawal works", "Repeat the cycle monthly with a different amount each time"],
  Insurance: ["Buy cover for a position you already hold and keep it active for a full cover period, starting with $100-$500 of cover", "Confirm the cover policy, the premium paid and the expiry date", "Renew the cover before it lapses so there is no gap in protection"],
  Farm: ["Deposit into the farm and harvest rewards at least once a week, starting with $100-$500", "Confirm the pending rewards grow between harvests", "Reinvest the harvested rewards back into the farm each week"],
  Indexes: ["Buy the index token and hold it for at least one rebalance cycle, starting with $100-$500", "Confirm the index composition and the next rebalance date", "Hold through the rebalance instead of selling into it"],
  "Collateral Markets": ["Supply collateral to the market and borrow against it at a conservative ratio, starting with $100-$500 of collateral", "Confirm the collateral ratio and the borrow rate", "Adjust the borrow amount monthly to keep the ratio conservative"],
  "Cross Chain Bridge": ["Bridge assets across at least two supported routes and keep the receipts, starting with $50-$100 per route", "Confirm both bridge transactions settled on the destination chain", "Use a different route each week so the bridging history is varied"],
  CeDeFi: ["Deposit into the CeDeFi vault and confirm the custodian's proof of reserves, starting with $100-$500", "Confirm the deposit receipt and the custodian attestation", "Hold the deposit for a full vault term before withdrawing"],
  "OTC Marketplace": ["List or fill at least one OTC order and settle it through escrow, starting with a $100-$500 order", "Confirm the escrow release and the trade receipt", "Complete one OTC trade a month to keep the account active"],
  "Dual-Token Stablecoin": ["Mint the stable pair and hold both tokens through one peg check, starting with $100-$500", "Confirm the peg holds within 1% and keep your mint receipt", "Hold the pair for at least two weeks before redeeming"],
  "Stablecoin Wrapper": ["Wrap the stablecoin and use the wrapped version in one supported pool, starting with $100-$500", "Confirm the wrapped balance and that the unwrap path works", "Keep the wrapped position for at least two weeks"],
  "Options Vault": ["Deposit into the options vault for a full epoch and collect the premium, starting with $100-$500", "Confirm the epoch's premium distribution and your share of it", "Roll the deposit into the next epoch instead of withdrawing"],
  "Interest Rate Derivatives": ["Open a fixed-rate position for one full term, starting with $100-$500", "Confirm the fixed rate, the term end and the settlement terms", "Hold the position to term instead of closing it early"],
  "Decentralized BTC": ["Wrap or bridge BTC into the protocol and use it in one pool, starting with $100-$500 of BTC value", "Confirm the BTC-backed balance and that the redemption path works", "Keep the position for at least a month so the history builds"],
  "Anchor BTC": ["Deposit BTC-backed collateral and hold it for a full epoch, starting with $100-$500 of BTC value", "Confirm the collateral receipt and the epoch's yield", "Hold through the epoch and roll into the next one"],
  "Liquidity Manager": ["Deposit into a managed liquidity position and let it rebalance, starting with $100-$500", "Confirm the position range and the rebalancing history", "Leave the position managed for at least a month"],
  "Leveraged Farming": ["Open a leveraged farm at modest leverage (2x or less) and monitor the health factor daily, starting with $100-$500", "Confirm the leverage ratio and the liquidation price", "Reduce leverage whenever the health factor falls, and never add leverage into a falling market"],
  "Uncollateralized Lending": ["Complete the credit check, borrow a small amount and repay on schedule, starting with a $100-$500 line", "Confirm the credit line, the repayment schedule and that the first repayment clears on time", "Repay early at least once to build a clean repayment record"],
  "Governance Incentives": ["Lock tokens or vote in at least one governance round, starting with a $100-$500 lock", "Confirm the vote receipt and the incentive distribution for the round", "Vote in every round while the lock is active"],
  "Crypto Card Issuer": ["Order the card, activate it and spend at least once a month, starting with a $20-$50 first spend", "Confirm the card status and the cashback or points earned on the spend", "Keep one recurring spend on the card each month"]
};
const GENERIC_PLAY = ["Use the protocol's core feature with a small position first, then scale up, starting with $100-$500", "Confirm the position shows in your dashboard and the activity is recorded", "Repeat the core action weekly for at least a month so the history builds"];
function playbookFor(category) {
  return (category !== null && PLAYBOOK[category]) ? PLAYBOOK[category] : GENERIC_PLAY;
}
function money(x) {
  return x >= 1 ? "$" + x.toFixed(2).replace(/\.00$/, "") : "$" + x.toFixed(3);
}
function farmSteps(row) {
  // row: [slug, name, category, chain, tvl, change_7d, listed_at, implied,
  //       rank, watchlist, ratio, growth, age, concentration]
  const chain = row[3] || "Ethereum";
  const g = gasFor(chain);
  const pb = playbookFor(row[2]);
  const action = pb[0], check = pb[1], cadence = pb[2];
  const gasNote = g.tier === "expensive L1"
    ? chain + " is an expensive chain, so batch your transactions and avoid peak hours"
    : g.tier === "cheap L2"
    ? chain + " is a cheap L2, so each transaction costs very little and you can act often"
    : chain + " transactions are moderately priced, so a few dollars of gas covers a week of activity";
  return [
    "Set up a fresh wallet and fund it on " + chain + " with about $" + g.fundUsd + " for gas — a typical " + chain + " transaction costs about " + money(g.gasUsd) + ", so this covers several transactions. " + gasNote + ". (10 minutes, about $" + g.fundUsd + ".)",
    action + ". Do it from the protocol's own app and keep the transaction receipt. (15-30 minutes, about " + money(g.gasUsd) + " gas on " + chain + ".)",
    check + " — this is the step that proves the activity counts toward any future allocation, so do not skip it. (10 minutes, no extra cost.)",
    cadence + ". Each repeat costs about " + money(g.gasUsd) + " in gas on " + chain + ", so a month of weekly activity costs roughly $" + (g.gasUsd * 4).toFixed(2) + " in gas. (30 minutes a week.)",
    "Record the position in a spreadsheet: date, amount, chain (" + chain + ") and a screenshot of the dashboard. Check the protocol's points or activity page every two weeks for changes. (10 minutes every two weeks.)",
    "Never share your seed phrase and never sign a blind approval. When a token launches, claim only from the protocol's own app, then revoke approvals you no longer use. (5 minutes, about " + money(g.gasUsd) + " gas on " + chain + ".)"
  ];
}
// __DOM__

// Row fields: 0 slug, 1 name, 2 category, 3 chain, 4 tvl, 5 change_7d,
// 6 listed_at, 7 implied, 8 rank, 9 watchlist, 10 ratio, 11 growth,
// 12 age, 13 concentration.
if (typeof document !== "undefined") {
const $ = (id) => document.getElementById(id);
const rows = DATA.rows;
const meta = DATA.meta;
function fmtUsd(v) {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + Math.round(v);
}
function fmtPct(v) {
  if (v === null || v === undefined) return "n/a";
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Stats strip.
const top = rows[0];
$("stats").innerHTML =
  "<div class='stat'><b>" + rows.length + "</b>protocols ranked</div>" +
  "<div class='stat'><b>40 / 40</b>watchlist covered</div>" +
  "<div class='stat'><b>" + fmtUsd(top[7]) + "</b>top implied value</div>" +
  "<div class='stat'><b>" + meta.nComparables + "</b>token comparables fitted</div>";
$("asOf").textContent = meta.asOf;
// Category chart: total implied per category, top 8, inline SVG.
(function chart() {
  const tot = {};
  rows.forEach((r) => { tot[r[2] || "Uncategorized"] = (tot[r[2] || "Uncategorized"] || 0) + r[7]; });
  const cats = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = cats[0][1];
  const W = 760, rowH = 30;
  let svg = "<svg viewBox='0 0 " + W + " " + (cats.length * rowH + 8) + "' width='100%' role='img' aria-label='Implied value by category'>";
  cats.forEach((c, i) => {
    const y = 8 + i * rowH, w = Math.max(4, Math.round((c[1] / max) * 480));
    svg += "<text x='0' y='" + (y + 13) + "' font-size='12' fill='#14202e'>" + esc(c[0]) + "</text>" +
      "<rect x='170' y='" + y + "' width='" + w + "' height='16' rx='3' fill='#0e7490'/>" +
      "<text x='" + (180 + w) + "' y='" + (y + 13) + "' font-size='12' fill='#5a6b7d'>" + fmtUsd(c[1]) + "</text>";
  });
  svg += "</svg>";
  $("chart").innerHTML = svg;
})();
// Category filter options.
const cats = [...new Set(rows.map((r) => r[2] || "Uncategorized"))].sort();
cats.forEach((c) => {
  const o = document.createElement("option");
  o.value = c; o.textContent = c;
  $("cat").appendChild(o);
});
let sortKey = "rank", sortDir = 1;
function visibleRows() {
  const q = $("q").value.trim().toLowerCase();
  const cat = $("cat").value;
  const wl = $("wl").checked;
  let list = rows.filter((r) => {
    if (wl && !r[9]) return false;
    if (cat && (r[2] || "Uncategorized") !== cat) return false;
    if (q && !(r[1].toLowerCase().includes(q) || r[0].toLowerCase().includes(q))) return false;
    return true;
  });
  const key = { rank: 8, name: 1, category: 2, tvl: 4, growth: 5, implied: 7 }[sortKey];
  list = [...list].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (typeof av === "string") return sortDir * av.localeCompare(bv);
    return sortDir * ((av === null ? -1e18 : av) - (bv === null ? -1e18 : bv));
  });
  return list;
}
function render() {
  const list = visibleRows();
  $("count").textContent = list.length + " of " + rows.length + " protocols";
  $("rows").innerHTML = list.map((r) => {
    const g = r[5] === null ? "<span>n/a</span>" : "<span class='" + (r[5] >= 0 ? "up" : "down") + "'>" + fmtPct(r[5]) + "</span>";
    return "<tr data-slug='" + esc(r[0]) + "' class='" + (sel === r[0] ? "sel" : "") + "'>" +
      "<td class='num'>" + r[8] + "</td>" +
      "<td><strong>" + esc(r[1]) + "</strong>" + (r[9] ? "<span class='wl'>WATCHLIST</span>" : "") + "<br><span class='note'>" + esc(r[0]) + " · " + esc(r[3]) + "</span></td>" +
      "<td>" + esc(r[2] || "—") + "</td>" +
      "<td class='num'>" + fmtUsd(r[4]) + "</td>" +
      "<td class='num'>" + g + "</td>" +
      "<td class='num'><strong>" + fmtUsd(r[7]) + "</strong></td></tr>";
  }).join("");
}
let sel = null;
function showDetail(slug) {
  const r = rows.find((x) => x[0] === slug);
  if (!r) { $("detailBody").innerHTML = "<p class='note'>Protocol not found.</p>"; return; }
  sel = slug;
  const steps = farmSteps(r);
  $("detailBody").innerHTML =
    "<h3>" + esc(r[1]) + "</h3>" +
    "<p class='meta'>#" + r[8] + " · " + esc(r[2] || "Uncategorized") + " · primary chain " + esc(r[3]) + (r[9] ? " · <span class='wl'>WATCHLIST</span>" : "") + "</p>" +
    "<div class='kv'>" +
    "<div><b>Implied value</b><span>" + fmtUsd(r[7]) + "</span></div>" +
    "<div><b>TVL</b><span>" + fmtUsd(r[4]) + "</span></div>" +
    "<div><b>Value multiple</b><span>" + r[10].toFixed(3) + " × TVL</span></div>" +
    "<div><b>7-day growth</b><span>" + fmtPct(r[5]) + "</span></div>" +
    "<div><b>Growth factor</b><span>" + r[11].toFixed(3) + "</span></div>" +
    "<div><b>Age factor</b><span>" + r[12].toFixed(3) + "</span></div>" +
    "<div><b>Concentration</b><span>" + r[13].toFixed(3) + "</span></div>" +
    "<div><b>Listed since</b><span>" + esc(r[6] || "not reported") + "</span></div>" +
    "</div>" +
    "<p class='note'>Implied = TVL × " + r[10].toFixed(3) + " (ratio) × " + r[11].toFixed(3) + " (growth) × " + r[12].toFixed(3) + " (age) × " + r[13].toFixed(3) + " (concentration). The protocol records no token.</p>" +
    "<h4>Farm plan — " + esc(r[1]) + "</h4>" +
    "<ol class='steps'>" + steps.map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>" +
    "<button class='copy' id='copyBtn'>Copy farm plan</button>";
  $("copyBtn").addEventListener("click", () => {
    const text = "Farm plan — " + r[1] + " (Token Radar, rank #" + r[8] + ", implied " + fmtUsd(r[7]) + ")\n\n" +
      steps.map((s, i) => (i + 1) + ". " + s).join("\n\n");
    const done = () => { $("copyBtn").textContent = "Copied ✓"; setTimeout(() => { $("copyBtn").textContent = "Copy farm plan"; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  });
  render();
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { /* clipboard unavailable */ }
  document.body.removeChild(ta);
}
// Comparables table.
$("compRows").innerHTML = DATA.comps.map((c) =>
  "<tr><td>" + esc(c[0]) + "</td><td>" + esc(c[1] || "—") + "</td><td class='num'>" + fmtUsd(c[2]) + "</td><td class='num'>" + fmtUsd(c[3]) + "</td><td class='num'>" + (c[3] / c[2]).toFixed(3) + "</td></tr>"
).join("");
// Events.
$("q").addEventListener("input", render);
$("cat").addEventListener("change", render);
$("wl").addEventListener("change", render);
$("sort").addEventListener("change", (e) => { sortKey = e.target.value; sortDir = sortKey === "name" || sortKey === "category" ? 1 : -1; if (sortKey === "rank") sortDir = 1; render(); });
document.querySelectorAll("#board th[data-k]").forEach((th) => {
  th.addEventListener("click", () => {
    const k = th.getAttribute("data-k");
    if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = (k === "name" || k === "category") ? 1 : -1; if (k === "rank") sortDir = 1; }
    $("sort").value = sortKey;
    render();
  });
});
$("rows").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-view]");
  const tr = e.target.closest("tr[data-slug]");
  const slug = btn ? btn.getAttribute("data-view") : tr ? tr.getAttribute("data-slug") : null;
  if (slug) { location.hash = "#protocol=" + slug; showDetail(slug); }
});
// Hash routing: #protocol=<slug> for detail, #q=<text> for search.
function route() {
  const h = location.hash || "";
  const pm = h.match(/protocol=([^&]+)/);
  const qm = h.match(/q=([^&]+)/);
  if (qm) { $("q").value = decodeURIComponent(qm[1]); }
  if (!pm) { sel = null; $("detailBody").innerHTML = "<p class='note'>Select a protocol to see its detail and farm plan.</p>"; }
  render();
  if (pm) showDetail(decodeURIComponent(pm[1]));
}
window.addEventListener("hashchange", route);
route();
}
