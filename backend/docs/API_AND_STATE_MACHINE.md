# API Specification & State Machine Documentation

## Transfer Orchestrator State Machine

```
              ┌─────────┐
              │ CREATED │
              └────┬────┘
                   │
                   ▼
              ┌───────────┐
              │ KYC_CHECK ├────────────┐
              └────┬──────┘            │ (KYC Rejected)
                   │ (KYC Approved)    ▼
                   ▼              ┌──────────┐
           ┌────────────────┐     │ REJECTED │◄──────────┐
           │ AWAITING_FUNDS │     └──────────┘           │
           └───────┬────────┘                            │ (AML Sanction / Rejected)
                   │ (Funds Deposited)                   │
                   ▼                                     │
           ┌────────────────┐                            │
           │ FUNDS_RECEIVED │                            │
           └───────┬────────┘                            │
                   │                                     │
                   ▼                                     │
             ┌───────────┐                               │
             │ AML_CHECK ├───────────────────────────────┤
             └─┬───────┬─┘                               │
               │       │ (Suspicious / High value)       │
        (Pass) │       ▼                                 │
               │  ┌────────────┐                         │
               │  │ AML_REVIEW ├─────────────────────────┘
               │  └─────┬──────┘
               │        │ (Admin Approved)
               ▼        ▼
            ┌────────────┐
            │ CONVERTING │ (ChainService: Mint/Swap/Burn)
            └─────┬──────┘
                  │
                  ▼
          ┌────────────────┐
          │ PAYOUT_PENDING │ (IMPS / UPI Rail Payout)
          └───────┬────────┘
                  │
                  ▼
            ┌───────────┐
            │ COMPLETED │
            └───────────┘

Terminal States:
- REJECTED: KYC rejected or AML violation
- CANCELLED: User requested cancellation before funds conversion
- FAILED: Banking rail or blockchain settlement error
- REFUNDED: Sender refunded following payout failure
```

## API Endpoints Summary

### Auth & Health
- `GET /health` - System health, timestamp, and version
- `GET /api/auth/me` - Authenticated user identity inspection
- `GET /api/admin/ping` - Admin role check

### Quotes / FX (`/quotes`)
- `POST /quotes` - Generate locked quote with 60s guaranteed expiry
  - Input: `{ "sourceCurrency": "AED", "targetCurrency": "INR", "sendAmountMinor": 100000 }`
  - Output: Fees, exchange rate, net receive amount in minor units, expiry timestamp.
- `GET /quotes/:id` - Inspect quote details and dynamic seconds remaining.
- `GET /quotes` - List user's quotes.

### KYC Verifier (`/kyc`)
- `POST /kyc/submit` - Submit identity verification payload (name, DOB, ID type/number, country)
  - ID ending in `0000`: `REJECTED`
  - ID ending in `9999`: `REVIEW`
  - Other IDs: `APPROVED`
- `GET /kyc/status` - Current verification status (`NOT_STARTED`, `PENDING`, `APPROVED`, `REJECTED`, `REVIEW`)

### Transfers (`/transfers`)
- `POST /transfers` - Initialize transfer referencing locked quote and recipient details
- `GET /transfers` - List current user's transfers
- `GET /transfers/:id` - Full transfer status, amounts, blockchain transaction hash, bank payout reference, and chronological audit event timeline
- `POST /transfers/:id/cancel` - Cancel transfer (permitted during `CREATED`, `KYC_CHECK`, `AWAITING_FUNDS`)
- `POST /transfers/:id/deposit` - Simulate sender UAE bank deposit (triggers automatic AML -> Conversion -> Payout pipeline)
- `POST /transfers/:id/aml-review` - Admin endpoint to approve or reject transfer in `AML_REVIEW` status
