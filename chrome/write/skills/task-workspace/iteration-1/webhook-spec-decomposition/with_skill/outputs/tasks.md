# Webhook Notification System Tasks
> From: **silver-beacon** | Codename: **bright-signal**

**Goal:** Allow users to configure webhook endpoints that receive real-time notifications when system events occur, with reliable delivery, retry logic, and a management UI.

## Task Overview

| # | Task | Depends on | Parallel |
|---|------|-----------|----------|
| 1 | Data Model & Migrations | — | Yes |
| 2 | Webhook Registry API | 1 | Yes |
| 3 | Event Queue & Delivery Worker | 1 | Yes |
| 4 | HMAC Signature & Payload Signing | — | Yes |
| 5 | Management UI | 2, 3 | No |

---

## Task 1: Data Model & Migrations

**Objective:** Create the PostgreSQL schema for webhook configurations and delivery logs.

### Context

We're building a webhook notification system that lets users register HTTP endpoints to receive event notifications. This task lays the foundation — every other task depends on the data model being in place.

The system has two core entities:

1. **Webhook configurations** — a user-defined endpoint subscription. Each webhook targets a URL, subscribes to one or more event types, and has a secret used for HMAC-SHA256 payload signing. Webhooks can be toggled active/inactive.
2. **Delivery logs** — a record of every delivery attempt. Each log entry tracks the webhook it belongs to, the event type and payload, HTTP status code returned, response time, attempt number, and delivery status (pending, success, failed, exhausted).

Key design decisions:
- Secrets must be stored **encrypted at rest** in the database (not plain text). The encryption/decryption approach should use whatever pattern the project already uses for sensitive fields; if none exists, use AES-256-GCM with a key from environment config.
- Each webhook subscribes to specific event types (stored as an array or junction table — implementer's choice, but an array column like `TEXT[]` is simpler and sufficient given we won't query by event type at scale).
- The retry strategy uses exponential backoff with 5 max attempts (intervals: 1m, 5m, 25m, 2h, 12h). The delivery log needs to track attempt count and next retry time so the worker can pick up retries.

Tech stack: **PostgreSQL** for storage. Use the project's existing migration tooling.

### Requirements

- Create a `webhooks` table with columns: `id`, `user_id`, `url`, `secret` (encrypted), `event_types`, `active` (boolean, default true), `created_at`, `updated_at`
- Create a `webhook_delivery_logs` table with columns: `id`, `webhook_id` (FK), `event_type`, `payload` (JSONB), `status` (enum: pending, success, failed, exhausted), `http_status_code`, `response_time_ms`, `attempt_number`, `next_retry_at`, `created_at`
- Add appropriate indexes: `webhooks` by `user_id` and `active`; `delivery_logs` by `webhook_id`, `status`, and `next_retry_at`
- Write both up and down migrations

### Acceptance Criteria

- [ ] Migrations run successfully against a fresh database
- [ ] Migrations roll back cleanly
- [ ] `webhooks` table stores encrypted secrets (not plain text)
- [ ] `webhook_delivery_logs` table supports all fields needed by the delivery pipeline (status, attempt count, next retry time)
- [ ] Indexes exist for the primary query patterns (lookup webhooks by user, find pending retries by time)

### Dependencies

- **Blocked by:** None
- **Blocks:** Task 2 (Registry API), Task 3 (Delivery Worker), Task 5 (Management UI)

### References

- Spec: webhook-spec.md — "Webhook Registry" and "Delivery Pipeline" sections
- Look at existing migration files in the project for naming conventions and tooling
- Encryption pattern: check if the project has an existing secrets/encryption utility; reuse it if so

---

## Task 2: Webhook Registry API

**Objective:** Build the CRUD REST API for creating, reading, updating, and deleting webhook configurations.

### Context

This is the control plane for webhooks. Users interact with this API (directly or via the Management UI in Task 5) to register endpoints, choose which events to subscribe to, and manage their webhooks.

The system uses **Node.js** on the backend. The API should follow whatever routing and controller patterns the project already uses (Express, Fastify, etc.).

Key design decisions and behaviors:
- **CRUD operations:** Create, Read (list + single), Update, Delete webhook configurations.
- **Secret handling:** When a webhook is created, the user provides a secret (or the system generates one). The secret is used for HMAC-SHA256 signing of outbound payloads (Task 4). On read/list, the secret must **never** be returned in API responses — return a masked version or omit it entirely.
- **Event types:** Each webhook subscribes to specific event types. The API should validate that provided event types are from a known set. Define a central event type registry (a constants file or enum) that both this API and the delivery worker (Task 3) reference.
- **Active/inactive toggle:** Webhooks can be deactivated without deletion. Inactive webhooks should not receive deliveries.
- **Test ping:** The API must expose a "test ping" endpoint that sends a test payload to the webhook's URL immediately. This helps users verify their endpoint is reachable. The ping should use the same signing and delivery mechanism as real events (or closely mirror it).

