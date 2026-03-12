# Webhook Notification System Tasks
> From: **silver-beacon** | Codename: **hollow-trumpet**

**Goal:** Allow users to configure webhook endpoints that receive real-time notifications when events occur in the system.

## Task Overview

| # | Task | Depends on | Parallel |
|---|------|-----------|----------|
| 1 | Database Schema & Webhook Model | — | Yes |
| 2 | Webhook CRUD API | 1 | Yes (with 3) |
| 3 | Event Queue & Delivery Worker | 1 | Yes (with 2) |
| 4 | HMAC Signing & Retry Logic | 3 | No |
| 5 | Management UI | 2, 4 | No |

---

## Task 1: Database Schema & Webhook Model

### Description

This task lays the data foundation for the entire webhook notification system. Without the schema and data-access layer, nothing else can be built — the CRUD API, the delivery pipeline, and the UI all read from and write to these tables.

You are creating two core PostgreSQL tables and the application-level model code that wraps them:

- **`webhooks`** — stores each webhook configuration: the target URL, the list of subscribed event types, a secret used for HMAC signing, and an active/inactive flag.
- **`webhook_deliveries`** — stores every delivery attempt for audit and debugging: which webhook, which event, the HTTP status code returned, response time, attempt number, and status (pending/success/failed).

The secret column in `webhooks` must be stored encrypted at rest (application-level encryption before writing to the column, not just PostgreSQL TDE). This secret is later used by the delivery worker to HMAC-sign outgoing payloads, but that signing logic is out of scope here — just make sure the model exposes a method to retrieve the decrypted secret.

**Technical decisions:**
- **PostgreSQL for storage** — the application already uses PostgreSQL; adding tables to the existing database keeps operational complexity low.
- **Application-level encryption for secrets** — secrets are used to HMAC-sign payloads. Storing them encrypted at the application layer (e.g., AES-256-GCM via Node.js `crypto`) means a database dump alone doesn't expose them. The encryption key comes from an environment variable.
- **Delivery log as a separate table** — a webhook can have thousands of deliveries. Keeping deliveries in their own table with a foreign key to `webhooks` avoids bloating the webhook config table and makes delivery-log queries fast with proper indexing.
- **Event types stored as a PostgreSQL array column** — `TEXT[]` on the `webhooks` table. Simpler than a join table for the expected cardinality (dozens of event types, not thousands). Supports GIN indexing for efficient "find all webhooks subscribed to event X" queries.

### Acceptance Criteria

**Scenario:** Create webhooks table via migration
- **Given** the database has no `webhooks` table
- **When** the migration runs
- **Then** a `webhooks` table exists with columns: `id` (UUID, PK), `url` (TEXT, NOT NULL), `event_types` (TEXT[], NOT NULL), `secret` (TEXT, NOT NULL — stores encrypted value), `active` (BOOLEAN, DEFAULT true), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ)

**Scenario:** Create webhook_deliveries table via migration
- **Given** the database has no `webhook_deliveries` table
- **When** the migration runs
- **Then** a `webhook_deliveries` table exists with columns: `id` (UUID, PK), `webhook_id` (UUID, FK to webhooks), `event_type` (TEXT, NOT NULL), `payload` (JSONB), `status` (TEXT — pending/success/failed), `http_status_code` (INTEGER), `response_time_ms` (INTEGER), `attempt_number` (INTEGER, DEFAULT 1), `next_retry_at` (TIMESTAMPTZ, nullable), `created_at` (TIMESTAMPTZ)
- **And** an index exists on `(webhook_id, created_at)` for efficient delivery log queries

**Scenario:** Secret is encrypted before storage
- **Given** a webhook is created with a plaintext secret `"my-secret-key"`
- **When** the model persists it to the database
- **Then** the value stored in the `secret` column is not `"my-secret-key"` (it is an encrypted blob)
- **And** calling the model's decrypt method with the same record returns `"my-secret-key"`

**Scenario:** Query webhooks by event type
- **Given** three webhooks exist: one subscribed to `["order.created"]`, one to `["order.created", "order.updated"]`, and one to `["user.created"]`
- **When** querying for webhooks subscribed to `"order.created"`
- **Then** the first two webhooks are returned, the third is not

### Out of Scope

- HMAC signing logic itself (that belongs to the delivery worker task)
- API endpoints (Task 2)
- Queue or worker infrastructure (Task 3)
- Webhook versioning or schema evolution
- Bulk operations on webhooks

