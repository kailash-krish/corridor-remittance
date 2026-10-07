/**
 * database.ts
 *
 * In-memory database fallback for local/test development.
 * In production, swap the in-memory maps with Supabase calls.
 *
 * Tables mimicked:
 *   wallets   (user_id, address, encrypted_key, created_at)
 *   chain_txs (transfer_id, method, tx_hash, created_at)
 *   listener_state (key, value)  — for event-listener checkpoint
 */

export interface WalletRow {
  user_id:       string;
  address:       string;
  encrypted_key: string; // AES-256-GCM cipher text (never plaintext)
  created_at:    string;
}

export interface ChainTxRow {
  transfer_id: string;
  method:      string; // "mintStable" | "lockForTransfer" | "releaseToReceiver" | "burnStable" | "refund"
  tx_hash:     string;
  created_at:  string;
}

// -------------------------------------------------------------------
// In-memory store (used when Supabase creds are dummies / in tests)
// -------------------------------------------------------------------
const wallets   = new Map<string, WalletRow>();   // key = user_id
const chainTxs  = new Map<string, ChainTxRow>();  // key = `${transferId}:${method}`
const listenerState = new Map<string, string>();  // key = "lastBlock"

export const db = {
  wallets: {
    async findByUserId(userId: string): Promise<WalletRow | null> {
      return wallets.get(userId) ?? null;
    },
    async save(row: WalletRow): Promise<void> {
      wallets.set(row.user_id, row);
    },
  },

  chainTxs: {
    async find(transferId: string, method: string): Promise<ChainTxRow | null> {
      return chainTxs.get(`${transferId}:${method}`) ?? null;
    },
    async save(row: ChainTxRow): Promise<void> {
      chainTxs.set(`${row.transfer_id}:${row.method}`, row);
    },
  },

  listenerState: {
    async get(key: string): Promise<string | null> {
      return listenerState.get(key) ?? null;
    },
    async set(key: string, value: string): Promise<void> {
      listenerState.set(key, value);
    },
  },
};
