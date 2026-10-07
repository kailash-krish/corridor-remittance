import { AsyncLocalStorage } from 'node:async_hooks';
import type { InMemoryDatabase } from './repository.js';
/** Each hosted request gets its own session snapshot; concurrent users never share maps. */
export const databaseScope = new AsyncLocalStorage<InMemoryDatabase>();
