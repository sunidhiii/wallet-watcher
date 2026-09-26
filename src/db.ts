import fs from "fs";
import path from "path";

export interface BalanceLogEntry {
  address: string;
  type: "inflow" | "outflow";
  amountWei: string;
  txHash?: string;
  timestamp: string; // ISO 8601
}

interface DbShape {
  // address (lowercase) -> balance in wei, as a decimal string
  balances: Record<string, string>;
  log: BalanceLogEntry[];
}

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

/**
 * This is a deliberately simple persistence layer: a single JSON file, read
 * and rewritten in full on every write. That's easy to read/reason about and
 * is enough for this take-home's scope, but it is NOT safe under concurrent
 * writes (see README "Trade-offs"). A real service would use SQLite/Postgres
 * with proper transactions instead.
 */
function ensureDbFile(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial: DbShape = { balances: {}, log: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
}

function readDb(): DbShape {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw) as DbShape;
}

function writeDb(db: DbShape): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function getBalance(address: string): string {
  const db = readDb();
  return db.balances[address.toLowerCase()] ?? "0";
}

export function getAllBalances(): Record<string, string> {
  return readDb().balances;
}

export function setBalance(address: string, balanceWei: string): void {
  const db = readDb();
  db.balances[address.toLowerCase()] = balanceWei;
  writeDb(db);
}

export function appendLog(entry: BalanceLogEntry): void {
  const db = readDb();
  db.log.push(entry);
  writeDb(db);
}

export function getLog(): BalanceLogEntry[] {
  return readDb().log;
}
