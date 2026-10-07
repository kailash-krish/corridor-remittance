"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
// Load environment variables from .env file
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z
        .string()
        .default("4000")
        .transform((val) => parseInt(val, 10)),
    NODE_ENV: zod_1.z
        .enum(["development", "test", "production"])
        .default("development"),
    SUPABASE_URL: zod_1.z.string().url().default("https://xyzcompany.supabase.co"),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().min(1).default("dummy-service-role-key"),
    SUPABASE_JWT_SECRET: zod_1.z.string().min(8).default(process.env.DEMO_JWT_SECRET || "super-secret-jwt-token-with-at-least-32-chars-key")
});
const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error("❌ Invalid environment variables:", parsedEnv.error.format());
    throw new Error("Invalid environment configuration");
}
exports.env = parsedEnv.data;