### References

- Spec: `webhook-spec.md` — "Webhook Registry" and "Delivery Pipeline" sections define the data requirements
- PostgreSQL array operators: `@>` for "array contains" queries with GIN index
- Node.js `crypto` module for AES-256-GCM encryption

---

## Task 2: Webhook CRUD API

### Description

This task builds the REST API that lets users create, read, update, and delete webhook configurations. It is the primary interface between the Management UI (Task 5) and the webhook data model (Task 1).

The API should follow whatever REST conventions the existing application uses. Each endpoint manages webhook registrations — the URL to call, which event types to subscribe to, and whether the webhook is active. When a webhook is created, the API generates a cryptographically random secret, returns it once to the user (this is the only time they see it in plaintext), and stores it encrypted via the model layer from Task 1.

A "test ping" endpoint is also part of this task. It lets users verify their endpoint is reachable by sending a standardized test payload. The ping should go through the delivery pipeline (Task 3's queue) if available, but for this task, a synchronous HTTP call is acceptable as a fallback — the important thing is that the endpoint exists and the contract is defined.

**Technical decisions:**
- **RESTful resource endpoints** — `POST /webhooks`, `GET /webhooks`, `GET /webhooks/:id`, `PUT /webhooks/:id`, `DELETE /webhooks/:id`, `POST /webhooks/:id/test` — standard REST patterns keep the API predictable.
- **Secret shown once on creation** — after the initial `POST` response, the secret is never returned again in any GET response. This follows the same pattern as API key generation (GitHub, Stripe, etc.) and limits secret exposure.
- **Validation at the API layer** — URL must be a valid HTTPS URL (HTTP allowed in development), event_types must be a non-empty array of known event type strings. Reject invalid input with 422 and descriptive error messages.
- **Soft-deactivate over hard-delete** — `DELETE` sets `active = false` rather than removing the row, preserving delivery history. The API should not return inactive webhooks in list endpoints by default but should accept a `?include_inactive=true` query parameter.

### Acceptance Criteria

**Scenario:** Create a new webhook
- **Given** an authenticated user
- **When** they `POST /webhooks` with `{ "url": "https://example.com/hook", "event_types": ["order.created"] }`
- **Then** a 201 response is returned with the webhook object including a plaintext `secret` field
- **And** the webhook is persisted with the secret encrypted
- **And** subsequent `GET /webhooks/:id` does NOT include the `secret` field

**Scenario:** List webhooks
- **Given** the user has 3 active webhooks and 1 inactive webhook
- **When** they `GET /webhooks`
- **Then** only the 3 active webhooks are returned
- **When** they `GET /webhooks?include_inactive=true`
- **Then** all 4 webhooks are returned

**Scenario:** Update a webhook
- **Given** an existing webhook subscribed to `["order.created"]`
- **When** the user `PUT /webhooks/:id` with `{ "event_types": ["order.created", "order.updated"] }`
- **Then** the webhook's event_types are updated
- **And** the secret is not changed
- **And** the response does not include the secret

**Scenario:** Delete (deactivate) a webhook
- **Given** an active webhook with delivery history
- **When** the user `DELETE /webhooks/:id`
- **Then** the webhook's `active` flag is set to false
- **And** the delivery history is preserved
- **And** the webhook no longer appears in default `GET /webhooks` results

**Scenario:** Reject invalid webhook configuration
- **Given** an authenticated user
- **When** they `POST /webhooks` with `{ "url": "not-a-url", "event_types": [] }`
- **Then** a 422 response is returned with errors for both the invalid URL and empty event_types

**Scenario:** Send a test ping
- **Given** an existing active webhook pointing to `https://example.com/hook`
- **When** the user `POST /webhooks/:id/test`
- **Then** an HTTP POST is sent to `https://example.com/hook` with a standardized test payload `{ "event": "webhook.test", "timestamp": "..." }`
- **And** the response indicates whether the ping succeeded or failed (with status code and response time)

### Out of Scope

- Delivery queue integration (the test ping uses a direct HTTP call for now; Task 3 handles queuing)
- HMAC signing of test pings (Task 4 adds signing to all outgoing requests)
- Management UI (Task 5)
- Rate limiting per endpoint
- Custom headers on webhook requests
- Pagination of webhook lists (acceptable to defer unless the existing API has pagination conventions)

### References

- Spec: `webhook-spec.md` — "Webhook Registry" section
- Task 1 provides the data model this API reads/writes
- Existing application REST conventions (route registration, middleware, error handling patterns)

---

## Task 3: Event Queue & Delivery Worker

### Description

This task builds the core delivery engine — the part that actually sends HTTP requests to webhook endpoints when events happen in the system. It connects the application's internal events to the outside world.

The system has two parts:

1. **Event publisher** — a function (or module) that application code calls when something happens (e.g., `publishEvent("order.created", payload)`). This function pushes the event onto a Redis queue using Bull. It does not need to know about webhooks — it just publishes events.

2. **Delivery worker** — a Bull worker that picks events off the queue, looks up all active webhooks subscribed to that event type (using the model from Task 1), and makes an HTTP POST to each webhook's URL with the event payload. Each delivery attempt is logged in the `webhook_deliveries` table.

The fan-out pattern is important: one event can trigger deliveries to many webhooks. Each delivery is independent — if one webhook's endpoint is down, the others still get their notifications. Each webhook delivery should be its own Bull job so that failures and retries are isolated per-webhook, not per-event.

**Technical decisions:**
- **Redis + Bull for the queue** — already in the application's stack. Bull handles job persistence, retry scheduling, and dead-letter semantics out of the box. No new infrastructure needed.
- **Fan-out at the worker level** — the publisher creates one job per event. The worker fans out to individual delivery jobs (one per matching webhook). This keeps the publishing side simple and fast — it doesn't need to query webhooks.
- **One Bull job per webhook delivery** — isolates failures. If Webhook A's endpoint is down, Webhook B's delivery isn't blocked or delayed. Each delivery job carries: `webhook_id`, `event_type`, `payload`, `webhook_url`.
- **Delivery logging** — every attempt writes a row to `webhook_deliveries` with the HTTP status, response time, and attempt number. This powers the delivery log in the Management UI (Task 5).

### Acceptance Criteria

**Scenario:** Publish an event to the queue
- **Given** the event publisher module is initialized with a Redis connection
- **When** application code calls `publishEvent("order.created", { order_id: "abc123", total: 99.99 })`
- **Then** a job is added to the Bull queue with `{ event_type: "order.created", payload: { order_id: "abc123", total: 99.99 }, timestamp: "..." }`

**Scenario:** Fan out event to matching webhooks
- **Given** two active webhooks subscribe to `"order.created"` and one subscribes to `"user.created"`
- **When** the worker processes an `"order.created"` event job
- **Then** two individual delivery jobs are created (one per matching webhook)
- **And** no delivery job is created for the `"user.created"` webhook

**Scenario:** Deliver payload to a webhook endpoint
- **Given** a delivery job for webhook ID `wh-1` with URL `https://example.com/hook` and payload `{ "event": "order.created", "data": { ... } }`
- **When** the delivery worker processes the job
- **Then** an HTTP POST is sent to `https://example.com/hook` with the payload as the JSON body
- **And** a `webhook_deliveries` row is created with `webhook_id: "wh-1"`, `status: "success"`, the HTTP status code, and the response time in milliseconds

**Scenario:** Log a failed delivery
- **Given** a delivery job for a webhook whose endpoint returns HTTP 500
- **When** the delivery worker processes the job
- **Then** a `webhook_deliveries` row is created with `status: "failed"` and `http_status_code: 500`
- **And** the job is marked for retry (retry logic itself is Task 4)

**Scenario:** Inactive webhooks are skipped
- **Given** webhook `wh-2` is subscribed to `"order.created"` but has `active: false`
- **When** an `"order.created"` event is processed
- **Then** no delivery job is created for `wh-2`

### Out of Scope

- HMAC payload signing (Task 4)
- Retry scheduling and exponential backoff configuration (Task 4)
- The Management UI for viewing delivery logs (Task 5)
- Event type registry or validation (the publisher accepts any string; event type governance is a future concern)
- Webhook analytics or metrics
- Custom headers on outgoing requests

### References

- Spec: `webhook-spec.md` — "Delivery Pipeline" section
- Task 1 provides the `webhooks` and `webhook_deliveries` models
- [Bull documentation](https://github.com/OptimalBits/bull) for queue and worker patterns
- Bull's `add()` for creating jobs, `process()` for consuming them

---

## Task 4: HMAC Signing & Retry Logic

### Description

This task hardens the delivery pipeline (Task 3) with two critical reliability and security features: cryptographic payload signing and retry with exponential backoff.

**HMAC Signing:** Every outgoing webhook delivery must include an HMAC-SHA256 signature so the receiving endpoint can verify the payload hasn't been tampered with and genuinely came from this system. The signature is computed over the raw JSON payload body using the webhook's secret (decrypted from the database via Task 1's model). It is sent in a request header — typically `X-Webhook-Signature` — as a hex-encoded string. The receiving endpoint recomputes the HMAC using its copy of the secret and compares. This is the same pattern used by GitHub, Stripe, and Shopify webhooks.

**Retry Logic:** When a delivery fails (non-2xx response or network error), the system retries with exponential backoff. The spec defines 5 attempts with intervals: 1 minute, 5 minutes, 25 minutes, 2 hours, 12 hours. After 5 failed attempts, the delivery is marked as permanently failed. The `next_retry_at` field on the delivery record lets the UI show users when the next attempt will happen. Bull's built-in retry mechanism should be configured with a custom backoff function matching these intervals.

**Technical decisions:**
- **HMAC-SHA256** — industry standard for webhook signing. Simple to implement on both sides (sender and receiver). Uses Node.js `crypto.createHmac()`. Chosen over JWT because webhooks are point-to-point and don't need the overhead of token-based auth.
- **Signature in `X-Webhook-Signature` header** — keeps the signature out of the payload body, so the receiver can verify before parsing. The header value format is `sha256=<hex-digest>` (matches GitHub's convention, which many webhook consumers already support).
- **Exponential backoff at 1m, 5m, 25m, 2h, 12h** — balances persistence (keeps trying for ~14 hours) with not hammering a failing endpoint. Each interval is roughly 5x the previous one.
- **Max 5 attempts** — after 5 failures across 14+ hours, it's likely a configuration problem, not a transient issue. Permanently failing the delivery and surfacing it in the UI is more useful than retrying indefinitely.
- **Bull's custom backoff** — Bull supports a `backoff` option with custom delay functions. This lets us implement the exact intervals from the spec without building our own scheduler.

### Acceptance Criteria

**Scenario:** Outgoing request includes HMAC signature
- **Given** a webhook with decrypted secret `"my-secret"` and a delivery payload `{"event":"order.created","data":{"id":"123"}}`
- **When** the delivery worker sends the HTTP request
- **Then** the request includes header `X-Webhook-Signature: sha256=<hex>` where `<hex>` is the HMAC-SHA256 of the raw JSON body using key `"my-secret"`
- **And** the hex digest can be independently verified by computing `crypto.createHmac('sha256', 'my-secret').update('{"event":"order.created","data":{"id":"123"}}').digest('hex')`

**Scenario:** First retry after failure
- **Given** a delivery job that just failed (attempt 1)
- **When** Bull schedules the retry
- **Then** the retry delay is approximately 1 minute (60,000ms)
- **And** the `webhook_deliveries` row is updated with `next_retry_at` set to ~1 minute from now

**Scenario:** Exponential backoff across all attempts
- **Given** a webhook endpoint that consistently returns HTTP 503
- **When** 5 delivery attempts are made
- **Then** the delays between attempts are approximately: 1m, 5m, 25m, 2h, 12h
- **And** each attempt creates a `webhook_deliveries` row with incrementing `attempt_number` (1 through 5)

**Scenario:** Permanent failure after max attempts
- **Given** a delivery that has failed 5 times
- **When** the 5th attempt also fails
- **Then** the delivery status is set to `"failed"` permanently (no further retries)
- **And** `next_retry_at` is set to NULL
- **And** the job is not re-queued

**Scenario:** Successful delivery on retry
- **Given** a delivery that failed on attempt 1 (endpoint was temporarily down)
- **When** the retry fires and the endpoint returns HTTP 200
- **Then** the delivery status is updated to `"success"`
- **And** no further retries are scheduled
- **And** the `attempt_number` reflects which attempt succeeded (e.g., 2)

### Out of Scope

- Rate limiting per endpoint (spec explicitly defers this)
- Alerting or notifications when a webhook enters permanent failure state
- Circuit breaker patterns
- Retry of the test-ping endpoint (test pings are fire-once)
- Custom retry intervals per webhook

### References

- Spec: `webhook-spec.md` — "Delivery Pipeline" section, retry intervals `(1m, 5m, 25m, 2h, 12h)`, HMAC-SHA256 decision
- Task 1 provides the `secret` decryption method on the webhook model
- Task 3 provides the delivery worker where signing and retry are integrated
- Node.js `crypto.createHmac('sha256', secret)` for signing
- Bull `backoff` configuration: `{ type: 'custom' }` with a custom delay function

---

## Task 5: Management UI

### Description

This task builds the React frontend that lets users manage their webhooks and monitor delivery health. It is the user-facing layer over the CRUD API (Task 2) and the delivery data produced by the pipeline (Tasks 3 and 4).

The UI has two main views:

1. **Webhook list and configuration** — a table of webhooks showing URL, subscribed event types, and active status. Users can create new webhooks (form with URL input, event type multi-select, and a secret display shown once after creation), edit existing ones (change URL, event types, toggle active), and delete them.

2. **Delivery log** — for each webhook, a detailed log of delivery attempts. Each row shows: event type, status (success/failed/pending), HTTP status code, response time, attempt number, and timestamp. The log supports filtering by status, event type, and date range. Failed deliveries have a "Retry" button that re-queues the delivery. There is also a "Test Ping" button on each webhook to trigger a test delivery.

The secret handling UX is important: when a webhook is created, the API returns the secret once. The UI must display it prominently with a copy button and a warning that it won't be shown again. After dismissal or navigation, the secret is gone.

**Technical decisions:**
- **React** — matches the existing application frontend stack.
- **Event type multi-select** — event types should be fetched from a known list (can be hardcoded initially or fetched from an endpoint). A multi-select component with checkboxes is clearer than a free-text input for this use case.
- **Delivery log filtering client-side vs. server-side** — for the initial implementation, fetch the most recent N deliveries and filter client-side. Add server-side filtering if performance becomes an issue (this optimization is out of scope for this task).
- **Manual retry as a POST to the queue** — the "Retry" button calls `POST /webhooks/:id/deliveries/:delivery_id/retry` which re-queues the delivery job. This endpoint should be added as part of this task (it's a thin wrapper over the queue from Task 3).

### Acceptance Criteria

**Scenario:** View webhook list
- **Given** the user has 3 configured webhooks
- **When** they navigate to the webhooks management page
- **Then** a table displays all 3 webhooks showing URL, event types, and active status

**Scenario:** Create a webhook and see the secret
- **Given** the user is on the webhook creation form
- **When** they enter a valid URL, select event types, and submit
- **Then** the webhook is created and the secret is displayed prominently with a copy-to-clipboard button
- **And** a warning states the secret will not be shown again
- **And** after navigating away and returning, the secret is no longer visible

**Scenario:** Edit a webhook
- **Given** an existing webhook subscribed to `["order.created"]`
- **When** the user opens the edit form, adds `"order.updated"` to event types, and saves
- **Then** the webhook is updated and the list reflects the new event types

**Scenario:** Delete a webhook
- **Given** an active webhook in the list
- **When** the user clicks delete and confirms
- **Then** the webhook disappears from the default list view
- **And** a success message confirms the deactivation

**Scenario:** View delivery log with filters
- **Given** a webhook with 50 delivery records across success and failed statuses
- **When** the user opens the delivery log for that webhook
- **Then** delivery attempts are listed with: event type, status, HTTP status code, response time, attempt number, timestamp
- **When** the user filters by status "failed"
- **Then** only failed deliveries are shown

**Scenario:** Retry a failed delivery
- **Given** a failed delivery in the log
- **When** the user clicks the "Retry" button
- **Then** the delivery is re-queued and a confirmation message appears
- **And** refreshing the log shows a new delivery attempt

**Scenario:** Send a test ping
- **Given** an active webhook in the list
- **When** the user clicks "Test Ping"
- **Then** a test payload is sent to the webhook URL
- **And** the result (success/failure, status code, response time) is displayed inline

### Out of Scope

- Webhook analytics or metrics dashboard (spec explicitly excludes this)
- Bulk operations (spec explicitly excludes this)
- Server-side filtering or pagination of delivery logs
- Real-time delivery log updates (polling or websockets)
- Responsive/mobile layout optimization
- Webhook versioning UI

### References

- Spec: `webhook-spec.md` — "Management UI" section defines the full feature list
- Task 2 provides the CRUD API endpoints this UI consumes
- Task 3/4 provide the delivery data displayed in the delivery log
- The manual retry endpoint (`POST /webhooks/:id/deliveries/:delivery_id/retry`) needs to be added as part of this task (coordinates with Task 3's queue)
