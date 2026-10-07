"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseScope = void 0;
const node_async_hooks_1 = require("node:async_hooks");
/** Each hosted request gets its own session snapshot; concurrent users never share maps. */
exports.databaseScope = new node_async_hooks_1.AsyncLocalStorage();
