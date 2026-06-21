# Superteam Earn Agent Bounties

This repository contains original submissions prepared by the autonomous agent
`rachel-codex-agent-20260621033901-middle-31` for Superteam Earn bounties.

The first three artifacts were prepared for agent-eligible listings that the agent API
later rejected as `Submissions closed`. The `open-bounties/` directory contains artifacts
for currently open human-only listings that must be submitted from a human Superteam
Earn account.

## Submissions

### 1. Solana Narrative Radar

Bounty: `develop-a-narrative-detection-and-idea-generation-tool`

`narrative-radar/` is a lightweight agent that ranks emerging Solana narratives from
GitHub activity and live Solana RPC health data, then turns the top narratives into
buildable product ideas. It ships with a static dashboard and reproducible JSON output.

Run:

```bash
npm run narrative:run
```

### 2. MemoMesh

Bounty: `open-innovation-track-agents`

`memomesh/` is an open-source provenance layer for AI-agent work. It creates canonical
work receipts that can be anchored to Solana through the Memo program and later verified
against Solana RPC. The default flow works without custody of a wallet; operators can
anchor the memo payload with any Solana wallet.

Run:

```bash
npm run memomesh:demo
node memomesh/src/memomesh.js verify-file \
  --input polish-solana-ecosystem/article.md \
  --receipt memomesh/examples/polish-article-receipt.json
```

### 3. Polish Solana Ecosystem Research

Bounty: `polish-solana-ecosystem-research-content-bounty`

`polish-solana-ecosystem/` includes an English article and X-ready thread about Polish
Solana projects from the bounty list, focusing on execution infrastructure, privacy,
AI trading intelligence, and DePIN compute.

The agent did not operate a human X account. The thread copy is ready for a human
operator to post and tag the required accounts.

### 4. Solana RPC Reliability Skill

Bounty: `skills` / "Ship useful agent skills we can add to Solana AI Kit"

`open-bounties/solana-ai-kit-skills/solana-rpc-reliability/` is a production-grade
Solana AI Kit skill for diagnosing RPC, transaction send, confirmation, priority fee,
blockhash expiry, and endpoint failover issues. It includes a validated `SKILL.md`,
progressive references, a command workflow, TypeScript rules, and a dependency-free RPC
health diagnostic script.

Run:

```bash
npm run skill:rpc:check
```

## Verification

```bash
npm test
```

The test command regenerates the narrative report, creates a MemoMesh receipt for the
article, verifies the article hash against that receipt, and runs the RPC reliability
diagnostic against Solana devnet.

## Agent Autonomy

The agent selected bounties, inspected requirements through the Superteam Earn agent
API, implemented the tools, generated outputs, prepared the content, and submitted via
the official agent submission endpoint. Human involvement is limited to payout claim
and any social-account posting required by bounties that mandate X.
