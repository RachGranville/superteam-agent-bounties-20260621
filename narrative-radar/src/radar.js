import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = resolve(__dirname, "../outputs/report.json");
const NARRATIVES_PATH = resolve(__dirname, "../data/narratives.json");
const GITHUB_API = "https://api.github.com/search/repositories";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function daysSince(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return 365;
  return Math.max(0, (Date.now() - date.getTime()) / 86_400_000);
}

function normalize(value, max) {
  return Math.max(0, Math.min(1, value / max));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "rachel-codex-solana-narrative-radar",
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchGithubRepos(query) {
  const search = new URL(GITHUB_API);
  search.searchParams.set("q", `${query} in:name,description,readme pushed:>2025-01-01`);
  search.searchParams.set("sort", "updated");
  search.searchParams.set("order", "desc");
  search.searchParams.set("per_page", "8");

  const data = await fetchJson(search);
  return (data.items ?? []).map((repo) => ({
    name: repo.full_name,
    description: repo.description,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    url: repo.html_url,
    topics: repo.topics ?? []
  }));
}

async function fetchSolanaHealth() {
  const body = {
    jsonrpc: "2.0",
    id: "narrative-radar",
    method: "getRecentPerformanceSamples",
    params: [5]
  };
  const response = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const samples = data.result ?? [];
  const avgTps = samples.length
    ? samples.reduce((sum, sample) => sum + sample.numTransactions / sample.samplePeriodSecs, 0) / samples.length
    : 0;
  return {
    rpc: SOLANA_RPC,
    sampleCount: samples.length,
    averageTransactionsPerSecond: Math.round(avgTps),
    rawSamples: samples
  };
}

function fallbackRepos(narrativeId) {
  const base = {
    "agent-commerce": ["solana-foundation/awesome-solana-ai", "solana-labs/solana-pay"],
    "zk-privacy": ["darklakefi/darklake", "anza-xyz/solana-zk-sdk"],
    "depin-compute": ["helium/helium-program-library", "hivemapper/solana-programs"],
    "trading-automation": ["jup-ag/jupiter-swap-api-client", "openbook-dex/program"],
    "token-extensions": ["solana-program/token-2022", "solana-labs/solana-program-library"]
  };
  return (base[narrativeId] ?? ["solana-labs/solana"]).map((name, index) => ({
    name,
    description: "Fallback repository seed used when live API access is unavailable.",
    stars: 10 - index,
    forks: 1,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: new Date(Date.now() - index * 7 * 86_400_000).toISOString(),
    url: `https://github.com/${name}`,
    topics: ["solana"]
  }));
}

function scoreNarrative(narrative, repos, solanaHealth) {
  const unique = new Map();
  for (const repo of repos) unique.set(repo.name, repo);
  const uniqueRepos = [...unique.values()];
  const stars = uniqueRepos.reduce((sum, repo) => sum + repo.stars, 0);
  const averageFreshness = uniqueRepos.length
    ? uniqueRepos.reduce((sum, repo) => sum + Math.max(0, 120 - daysSince(repo.updatedAt)), 0) / uniqueRepos.length
    : 0;

  const repoMomentum = normalize(uniqueRepos.length, 18);
  const starSignal = normalize(Math.log10(stars + 1), 4);
  const freshnessSignal = normalize(averageFreshness, 120);
  const networkSignal = normalize(solanaHealth.averageTransactionsPerSecond, 5_000);
  const score = repoMomentum * 0.35 + starSignal * 0.25 + freshnessSignal * 0.25 + networkSignal * 0.15;

  return {
    id: narrative.id,
    title: narrative.title,
    score: Number((score * 100).toFixed(2)),
    whyItMatters: narrative.whyItMatters,
    signals: {
      repoCount: uniqueRepos.length,
      starSample: stars,
      averageFreshnessDays: Number((uniqueRepos.reduce((sum, repo) => sum + daysSince(repo.updatedAt), 0) / Math.max(1, uniqueRepos.length)).toFixed(1)),
      networkTps: solanaHealth.averageTransactionsPerSecond
    },
    evidence: uniqueRepos.slice(0, 8),
    buildIdeas: narrative.ideas
  };
}

async function main() {
  const outPath = resolve(process.cwd(), getArg("--out", DEFAULT_OUT));
  const narratives = JSON.parse(await readFile(NARRATIVES_PATH, "utf8"));
  let solanaHealth;
  const sourceWarnings = [];

  try {
    solanaHealth = await fetchSolanaHealth();
  } catch (error) {
    sourceWarnings.push(`Solana RPC fallback used: ${error.message}`);
    solanaHealth = {
      rpc: SOLANA_RPC,
      sampleCount: 0,
      averageTransactionsPerSecond: 2_500,
      rawSamples: []
    };
  }

  const ranked = [];
  for (const narrative of narratives) {
    const repos = [];
    for (const query of narrative.queries) {
      try {
        repos.push(...await fetchGithubRepos(query));
      } catch (error) {
        sourceWarnings.push(`GitHub fallback for "${query}": ${error.message}`);
        repos.push(...fallbackRepos(narrative.id));
      }
    }
    ranked.push(scoreNarrative(narrative, repos, solanaHealth));
  }

  ranked.sort((a, b) => b.score - a.score);

  const report = {
    schema: "solana-narrative-radar/v1",
    generatedAt: new Date().toISOString(),
    agent: "rachel-codex-agent-20260621033901-middle-31",
    dataSources: [
      "GitHub Search API",
      "Solana mainnet-beta getRecentPerformanceSamples",
      "Curated narrative definitions"
    ],
    sourceWarnings,
    solanaHealth,
    detectedNarratives: ranked,
    summary: ranked.slice(0, 3).map((item) => ({
      title: item.title,
      score: item.score,
      firstIdea: item.buildIdeas[0]
    }))
  };

  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  for (const item of ranked.slice(0, 5)) {
    console.log(`${item.score.toFixed(2).padStart(6)} ${item.title}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
