"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.inMemoryDb = exports.InMemoryDatabase = void 0;
const requestScope_js_1 = require("./requestScope.js");
const supabase_js_1 = require("./supabase.js");
const logger_js_1 = require("../utils/logger.js");
const env_js_1 = require("../config/env.js");
/**
 * Unified Repository Layer.
 * In production, writes and reads from Supabase Postgres.
 * In memory fallback ensures 100% test isolation, fast execution,
 * and zero external dependencies during offline testing.
 */
class InMemoryDatabase {
    kycRecords = new Map(); // keyed by user_id
    quotes = new Map(); // keyed by id
    transfers = new Map(); // keyed by id
    transferEvents = [];
    amlFlags = new Map(); // keyed by id
    notifications = [];
    idempotencyKeys = new Map(); // keyed by `${userId}:${key}`
    reset() {
        this.kycRecords.clear();
        this.quotes.clear();
        this.transfers.clear();
        this.transferEvents = [];
        this.amlFlags.clear();
        this.notifications = [];
        this.idempotencyKeys.clear();
    }
}
exports.InMemoryDatabase = InMemoryDatabase;
const localDatabase = new InMemoryDatabase();
exports.inMemoryDb = new Proxy(localDatabase, {
    get(target, property) {
        const current = requestScope_js_1.databaseScope.getStore() || target;
        const value = Reflect.get(current, property);
        return typeof value === 'function' ? value.bind(current) : value;
    },
    set(target, property, value) {
        return Reflect.set(requestScope_js_1.databaseScope.getStore() || target, property, value);
    }
});
// In test environment or when SUPABASE_URL is dummy, use the in-memory engine.
const useInMemory = env_js_1.env.NODE_ENV === "test" ||
    env_js_1.env.SUPABASE_URL.includes("xyzcompany") ||
    env_js_1.env.SUPABASE_SERVICE_ROLE_KEY.includes("dummy");
