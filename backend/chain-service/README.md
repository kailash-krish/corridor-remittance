# Blockchain & Custodial Wallet Layer (Person 3)

Part of the **Cross-Border Blockchain Remittance Platform** (UAE AED ➔ India INR).

This module contains:
1. **RemittanceStable (`RMTS`)**: ERC-20 token (6 decimals, Pausable, AccessControl for Minter/Burner).
2. **RemittanceEscrow**: Smart contract managing on-chain escrow locks per `transferId` with ReentrancyGuard and strictly enforced state transitions (`NONE` ➔ `LOCKED` ➔ `RELEASED` | `REFUNDED`).
3. **WalletService**: Custodial Ethereum wallet generation where private keys are encrypted with **AES-256-GCM** using a master key. Keys are never logged and never exposed over APIs.
4. **ChainService**: Concrete implementation fulfilling the `ChainServiceInterface` contract for Person 2's core backend orchestrator. Supports on-chain and in-memory idempotency.
5. **ChainEventListener**: Background event listener watching contract events and dispatching HMAC-SHA256 signed webhooks to Person 2's backend.
6. **Token Conversions**: Scaling logic between backend AED minor units (fils, 2 decimals) and RMTS token units (6 decimals).

---

## Architecture Flow

```
[Person 2 Orchestrator]
       |
       | 1. fiat-in confirmed
       v
[ChainService.mintStable] ──> RemittanceStable.mint (sender custodial address)
       |
       | 2. lock
       v
[ChainService.lockForTransfer] ──> RemittanceEscrow.lock
       |
       +-------------------------------+
       | (Success Path)                | (Failure Path)
       v                               v
[ChainService.releaseToReceiver]     [ChainService.refund]
       |                               |
       v                               v
[ChainService.burnStable]        Tokens returned to sender
```

---

## Getting Started

### 1. Install Dependencies
```bash
cd chain-service
npm install
```

### 2. Compile Smart Contracts
```bash
npm run compile
```

### 3. Run Tests
```bash
npm run test
```

### 4. Start Local Node & Deploy
```bash
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
npm run deploy:local
```

### 5. Run Event Listener
```bash
npm run listener
```
