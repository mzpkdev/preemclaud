# Webhook Notification System — Task Decomposition

**Source spec:** `silver-beacon` (webhook-spec.md)
**Tech stack:** Node.js, PostgreSQL, Redis (Bull), React

---

## Task 1: Database Schema & Data Model

**Assignee role:** Backend developer
**Priority:** P0 (blocking for Tasks 2, 3, 4)

**Description:** Design and implement the PostgreSQL schema for the webhook system.

**Deliverables:**
- `webhooks` table: id, user_id, url, secret (encrypted), active (boolean), created_at, updated_at
- `webhook_event_subscriptions` table: webhook_id, event_type
- `webhook_delivery_logs` table: id, webhook_id, event_type, payload, status (pending/success/failed), response_code, response_time_ms, attempt_number, next_retry_at, created_at
- Migration files for all tables
- Encryption utility for storing/retrieving webhook secrets

**Acceptance criteria:**
- Migrations run cleanly on a fresh database
- Secrets are stored encrypted at rest, decryptable at delivery time
- Indexes on: webhook_id + event_type (subscriptions), webhook_id + status + created_at (delivery logs)

**Dependencies:** None

---

## Task 2: Webhook CRUD API

**Assignee role:** Backend developer
**Priority:** P0 (blocking for Tasks 5, 6)

**Description:** Implement REST endpoints for managing webhook configurations.

**Deliverables:**
- `POST /webhooks` — create a new webhook (URL, event types, optional secret auto-generated if omitted)
- `GET /webhooks` — list webhooks for the authenticated user
- `GET /webhooks/:id` — get a single webhook
- `PUT /webhooks/:id` — update webhook (URL, event types, active/inactive toggle)
- `DELETE /webhooks/:id` — soft or hard delete a webhook
- Input validation (valid URL, supported event types, etc.)
- Unit tests for all endpoints

**Acceptance criteria:**
- All CRUD operations work and are scoped to the authenticated user
- Invalid inputs return 400 with descriptive error messages
- Secret is never returned in plaintext in GET responses (masked or omitted)
- Test coverage for happy paths and error cases

**Dependencies:** Task 1 (schema)

---

## Task 3: Event Queue & Delivery Worker

**Assignee role:** Backend developer (systems/infrastructure leaning)
**Priority:** P0

**Description:** Build the event publishing and delivery pipeline using Redis and Bull.

**Deliverables:**
- Event publisher: function that accepts an event type + payload, enqueues it to the Bull queue
- Delivery worker: consumes queue jobs, looks up all active webhooks subscribed to that event type, fans out delivery to each
- HTTP delivery: POST to webhook URL with JSON payload, include `X-Signature` header (HMAC-SHA256 of body using webhook secret)
- Log each delivery attempt to `webhook_delivery_logs` with status, response code, response time
- Timeout handling (e.g., 10s per request)

**Acceptance criteria:**
- Events published to the queue are picked up and delivered to all matching webhooks
- Payload is signed with HMAC-SHA256; signature is verifiable by the receiver
- Each delivery attempt is recorded in the delivery log
- Worker handles endpoint errors gracefully (timeouts, 5xx, network errors) without crashing

**Dependencies:** Task 1 (schema)

---

## Task 4: Retry Logic with Exponential Backoff

**Assignee role:** Backend developer
**Priority:** P1

**Description:** Implement retry handling for failed webhook deliveries using Bull's built-in retry capabilities.

**Deliverables:**
- Configure Bull job retry with exponential backoff schedule: 1m, 5m, 25m, 2h, 12h (max 5 attempts)
- On each failed attempt, update `webhook_delivery_logs` with attempt number and next_retry_at
- After final failure (attempt 5), mark delivery as permanently failed
- Auto-disable webhook if it fails consistently (e.g., 50 consecutive failures — optional, discuss with team)

**Acceptance criteria:**
- Failed deliveries are retried on the correct schedule
- Delivery log accurately reflects each attempt
- After 5 failures, no further retries are attempted
- Retry behavior is verified with integration tests (use mock endpoints)

**Dependencies:** Task 3 (delivery worker)

---

## Task 5: Management UI — Webhook CRUD

**Assignee role:** Frontend developer
**Priority:** P1