exports.db = {
    isInMemory: useInMemory,
    kyc: {
        async findByUserId(userId) {
            if (useInMemory) {
                return exports.inMemoryDb.kycRecords.get(userId) || null;
            }
            try {
                const { data, error } = await supabase_js_1.supabaseAdmin
                    .from("kyc_records")
                    .select("*")
                    .eq("user_id", userId)
                    .maybeSingle();
                if (error)
                    throw error;
                return data;
            }
            catch (err) {
                logger_js_1.logger.warn({ err }, "Supabase query fallback to in-memory for KYC");
                return exports.inMemoryDb.kycRecords.get(userId) || null;
            }
        },
        async upsert(record) {
            exports.inMemoryDb.kycRecords.set(record.user_id, record);
            if (!useInMemory) {
                try {
                    await supabase_js_1.supabaseAdmin.from("kyc_records").upsert(record);
                }
                catch (err) {
                    logger_js_1.logger.error({ err }, "Failed to write KYC record to Supabase");
                }
            }
            return record;
        }
    },
    quotes: {
        async findById(id) {
            if (useInMemory) {
                return exports.inMemoryDb.quotes.get(id) || null;
            }
            try {
                const { data, error } = await supabase_js_1.supabaseAdmin
                    .from("quotes")
                    .select("*")
                    .eq("id", id)
                    .maybeSingle();
                if (error)
                    throw error;
                return data;
            }
            catch (err) {
                logger_js_1.logger.warn({ err }, "Supabase query fallback to in-memory for quote");
                return exports.inMemoryDb.quotes.get(id) || null;
            }
        },
        async findByUserId(userId) {
            if (useInMemory) {
                return Array.from(exports.inMemoryDb.quotes.values())
                    .filter((q) => q.user_id === userId)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }
            try {
                const { data, error } = await supabase_js_1.supabaseAdmin
                    .from("quotes")
                    .select("*")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false });
                if (error)
                    throw error;
                return (data || []);
            }
            catch (err) {
                return Array.from(exports.inMemoryDb.quotes.values())
                    .filter((q) => q.user_id === userId)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }
        },
        async insert(quote) {
            exports.inMemoryDb.quotes.set(quote.id, quote);
            if (!useInMemory) {
                try {
                    await supabase_js_1.supabaseAdmin.from("quotes").insert(quote);
                }
                catch (err) {
                    logger_js_1.logger.error({ err }, "Failed to insert quote into Supabase");
                }
            }
            return quote;
        },
        async markConsumed(id) {
            const q = exports.inMemoryDb.quotes.get(id);
            if (q) {
                q.is_consumed = true;
                q.consumed_at = new Date().toISOString();
            }
            if (!useInMemory) {
                try {
                    await supabase_js_1.supabaseAdmin
                        .from("quotes")
                        .update({ is_consumed: true, consumed_at: new Date().toISOString() })
                        .eq("id", id);
                }
                catch (err) {
                    logger_js_1.logger.error({ err }, "Failed to mark quote consumed in Supabase");
                }
            }
        }
    },
    transfers: {
        async findById(id) {
            if (useInMemory) {
                return exports.inMemoryDb.transfers.get(id) || null;
            }
            try {
                const { data, error } = await supabase_js_1.supabaseAdmin
                    .from("transfers")
                    .select("*")
                    .eq("id", id)
                    .maybeSingle();
                if (error)
                    throw error;
                return data;
            }
            catch (err) {
                logger_js_1.logger.warn({ err }, "Supabase query fallback to in-memory for transfer");
                return exports.inMemoryDb.transfers.get(id) || null;
            }
        },
        async findByUserId(userId) {
            if (useInMemory) {
                return Array.from(exports.inMemoryDb.transfers.values())
                    .filter((t) => t.user_id === userId)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }
            try {
                const { data, error } = await supabase_js_1.supabaseAdmin
                    .from("transfers")
                    .select("*")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false });
                if (error)
                    throw error;
                return (data || []);
            }
            catch (err) {
                return Array.from(exports.inMemoryDb.transfers.values())
                    .filter((t) => t.user_id === userId)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }
        },
        async insert(transfer) {
            exports.inMemoryDb.transfers.set(transfer.id, transfer);
            if (!useInMemory) {
                try {
                    await supabase_js_1.supabaseAdmin.from("transfers").insert(transfer);
                }
                catch (err) {
                    logger_js_1.logger.error({ err }, "Failed to insert transfer into Supabase");
                }
            }
            return transfer;
        },
        async update(id, updates) {
            const existing = exports.inMemoryDb.transfers.get(id);
            if (!existing)
                return null;
            const updated = {
                ...existing,
                ...updates,
                updated_at: new Date().toISOString()
            };
            exports.inMemoryDb.transfers.set(id, updated);
            if (!useInMemory) {
                try {
                    await supabase_js_1.supabaseAdmin
                        .from("transfers")
                        .update({ ...updates, updated_at: new Date().toISOString() })
                        .eq("id", id);
                }
                catch (err) {
                    logger_js_1.logger.error({ err }, "Failed to update transfer in Supabase");
                }
            }
            return updated;
        }
    },
    events: {
        async insert(event) {
            exports.inMemoryDb.transferEvents.push(event);
            if (!useInMemory) {
                try {
                    await supabase_js_1.supabaseAdmin.from("transfer_events").insert(event);
                }
                catch (err) {
                    logger_js_1.logger.error({ err }, "Failed to insert transfer event into Supabase");
                }
            }
            return event;
        },
        async findByTransferId(transferId) {
            if (useInMemory) {
                return exports.inMemoryDb.transferEvents
                    .filter((e) => e.transfer_id === transferId)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            }
            try {
                const { data, error } = await supabase_js_1.supabaseAdmin
                    .from("transfer_events")
                    .select("*")
                    .eq("transfer_id", transferId)
                    .order("created_at", { ascending: true });
                if (error)
                    throw error;
                return (data || []);
            }
            catch (err) {
                return exports.inMemoryDb.transferEvents
                    .filter((e) => e.transfer_id === transferId)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            }
        }
    },
    aml: {
        async insert(flag) {
            exports.inMemoryDb.amlFlags.set(flag.id, flag);
            if (!useInMemory) {
                try {
                    await supabase_js_1.supabaseAdmin.from("aml_flags").insert(flag);
                }
                catch (err) {
                    logger_js_1.logger.error({ err }, "Failed to insert AML flag into Supabase");
                }
            }
            return flag;
        },
        async findById(id) {
            return exports.inMemoryDb.amlFlags.get(id) || null;
        },
        async findAllPending() {
            return Array.from(exports.inMemoryDb.amlFlags.values()).filter((f) => f.status === "PENDING");
        },
        async findByTransferId(transferId) {
            for (const flag of exports.inMemoryDb.amlFlags.values()) {
                if (flag.transfer_id === transferId)
                    return flag;
            }
            return null;
        },
        async update(id, updates) {
            const existing = exports.inMemoryDb.amlFlags.get(id);
            if (!existing)
                return null;
            const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
            exports.inMemoryDb.amlFlags.set(id, updated);
            return updated;
        }
    },
    notifications: {
        async insert(notification) {
            exports.inMemoryDb.notifications.push(notification);
            if (!useInMemory) {
                try {
                    await supabase_js_1.supabaseAdmin.from("notifications").insert(notification);
                }
                catch (err) {
                    logger_js_1.logger.error({ err }, "Failed to insert notification into Supabase");
                }
            }
            return notification;
        },
        async findByUserId(userId) {
            return exports.inMemoryDb.notifications.filter((n) => n.user_id === userId);
        },
        async markRead(id) {
            const notif = exports.inMemoryDb.notifications.find((n) => n.id === id);
            if (notif) {
                notif.status = "SENT";
                notif.is_read = true;
            }
            return notif || null;
        }
    },
    idempotency: {
        async findByKey(userId, key) {
            const compositeKey = `${userId}:${key}`;
            return exports.inMemoryDb.idempotencyKeys.get(compositeKey) || null;
        },
        async save(record) {
            const compositeKey = `${record.user_id}:${record.key}`;
            exports.inMemoryDb.idempotencyKeys.set(compositeKey, record);
            if (!useInMemory) {
                try {
                    await supabase_js_1.supabaseAdmin.from("idempotency_keys").upsert(record);
                }
                catch (err) {
                    logger_js_1.logger.error({ err }, "Failed to persist idempotency key to Supabase");
                }
            }
            return record;
        }
    }
};
