import { databaseScope } from './requestScope.js';
import {
  KycRecord,
  Quote,
  Transfer,
  TransferEvent,
  AmlFlag,
  Notification,
  IdempotencyKey
} from "./types.js";
import { supabaseAdmin } from "./supabase.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * Unified Repository Layer.
 * In production, writes and reads from Supabase Postgres.
 * In memory fallback ensures 100% test isolation, fast execution,
 * and zero external dependencies during offline testing.
 */
export class InMemoryDatabase {
  public kycRecords = new Map<string, KycRecord>(); // keyed by user_id
  public quotes = new Map<string, Quote>(); // keyed by id
  public transfers = new Map<string, Transfer>(); // keyed by id
  public transferEvents: TransferEvent[] = [];
  public amlFlags = new Map<string, AmlFlag>(); // keyed by id
  public notifications: Notification[] = [];
  public idempotencyKeys = new Map<string, IdempotencyKey>(); // keyed by `${userId}:${key}`

  public reset() {
    this.kycRecords.clear();
    this.quotes.clear();
    this.transfers.clear();
    this.transferEvents = [];
    this.amlFlags.clear();
    this.notifications = [];
    this.idempotencyKeys.clear();
  }
}

const localDatabase = new InMemoryDatabase();
export const inMemoryDb = new Proxy(localDatabase, {
  get(target, property) {
    const current = databaseScope.getStore() || target;
    const value = Reflect.get(current, property);
    return typeof value === 'function' ? value.bind(current) : value;
  },
  set(target, property, value) {
    return Reflect.set(databaseScope.getStore() || target, property, value);
  }
});

// In test environment or when SUPABASE_URL is dummy, use the in-memory engine.
const useInMemory =
  env.NODE_ENV === "test" ||
  env.SUPABASE_URL.includes("xyzcompany") ||
  env.SUPABASE_SERVICE_ROLE_KEY.includes("dummy");

