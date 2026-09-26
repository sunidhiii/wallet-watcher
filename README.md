# Wallet Watcher and Withdrawal Builder

A small slice of a custody backend: it generates wallets deterministically,
tracks their balances on-chain, and builds (and optionally broadcasts)
withdrawal transactions.

- **Network:** Ethereum Sepolia (testnet)
- **Asset:** native ETH
- **Stack:** Node.js, TypeScript, [ethers v6](https://docs.ethers.org/v6/), Express

## How it works, in one paragraph

On startup, the service derives N wallets from a mnemonic (index-ordered, so
the same index always gives the same wallet), then starts polling each
wallet's balance on a timer. Whenever a poll sees a balance increase, it logs
an inflow. A separate API endpoint builds and signs an ETH transfer from any
watched wallet; it only touches the network, and only records an outflow, if
you explicitly ask it to broadcast.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: at minimum, set your own testnet-only MNEMONIC and an RPC URL
```

Fund a couple of the generated wallets with Sepolia test ETH (e.g. via a
public faucet) if you want to see real inflows/withdrawals. The addresses are
printed to the console on startup, and available via `GET /wallets`.

## Running

```bash
npm run dev      # ts-node, no build step - good for local development
# or
npm run build && npm start   # compiles to dist/, then runs the compiled JS
```

## Running the tests

```bash
npm test
```

Tests cover:
- **Wallet generation** - determinism, the "grow keeps a prefix / shrink is a
  prefix" property, and input validation (`tests/walletGenerator.test.ts`).
- **Transaction building** - correct recipient/value/nonce, a valid recoverable
  signature, and wei-level precision, all against a fake in-memory provider so
  no network access is needed (`tests/withdrawalBuilder.test.ts`).

## API

### `GET /wallets`

Returns every watched wallet's address and last-known balance (in wei).

```json
[
  { "index": 0, "address": "0xAbc...123", "balanceWei": "50000000000000000" },
  { "index": 1, "address": "0xDef...456", "balanceWei": "0" }
]
```

### `POST /withdraw`

Builds a withdrawal from one watched wallet. Set `"broadcast": false` (or
omit it) to only build and sign the transaction; set it to `true` to actually
send it.

Request body:

```json
{
  "walletIndex": 0,
  "to": "0x000000000000000000000000000000000000dEaD",
  "amountEth": "0.01",
  "broadcast": false
}
```

**Response when `broadcast` is false or omitted** - the built transaction,
its raw signed payload, and the signature that produced it:

```json
{
  "built": {
    "from": "0xAbc...123",
    "to": "0x000000000000000000000000000000000000dEaD",
    "value": "10000000000000000",
    "nonce": 4,
    "gasLimit": "21000",
    "maxFeePerGas": "1500000000",
    "maxPriorityFeePerGas": "1000000000",
    "chainId": "11155111"
  },
  "rawTransaction": "0x02f8...",
  "signature": { "r": "0x...", "s": "0x...", "v": 1 }
}
```

**Response when `broadcast` is true** - the transaction is sent, and an
outflow is logged immediately:

```json
{ "txHash": "0x9f1c..." }
```

Example:

```bash
curl -X POST http://localhost:3000/withdraw \
  -H "Content-Type: application/json" \
  -d '{"walletIndex": 0, "to": "0x000000000000000000000000000000000000dEaD", "amountEth": "0.01", "broadcast": false}'
```

## Deposit handling

The assignment asks that deposit-transaction aggregation *not* be
implemented, and instead asks for an explanation of two situations. The
tracker in this service works by polling each wallet's **balance** directly
(`provider.getBalance`), not by scanning or parsing individual incoming
transactions - so it never sees deposits as discrete events in the first
place, only as a change in balance between two poll ticks.

**Multiple deposits within one polling interval.** If two or more deposits
land on the same wallet between one poll and the next, the tracker only
observes the net difference: `current balance - last recorded balance`. That
whole difference is written as a single inflow log entry, dated to the poll
that detected it - not as separate entries per deposit, and not dated to when
each deposit actually landed on-chain. This is enough to satisfy "reflected
within 10 minutes," but it means the log records "a total of X arrived by
time T," not a deposit-by-deposit history. Recovering the individual deposits
would require the deliberately-out-of-scope aggregation (e.g. scanning blocks
for transfers to the address).

**The service being offline.** While the process isn't running, nothing
polls, so on-chain balance can move without the local record updating. On
restart, the very first poll compares the last-persisted balance to whatever
the balance is now, and - exactly as above - logs the whole accumulated
difference as one inflow entry, timestamped to when it was detected after
restart. No funds are lost or missed (the comparison is against the last
persisted value, however old), but a gap while offline is invisible: you get
one lump inflow on restart rather than a true timeline of what arrived while
the service was down.

## Trade-offs

- **JSON file instead of a real database.** `src/db.ts` reads and rewrites a
  single JSON file on every write. That's simple and easy to follow, but it's
  not safe under concurrent writes (e.g. a poll tick and a withdrawal
  finishing at the same instant). A production version would use SQLite or
  Postgres with real transactions.
- **Polling, not event subscriptions.** Simpler to reason about and to test,
  at the cost of the coarser per-interval inflow granularity described above.
  A production version might use `eth_getLogs`/websocket subscriptions for
  near-real-time, per-transaction detection.
- **Outflows are logged on broadcast, not on confirmation.** This matches the
  assignment's wording directly ("Outflows are recorded only when a
  withdrawal is actually broadcast"), but it means a log entry can exist for
  a transaction that later fails to confirm (e.g. it's dropped or replaced).
  A stricter version would reconcile against confirmed receipts.
- **Fixed 21000 gas limit.** Correct for a plain ETH transfer to an
  externally-owned account; a version supporting an ERC-20 token would need
  `provider.estimateGas` instead.
- **No authentication on the API.** Out of scope for this exercise; a real
  deployment would put `/withdraw` behind proper auth (API keys, mTLS, etc.)
  since it can move funds.
- **Single mnemonic, in-memory private keys.** Keys are derived once at
  startup and held in memory to sign - never written to disk or logged. For
  a production custody system you'd want an HSM or a dedicated signing
  service instead of holding keys in the same process as the HTTP API.

## Security notes

- Testnet only - the mnemonic in `.env.example` is the well-known public
  "hardhat/ganache" test mnemonic, which is safe to see in a repo because it
  holds no real funds. Replace it with your own testnet-only mnemonic.
- `.env` (and the local `data/db.json`) are excluded via `.gitignore` - never
  commit real secrets or a mnemonic that controls real funds.
