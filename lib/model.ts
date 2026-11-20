// Token launch radar — value model and farm-plan generator.
//
// The model is derived entirely from the sealed snapshot's own figures:
//   implied_value = TVL x categoryRatio x growthFactor x ageFactor
//   categoryRatio = median mcap/TVL of the tokened protocols in the same
//                   category (comparables); global median when a category
//                   has fewer than 3 tokened comparables.
//   growthFactor  = 1 + clamp(change_7d, -30, +100) / 200   (0.85 .. 1.50)
//   ageFactor     = 0.70 + 0.15 * min(yearsSinceListed, 4)   (0.70 .. 1.30)
// A protocol is a "pre-token" subject when the snapshot records no token
// for it (gecko_id and symbol both null). Wrapped, staked, bridged and
// exchange products are excluded with the same rule the watchlist uses,
// because they are not protocols waiting on a launch of their own.

export interface SnapshotProtocol {
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
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface Comparable {
  category: string;
  n: number;
  median_ratio: number;
}

export interface ScoredProtocol {
  protocol: SnapshotProtocol;
  categoryRatio: number;
  growthFactor: number;
  ageFactor: number;
  ageYears: number;
  implied: number;
  watchlist: boolean;
  farmSteps: string[];
}

const EXCLUDED_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);

const EXCHANGE_PREFIX =
  /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** True when the snapshot records no token for the protocol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/** True when the protocol is a plausible pre-token launch subject. */
export function isLaunchSubject(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  if (VERSION_SUFFIX.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  return true;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Median mcap/TVL per category over tokened protocols, plus the global one. */
export function categoryRatios(
  protocols: SnapshotProtocol[],
): { byCategory: Map<string, number>; global: number; counts: Map<string, number> } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protocols) {
    if (p.gecko_id === null || p.symbol === null) continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? "Other";
    const list = byCategory.get(key) ?? [];
    list.push(ratio);
    byCategory.set(key, list);
  }
  const global = median(all);
  const medians = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const [key, list] of byCategory) {
    counts.set(key, list.length);
    medians.set(key, list.length >= 3 ? median(list) : global);
  }
  return { byCategory: medians, global, counts };
}

export function ageYears(listedAt: string | null, asOf: string): number {
  if (listedAt === null) return 0;
  const listed = Date.parse(listedAt + "T00:00:00Z");
  const ref = Date.parse(asOf + "T00:00:00Z");
  if (!Number.isFinite(listed) || !Number.isFinite(ref) || ref <= listed) return 0;
  return (ref - listed) / 86_400_000 / 365.25;
}

/** Score one pre-token protocol. All inputs come from the snapshot. */
export function scoreProtocol(
  p: SnapshotProtocol,
  ratio: number,
  asOf: string,
): Omit<ScoredProtocol, "watchlist" | "farmSteps"> {
  const growth = p.change_7d === null ? 0 : p.change_7d;
  const growthFactor = clamp(1 + clamp(growth, -30, 100) / 200, 0.85, 1.5);
  const years = ageYears(p.listed_at, asOf);
  const ageFactor = p.listed_at === null ? 1 : 0.7 + 0.15 * Math.min(years, 4);
  const safeRatio = clamp(ratio, 0.02, 2.0);
  const implied = Math.max(
    1,
    Math.round(p.tvl_usd * safeRatio * growthFactor * ageFactor),
  );
  return {
    protocol: p,
    categoryRatio: safeRatio,
    growthFactor,
    ageFactor,
    ageYears: years,
    implied,
  };
}

// ---------------------------------------------------------------------------
// Farm plans. Generated from the protocol's category and chains — never from
// a hardcoded list of names. Each step states what to do, what it costs and
// how long it takes, and is 20-600 characters long.
// ---------------------------------------------------------------------------