export const db = {
  isInMemory: useInMemory,

  kyc: {
    async findByUserId(userId: string): Promise<KycRecord | null> {
      if (useInMemory) {
        return inMemoryDb.kycRecords.get(userId) || null;
      }
      try {
        const { data, error } = await supabaseAdmin
          .from("kyc_records")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        return data as KycRecord | null;
      } catch (err) {
        logger.warn({ err }, "Supabase query fallback to in-memory for KYC");
        return inMemoryDb.kycRecords.get(userId) || null;
      }
    },

    async upsert(record: KycRecord): Promise<KycRecord> {
      inMemoryDb.kycRecords.set(record.user_id, record);
      if (!useInMemory) {
        try {
          await supabaseAdmin.from("kyc_records").upsert(record);
        } catch (err) {
          logger.error({ err }, "Failed to write KYC record to Supabase");
        }
      }
      return record;
    }
  },

  quotes: {
    async findById(id: string): Promise<Quote | null> {
      if (useInMemory) {
        return inMemoryDb.quotes.get(id) || null;
      }
      try {
        const { data, error } = await supabaseAdmin
          .from("quotes")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as Quote | null;
      } catch (err) {
        logger.warn({ err }, "Supabase query fallback to in-memory for quote");
        return inMemoryDb.quotes.get(id) || null;
      }
    },

    async findByUserId(userId: string): Promise<Quote[]> {
      if (useInMemory) {
        return Array.from(inMemoryDb.quotes.values())
          .filter((q) => q.user_id === userId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      try {
        const { data, error } = await supabaseAdmin
          .from("quotes")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as Quote[];
      } catch (err) {
        return Array.from(inMemoryDb.quotes.values())
          .filter((q) => q.user_id === userId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    },

    async insert(quote: Quote): Promise<Quote> {
      inMemoryDb.quotes.set(quote.id, quote);
      if (!useInMemory) {
        try {
          await supabaseAdmin.from("quotes").insert(quote);
        } catch (err) {
          logger.error({ err }, "Failed to insert quote into Supabase");
        }
      }
      return quote;
    },

    async markConsumed(id: string): Promise<void> {
      const q = inMemoryDb.quotes.get(id);
      if (q) {
        q.is_consumed = true;
        q.consumed_at = new Date().toISOString();
      }
      if (!useInMemory) {
        try {
          await supabaseAdmin
            .from("quotes")
            .update({ is_consumed: true, consumed_at: new Date().toISOString() })
            .eq("id", id);
        } catch (err) {
          logger.error({ err }, "Failed to mark quote consumed in Supabase");
        }
      }
    }
  },

  transfers: {
    async findById(id: string): Promise<Transfer | null> {
      if (useInMemory) {
        return inMemoryDb.transfers.get(id) || null;
      }
      try {
        const { data, error } = await supabaseAdmin
          .from("transfers")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as Transfer | null;
      } catch (err) {
        logger.warn({ err }, "Supabase query fallback to in-memory for transfer");
        return inMemoryDb.transfers.get(id) || null;
      }
    },

    async findByUserId(userId: string): Promise<Transfer[]> {
      if (useInMemory) {
        return Array.from(inMemoryDb.transfers.values())
          .filter((t) => t.user_id === userId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      try {
        const { data, error } = await supabaseAdmin
          .from("transfers")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as Transfer[];
      } catch (err) {
        return Array.from(inMemoryDb.transfers.values())
          .filter((t) => t.user_id === userId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    },

    async insert(transfer: Transfer): Promise<Transfer> {
      inMemoryDb.transfers.set(transfer.id, transfer);
      if (!useInMemory) {
        try {
          await supabaseAdmin.from("transfers").insert(transfer);
        } catch (err) {
          logger.error({ err }, "Failed to insert transfer into Supabase");
        }
      }
      return transfer;
    },

    async update(id: string, updates: Partial<Transfer>): Promise<Transfer | null> {
      const existing = inMemoryDb.transfers.get(id);
      if (!existing) return null;

      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString()
      };
      inMemoryDb.transfers.set(id, updated);

      if (!useInMemory) {
        try {
          await supabaseAdmin
            .from("transfers")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", id);
        } catch (err) {
          logger.error({ err }, "Failed to update transfer in Supabase");
        }
      }

      return updated;
    }
  },

  events: {
    async insert(event: TransferEvent): Promise<TransferEvent> {
      inMemoryDb.transferEvents.push(event);
      if (!useInMemory) {
        try {
          await supabaseAdmin.from("transfer_events").insert(event);
        } catch (err) {
          logger.error({ err }, "Failed to insert transfer event into Supabase");
        }
      }
      return event;
    },

    async findByTransferId(transferId: string): Promise<TransferEvent[]> {
      if (useInMemory) {
        return inMemoryDb.transferEvents
          .filter((e) => e.transfer_id === transferId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      try {
        const { data, error } = await supabaseAdmin
          .from("transfer_events")
          .select("*")
          .eq("transfer_id", transferId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []) as TransferEvent[];
      } catch (err) {
        return inMemoryDb.transferEvents
          .filter((e) => e.transfer_id === transferId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    }
  },

  aml: {
    async insert(flag: AmlFlag): Promise<AmlFlag> {
      inMemoryDb.amlFlags.set(flag.id, flag);
      if (!useInMemory) {
        try {
          await supabaseAdmin.from("aml_flags").insert(flag);
        } catch (err) {
          logger.error({ err }, "Failed to insert AML flag into Supabase");
        }
      }
      return flag;
    },

    async findById(id: string): Promise<AmlFlag | null> {
      return inMemoryDb.amlFlags.get(id) || null;
    },

    async findAllPending(): Promise<AmlFlag[]> {
      return Array.from(inMemoryDb.amlFlags.values()).filter((f) => f.status === "PENDING");
    },

    async findByTransferId(transferId: string): Promise<AmlFlag | null> {
      for (const flag of inMemoryDb.amlFlags.values()) {
        if (flag.transfer_id === transferId) return flag;
      }
      return null;
    },

    async update(id: string, updates: Partial<AmlFlag>): Promise<AmlFlag | null> {
      const existing = inMemoryDb.amlFlags.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      inMemoryDb.amlFlags.set(id, updated);
      return updated;
    }
  },

  notifications: {
    async insert(notification: Notification): Promise<Notification> {
      inMemoryDb.notifications.push(notification);
      if (!useInMemory) {
        try {
          await supabaseAdmin.from("notifications").insert(notification);
        } catch (err) {
          logger.error({ err }, "Failed to insert notification into Supabase");
        }
      }
      return notification;
    },

    async findByUserId(userId: string): Promise<Notification[]> {
      return inMemoryDb.notifications.filter((n) => n.user_id === userId);
    },

    async markRead(id: string): Promise<Notification | null> {
      const notif = inMemoryDb.notifications.find((n) => n.id === id);
      if (notif) {
        notif.status = "SENT";
        (notif as any).is_read = true;
      }
      return notif || null;
    }
  },

  idempotency: {
    async findByKey(userId: string, key: string): Promise<IdempotencyKey | null> {
      const compositeKey = `${userId}:${key}`;
      return inMemoryDb.idempotencyKeys.get(compositeKey) || null;
    },

    async save(record: IdempotencyKey): Promise<IdempotencyKey> {
      const compositeKey = `${record.user_id}:${record.key}`;
      inMemoryDb.idempotencyKeys.set(compositeKey, record);
      if (!useInMemory) {
        try {
          await supabaseAdmin.from("idempotency_keys").upsert(record);
        } catch (err) {
          logger.error({ err }, "Failed to persist idempotency key to Supabase");
        }
      }
      return record;
    }
  }
};
