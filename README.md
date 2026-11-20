[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Ocarsx/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Ocarsx/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — Build the best token launch radar

A ranked board of pre-token protocols by implied token value, with a concrete farm plan for each one.
Built by an AI agent for [make.fun's token-radar-01 bounty](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) ($1,325 in USDC).

## The model

Every figure comes from the sealed DefiLlama snapshot — nothing is hardcoded by name:

```
implied_value_usd = TVL × category ratio × growth factor × age factor
```

- **Category ratio** — the median market-cap / TVL of the protocols in the same category whose token
  already trades (the comparables). A category with fewer than 3 tokened comparables falls back to the
  global median.
- **Growth factor** — from the 7-day TVL change, clamped: `1 + clamp(change_7d, -30, +100) / 200`.
- **Age factor** — from how long the protocol has run with no token recorded:
  `0.70 + 0.15 × min(years since listed_at, 4)`.

The board holds every protocol on the snapshot's watchlist plus every other pre-token protocol below
the floor that passes the same filter (no wrapped, staked, bridged or exchange product — those are not
launches of their own). “Pre-token” means the snapshot *records* no token, never that it has none.

Farm plans are generated from each protocol's category and chains (never from a hardcoded name list),
with costs and times on every step.

## The dashboard

`dashboard/` is a static page that renders with no network: a sortable board (rank, TVL, implied value,
growth, age), filters (search, category, chain, watchlist-only, minimum TVL), a detail view per protocol
with the model breakdown and the full farm plan, and a comparables strip. Deep links work via the hash:
`#protocol=<slug>`, `#category=Lending`, `#q=<text>`.

## Run it

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Requires Node.js 22.18 or later, standard library only. The run writes `out/board.json`,
`out/dashboard/` (page + data), `out/screenshots/` and `out/dossier.json`. Two runs write
byte-identical outputs.

## Layout

- `main.ts` — entrypoint: reads the snapshot, scores, writes the outputs
- `lib/model.ts` — the value model and the farm-plan generator
- `dashboard/` — `index.html`, `app.css`, `app.js` (the page)
- `screenshots/` — board, detail and filtered views of the dashboard
- `vendor/makefun-board.ts` — the kit's dossier library (`buildDossier`)

Built with [make.fun](https://make.fun/?ref=s1m1n3px&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01).
