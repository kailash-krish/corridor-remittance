import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

const schema = z.object({
  RPC_URL:                z.string().default("http://127.0.0.1:8545"),
  ADMIN_PRIVATE_KEY:      z.string().min(64),
  MASTER_ENCRYPTION_KEY:  z.string().length(64, "Must be 64 hex chars (32 bytes)"),
  SUPABASE_URL:           z.string().default("https://xyzcompany.supabase.co"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default("dummy"),
  CORE_BACKEND_URL:       z.string().default("http://localhost:4000"),
  WEBHOOK_HMAC_SECRET:    z.string().min(16),
  CONFIRMATIONS_REQUIRED: z.string().default("1").transform(Number),
  EVENT_POLL_INTERVAL_MS: z.string().default("2000").transform(Number),
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error("❌ Invalid environment variables:", result.error.format());
  process.exit(1);
}
export const config = result.data;
