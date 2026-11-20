// Token Radar dashboard. Renders window.BOARD_DATA with no network.
// Farm steps are rebuilt here from the same category/chain templates the
// program uses in lib/model.ts, so the page and board.json always agree.
(function () {
  var D = window.BOARD_DATA || { rows: [], comparables: [] };
  // Rows arrive as arrays (see the column comment in data.js); hydrate them.
  var COLS = ["slug", "name", "rank", "implied", "tvl", "chg", "cat", "chains", "listed", "age", "ratio", "gf", "af", "wl"];
  var rows = (D.rows || []).map(function (a) {
    if (!Array.isArray(a)) return a;
    var r = {};
    for (var i = 0; i < COLS.length; i++) r[COLS[i]] = a[i];
    return r;
  });
  window.BOARD_ROWS = rows;

  function fmtUsd(n) {
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    return "$" + Math.round(n).toLocaleString("en-US");
  }
  function money(tvl) {
    if (tvl >= 1e9) return "$" + (tvl / 1e9).toFixed(1) + "B";
    return "$" + Math.round(tvl / 1e6) + "M";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var CATEGORY_ACTIONS = {
    Lending: { verb: "Supply and borrow on", action: "supply collateral, then borrow a small amount against it and repay it", asset: "stablecoins" },
    Dexs: { verb: "Trade and provide liquidity on", action: "swap tokens in both directions and add a small amount of liquidity to a pool", asset: "the main trading pair" },
    Yield: { verb: "Deposit into the vaults of", action: "deposit into a vault, harvest the yield, then redeposit the rewards", asset: "a stablecoin vault" },
    "Yield Aggregator": { verb: "Deposit into the vaults of", action: "deposit into a vault, harvest the yield, then redeposit the rewards", asset: "a stablecoin vault" },
    Derivatives: { verb: "Open and close positions on", action: "open a small leveraged position, set a stop, then close it after a few days", asset: "a perpetual position" },
    "Basis Trading": { verb: "Use the basis strategies of", action: "enter a delta-neutral position and hold it through one funding cycle", asset: "a basis position" },
    RWA: { verb: "Mint or hold the real-world assets of", action: "mint the tokenised asset with a small amount and hold it for a month", asset: "tokenised treasuries" },
    CDP: { verb: "Open a vault on", action: "lock collateral, mint the protocol's stable asset, then repay and unlock", asset: "a collateralised vault" },
    "CDP Manager": { verb: "Manage a vault through", action: "open a vault, adjust its collateral ratio once, then close it cleanly", asset: "a collateralised vault" },
    "Prediction Market": { verb: "Trade markets on", action: "buy YES and NO shares in two different markets and settle both", asset: "event shares" },
    "Risk Curators": { verb: "Allocate to a curated vault of", action: "deposit into a curated vault and rebalance your allocation once a month", asset: "a curated vault" },
    "Onchain Capital Allocator": { verb: "Allocate capital through", action: "deposit into an allocation vault and review the strategy report each month", asset: "an allocation vault" },
    "Liquidity Manager": { verb: "Provide managed liquidity on", action: "deposit into a managed pool, let it rebalance, then withdraw part of it", asset: "a managed pool" },
    "Liquid Restaking": { verb: "Restake through", action: "restake a small amount and hold the receipt token for several weeks", asset: "a restaking position" },
    Launchpad: { verb: "Join launches on", action: "stake for launch access, join one sale, then claim and hold the allocation", asset: "a launch allocation" },
    "NFT Marketplace": { verb: "Trade on", action: "list one item, place a bid on another, and complete one purchase", asset: "a listed item" },
    "Cross Chain Bridge": { verb: "Bridge through", action: "bridge a small amount between two chains and back, keeping the receipts", asset: "a cross-chain transfer" },
    "Interest Rate Derivatives": { verb: "Trade rate positions on", action: "open a fixed-rate position for a month and close it at expiry", asset: "a rate position" },
    "Token Locker": { verb: "Lock tokens with", action: "lock a small token amount for a month and verify the lock on the explorer", asset: "a token lock" },
    "Stablecoin Issuer": { verb: "Mint and redeem with", action: "mint the stablecoin with collateral, use it once, then redeem it back", asset: "the stablecoin" },
    Payments: { verb: "Pay and receive through", action: "send two small payments and receive one, using the protocol's rails", asset: "a payment" },
    "Decentralized AI": { verb: "Use the AI services of", action: "run one inference job and pay for it with the protocol's credits", asset: "an inference job" },
    "AI Agents": { verb: "Run an agent on", action: "deploy one agent task, fund it with a small budget and review its log", asset: "an agent task" },
    Insurance: { verb: "Buy cover on", action: "buy a small cover policy for one month and keep the policy receipt", asset: "a cover policy" },
    Indexes: { verb: "Buy the index of", action: "buy a small index position and hold it for a month, rebalancing once", asset: "an index position" },
    Farm: { verb: "Farm the pools of", action: "stake in a farm pool, claim rewards weekly and compound them once", asset: "a farm pool" },
    Synthetics: { verb: "Mint synths on", action: "mint a small synthetic position, hold it a week, then burn it back", asset: "a synthetic position" },
    Options: { verb: "Trade options on", action: "buy one call and one put, then let one expire and close the other", asset: "an option contract" },
    Privacy: { verb: "Use the private transfers of", action: "make one shielded deposit and one shielded withdrawal a week apart", asset: "a shielded transfer" },
    "Crypto Card Issuer": { verb: "Spend with the card of", action: "load the card with a small amount and make two everyday purchases", asset: "a card top-up" }
  };
  var DEFAULT_ACTION = { verb: "Use", action: "make a small deposit, use the core feature once, then withdraw part of it", asset: "a small position" };

  // Pure: rebuild the farm plan for a row. Mirrors lib/model.ts exactly.
  function buildFarmSteps(r) {
    var chain = (r.chains && r.chains[0]) || "Ethereum";
    var other = (r.chains && r.chains[1]) || null;
    var act = CATEGORY_ACTIONS[r.cat || ""] || DEFAULT_ACTION;
    var size = r.tvl >= 5e8 ? "$200–$500" : "$50–$200";
    var steps = [
      "Set up a fresh wallet and bridge " + size + " in stablecoins to " + chain + " for " + r.name + " (bridge fee ~$1–$5, ~10 minutes). Keep a little native gas aside.",
      act.verb + " " + r.name + " on " + chain + ": " + act.action + " with " + size + " of " + act.asset + " (gas ~$0.50–$3 per transaction, ~15 minutes)."
    ];
    if (other) {
      steps.push("Repeat the core action on " + other + " too, so your activity spans both " + chain + " and " + other + " (another " + size + ", gas ~$1–$3, ~15 minutes).");
    } else {
      steps.push("Do a second, different interaction on " + chain + " — for example a swap, a second deposit or a governance vote — to show breadth, not a single click (gas ~$0.50–$2, ~10 minutes).");
    }
    steps.push("Return once a week for a month: repeat the main action, claim any points or rewards, and leave most funds in place (each visit ~$1–$3 in gas, ~10 minutes).");
    steps.push("Before any token launch, check " + r.name + "'s own announcements and record your wallet activity: TVL " + money(r.tvl) + ", implied value about " + fmtUsd(r.implied) + ", and keep receipts of every transaction.");
    return steps;
  }
  window.BUILD_FARM_STEPS = buildFarmSteps;

  if (typeof document === "undefined") return;

  var state = { sort: "rank", dir: 1, q: "", cat: "", chain: "", minTvl: 0, wl: false, sel: null };

  function $(id) { return document.getElementById(id); }
  function filtered() {
    var q = state.q.toLowerCase();
    return rows.filter(function (r) {
      if (q && (r.name + " " + r.slug).toLowerCase().indexOf(q) < 0) return false;
      if (state.cat && r.cat !== state.cat) return false;
      if (state.chain && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (r.tvl < state.minTvl) return false;
      if (state.wl && !r.wl) return false;
      return true;
    });
  }
  function sorted(list) {
    var k = state.sort, d = state.dir;
    return list.slice().sort(function (a, b) {
      var va, vb;
      if (k === "name") { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
      else if (k === "cat") { va = a.cat || ""; vb = b.cat || ""; }
      else if (k === "chg") { va = a.chg == null ? -1e9 : a.chg; vb = b.chg == null ? -1e9 : b.chg; }
      else { va = a[k]; vb = b[k]; }
      if (va < vb) return -1 * d;
      if (va > vb) return 1 * d;
      return a.rank - b.rank;
    });
  }
  function chgHtml(r) {
    if (r.chg == null) return '<span class="slug">—</span>';
    var cls = r.chg >= 0 ? "pos" : "neg";
    return '<span class="' + cls + '">' + (r.chg >= 0 ? "+" : "") + r.chg.toFixed(1) + "%</span>";
  }
  function render() {
    var list = sorted(filtered());
    $("count").textContent = list.length + " of " + rows.length + " protocols";
    $("rows").innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : "") + ">" +
        '<td class="num">' + r.rank + "</td>" +
        "<td><strong>" + esc(r.name) + "</strong>" + (r.wl ? '<span class="badge">WATCHLIST</span>' : "") +
        '<br><span class="slug">' + esc(r.slug) + "</span></td>" +
        "<td>" + esc(r.cat || "—") + "</td>" +
        "<td>" + esc((r.chains || []).slice(0, 2).join(", ")) + "</td>" +
        '<td class="num">' + fmtUsd(r.tvl) + "</td>" +
        '<td class="num">' + chgHtml(r) + "</td>" +
        '<td class="num">' + (r.age ? r.age.toFixed(1) + "y" : "—") + "</td>" +
        '<td class="num val">' + fmtUsd(r.implied) + "</td></tr>";
    }).join("");
    var trs = document.querySelectorAll("#rows tr");
    for (var i = 0; i < trs.length; i++) {
      trs[i].addEventListener("click", function () { showDetail(this.getAttribute("data-slug")); });
    }
  }
  function showDetail(slug, pushHash) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) r = rows[i];
    if (!r) return;
    state.sel = slug;
    var steps = buildFarmSteps(r);
    $("detail").innerHTML =
      "<h2>" + esc(r.name) + (r.wl ? ' <span class="badge">WATCHLIST</span>' : "") + "</h2>" +
      '<p class="slug">' + esc(r.slug) + " · rank #" + r.rank + " · " + esc(r.cat || "no category") + "</p>" +
      '<div class="kv">' +
      "<div><b>" + fmtUsd(r.tvl) + "</b><span>TVL</span></div>" +
      "<div><b>" + (r.chg == null ? "—" : (r.chg >= 0 ? "+" : "") + r.chg.toFixed(1) + "%") + "</b><span>7-day change</span></div>" +
      "<div><b>" + (r.age ? r.age.toFixed(1) + " years" : "—") + "</b><span>Running since " + esc(r.listed || "unknown") + "</span></div>" +
      "<div><b>" + esc((r.chains || []).join(", ")) + "</b><span>Chains</span></div>" +
      "<div><b>" + fmtUsd(r.implied) + "</b><span>Implied value</span></div>" +
      "</div>" +
      "<h3>Why this value</h3>" +
      '<p class="math">' + fmtUsd(r.tvl) + " TVL × " + r.ratio.toFixed(3) + " category ratio (median mcap/TVL of tokened " + esc(r.cat || "peers") + ") × " + r.gf.toFixed(3) + " growth × " + r.af.toFixed(3) + " age = " + fmtUsd(r.implied) + "</p>" +
      "<h3>How to farm it</h3><ol class=\"steps\">" +
      steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>";
    if (pushHash !== false) {
      try { history.replaceState(null, "", "#protocol=" + encodeURIComponent(slug)); } catch (e) {}
    }
    render();
    $("detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function readHash() {
    var h = (location.hash || "").replace(/^#/, "");
    var out = {};
    h.split("&").forEach(function (pair) {
      var kv = pair.split("=");
      if (kv[0]) out[kv[0]] = decodeURIComponent(kv[1] || "");
    });
    return out;
  }
  function init() {
    var cats = {}, chains = {};
    rows.forEach(function (r) {
      if (r.cat) cats[r.cat] = 1;
      (r.chains || []).forEach(function (c) { chains[c] = 1; });
    });
    Object.keys(cats).sort().forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; $("cat").appendChild(o);
    });
    Object.keys(chains).sort().forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; $("chain").appendChild(o);
    });
    var top = rows[0] || {};
    $("meta").textContent = "Snapshot " + (D.as_of || "") + " · " + rows.length + " pre-token protocols · floor $50M · data: DefiLlama";
    $("stats").innerHTML =
      "<div class=\"stat\"><b>" + rows.length + "</b><span>Protocols ranked</span></div>" +
      "<div class=\"stat\"><b>" + rows.filter(function (r) { return r.wl; }).length + "</b><span>Watchlist covered</span></div>" +
      "<div class=\"stat\"><b>" + fmtUsd(top.implied || 0) + "</b><span>Top implied value</span></div>" +
      "<div class=\"stat\"><b>" + (D.global_median_ratio || 0).toFixed(3) + "</b><span>Global median mcap/TVL</span></div>";
    $("comparables").innerHTML = (D.comparables || []).slice(0, 12).map(function (c) {
      return '<span class="chip">' + esc(c.category) + ' <b>' + c.median_ratio.toFixed(3) + '</b> · n=' + c.n + "</span>";
    }).join("");
    $("footN").textContent = rows.length;
    $("q").addEventListener("input", function () { state.q = this.value; render(); });
    $("cat").addEventListener("change", function () { state.cat = this.value; render(); });
    $("chain").addEventListener("change", function () { state.chain = this.value; render(); });
    $("minTvl").addEventListener("change", function () { state.minTvl = +this.value; render(); });
    $("wlOnly").addEventListener("change", function () { state.wl = this.checked; render(); });
    var ths = document.querySelectorAll("#board th[data-sort]");
    for (var i = 0; i < ths.length; i++) {
      ths[i].addEventListener("click", function () {
        var k = this.getAttribute("data-sort");
        if (state.sort === k) state.dir = -state.dir;
        else { state.sort = k; state.dir = k === "name" || k === "cat" ? 1 : -1; }
        render();
      });
    }
    var h = readHash();
    if (h.category) { state.cat = h.category; $("cat").value = h.category; }
    if (h.q) { state.q = h.q; $("q").value = h.q; }
    if (h.chain) { state.chain = h.chain; $("chain").value = h.chain; }
    render();
    if (h.protocol) showDetail(h.protocol, false);
  }
  window.SHOW_DETAIL = showDetail;
  init();
})();