Validation rules:
- URL must be a valid HTTPS URL (reject HTTP in production)
- Event types must be from the known set
- Secret is required on create (or auto-generated)

### Requirements

- `POST /webhooks` — create a new webhook; accepts `url`, `secret` (optional, auto-generate if missing), `event_types`, returns the created webhook (secret masked)
- `GET /webhooks` — list webhooks for the authenticated user (secret never exposed)
- `GET /webhooks/:id` — get a single webhook (secret never exposed)
- `PUT /webhooks/:id` — update webhook fields (url, event_types, active); secret rotation should be a separate explicit action or allowed here
- `DELETE /webhooks/:id` — soft or hard delete (implementer's discretion; hard delete is simpler and acceptable per spec)
- `POST /webhooks/:id/test` — send a test ping to the webhook's URL using the same payload signing as real deliveries
- `GET /webhooks/:id/deliveries` — list delivery logs for a webhook, with pagination (`page`, `limit`) and filtering (`status`, `event_type`, `date_from`, `date_to`)
- `POST /deliveries/:id/retry` — re-enqueue a failed/exhausted delivery (calls Task 3's `retryDelivery` function)
- Define and export a canonical list of supported event types (e.g., `WEBHOOK_EVENT_TYPES` constant)
- Input validation on all endpoints
- Proper error responses (400 for validation, 404 for not found, 401/403 for auth)

### Acceptance Criteria

- [ ] All CRUD endpoints work and return correct HTTP status codes
- [ ] Secrets are never exposed in any API response
- [ ] Event type validation rejects unknown types
- [ ] URL validation rejects non-HTTPS URLs
- [ ] Test ping endpoint sends a request to the webhook URL and returns the result
- [ ] Delivery log endpoint returns paginated results with correct filtering
- [ ] Retry endpoint re-enqueues a failed delivery and returns updated status
- [ ] API endpoints are protected by authentication (use existing auth middleware)
- [ ] Unit tests cover happy paths and key error cases (invalid URL, unknown event type, nonexistent webhook)

### Dependencies

- **Blocked by:** Task 1 (needs the data model)
- **Blocks:** Task 5 (UI consumes this API)

### References

- Spec: webhook-spec.md — "Webhook Registry" section
- Look at existing API route files for patterns (routing, middleware, error handling)
- The event type constant defined here will be imported by Task 3 (delivery worker)

---

## Task 3: Event Queue & Delivery Worker

**Objective:** Build the event publishing pipeline and background worker that delivers webhook payloads to registered endpoints with retry logic.

### Context

This is the engine of the webhook system. When something happens in the application (e.g., a resource is created, updated, deleted), an event is published. The delivery worker picks it up, finds all active webhooks subscribed to that event type, and delivers the payload to each one.

The system uses **Redis + Bull** for the job queue. Bull is already in the stack and handles retries natively, which simplifies the implementation significantly.

**How it works, end to end:**

1. **Event publishing:** Application code calls a publish function (e.g., `webhookEvents.publish('order.created', payload)`). This pushes a job onto a Bull queue in Redis.
2. **Fan-out:** The worker picks up the job, queries for all *active* webhooks subscribed to that event type, and creates a *separate delivery job* for each matching webhook. This fan-out is important — each delivery is independent so one slow/failing endpoint doesn't block others.
3. **Delivery:** Each delivery job sends an HTTP POST to the webhook URL with the event payload in the body. The request must include an HMAC-SHA256 signature header (see Task 4 for the signing utility — you can stub it initially or implement a simple version and let Task 4 refine it).
4. **Logging:** Every delivery attempt (success or failure) is recorded in the `webhook_delivery_logs` table with the HTTP status code, response time, and attempt number.
5. **Retries:** If a delivery fails (non-2xx response or network error), it's retried with exponential backoff. The intervals are: **1 minute, 5 minutes, 25 minutes, 2 hours, 12 hours** (5 attempts max). After all attempts are exhausted, mark the delivery as `exhausted`. Bull's built-in retry/backoff features should be used for this.

Key design decisions:
- **Separate fan-out from delivery:** The initial event job fans out into individual delivery jobs. Don't deliver inline during fan-out — if you have 50 webhooks for one event, they should be 50 independent jobs.
- **Idempotency:** Include a unique delivery ID in each payload so receivers can deduplicate.
- **Timeouts:** Set a reasonable HTTP timeout for delivery requests (e.g., 30 seconds). Don't let a slow endpoint tie up a worker indefinitely.
- **Manual retry:** Expose a function (or queue a job) to retry a specific failed delivery by its log ID. The Management UI (Task 5) will call this.

### Requirements

- Create a `webhookEvents.publish(eventType, payload)` function that enqueues an event job to the Bull queue
- Implement a fan-out worker that picks up event jobs, queries matching active webhooks, and creates individual delivery jobs
- Implement a delivery worker that sends HTTP POST requests with the event payload and HMAC signature header
- Log every delivery attempt to `webhook_delivery_logs` (status, HTTP code, response time, attempt number)
- Configure Bull retry with exponential backoff: delays of 1m, 5m, 25m, 2h, 12h
- After 5 failed attempts, mark delivery status as `exhausted`
- Include a unique delivery ID (e.g., UUID) in each outbound payload for receiver-side deduplication
- Set a 30-second HTTP timeout on delivery requests
- Expose a `retryDelivery(deliveryLogId)` function that re-enqueues a failed/exhausted delivery

### Acceptance Criteria

- [ ] Publishing an event creates a job in the Redis queue
- [ ] The fan-out worker creates one delivery job per matching active webhook
- [ ] Inactive webhooks are skipped during fan-out
- [ ] Each delivery sends an HTTP POST with correct payload and signature header
- [ ] Successful deliveries are logged with status `success`
- [ ] Failed deliveries are retried up to 5 times with the specified backoff intervals
- [ ] After 5 failures, delivery status is `exhausted`
- [ ] The `retryDelivery` function re-enqueues a specific failed delivery
- [ ] A slow endpoint (>30s) times out and is treated as a failure
- [ ] Unit tests cover: fan-out logic, delivery success/failure logging, retry behavior

### Dependencies

- **Blocked by:** Task 1 (needs the data model)
- **Blocks:** Task 5 (UI needs delivery logs and manual retry)

### References

- Spec: webhook-spec.md — "Delivery Pipeline" section
- Bull documentation for retry/backoff configuration: https://github.com/OptimalBits/bull
- Look at existing Bull queue usage in the project for patterns (queue naming, Redis connection config, worker setup)
- Task 4 provides the HMAC signing utility — coordinate on the function signature, or use a simple inline implementation and refactor later

---

## Task 4: HMAC Signature & Payload Signing

**Objective:** Implement the HMAC-SHA256 signing utility that signs outbound webhook payloads so receivers can verify authenticity.

### Context

Every webhook delivery must include a signature so the receiving server can verify the request is legitimate and hasn't been tampered with. This is standard practice in webhook systems (Stripe, GitHub, Shopify all do this).

The chosen approach is **HMAC-SHA256** — the industry standard for webhook signing. It's simple: hash the request body with the webhook's secret key, and include the resulting signature in a header.

**How it works:**

1. The delivery worker (Task 3) calls the signing function with the raw JSON payload body and the webhook's secret.
2. The function computes `HMAC-SHA256(secret, body)` and returns the hex-encoded signature.
3. The delivery worker includes the signature in a request header (e.g., `X-Webhook-Signature` or `X-Signature-256`).
4. The receiving server can verify by computing the same HMAC with its copy of the secret and comparing.

**Implementation notes:**
- Use Node.js built-in `crypto` module — no external dependencies needed.
- The function should accept the raw string body (not a parsed object) to ensure the signature matches exactly what's sent over the wire. Signing a re-serialized object can produce different results due to key ordering.
- Consider including a timestamp in the signature scheme to prevent replay attacks. A common pattern: `signature = HMAC(secret, timestamp + "." + body)`, and include both the signature and timestamp in headers. This is optional but recommended.
- Export both the signing function (for the delivery worker) and a verification function (useful for documentation/examples and for the test ping endpoint).

Tech stack: **Node.js** `crypto` module. No additional dependencies.

### Requirements

- Implement `signPayload(secret, body)` → returns hex-encoded HMAC-SHA256 signature
- Implement `verifySignature(secret, body, signature)` → returns boolean (timing-safe comparison)
- Use `crypto.timingSafeEqual` for the verification function to prevent timing attacks
- Define the signature header name as a constant (e.g., `X-Webhook-Signature-256`)
- Optionally include a timestamp in the signing scheme for replay protection (if implemented, also export `buildSignatureHeader(secret, body)` that returns both timestamp and signature)
- Export all functions for use by the delivery worker (Task 3) and test ping endpoint (Task 2)

### Acceptance Criteria

- [ ] `signPayload` produces a valid HMAC-SHA256 hex digest
- [ ] `verifySignature` correctly validates a matching signature
- [ ] `verifySignature` correctly rejects a non-matching signature
- [ ] Verification uses timing-safe comparison (`crypto.timingSafeEqual`)
- [ ] Signing the same body + secret always produces the same signature (deterministic)
- [ ] The module exports are clean and documented (JSDoc or TypeScript types)
- [ ] Unit tests cover: signing, valid verification, invalid verification, empty body edge case

### Dependencies

- **Blocked by:** None
- **Blocks:** None (Tasks 2 and 3 consume this, but can stub/inline a simple version and swap in later)

### References

- Node.js `crypto` module: `crypto.createHmac('sha256', secret).update(body).digest('hex')`
- GitHub webhook signature verification docs (good reference implementation): https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- Stripe's approach to webhook signing with timestamps: https://stripe.com/docs/webhooks/signatures

---

## Task 5: Management UI

**Objective:** Build the React frontend for creating, managing, and monitoring webhooks — including delivery logs and manual retry.

### Context

This is the user-facing interface for the webhook system. Users come here to register endpoints, select which events to subscribe to, view delivery history, and troubleshoot failed deliveries.

The application uses **React**. Follow the project's existing component patterns, styling approach, and state management conventions.

**What the UI needs to do:**

1. **Webhook list page:** Show all webhooks for the current user with their status (active/inactive), subscribed event types, and URL. Each row links to a detail/edit view.
2. **Create/edit webhook form:** Fields for URL, event type selector (multi-select from the known event types), and active toggle. On create, show the generated secret *once* (it won't be retrievable later since the API masks it). On edit, allow URL change, event type change, active toggle, and secret rotation.
3. **Delivery log view:** For a given webhook, show a paginated/filterable log of delivery attempts. Columns: event type, status (pending/success/failed/exhausted), HTTP status code, response time, timestamp. Filters: status, event type, date range.
4. **Manual retry:** For failed/exhausted deliveries, show a "Retry" button that calls the retry endpoint and refreshes the log.
5. **Test ping:** On the webhook detail page, a "Send Test Ping" button that triggers the test endpoint (Task 2's `POST /webhooks/:id/test`) and shows the result inline.

Key design decisions:
- The event type selector should use the same canonical event type list as the backend. Either fetch it from an API endpoint or import it from a shared constants package — whatever pattern the project uses for shared frontend/backend constants.
- The secret is only shown once on creation (the API never returns it after that). Make this prominent in the UI — show it in a copyable field with a warning.
- Delivery logs can be high volume. Use pagination (not infinite scroll) and support filtering server-side to keep performance reasonable.

API endpoints this UI consumes (all from Task 2 and Task 3):
- `GET /webhooks` — list
- `POST /webhooks` — create
- `GET /webhooks/:id` — detail
- `PUT /webhooks/:id` — update
- `DELETE /webhooks/:id` — delete
- `POST /webhooks/:id/test` — test ping
- `GET /webhooks/:id/deliveries` — delivery logs (paginated, filterable) — defined in Task 2
- `POST /deliveries/:id/retry` — manual retry — defined in Task 2, calls Task 3's retry function

### Requirements

- Webhook list page showing all user webhooks with URL, event types, active status
- Create webhook form with URL input, event type multi-select, auto-generated secret display (shown once)
- Edit webhook form with URL, event types, active toggle, secret rotation option
- Delete webhook with confirmation dialog
- Delivery log table for each webhook: event type, status, HTTP code, response time, timestamp
- Delivery log filtering by status, event type, and date range
- Pagination for delivery logs
- Retry button on failed/exhausted deliveries
- Test ping button on webhook detail page with inline result display
- Loading states and error handling on all async operations

### Acceptance Criteria

- [ ] User can create a webhook and sees the secret displayed once
- [ ] User can list, edit, and delete webhooks
- [ ] User can toggle a webhook active/inactive
- [ ] Delivery logs display correctly with all columns
- [ ] Delivery log filters work (status, event type, date range)
- [ ] Pagination works on delivery logs
- [ ] Retry button triggers a retry and refreshes the log to show the new attempt
- [ ] Test ping button sends a test and shows success/failure result
- [ ] UI handles loading and error states gracefully
- [ ] Components follow existing project patterns and styling

### Dependencies

- **Blocked by:** Task 2 (needs the CRUD API), Task 3 (needs delivery logs and retry endpoint)
- **Blocks:** None

### References

- Spec: webhook-spec.md — "Management UI" section
- Look at existing React pages/components in the project for patterns (routing, forms, tables, API calls)
- The delivery log endpoint (`GET /webhooks/:id/deliveries`) and retry endpoint (`POST /deliveries/:id/retry`) are defined in Task 2
