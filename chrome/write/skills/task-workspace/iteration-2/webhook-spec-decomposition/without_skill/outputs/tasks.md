# Webhook Notification System — Task Decomposition

Source spec: `webhook-spec.md` (codename: **silver-beacon**)

---

## Task 1: Database Schema and Data Model

**Summary:** Design and implement the PostgreSQL schema for webhook configurations and delivery logs.

**What to build:**
- `webhooks` table: id, user_id, url, secret (encrypted), active flag, created_at, updated_at
- `webhook_event_subscriptions` table: webhook_id, event_type
- `webhook_deliveries` table: id, webhook_id, event_type, payload, status (pending/success/failed), response_code, response_time_ms, attempt_number, next_retry_at, created_at
- Migration scripts for all tables
- Encryption/decryption utility for the webhook secret field (HMAC-SHA256 signing requires the plaintext secret at delivery time)

**Depends on:** Nothing (can start immediately)

**Acceptance criteria:**
- Migrations run cleanly on a fresh database
- Secrets are stored encrypted at rest
- Schema supports all fields needed by the CRUD API and delivery pipeline

---

## Task 2: Webhook CRUD API

**Summary:** Build the REST API for managing webhook configurations.

**What to build:**
- `POST /webhooks` — create a new webhook (url, event types, secret)
- `GET /webhooks` — list all webhooks for the authenticated user
- `GET /webhooks/:id` — get a single webhook
- `PUT /webhooks/:id` — update webhook (url, events, active/inactive)
- `DELETE /webhooks/:id` — delete a webhook
- Input validation (valid URL, at least one event type, etc.)
- Secret is auto-generated if not provided; never returned in API responses

**Depends on:** Task 1 (database schema)

**Acceptance criteria:**
- Full CRUD lifecycle works end-to-end
- Validation rejects invalid URLs and empty event lists
- Secret is never exposed in GET responses
- Appropriate HTTP status codes and error messages

---

## Task 3: Event Queue and Delivery Worker

**Summary:** Implement the Redis/Bull queue that receives events and fans them out to matching webhooks.

**What to build:**
- Event publisher: a function other parts of the system call to emit events (e.g., `publishEvent(eventType, payload)`)
- Bull queue setup on Redis for webhook delivery jobs
- Worker process that:
  1. Picks up an event from the queue
  2. Queries active webhooks subscribed to that event type
  3. Creates a delivery job per matching webhook
- HTTP delivery logic: POST to the webhook URL with the event payload
- HMAC-SHA256 signature generation: sign the payload body with the webhook's secret and include in an `X-Webhook-Signature` header
- Log every delivery attempt in the `webhook_deliveries` table (status, response code, response time)

**Depends on:** Task 1 (database schema), Task 2 (webhook registry must exist to look up subscriptions)

**Acceptance criteria:**
- Events are delivered to all matching webhooks
- Payloads are signed with HMAC-SHA256 using the per-webhook secret
- Each delivery attempt is recorded with status, response code, and response time
- Worker handles endpoint timeouts and network errors gracefully

---

## Task 4: Retry Logic with Exponential Backoff

**Summary:** Add retry behavior to the delivery worker for failed webhook deliveries.

**What to build:**
- On delivery failure (non-2xx response or network error), schedule a retry with exponential backoff intervals: 1m, 5m, 25m, 2h, 12h
- Maximum 5 retry attempts per delivery
- Update `webhook_deliveries` record with attempt number and next_retry_at
- After final failure, mark delivery as permanently failed
- Use Bull's built-in delayed job feature for scheduling retries

**Depends on:** Task 3 (delivery worker)

**Acceptance criteria:**
- Failed deliveries are retried up to 5 times at the specified intervals
- Delivery log shows attempt count and next retry time
- After 5 failures, delivery is marked as permanently failed with no further retries

---

## Task 5: Management UI — Webhook List and CRUD Forms

**Summary:** Build the React frontend for listing, creating, editing, and deleting webhooks.

**What to build:**
- Webhook list page showing all configured webhooks (url, event types, active status)
- Create webhook form: URL input, event type multi-selector, active toggle
- Edit webhook form: same fields, pre-populated
- Delete confirmation dialog
- Active/inactive toggle directly from the list
- Connect to the CRUD API from Task 2

**Depends on:** Task 2 (CRUD API)

**Acceptance criteria:**
- Users can create, view, edit, and delete webhooks through the UI
- Event type selector shows all available event types
- Active/inactive status is togglable
- Form validation matches API validation (valid URL, at least one event type)

---

## Task 6: Management UI — Delivery Logs and Manual Actions

**Summary:** Build the delivery log viewer and add test ping / manual retry functionality.

**What to build:**
- Delivery log page with table: event type, status, response code, response time, timestamp
- Filters: status (success/failed/pending), event type, date range
- Manual retry button on failed deliveries — re-enqueues the original payload
- Test ping button on a webhook — sends a synthetic test event to the webhook URL and shows the result
- API endpoints to support these actions:
  - `POST /webhooks/:id/test` — send test ping
  - `POST /webhooks/deliveries/:id/retry` — manual retry of a specific delivery

**Depends on:** Task 3 (delivery worker), Task 5 (UI foundation)

**Acceptance criteria:**
- Delivery logs display with all fields and are filterable
- Manual retry re-enqueues the delivery and shows updated status
- Test ping sends a request to the webhook URL and reports success/failure in the UI

---

## Dependency Graph

```
Task 1 (DB Schema)
  |
  v
Task 2 (CRUD API) ---------> Task 5 (UI: CRUD)
  |                                |
  v                                v
Task 3 (Queue + Worker) ----> Task 6 (UI: Logs + Actions)
  |
  v
Task 4 (Retry Logic)
```

## Open Questions (for the team to resolve before or during implementation)

- Should we support custom headers on webhook requests? (Affects Task 2 schema and Task 3 delivery logic)
- Maximum payload size? (Affects Task 3 delivery logic and Task 1 column sizing)