const CATEGORY_ACTIONS: Record<string, { verb: string; action: string; asset: string }> = {
  Lending: {
    verb: "Supply and borrow on",
    action: "supply collateral, then borrow a small amount against it and repay it",
    asset: "stablecoins",
  },
  Dexs: {
    verb: "Trade and provide liquidity on",
    action: "swap tokens in both directions and add a small amount of liquidity to a pool",
    asset: "the main trading pair",
  },
  Yield: {
    verb: "Deposit into the vaults of",
    action: "deposit into a vault, harvest the yield, then redeposit the rewards",
    asset: "a stablecoin vault",
  },
  "Yield Aggregator": {
    verb: "Deposit into the vaults of",
    action: "deposit into a vault, harvest the yield, then redeposit the rewards",
    asset: "a stablecoin vault",
  },
  Derivatives: {
    verb: "Open and close positions on",
    action: "open a small leveraged position, set a stop, then close it after a few days",
    asset: "a perpetual position",
  },
  "Basis Trading": {
    verb: "Use the basis strategies of",
    action: "enter a delta-neutral position and hold it through one funding cycle",
    asset: "a basis position",
  },
  RWA: {
    verb: "Mint or hold the real-world assets of",
    action: "mint the tokenised asset with a small amount and hold it for a month",
    asset: "tokenised treasuries",
  },
  CDP: {
    verb: "Open a vault on",
    action: "lock collateral, mint the protocol's stable asset, then repay and unlock",
    asset: "a collateralised vault",
  },
  "CDP Manager": {
    verb: "Manage a vault through",
    action: "open a vault, adjust its collateral ratio once, then close it cleanly",
    asset: "a collateralised vault",
  },
  "Prediction Market": {
    verb: "Trade markets on",
    action: "buy YES and NO shares in two different markets and settle both",
    asset: "event shares",
  },
  "Risk Curators": {
    verb: "Allocate to a curated vault of",
    action: "deposit into a curated vault and rebalance your allocation once a month",
    asset: "a curated vault",
  },
  "Onchain Capital Allocator": {
    verb: "Allocate capital through",
    action: "deposit into an allocation vault and review the strategy report each month",
    asset: "an allocation vault",
  },
  "Liquidity Manager": {
    verb: "Provide managed liquidity on",
    action: "deposit into a managed pool, let it rebalance, then withdraw part of it",
    asset: "a managed pool",
  },
  "Liquid Restaking": {
    verb: "Restake through",
    action: "restake a small amount and hold the receipt token for several weeks",
    asset: "a restaking position",
  },
  Launchpad: {
    verb: "Join launches on",
    action: "stake for launch access, join one sale, then claim and hold the allocation",
    asset: "a launch allocation",
  },
  "NFT Marketplace": {
    verb: "Trade on",
    action: "list one item, place a bid on another, and complete one purchase",
    asset: "a listed item",
  },
  "Cross Chain Bridge": {
    verb: "Bridge through",
    action: "bridge a small amount between two chains and back, keeping the receipts",
    asset: "a cross-chain transfer",
  },
  "Interest Rate Derivatives": {
    verb: "Trade rate positions on",
    action: "open a fixed-rate position for a month and close it at expiry",
    asset: "a rate position",
  },
  "Token Locker": {
    verb: "Lock tokens with",
    action: "lock a small token amount for a month and verify the lock on the explorer",
    asset: "a token lock",
  },
  "Stablecoin Issuer": {
    verb: "Mint and redeem with",
    action: "mint the stablecoin with collateral, use it once, then redeem it back",
    asset: "the stablecoin",
  },
  Payments: {
    verb: "Pay and receive through",
    action: "send two small payments and receive one, using the protocol's rails",
    asset: "a payment",
  },
  "Decentralized AI": {
    verb: "Use the AI services of",
    action: "run one inference job and pay for it with the protocol's credits",
    asset: "an inference job",
  },
  "AI Agents": {
    verb: "Run an agent on",
    action: "deploy one agent task, fund it with a small budget and review its log",
    asset: "an agent task",
  },
  Insurance: {
    verb: "Buy cover on",
    action: "buy a small cover policy for one month and keep the policy receipt",
    asset: "a cover policy",
  },
  Indexes: {
    verb: "Buy the index of",
    action: "buy a small index position and hold it for a month, rebalancing once",
    asset: "an index position",
  },
  Farm: {
    verb: "Farm the pools of",
    action: "stake in a farm pool, claim rewards weekly and compound them once",
    asset: "a farm pool",
  },
  Synthetics: {
    verb: "Mint synths on",
    action: "mint a small synthetic position, hold it a week, then burn it back",
    asset: "a synthetic position",
  },
  Options: {
    verb: "Trade options on",
    action: "buy one call and one put, then let one expire and close the other",
    asset: "an option contract",
  },
  Privacy: {
    verb: "Use the private transfers of",
    action: "make one shielded deposit and one shielded withdrawal a week apart",
    asset: "a shielded transfer",
  },
  "Crypto Card Issuer": {
    verb: "Spend with the card of",
    action: "load the card with a small amount and make two everyday purchases",
    asset: "a card top-up",
  },
};

const DEFAULT_ACTION = {
  verb: "Use",
  action: "make a small deposit, use the core feature once, then withdraw part of it",
  asset: "a small position",
};

function money(tvl: number): string {
  if (tvl >= 1_000_000_000) return "$" + (tvl / 1_000_000_000).toFixed(1) + "B";
  return "$" + Math.round(tvl / 1_000_000) + "M";
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** Build 5 concrete farm steps for a protocol, from its category and chains. */
export function farmSteps(p: SnapshotProtocol, implied: number): string[] {
  const chain = p.chains.length > 0 ? p.chains[0] : "Ethereum";
  const otherChain = p.chains.length > 1 ? p.chains[1] : null;
  const act = CATEGORY_ACTIONS[p.category ?? ""] ?? DEFAULT_ACTION;
  const size = p.tvl_usd >= 500_000_000 ? "$200–$500" : "$50–$200";
  const steps: string[] = [
    `Set up a fresh wallet and bridge ${size} in stablecoins to ${chain} for ${p.name} (bridge fee ~$1–$5, ~10 minutes). Keep a little native gas aside.`,
    `${act.verb} ${p.name} on ${chain}: ${act.action} with ${size} of ${act.asset} (gas ~$0.50–$3 per transaction, ~15 minutes).`,
  ];
  if (otherChain !== null) {
    steps.push(
      `Repeat the core action on ${otherChain} too, so your activity spans both ${chain} and ${otherChain} (another ${size}, gas ~$1–$3, ~15 minutes).`,
    );
  } else {
    steps.push(
      `Do a second, different interaction on ${chain} — for example a swap, a second deposit or a governance vote — to show breadth, not a single click (gas ~$0.50–$2, ~10 minutes).`,
    );
  }
  steps.push(
    `Return once a week for a month: repeat the main action, claim any points or rewards, and leave most funds in place (each visit ~$1–$3 in gas, ~10 minutes).`,
  );
  steps.push(
    `Before any token launch, check ${p.name}'s own announcements and record your wallet activity: TVL ${money(p.tvl_usd)}, implied value about ${fmtUsd(implied)}, and keep receipts of every transaction.`,
  );
  return steps.map((s) => s.trim()).filter((s) => s.length >= 20 && s.length <= 600);
}

export { fmtUsd };
