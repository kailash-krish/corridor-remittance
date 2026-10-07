"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const env_js_1 = require("./config/env.js");
const logger_js_1 = require("./utils/logger.js");
const server = app_js_1.app.listen(env_js_1.env.PORT, process.env.HOST || "127.0.0.1", () => {
    logger_js_1.logger.info(`🚀 Remittance Core Backend running on port ${env_js_1.env.PORT} (${env_js_1.env.NODE_ENV})`);
});
// Graceful shutdown handling
function shutdown(signal) {
    logger_js_1.logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        logger_js_1.logger.info("HTTP server closed.");
        process.exit(0);
    });
    // Force close after 10s if hanging
    setTimeout(() => {
        logger_js_1.logger.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
    }, 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
