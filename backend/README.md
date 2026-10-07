# Cross-Border Remittance Platform: Complete Backend & Blockchain Layer

A full-fledged, production-grade cross-border remittance system (UAE **AED** $\rightarrow$ India **INR**) comprising:
1. **The Brain (Person 2)**: Core Backend API, State Machine Orchestrator, AML Rules Engine, KYC Verifier, and Banking Rail Simulators.
2. **The Blockchain & Wallet Layer (Person 3)**: Solidity Smart Contracts (`RemittanceStable`, `RemittanceEscrow`), AES-256-GCM Custodial Wallet Service, `ChainService` adapter, and Real-Time Event Listener.

---

## 🏗️ System Architecture & Corridors

```
[ Sender in UAE ] (AED)
       │
       ▼
[ Core Express API (Person 2) ] ── (Zod / JWT / Idempotency)
       │
       ├─► [ KYC Service ] ──────► APPROVED
       ├─► [ FX Service ] ───────► Lock 60s Guaranteed Quote
       ├─► [ AML Rules Engine ] ─► Low (Auto-clear) / Medium / High (Hold)
       │
       ▼
[ Fiat-In Simulator ] ──────────► Inbound UAE Bank Deposit Confirmed
       │
       ▼
[ ChainService & Escrow (Person 3) ]
       │
       ├─► 1. RemittanceStable.mint (RMTS to Sender Custodial Wallet)
       ├─► 2. RemittanceEscrow.lock (Escrow holds AED-pegged RMTS tokens)
       │
       ▼
[ Banking Payout Rail (IMPS / UPI) ] ──► INR Settled to Beneficiary in India
       │
       ├─► (Success) ──► RemittanceEscrow.release ──► RemittanceStable.burn
       └─► (Failure) ──► RemittanceEscrow.refund  ──► Tokens Returned & REFUNDED
```

---

## 📁 Repository Structure

```
.
├── docs/                                  # Core Backend Architecture & API Specifications
│   ├── ARCHITECTURE.md                    # Core system architecture
│   ├── API_CONTRACT.md                    # UI integration contract
│   └── API_AND_STATE_MACHINE.md           # Full transition state machine
├── src/                                   # Core Backend Source (Person 2)
│   ├── config/                            # Environment config (Zod)
│   ├── db/                                # DB Repository + In-Memory Fallback + Migrations
│   ├── middleware/                        # JWT Auth, Idempotency, Pino Logger, Error Handling
│   ├── orchestrator/                      # Remittance transfer state machine
│   ├── routes/                            # REST Endpoints (Quotes, Transfers, KYC, Simulators, Admin)
│   ├── services/                          # FX Rates, AML Rules, Notifications, ChainService stub
│   ├── simulators/                        # Bank Simulator (IMPS/UPI) & Fiat-In Simulator
│   └── utils/                             # Retry helper, Standard AppError, Logger
├── tests/                                 # Core Backend Vitest Suite (11 suites, 43 tests)
│
└── chain-service/                         # Blockchain & Wallet Layer (Person 3)
    ├── contracts/                         # Solidity 0.8.24 Smart Contracts
    │   ├── RemittanceStable.sol           # ERC-20 RMTS token (6 dec, Pausable, AccessControl)
    │   └── RemittanceEscrow.sol           # Escrow contract with ReentrancyGuard & state machine
    ├── src/                               # Blockchain Service Layer
    │   ├── chainService.ts                # Ethers v6 ChainService implementation
    │   ├── chainService.interface.ts      # Strict interface contract with Person 2
    │   ├── chainServiceAdapter.ts         # Bridge adapter for legacy orchestrator
    │   ├── walletService.ts               # Custodial wallet generator
    │   ├── crypto.ts                      # AES-256-GCM authenticated encryption/decryption
    │   ├── conversion.ts                  # Scaling between AED minor units & RMTS tokens
    │   ├── listener.ts                    # Event listener with HMAC-signed webhooks
    │   └── database.ts                    # Wallet & Tx hash persistence
    ├── scripts/                           # Hardhat deployment scripts
    │   └── deploy.ts                      # Automated local/testnet deployer
    ├── test/                              # Hardhat Test Suite (19 tests)
    │   ├── RemittanceStable.test.ts       # Stablecoin unit tests
    │   ├── RemittanceEscrow.test.ts       # Escrow unit tests
    │   └── integration.test.ts            # End-to-end integration tests
    ├── docs/                              # Blockchain Security & Handoff
    │   └── SECURITY_AND_HANDOFF.md        # Cryptographic pass & threat model
    ├── hardhat.config.ts                  # Hardhat configuration (Local, Sepolia, Amoy)
    └── README.md                          # Blockchain-specific documentation
```

---

## ⚡ Quick Start & Verification

### 1. Test Core Backend (Person 2)
```bash
# In the root directory
npm install
npm test
```
> **Status:** 11 / 11 test files passed (43 / 43 tests passing)

### 2. Test Blockchain & Wallet Layer (Person 3)
```bash
# In chain-service directory
cd chain-service
npm install
npm test
```
> **Status:** 19 / 19 tests passing (Unit + End-to-End Integration)

### 3. Deploy Smart Contracts to Local Node
```bash
# Terminal 1: Start local Ethereum node
cd chain-service
npx hardhat node

# Terminal 2: Deploy RemittanceStable & RemittanceEscrow
cd chain-service
npm run deploy:local
```
*(Contract addresses are automatically saved to `chain-service/deployments/deployment.json`)*

### 4. Run Core Backend Server
```bash
# In root directory
npm run dev
# Server starts on http://localhost:4000
```

### 5. Run Chain Event Listener
```bash
# In chain-service directory
cd chain-service
npm run listener
```
*(Watches for on-chain `Locked`, `Released`, `Refunded` events and pushes HMAC-SHA256 signed webhooks to the Core Backend)*

---

## 🔒 Security & Data Integrity Highlights

1. **Integer Minor Units**: All monetary values are handled in integer minor units (fils for AED, paise for INR) — zero floating-point arithmetic.
2. **Custodial Key Protection**: Ethereum private keys are encrypted using **AES-256-GCM** with a master key and 96-bit random IVs; private keys are never logged and never exposed over APIs.
3. **On-Chain Idempotency**: `RemittanceEscrow` strictly keys transfers by `transferId` hash, preventing double-locking and reentrancy attacks.
4. **Webhook Authentication**: Outgoing blockchain webhook payloads are signed via HMAC-SHA256 headers (`X-Chain-Signature`).
5. **Circuit Breakers**: `RemittanceStable` includes OpenZeppelin `Pausable` for emergency freezes.
