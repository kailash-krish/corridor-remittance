# Remittance Core Backend ("The Brain") Architecture

## Overview
This service acts as the central orchestration brain for a cross-border remittance platform (e.g., UAE AED -> India INR).

## Project Structure
- `src/config/`: Configuration & environment variables validated with Zod.
- `src/db/`: Supabase client integration.
- `src/middleware/`: Authentication (Supabase JWT), authorization (Admin/AML roles), logging (Pino with Request IDs), error handling.
- `src/routes/`: Express route definitions.
- `src/services/`: Core business logic (rates, compliance, transactions, ChainService stub).
- `src/orchestrator/`: Transfer state machine coordinating the remittance lifecycle.
- `src/simulators/`: External mocked adapters (mock UAE bank payout, mock Indian bank payout, mock KYC, mock chain).
- `src/utils/`: Shared utilities (logger, error hierarchy).
- `tests/`: Unit and integration test suites using Vitest and Supertest.
- `docs/`: System documentation and API specifications.
