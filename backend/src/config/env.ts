import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default("4000")
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SUPABASE_URL: z.string().url().default("https://xyzcompany.supabase.co"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default("dummy-service-role-key"),
  SUPABASE_JWT_SECRET: z.string().min(8).default(process.env.DEMO_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-chars-key")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid environment configuration");
}

export const env = parsedEnv.data;
