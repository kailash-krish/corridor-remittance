"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const requestLogger_js_1 = require("./middleware/requestLogger.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const auth_js_1 = require("./middleware/auth.js");
const health_js_1 = require("./routes/health.js");
const quotes_js_1 = require("./routes/quotes.js");
const kyc_js_1 = require("./routes/kyc.js");
const transfers_js_1 = require("./routes/transfers.js");
const simulators_js_1 = require("./routes/simulators.js");
const adminAml_js_1 = require("./routes/adminAml.js");
const notifications_js_1 = require("./routes/notifications.js");
const errors_js_1 = require("./utils/errors.js");
function createApp() {
    const app = (0, express_1.default)();
    // Basic security and parsing middlewares
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // Structured logging with unique request-id
    app.use(requestLogger_js_1.requestLogger);
    // Core endpoints
    app.use("/health", health_js_1.healthRouter);
    app.use("/quotes", quotes_js_1.quotesRouter);
    app.use("/kyc", kyc_js_1.kycRouter);
    app.use("/transfers", transfers_js_1.transfersRouter);
    app.use("/sim", simulators_js_1.simulatorsRouter);
    app.use("/admin/aml", adminAml_js_1.adminAmlRouter);
    app.use("/notifications", notifications_js_1.notificationsRouter);
    // Auth inspection endpoints (used for testing and user context checks)
    app.get("/api/auth/me", auth_js_1.requireAuth, (req, res) => {
        res.status(200).json({
            user: req.user
        });
    });
    // Admin-protected endpoint
    app.get("/api/admin/ping", auth_js_1.requireAuth, auth_js_1.requireAdmin, (_req, res) => {
        res.status(200).json({
            message: "Admin access granted"
        });
    });
    // 404 handler for undefined routes
    app.use((req, _res, next) => {
        next(new errors_js_1.NotFoundError(`Route not found: ${req.method} ${req.path}`));
    });
    // Centralized error handler
    app.use(errorHandler_js_1.errorHandler);
    return app;
}
exports.app = createApp();
