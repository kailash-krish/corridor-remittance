"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
const node_crypto_1 = __importDefault(require("node:crypto"));
const logger_js_1 = require("../utils/logger.js");
function requestLogger(req, res, next) {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] || node_crypto_1.default.randomUUID();
    req.id = requestId;
    res.setHeader("X-Request-Id", requestId);
    req.log = logger_js_1.logger.child({ requestId });
    req.log.debug({ method: req.method, url: req.url }, "Incoming request");
    res.on("finish", () => {
        const duration = Date.now() - startTime;
        req.log.info({
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            durationMs: duration
        }, "Request completed");
    });
    next();
}
