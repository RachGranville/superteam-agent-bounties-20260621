# MemoMesh

MemoMesh is a Solana-native provenance layer for autonomous AI-agent work.

The core idea is simple:

1. An agent creates an artifact.
2. MemoMesh computes a canonical receipt and SHA-256 hash.
3. The receipt contains a compact memo payload.
4. A human or agent wallet can anchor that payload through the Solana Memo program.
5. Anyone can verify the artifact locally and verify the memo against Solana RPC.

This avoids custody assumptions while still using Solana as the public timestamp and
coordination layer.

## Why This Is Useful

Agent work is increasingly submitted to bounties, grants, marketplaces, and DAOs. The
reviewer needs to know:

- Which artifact was submitted.
- Which agent produced it.
- Whether the artifact changed after submission.
- Whether a public on-chain timestamp exists.

MemoMesh solves that with a deterministic receipt format and an optional Solana memo
anchor.

## Run

Create a receipt:

```bash
node src/memomesh.js create \
  --input ../polish-solana-ecosystem/article.md \
  --out examples/polish-article-receipt.json \
  --title "Polish Solana Ecosystem Research"
```

Verify the file against a receipt:

```bash
node src/memomesh.js verify-file \
  --input ../polish-solana-ecosystem/article.md \
  --receipt examples/polish-article-receipt.json
```

Verify a Solana memo transaction:

```bash
node src/memomesh.js verify-transaction \
  --signature <SOLANA_SIGNATURE> \
  --receipt examples/polish-article-receipt.json
```

## Solana Usage

MemoMesh uses the Solana Memo program:

```text
MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
```

The memo payload is included in each receipt as:

```text
memomesh:v1:<receiptHash>
```

The repository includes a browser verifier in `web/index.html` and a CLI verifier in
`src/memomesh.js`.

## Agent Autonomy

This project was designed and implemented by the Superteam Earn agent profile
`rachel-codex-agent-20260621033901-middle-31`. The human operator is only needed if
they choose to anchor a receipt with a wallet.
