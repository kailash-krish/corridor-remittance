# Security Review & Team Handoff (Person 3 ➔ Person 2 & 1)

## 1. Security Architecture & Threat Model

### A. Custodial Key Management
- **At-Rest Encryption**: Private keys are encrypted using AES-256-GCM (`crypto.ts`) with a 96-bit random initialization vector (IV) per key.
- **Tamper Detection**: GCM authentication tags are verified during decryption. If ciphertext is altered in the database, decryption immediately fails.
- **Zero Raw Key Leakage**: Methods never return raw private keys. Keys only exist in memory during the instant an ethers transaction is signed, and are never logged or exported to client-facing endpoints.

### B. Smart Contract Protections
- **OpenZeppelin Standard**: Built on battle-tested OpenZeppelin v5 libraries (`ERC20`, `AccessControl`, `ERC20Pausable`, `ReentrancyGuard`).
- **Role Separation**:
  - `DEFAULT_ADMIN_ROLE`: Contract administration.
  - `MINTER_ROLE`: Only the platform operator can mint.
  - `BURNER_ROLE`: Only the operator can burn after off-chain payout.
  - `PAUSER_ROLE`: Emergency freeze if abnormal activity is detected.
- **Reentrancy Protection**: `nonReentrant` modifier applied to `lock`, `release`, and `refund` methods.
- **Strict State Invariants**:
  - `NONE ➔ LOCKED`: Only once per `transferId` (prevents double-spend and duplicate locks).
  - `LOCKED ➔ RELEASED`: Only callable once from `LOCKED`.
  - `LOCKED ➔ REFUNDED`: Only callable once from `LOCKED`.

### C. Webhook Authenticity
- Event listener signs all outgoing webhook payloads using HMAC-SHA256 (`X-Chain-Signature` header).
- Person 2's backend verifies this header using `WEBHOOK_HMAC_SECRET` before processing.

---

## 2. API Contract with Person 2 (Core Backend)

Person 2's orchestrator can import the service directly:
```typescript
import { ChainService } from "../chain-service/src/chainService";

const chainService = new ChainService();

// Step 1: Mint after fiat deposit
const mintReceipt = await chainService.mintStable(transferId, senderUserId, amountMinor);

// Step 2: Lock tokens into escrow
const lockReceipt = await chainService.lockForTransfer(transferId, senderUserId, receiverUserId, amountMinor);

// Step 3 (Success): Release upon payout
const releaseReceipt = await chainService.releaseToReceiver(transferId);

// Step 4 (Success): Burn tokens
const burnReceipt = await chainService.burnStable(transferId, receiverUserId, amountMinor);

// Alternative (Failure): Refund
const refundReceipt = await chainService.refund(transferId);
```

---

## 3. Decimal & Minor Unit Mapping

| Currency | Entity | Representation | Scale / Decimals | Example (100 AED) |
|---|---|---|---|---|
| **AED** | Person 2 Core Backend | Fils (integer) | 2 (`* 100`) | `10000` |
| **RMTS** | Blockchain Contract | Token Units | 6 (`* 10^6`) | `100000000` |
| **Conversion** | Scale Factor | `x 10,000` | `10^(6 - 2)` | `10000 * 10000 = 100000000` |
