// token-radar-01 v2 — value model + farm-plan generator.
// Everything here is derived from the snapshot's own figures at runtime:
// no protocol name is hardcoded anywhere in this file.

export interface Proto {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Proto[];
  watchlist: string[];
}

// ---------------------------------------------------------------------------
// Eligibility: the watchlist-style rule. A protocol is a board subject when it
// records no token and is not a wrapped / staked / bridged product, a CEX, a
// versioned copy, or an exchange-branded product. The watchlist itself is a
// floor, never a ceiling: subjects below the floor are equally valid.
// ---------------------------------------------------------------------------
const EXCLUDED_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);
const EXCHANGE_PREFIX =
  /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

export function isEligible(p: Proto): boolean {
  if (p.gecko_id !== null || p.symbol !== null) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  if (VERSION_SUFFIX.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Value model v2. implied = TVL x ratio x growth x age x concentration.
//  ratio:      a size-aware multiple fitted from the snapshot itself. The
//              market pays fewer dollars per TVL dollar as protocols get
//              bigger, so we fit log10(mcap/TVL) = a + b*log10(TVL) by OLS
//              over the token-bearing comparables (ratios winsorized to
//              [0.005, 3.0]) and read the multiple off that line, then bend
//              it by the protocol's category: categories with >= 3
//              comparables shift the multiple toward their own winsorized
//              median ([0.005, 1.0]), shrunk by n/(n+6) so a thin category
//              cannot drag the multiple around. Thin categories (n < 3) get
//              no shift at all — one stray comparable must not set a price.
//  growth:     1 + clamp(change_7d, -30, +100) / 200  (0.85 .. 1.50)
//  age:        0.70 + 0.15 * min(years listed, 4); unlisted -> 1.00. A
//              protocol that has run longer with no token has had more time
//              to earn a launch premium; a brand-new one has not.
//  concentration: within its category, by TVL rank k among eligible
//              subjects, the k-th protocol is worth less per TVL dollar —
//              a category's launch premium concentrates in its leaders.
//              k <= 2 -> 1.0; k >= 3 -> 1.5 / (k + 1).
// ---------------------------------------------------------------------------
export interface ModelMeta {
  nComparables: number;
  fitA: number;
  fitB: number;
  globalMedian: number;
  asOf: string;
  floorUsd: number;
}

export interface Model {
  meta: ModelMeta;
  ratioOf(p: Proto): number;
  growthOf(p: Proto): number;
  ageOf(p: Proto): number;
  concentrationOf(p: Proto): number;
  impliedOf(p: Proto): number;
}

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function buildModel(snap: Snapshot): Model {
  const asOf = new Date(snap.as_of + "T00:00:00Z").getTime();
  const comps = snap.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  // OLS fit of log10(ratio) on log10(TVL), ratios winsorized to [0.005, 3.0].
  const pts = comps.map((p) => ({
    x: Math.log10(p.tvl_usd),
    y: Math.log10(clamp(p.mcap_usd! / p.tvl_usd, 0.005, 3.0)),
  }));
  const n = pts.length;
  const mx = pts.reduce((s, q) => s + q.x, 0) / n;
  const my = pts.reduce((s, q) => s + q.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const q of pts) {
    sxy += (q.x - mx) * (q.y - my);
    sxx += (q.x - mx) * (q.x - mx);
  }
  const fitB = sxx === 0 ? 0 : sxy / sxx;
  const fitA = my - fitB * mx;

  // Category medians of winsorized ratios ([0.005, 1.0]), kept only for n >= 3.
  const byCat = new Map<string, number[]>();
  for (const p of comps) {
    if (p.category === null) continue;
    const arr = byCat.get(p.category) ?? [];
    arr.push(clamp(p.mcap_usd! / p.tvl_usd, 0.005, 1.0));
    byCat.set(p.category, arr);
  }
  const catMed = new Map<string, { n: number; med: number }>();
  for (const [c, arr] of byCat) {
    if (arr.length >= 3) catMed.set(c, { n: arr.length, med: median(arr) });
  }
  const globalMedian = median(
    comps.map((p) => clamp(p.mcap_usd! / p.tvl_usd, 0.005, 1.0)),
  );

  const eligible = snap.protocols.filter(isEligible);
  const catRank = new Map<string, number>();
  for (const p of eligible) {
    const same = eligible
      .filter((q) => q.category === p.category)
      .sort((a, b) => b.tvl_usd - a.tvl_usd);
    catRank.set(p.slug, same.findIndex((q) => q.slug === p.slug) + 1);
  }

  const ratioOf = (p: Proto): number => {
    const base = clamp(Math.pow(10, fitA + fitB * Math.log10(p.tvl_usd)), 0.01, 1.0);
    let f = 1;
    if (p.category !== null) {
      const cm = catMed.get(p.category);
      if (cm) {
        const w = cm.n / (cm.n + 6);
        f = clamp(1 + w * (cm.med / globalMedian - 1), 0.5, 1.8);
      }
    }
    return clamp(base * f, 0.01, 1.0);
  };
  const growthOf = (p: Proto): number =>
    1 + clamp(p.change_7d ?? 0, -30, 100) / 200;
  const ageOf = (p: Proto): number => {
    if (!p.listed_at) return 1.0;
    const years =
      (asOf - new Date(p.listed_at + "T00:00:00Z").getTime()) /
      (365.25 * 24 * 3600 * 1000);
    return 0.7 + 0.15 * Math.min(Math.max(years, 0), 4);
  };
  const concentrationOf = (p: Proto): number => {
    const k = catRank.get(p.slug) ?? 1;
    return k <= 2 ? 1 : 1.5 / (k + 1);
  };
  const impliedOf = (p: Proto): number =>
    Math.max(
      1,
      Math.round(
        p.tvl_usd * ratioOf(p) * growthOf(p) * ageOf(p) * concentrationOf(p),
      ),
    );
  return {
    meta: {
      nComparables: n,
      fitA,
      fitB,
      globalMedian,
      asOf: snap.as_of,
      floorUsd: snap.floor_usd,
    },
    ratioOf,
    growthOf,
    ageOf,
    concentrationOf,
    impliedOf,
  };
}

// ---------------------------------------------------------------------------
// Farm plans. Every step is assembled from the protocol's own data — its
// category, its primary chain, its TVL — never from its name. Gas figures
// are typical per-transaction costs on each chain, stated as approximations.
// ---------------------------------------------------------------------------
export interface GasInfo {
  gasUsd: number;
  fundUsd: number;
  tier: string;
}
const GAS: Record<string, [number, number, string]> = {
  Ethereum: [4.0, 30, "expensive L1"],
  Bitcoin: [2.0, 20, "expensive L1"],
  Solana: [0.01, 2, "cheap"],
  Base: [0.02, 3, "cheap L2"],
  Arbitrum: [0.05, 3, "cheap L2"],
  Optimism: [0.03, 3, "cheap L2"],
  Polygon: [0.02, 3, "cheap L2"],
  Avalanche: [0.1, 5, "mid"],
  Binance: [0.1, 5, "mid"],
  Sui: [0.01, 2, "cheap"],
  Aptos: [0.01, 2, "cheap"],
  Tron: [0.5, 5, "mid"],
  Near: [0.01, 2, "cheap"],
  Cosmos: [0.05, 3, "cheap"],
  "Hyperliquid L1": [0.01, 2, "cheap"],
  Monad: [0.02, 3, "cheap L2"],
  "zkSync Era": [0.05, 3, "cheap L2"],
  Linea: [0.03, 3, "cheap L2"],
  Scroll: [0.04, 3, "cheap L2"],
  Berachain: [0.05, 3, "cheap"],
  Sonic: [0.02, 3, "cheap"],
  Plasma: [0.05, 3, "cheap"],
  TON: [0.05, 3, "cheap"],
  Unichain: [0.02, 3, "cheap L2"],
  Blast: [0.02, 3, "cheap L2"],
  Mantle: [0.02, 3, "cheap L2"],
  Starknet: [0.05, 3, "cheap L2"],
  Sei: [0.01, 2, "cheap"],
  Injective: [0.01, 2, "cheap"],
  Fantom: [0.05, 3, "cheap"],
  Gnosis: [0.05, 3, "cheap"],
  Celo: [0.02, 3, "cheap L2"],
  "Arbitrum Nova": [0.02, 3, "cheap L2"],
  Ripple: [0.01, 2, "cheap"],
  Litecoin: [0.05, 3, "cheap"],
  Doge: [0.05, 3, "cheap"],
  Cardano: [0.2, 5, "mid"],
  Polkadot: [0.05, 3, "cheap"],
  "EthereumPoW": [0.1, 5, "mid"],
  Kava: [0.05, 3, "cheap"],
  Klaytn: [0.05, 3, "cheap"],
  Cronos: [0.05, 3, "cheap"],
  Metis: [0.02, 3, "cheap L2"],
  Mode: [0.02, 3, "cheap L2"],
  "Robinhood Chain": [0.02, 3, "cheap L2"],
  Arc: [0.02, 3, "cheap L2"],
  Katana: [0.02, 3, "cheap L2"],
  Corn: [0.05, 3, "cheap"],
  Ink: [0.02, 3, "cheap L2"],
  Tempo: [0.02, 3, "cheap L2"],
  MegaETH: [0.01, 2, "cheap"],
  Worldchain: [0.02, 3, "cheap L2"],
  "World Chain": [0.02, 3, "cheap L2"],
};

export function gasFor(chain: string): GasInfo {
  const g = GAS[chain] ?? [0.5, 5, "mid"];
  return { gasUsd: g[0], fundUsd: g[1], tier: g[2] };
}

// Per-category playbook: [core action, eligibility / points check, cadence].
// The action is what to do, the check proves the activity counts, the
// cadence keeps the history building. A generic fallback covers any category
// the snapshot invents later.
const PLAYBOOK: Record<string, [string, string, string]> = {
  "Risk Curators": [
    "Deposit into a curator vault whose strategy matches your risk appetite, starting with $100-$500",
    "Open the vault page and confirm your deposit shows under allocations or points, and note the vault fee and any lock-up",
    "Reallocate between vaults when a new strategy opens, and keep at least one vault position live the whole time",
  ],
  "Onchain Capital Allocator": [
    "Allocate capital to an allocator vault and keep the position for at least one full epoch, starting with $100-$500",
    "Confirm the allocation receipt and the epoch's points multiplier on the vault page",
    "Roll the allocation into the next epoch instead of withdrawing, so the streak is not broken",
  ],
  Yield: [
    "Deposit the base asset into the highest-APY yield pool and enable auto-compounding if it is offered, starting with $100-$500",
    "Verify the deposit appears in your dashboard and the yield accrues daily",
    "Compound or top up the position weekly so the balance keeps growing",
  ],
  "Yield Aggregator": [
    "Deposit into the aggregator vault and let it rotate strategies automatically, starting with $100-$500",
    "Confirm the vault share balance and the strategy's current APY on the vault page",
    "Leave the deposit in place for at least a month so the rotation history builds",
  ],
  Dexs: [
    "Provide liquidity to the most active pool and keep the position in range, starting with $100-$500 split across the pair",
    "Confirm the LP position and the trading fees accruing, and record the pool's 7-day volume",
    "Rebalance the range after each large price move instead of withdrawing",
  ],
  Lending: [
    "Supply collateral and borrow a small amount against it to activate both sides of the market, starting with $100-$500 of collateral",
    "Confirm the supply and borrow balances and keep the health factor above 1.5",
    "Top up collateral whenever the health factor drifts down, and never let it near liquidation",
  ],
  CDP: [
    "Mint the protocol's stable asset against collateral at a safe collateral ratio, starting with $100-$500 of collateral",
    "Confirm the minted amount, the collateral ratio and the liquidation price",
    "Repay a small part of the minted amount each month to show active management",
  ],
  "CDP Manager": [
    "Open a managed CDP vault and set an automation rule for the collateral ratio, starting with $100-$500 of collateral",
    "Confirm the vault's collateral ratio and that the automation rule is armed",
    "Review the automation log weekly and adjust the target ratio if the market moves",
  ],
  RWA: [
    "Complete any whitelist or KYC step, then buy the tokenized asset in the primary market, starting with $100-$500",
    "Confirm the purchase receipt and that the asset shows in your portfolio",
    "Hold the asset through at least one payout or distribution cycle",
  ],
  Derivatives: [
    "Open a small hedged position and hold it through one full funding cycle, starting with $100-$500 of margin",
    "Confirm the position, the funding payments and the liquidation price",
    "Roll the position into the next funding cycle rather than closing it outright",
  ],
  "Basis Trading": [
    "Open a delta-neutral basis position and collect funding for at least two weeks, starting with $100-$500",
    "Confirm the funding-rate history and that the net delta stays near zero",
    "Rebalance the hedge weekly so the position stays delta-neutral",
  ],
  Restaking: [
    "Restake the base asset and delegate to an operator with a track record, starting with $100-$500",
    "Confirm the restaked balance and the operator's slashing history",
    "Keep the stake delegated for a full reward epoch before switching operators",
  ],
  "Staking Pool": [
    "Stake into the pool and keep the stake for a full reward epoch, starting with $100-$500",
    "Confirm the staked balance and the epoch's reward rate",
    "Restake the rewards each epoch instead of withdrawing them",
  ],
  "Prediction Market": [
    "Take positions on at least three live markets and hold them to resolution, starting with $20-$50 per market",
    "Confirm the open positions and their resolution dates",
    "Enter one new market a week so the activity history keeps growing",
  ],
  Payments: [
    "Route at least one real payment through the protocol each week, starting with a $20-$50 payment",
    "Confirm the payment settles and the volume counts toward your activity",
    "Keep a weekly payment cadence for at least a month",
  ],
  Chain: [
    "Bridge assets to the chain and use its native apps for at least two transactions a week, starting with $100-$500 bridged",
    "Confirm the bridged balance and that the chain's activity record shows your transactions",
    "Use a different native app each week so the activity is varied",
  ],
  Privacy: [
    "Use the privacy pool for at least one full deposit and withdrawal cycle, starting with $100-$500",
    "Confirm the deposit note is saved offline and the withdrawal works",
    "Repeat the cycle monthly with a different amount each time",
  ],
  Insurance: [
    "Buy cover for a position you already hold and keep it active for a full cover period, starting with $100-$500 of cover",
    "Confirm the cover policy, the premium paid and the expiry date",
    "Renew the cover before it lapses so there is no gap in protection",
  ],
  Farm: [
    "Deposit into the farm and harvest rewards at least once a week, starting with $100-$500",
    "Confirm the pending rewards grow between harvests",
    "Reinvest the harvested rewards back into the farm each week",
  ],
  Indexes: [
    "Buy the index token and hold it for at least one rebalance cycle, starting with $100-$500",
    "Confirm the index composition and the next rebalance date",
    "Hold through the rebalance instead of selling into it",
  ],
  "Collateral Markets": [
    "Supply collateral to the market and borrow against it at a conservative ratio, starting with $100-$500 of collateral",
    "Confirm the collateral ratio and the borrow rate",
    "Adjust the borrow amount monthly to keep the ratio conservative",
  ],
  "Cross Chain Bridge": [
    "Bridge assets across at least two supported routes and keep the receipts, starting with $50-$100 per route",
    "Confirm both bridge transactions settled on the destination chain",
    "Use a different route each week so the bridging history is varied",
  ],
  CeDeFi: [
    "Deposit into the CeDeFi vault and confirm the custodian's proof of reserves, starting with $100-$500",
    "Confirm the deposit receipt and the custodian attestation",
    "Hold the deposit for a full vault term before withdrawing",
  ],
  "OTC Marketplace": [
    "List or fill at least one OTC order and settle it through escrow, starting with a $100-$500 order",
    "Confirm the escrow release and the trade receipt",
    "Complete one OTC trade a month to keep the account active",
  ],
  "Dual-Token Stablecoin": [
    "Mint the stable pair and hold both tokens through one peg check, starting with $100-$500",
    "Confirm the peg holds within 1% and keep your mint receipt",
    "Hold the pair for at least two weeks before redeeming",
  ],
  "Stablecoin Wrapper": [
    "Wrap the stablecoin and use the wrapped version in one supported pool, starting with $100-$500",
    "Confirm the wrapped balance and that the unwrap path works",
    "Keep the wrapped position for at least two weeks",
  ],
  "Options Vault": [
    "Deposit into the options vault for a full epoch and collect the premium, starting with $100-$500",
    "Confirm the epoch's premium distribution and your share of it",
    "Roll the deposit into the next epoch instead of withdrawing",
  ],
  "Interest Rate Derivatives": [
    "Open a fixed-rate position for one full term, starting with $100-$500",
    "Confirm the fixed rate, the term end and the settlement terms",
    "Hold the position to term instead of closing it early",
  ],
  "Decentralized BTC": [
    "Wrap or bridge BTC into the protocol and use it in one pool, starting with $100-$500 of BTC value",
    "Confirm the BTC-backed balance and that the redemption path works",
    "Keep the position for at least a month so the history builds",
  ],
  "Anchor BTC": [
    "Deposit BTC-backed collateral and hold it for a full epoch, starting with $100-$500 of BTC value",
    "Confirm the collateral receipt and the epoch's yield",
    "Hold through the epoch and roll into the next one",
  ],
  "Liquidity Manager": [
    "Deposit into a managed liquidity position and let it rebalance, starting with $100-$500",
    "Confirm the position range and the rebalancing history",
    "Leave the position managed for at least a month",
  ],
  "Leveraged Farming": [
    "Open a leveraged farm at modest leverage (2x or less) and monitor the health factor daily, starting with $100-$500",
    "Confirm the leverage ratio and the liquidation price",
    "Reduce leverage whenever the health factor falls, and never add leverage into a falling market",
  ],
  "Uncollateralized Lending": [
    "Complete the credit check, borrow a small amount and repay on schedule, starting with a $100-$500 line",
    "Confirm the credit line, the repayment schedule and that the first repayment clears on time",
    "Repay early at least once to build a clean repayment record",
  ],
  "Governance Incentives": [
    "Lock tokens or vote in at least one governance round, starting with a $100-$500 lock",
    "Confirm the vote receipt and the incentive distribution for the round",
    "Vote in every round while the lock is active",
  ],
  "Crypto Card Issuer": [
    "Order the card, activate it and spend at least once a month, starting with a $20-$50 first spend",
    "Confirm the card status and the cashback or points earned on the spend",
    "Keep one recurring spend on the card each month",
  ],
};

const GENERIC_PLAY: [string, string, string] = [
  "Use the protocol's core feature with a small position first, then scale up, starting with $100-$500",
  "Confirm the position shows in your dashboard and the activity is recorded",
  "Repeat the core action weekly for at least a month so the history builds",
];

export function playbookFor(category: string | null): [string, string, string] {
  if (category !== null && PLAYBOOK[category]) return PLAYBOOK[category];
  return GENERIC_PLAY;
}

const money = (x: number): string =>
  x >= 1 ? "$" + x.toFixed(2).replace(/\.00$/, "") : "$" + x.toFixed(3);

export function farmSteps(p: Proto): string[] {
  const chain = p.chains.length > 0 ? p.chains[0] : "Ethereum";
  const g = gasFor(chain);
  const [action, check, cadence] = playbookFor(p.category);
  const gasNote =
    g.tier === "expensive L1"
      ? `${chain} is an expensive chain, so batch your transactions and avoid peak hours`
      : g.tier === "cheap L2"
        ? `${chain} is a cheap L2, so each transaction costs very little and you can act often`
        : `${chain} transactions are moderately priced, so a few dollars of gas covers a week of activity`;
  return [
    `Set up a fresh wallet and fund it on ${chain} with about $${g.fundUsd} for gas — a typical ${chain} transaction costs about ${money(g.gasUsd)}, so this covers several transactions. ${gasNote}. (10 minutes, about $${g.fundUsd}.)`,
    `${action}. Do it from the protocol's own app and keep the transaction receipt. (15-30 minutes, about ${money(g.gasUsd)} gas on ${chain}.)`,
    `${check} — this is the step that proves the activity counts toward any future allocation, so do not skip it. (10 minutes, no extra cost.)`,
    `${cadence}. Each repeat costs about ${money(g.gasUsd)} in gas on ${chain}, so a month of weekly activity costs roughly $${(g.gasUsd * 4).toFixed(2)} in gas. (30 minutes a week.)`,
    `Record the position in a spreadsheet: date, amount, chain (${chain}) and a screenshot of the dashboard. Check the protocol's points or activity page every two weeks for changes. (10 minutes every two weeks.)`,
    `Never share your seed phrase and never sign a blind approval. When a token launches, claim only from the protocol's own app, then revoke approvals you no longer use. (5 minutes, about ${money(g.gasUsd)} gas on ${chain}.)`,
  ];
}

// Largest token-bearing comparables, for the dashboard's comparables table:
// the market prices the model is fitted against, kept separate from the
// pre-token board so the reader can see the two groups never mix.
export function topComparables(snap: Snapshot, limit: number): Proto[] {
  return snap.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .slice(0, limit);
}
