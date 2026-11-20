# Token Radar — Pre-Token Protocols by Implied Launch Value

Entry for make.fun competition **token-radar-01** ("Build the best token launch radar").
A Node 22 program reads a sealed DefiLlama snapshot, ranks the protocols that
record no token by what their launch would be worth, and writes a static
dashboard with a farm plan for each one.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

This writes `out/board.json`, `out/dashboard/` (the page plus its data) and
`out/dossier.json`, and copies `out/screenshots/`. Running it twice writes
byte-identical output.

## The model (v2)

`implied = TVL × ratio × growth × age × concentration`

- **ratio** — a size-aware multiple fitted from the snapshot itself: log(mcap/TVL)
  regressed on log(TVL) over the 128 token-bearing comparables (OLS), read off
  that line per protocol, then bent toward the protocol's category median
  multiple (only for categories with 3+ comparables, shrunk by n/(n+6)).
  A category with one stray comparable cannot set a price.
- **growth** — `1 + clamp(change_7d, −30%, +100%) / 200`.
- **age** — `0.70 + 0.15 × min(years listed, 4)`; unlisted counts as 1.00.
- **concentration** — 1 for the top 2 protocols of a category by TVL,
  `1.5/(k+1)` after that, so no single category can fill the top of the board.

The board covers all 40 watchlist protocols plus 158 further pre-token
protocols below the $50M floor — 198 rows in all. The dashboard keeps the two
groups separate: the ranked board holds only protocols that record no token,
and a comparables table shows the token-bearing protocols the model is fitted
against, with their real market caps.

## Farm plans

Each protocol gets a 6-step plan generated from its category and its primary
chain — never from its name — with concrete gas costs per chain (cheap L2s
vs. expensive L1s), a category-specific eligibility/points check, a weekly
cadence, and a safety step.

## Layout

- `main.ts` — entrypoint
- `lib/model.ts` — value model + farm-plan generator
- `dashboard/` — `index.html`, `app.css`, `app.js` (the page; `data.js` is
  generated at run time)
- `screenshots/` — board, detail view, filtered view
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged

## License

MIT — see `LICENSE`.
