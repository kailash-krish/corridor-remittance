# API Contract Specification

> **For UI / Frontend Teammates & Integration Partners**  
> Core Backend Base URL: `http://localhost:4000`

---

## 1. Authentication & Common Headers

### Headers
| Header | Type | Description | Required |
|---|---|---|---|
| `Authorization` | `Bearer <JWT>` | Supabase Auth Access Token | Yes (for protected endpoints) |
| `Idempotency-Key` | `UUID / String` | Unique client key to prevent double charges / duplicate submits | Recommended on `POST` |
| `Content-Type` | `application/json` | Request payload format | Yes for `POST` bodies |
| `x-request-id` | `UUID / String` | Traceability identifier (echoed back in response) | Optional |

### Standard Error Format
All errors return HTTP status $\ge$ 400 with this standard JSON body:
```json
{
  "error": {
    "code": "BAD_REQUEST | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | IDEMPOTENCY_CONFLICT | INVALID_STATE_TRANSITION | INTERNAL_SERVER_ERROR",
    "message": "Human readable error description",
    "details": null
  }
}
```

---

## 2. API Endpoints

### 🩺 Health & Auth Status
- **`GET /health`**  
  *Returns:* System health, uptime, timestamp.
- **`GET /api/auth/me`**  
  *Returns:* Decoded Supabase user context (`id`, `email`, `role`, `metadata`).

---

### 💵 Quotes / FX (`/quotes`)
- **`POST /quotes`**  
  *Body:*
  ```json
  {
    "sourceCurrency": "AED",
    "targetCurrency": "INR",
    "sendAmountMinor": 100000
  }
  ```
  *(Note: 100,000 fils = 1,000.00 AED)*  
  *Response (201 Created):*
  ```json
  {
    "data": {
      "id": "c1f7a0b2-...",
      "source_currency": "AED",
      "target_currency": "INR",
      "send_amount_minor": 100000,
      "fee_minor": 1000,
      "receive_amount_minor": 2247795,
      "exchange_rate": 22.705,
      "expires_at": "2026-10-06T18:30:00.000Z",
      "expiresInSeconds": 60,
      "status": "ACTIVE"
    }
  }
  ```
- **`GET /quotes/:id`**  
  *Returns:* Quote by ID, including remaining seconds and current status (`ACTIVE`, `EXPIRED`, `CONSUMED`).
- **`GET /quotes`**  
  *Returns:* Array of user's active/past quotes.

---

### 🪪 KYC Identity (`/kyc`)
- **`POST /kyc/submit`**  
  *Body:*
  ```json
  {
    "fullName": "Rashid Al Mansoori",
    "dateOfBirth": "1993-04-12",
    "idType": "NATIONAL_ID",
    "idNumber": "784-1993-1234567-1",
    "country": "ARE"
  }
  ```
  *Deterministic Rules (for demo / testing):*
  - ID ending in `0000` $\rightarrow$ `REJECTED` (Sanctions match)
  - ID ending in `9999` $\rightarrow$ `REVIEW` (Low document quality)
  - All other IDs $\rightarrow$ `APPROVED`
- **`GET /kyc/status`**  
  *Response (200 OK):*
  ```json
  {
    "data": {
      "status": "APPROVED | PENDING | REVIEW | REJECTED | NOT_STARTED",
      "record": { ... }
    }
  }
  ```

---

### 🚀 Transfers (`/transfers`)
- **`POST /transfers`**  
  *Headers:* `Idempotency-Key: <unique-uuid>`  
  *Body:*
  ```json
  {
    "quoteId": "c1f7a0b2-...",
    "senderAccountId": "AE290331234567890123456",
    "recipientDetails": {
      "name": "Amit Kumar",
      "account_number": "123456789012",
      "ifsc": "HDFC0001234",
      "upi_id": "amit@okhdfcbank",
      "country": "IND"
    }
  }
  ```
  *Response (201 Created):*
  ```json
  {
    "data": {
      "id": "99b8214f-...",
      "status": "AWAITING_FUNDS",
      "source_currency": "AED",
      "target_currency": "INR",
      "send_amount_minor": 100000,
      "receive_amount_minor": 2247795,
      "fee_minor": 1000,
      "exchange_rate": 22.705,
      "blockchain_tx_hash": null,
      "payout_reference": null,
      "created_at": "..."
    }
  }
  ```
- **`GET /transfers`**  
  *Returns:* Array of all transfers initiated by authenticated user.
- **`GET /transfers/:id`**  
  *Returns:* Detailed transfer record + chronological audit event list.
- **`GET /transfers/:id/events`**  
  *Returns:* Append-only chronological audit log of all state transitions for the transfer.
- **`POST /transfers/:id/cancel`**  
  *Body (optional):* `{"reason": "Changed my mind"}`  
  *Allowed during:* `CREATED`, `KYC_CHECK`, `AWAITING_FUNDS`.

---

### 🏦 Simulators (`/sim`)
*(Mimics banking webhooks and callbacks into the orchestrator)*
- **`POST /sim/fiat-in/:transferId?mode=success | insufficient | timeout`**  
  - `success`: Confirms UAE deposit $\rightarrow$ moves to `FUNDS_RECEIVED` $\rightarrow$ triggers AML $\rightarrow$ converts $\rightarrow$ payouts.
  - `insufficient`: Marks transfer `FAILED` ("Insufficient deposit").
  - `timeout`: Marks transfer `FAILED` ("Deposit window timed out").
- **`POST /sim/payout/:transferId?mode=success | delayed | failed`**  
  - `success`: Confirms beneficiary bank payout $\rightarrow$ `COMPLETED`.
  - `delayed`: Logs transit delay event, remains `PAYOUT_PENDING`.
  - `failed`: Retries once; after max attempts marks `FAILED` and auto-refunds to `REFUNDED`.

---

### 🛡️ Admin AML Compliance (`/admin/aml`)
*(Requires `role: admin`)*
- **`GET /admin/aml/queue`**  
  *Returns:* Pending AML compliance review queue with transfer details and flagged rules.
- **`GET /admin/aml/:id`**  
  *Returns:* Specific AML flag and full transfer history.
- **`POST /admin/aml/:id/decision`**  
  *Body:*
  ```json
  {
    "decision": "approve | reject",
    "note": "Audited bank statement and tax declarations"
  }
  ```

---

### 🔔 Notifications (`/notifications`)
- **`GET /notifications`**  
  *Returns:* List of user notifications.
- **`POST /notifications/:id/read`**  
  *Returns:* Notification with `is_read: true`.
