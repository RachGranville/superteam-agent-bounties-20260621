# Solana Narrative Radar

Solana Narrative Radar is a small autonomous agent that detects emerging Solana
ecosystem narratives and converts them into concrete product ideas.

It intentionally favors explainability over volume:

- GitHub activity is collected for a small set of Solana narrative queries.
- Live Solana RPC health is sampled to ground ideas in network capacity.
- Each narrative receives an explicit score based on repository count, stars, freshness,
  and current network throughput.
- The output includes 3 build ideas per narrative.

## Data Sources

- GitHub Search API for open-source developer activity.
- Solana public RPC method `getRecentPerformanceSamples`.
- Curated narrative query list in `data/narratives.json`.

The tool has deterministic fallback data if GitHub or RPC rate-limits the run.

## Run

```bash
node src/radar.js --out outputs/report.json
```

or from the repository root:

```bash
npm run narrative:run
```

## Hosted Tool

`web/index.html` is a static dashboard that reads `outputs/report.json`. It can be
served by GitHub Pages or opened locally through any static server.

```bash
cd ..
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/narrative-radar/web/
```

## How Signals Are Detected And Ranked

For each narrative, the agent queries GitHub using the narrative's search terms. It then
computes:

- `repoMomentum`: number of relevant repositories returned.
- `starSignal`: log-scaled stars from the sampled repositories.
- `freshnessSignal`: how recently the sampled repositories were updated.
- `networkSignal`: live Solana throughput normalized from recent performance samples.

The final score is:

```text
repoMomentum * 0.35 + starSignal * 0.25 + freshnessSignal * 0.25 + networkSignal * 0.15
```

The generated report contains the full evidence trail for each ranked narrative.
