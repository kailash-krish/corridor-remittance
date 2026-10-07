import pino from "pino";
import { env } from "../config/env.js";

const isDev = env.NODE_ENV === "development";
const isTest = env.NODE_ENV === "test";

export const logger = pino({
  level: isTest ? "silent" : isDev ? "debug" : "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      }
    : undefined
});