**Description:** Build the React UI for managing webhook configurations.

**Deliverables:**
- Webhooks list view: table showing URL (truncated), subscribed events, status (active/inactive), created date, actions (edit/delete)
- Create webhook form: URL input, event type multi-select, auto-generate secret toggle
- Edit webhook form: same fields plus active/inactive toggle
- Delete confirmation dialog
- Loading, empty, and error states for all views

**Acceptance criteria:**
- User can list, create, edit, and delete webhooks through the UI
- Event type selector shows all available event types
- Form validation matches API constraints (valid URL, at least one event type)
- Responsive layout

**Dependencies:** Task 2 (CRUD API)

---

## Task 6: Management UI — Delivery Logs & Actions

**Assignee role:** Frontend developer
**Priority:** P1

**Description:** Build the delivery log viewer and action buttons (manual retry, test ping).

**Deliverables:**
- Delivery log view per webhook: table with event type, status, response code, response time, timestamp, attempt number
- Filters: status (success/failed/pending), event type, date range
- Manual retry button on failed deliveries — calls API to re-enqueue the delivery
- Test ping button on webhook detail view — sends a test event to verify the endpoint is reachable
- Pagination for log entries

**Acceptance criteria:**
- Logs display correctly with all columns
- Filters work independently and in combination
- Manual retry triggers a new delivery attempt and refreshes the log
- Test ping sends a well-known test payload and displays the result (success/failure + response code)

**Dependencies:** Task 2 (CRUD API), Task 3 (delivery worker)

---

## Task 7: Test Ping Endpoint

**Assignee role:** Backend developer
**Priority:** P1

**Description:** Implement the backend endpoint for sending a test ping to a webhook.

**Deliverables:**
- `POST /webhooks/:id/test` — sends a test payload to the webhook URL
- Uses the same signing and delivery logic as the real worker (HMAC-SHA256, same headers)
- Returns the delivery result synchronously (status code, response time, success/failure)
- Logs the test ping in the delivery log with a "test" flag

**Acceptance criteria:**
- Test ping uses identical delivery logic to real events (same signature, headers, format)
- Response includes enough detail for the UI to display result
- Works regardless of whether the webhook is active or inactive

**Dependencies:** Task 3 (delivery worker, for shared delivery logic)

---

## Task 8: Manual Retry Endpoint

**Assignee role:** Backend developer
**Priority:** P2

**Description:** Implement the backend endpoint to manually retry a failed delivery.

**Deliverables:**
- `POST /webhooks/:webhookId/deliveries/:deliveryId/retry` — re-enqueues the original event payload for delivery
- Creates a new delivery log entry linked to the original
- Returns 400 if the delivery is not in a failed state

**Acceptance criteria:**
- Manual retry re-delivers the exact original payload with a fresh signature
- A new log entry is created (does not overwrite the old one)
- Cannot retry a delivery that already succeeded or is still pending

**Dependencies:** Task 3 (delivery worker), Task 4 (retry logic)

---

## Dependency Graph

```
Task 1 (Schema)
├── Task 2 (CRUD API)
│   ├── Task 5 (UI: CRUD)
│   └── Task 6 (UI: Logs & Actions)
├── Task 3 (Queue & Worker)
│   ├── Task 4 (Retry Logic)
│   ├── Task 6 (UI: Logs & Actions)
│   ├── Task 7 (Test Ping)
│   └── Task 8 (Manual Retry)
└────────── Task 4 (Retry Logic)
            └── Task 8 (Manual Retry)
```

## Suggested Parallelization

| Phase | Tasks | Developers needed |
|-------|-------|-------------------|
| Phase 1 | Task 1 (Schema) | 1 backend |
| Phase 2 | Task 2 (CRUD API) + Task 3 (Queue & Worker) | 2 backend |
| Phase 3 | Task 4 (Retry) + Task 5 (UI: CRUD) + Task 7 (Test Ping) | 1 backend + 1 frontend |
| Phase 4 | Task 6 (UI: Logs) + Task 8 (Manual Retry) | 1 backend + 1 frontend |

## Open Questions (from spec, carry forward)

- Should we support custom headers on webhook requests? (Affects Tasks 2, 3, 5)
- Maximum payload size? (Affects Task 3 validation logic)
