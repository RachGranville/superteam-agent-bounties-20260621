import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const AGENT = "rachel-codex-agent-20260621033901-middle-31";

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function sha256(bufferOrText) {
  return createHash("sha256").update(bufferOrText).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function createReceipt() {
  const inputArg = arg("--input");
  const inputPath = resolve(process.cwd(), inputArg);
  const outPath = resolve(process.cwd(), arg("--out", "receipt.json"));
  const title = arg("--title", basename(inputPath));
  const content = await readFile(inputPath);
  const artifactHash = sha256(content);
  const createdAt = new Date().toISOString();

  const core = {
    schema: "memomesh/v1",
    title,
    agent: AGENT,
    createdAt,
    artifact: {
      path: inputArg,
      fileName: basename(inputPath),
      sha256: artifactHash,
      byteLength: content.length
    }
  };
  const receiptHash = sha256(canonicalize(core));
  const receipt = {
    ...core,
    receiptHash,
    solana: {
      memoProgram: MEMO_PROGRAM,
      memoPayload: `memomesh:v1:${receiptHash}`,
      rpcVerificationMethod: "getTransaction",
      anchorInstructions: [
        "Open any Solana wallet or CLI that can send a Memo program transaction.",
        `Use memo payload: memomesh:v1:${receiptHash}`,
        "Save the resulting transaction signature.",
        "Run verify-transaction with the signature and this receipt."
      ]
    }
  };

  await writeFile(outPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`Receipt written to ${outPath}`);
  console.log(`Memo payload: ${receipt.solana.memoPayload}`);
}

async function verifyFile() {
  const inputPath = resolve(process.cwd(), arg("--input"));
  const receiptPath = resolve(process.cwd(), arg("--receipt"));
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const content = await readFile(inputPath);
  const actual = sha256(content);
  if (actual !== receipt.artifact.sha256) {
    throw new Error(`Hash mismatch. expected=${receipt.artifact.sha256} actual=${actual}`);
  }
  console.log(`OK ${basename(inputPath)} matches receipt ${receipt.receiptHash}`);
}

async function rpc(method, params, rpcUrl) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "memomesh", method, params })
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

function transactionContainsMemo(transaction, memoPayload) {
  const instructions = transaction?.transaction?.message?.instructions ?? [];
  const accountKeys = transaction?.transaction?.message?.accountKeys ?? [];
  const logs = transaction?.meta?.logMessages ?? [];

  const directMemo = instructions.some((instruction) => {
    const programId = instruction.programId?.toString?.() ?? instruction.programId;
    if (programId === MEMO_PROGRAM && instruction.parsed === memoPayload) return true;
    if (programId === MEMO_PROGRAM && JSON.stringify(instruction).includes(memoPayload)) return true;
    const indexProgram = Number.isInteger(instruction.programIdIndex)
      ? accountKeys[instruction.programIdIndex]
      : null;
    return indexProgram === MEMO_PROGRAM && JSON.stringify(instruction).includes(memoPayload);
  });

  return directMemo || logs.some((line) => line.includes(memoPayload));
}

async function verifyTransaction() {
  const signature = arg("--signature");
  const receiptPath = resolve(process.cwd(), arg("--receipt"));
  const rpcUrl = arg("--rpc", DEFAULT_RPC);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const transaction = await rpc("getTransaction", [
    signature,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }
  ], rpcUrl);
  if (!transaction) throw new Error("Transaction not found");
  if (!transactionContainsMemo(transaction, receipt.solana.memoPayload)) {
    throw new Error("Transaction does not contain the expected MemoMesh payload");
  }
  console.log(`OK Solana transaction contains ${receipt.solana.memoPayload}`);
}

function help() {
  console.log(`Usage:
  node src/memomesh.js create --input <file> --out <receipt.json> [--title <title>]
  node src/memomesh.js verify-file --input <file> --receipt <receipt.json>
  node src/memomesh.js verify-transaction --signature <sig> --receipt <receipt.json> [--rpc <url>]`);
}

const command = process.argv[2];
try {
  if (command === "create") await createReceipt();
  else if (command === "verify-file") await verifyFile();
  else if (command === "verify-transaction") await verifyTransaction();
  else help();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
