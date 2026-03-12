# Webhook Notification System Tasks
> From: **silver-beacon** | Codename: **gentle-signal**

**Goal:** Allow users to configure webhook endpoints that receive real-time notifications when events occur in the system, with reliable delivery and a management UI.

## Task Overview

| # | Task | Depends on | Parallel |
|---|------|-----------|----------|
| 1 | Webhook Data Model & CRUD API | — | Yes |
| 2 | Event Queue & Delivery Worker | 1 | No |
| 3 | Retry Logic & Delivery Logging | 2 | No |
| 4 | Management UI | 1 | Yes |
| 5 | Test Ping & Manual Retry | 2, 4 | No |

---

## Task 1: Webhook Data Model & CRUD API

### Description

This is the foundation task. Before anything can be delivered, the system needs a way to register and manage webhook configurations. Users need to specify a target URL, choose which event types to subscribe to, and provide (or have generated) a secret used for HMAC signing. Each webhook can be toggled active/inactive.

This task creates the PostgreSQL schema for webhook configurations and a RESTful CRUD API (create, read, update, delete) that the management UI and other services will consume. Secrets must be stored encrypted at rest since they are used to sign outgoing payloads and would be a security risk if leaked.

**Technical decisions:**
- Secrets are stored encrypted in PostgreSQL (not plaintext) because they are the basis for HMAC-SHA256 payload signing and represent a security-sensitive credential.
- Each webhook subscribes to specific event types (stored as an array or join table) rather than receiving all events, so users have fine-grained control and the delivery worker can efficiently fan out.
- Webhook configurations include an active/inactive flag so users can disable delivery without deleting the configuration.

### Acceptance Criteria

**Scenario:** Create a webhook
- **Given** an authenticated user with a valid URL, at least one event type, and an optional secret
- **When** they POST to the webhook creation endpoint
- **Then** a webhook record is persisted with the URL, selected event types, an encrypted secret (generated if not provided), and an active status of true; the response includes the webhook ID and configuration (secret excluded)

**Scenario:** List webhooks
- **Given** an authenticated user with existing webhook configurations
- **When** they GET the webhooks list endpoint
- **Then** all their webhook configurations are returned without exposing decrypted secrets

**Scenario:** Update a webhook
- **Given** an existing webhook owned by the authenticated user
- **When** they PATCH the webhook with a changed URL or modified event subscriptions
- **Then** the configuration is updated and the response reflects the new state

**Scenario:** Delete a webhook
- **Given** an existing webhook owned by the authenticated user
- **When** they DELETE the webhook
- **Then** the webhook record is removed and subsequent deliveries to that endpoint cease

**Scenario:** Toggle webhook active state
- **Given** an existing active webhook
- **When** the user sets active to false via the update endpoint
- **Then** the webhook is persisted as inactive, and the delivery worker should skip it when matching events

### Out of Scope

- Delivery pipeline and queue setup (Task 2)
- Management UI (Task 4)
- Rate limiting per endpoint
- Webhook versioning
- Bulk operations on webhooks
- Custom headers on webhook requests (open question, not in current scope)

### References

- Spec: silver-beacon webhook-spec.md — "Webhook Registry" section
- Stack: Node.js API layer, PostgreSQL for persistence
- Encryption approach for secrets should follow existing credential storage patterns in the codebase if any exist

---

## Task 2: Event Queue & Delivery Worker

### Description

This task builds the event-driven delivery backbone. When something happens in the system (e.g., a resource is created, updated, or deleted), an event is published to a Redis queue. A background worker consumes events from the queue, looks up all active webhooks that subscribe to that event type, and delivers the payload to each matching endpoint.

Each outgoing request must include an HMAC-SHA256 signature computed from the webhook's secret and the request body, so the receiving server can verify authenticity. The worker fans out events to multiple webhooks independently — a failure delivering to one endpoint must not block delivery to others.

This task does not include retry logic or delivery logging — those are handled in Task 3. The worker here handles the happy path: pick up event, find matching webhooks, deliver payload with signature, move on.

**Technical decisions:**
- Redis + Bull is the queue system because it is already in the stack and supports job processing, scheduling, and retry primitives natively. RabbitMQ was rejected as overkill, SQS for vendor lock-in concerns.
- HMAC-SHA256 is the signature algorithm for outgoing payloads. The signature should be included in a request header (commonly `X-Webhook-Signature` or similar). JWT was considered but is heavier than needed for this use case.
- Fan-out is independent per webhook — delivery to endpoint A failing does not affect delivery to endpoint B for the same event.

### Acceptance Criteria

**Scenario:** Event published and delivered to matching webhook
- **Given** an active webhook subscribed to the "order.created" event type
- **When** an "order.created" event is published to the Redis queue
- **Then** the worker picks up the event, constructs a POST request with the event payload as JSON body and an HMAC-SHA256 signature header computed from the webhook's decrypted secret, and delivers it to the webhook's URL

**Scenario:** Event not delivered to non-matching webhook
- **Given** an active webhook subscribed only to "order.created"
- **When** a "user.updated" event is published
- **Then** no delivery attempt is made to that webhook

**Scenario:** Event not delivered to inactive webhook
- **Given** an inactive webhook subscribed to "order.created"
- **When** an "order.created" event is published
- **Then** no delivery attempt is made to that webhook

**Scenario:** Fan-out independence
- **Given** two active webhooks both subscribed to "order.created", where webhook A's endpoint is down
- **When** an "order.created" event is published
- **Then** webhook B receives its delivery regardless of webhook A's failure

### Out of Scope

- Retry logic and exponential backoff (Task 3)
- Delivery attempt logging and status tracking (Task 3)
- Webhook CRUD API (Task 1)
- Maximum payload size enforcement (open question, not in current scope)
- Rate limiting per endpoint

### References

- Spec: silver-beacon webhook-spec.md — "Delivery Pipeline" section
- Queue: Redis + Bull
- Signature: HMAC-SHA256 using the webhook's stored (encrypted-at-rest) secret

---

## Task 3: Retry Logic & Delivery Logging

### Description

Task 2 handles the happy path — this task handles everything else. When a delivery attempt fails (network error, non-2xx response), the system needs to retry with exponential backoff up to a maximum of 5 attempts. Every attempt — successful or failed — must be logged with enough detail for debugging and for surfacing in the management UI's delivery log.

The delivery log is central to the user experience: it is what users consult when a webhook isn't working. Each log entry records the event type, target URL, HTTP status code, response time, attempt number, and whether the delivery ultimately succeeded or exhausted retries. This data feeds into the Management UI's delivery log view (Task 4) and the manual retry feature (Task 5).

**Technical decisions:**
- Exponential backoff schedule is 1 minute, 5 minutes, 25 minutes, 2 hours, 12 hours (5 attempts max). This was chosen to balance reliability with not hammering failing endpoints. Fixed intervals were rejected as too aggressive; manual-retry-only was rejected for poor UX.
- Bull's built-in retry/backoff capabilities should be leveraged rather than implementing custom retry scheduling, since Bull is already the queue system.
- Every delivery attempt (not just the final outcome) is logged to PostgreSQL so the delivery log shows the full history of attempts per event-webhook pair.

### Acceptance Criteria

**Scenario:** Failed delivery is retried with backoff
- **Given** a delivery attempt to a webhook endpoint that returns a 500 status
- **When** the initial attempt fails
- **Then** the system schedules a retry after approximately 1 minute, and subsequent failures schedule retries at 5m, 25m, 2h, and 12h intervals respectively

**Scenario:** Successful retry stops the retry chain
- **Given** a delivery that failed on the first attempt
- **When** the second retry attempt receives a 200 response
- **Then** no further retry attempts are scheduled and the delivery is marked as successful

**Scenario:** Retries exhausted
- **Given** a delivery that has failed 5 consecutive attempts
- **When** the 5th attempt also fails
- **Then** no further retries are scheduled and the delivery is marked as permanently failed

**Scenario:** Delivery attempt is logged
- **Given** any delivery attempt (first try or retry)
- **When** the HTTP request completes (success or failure)
- **Then** a log entry is persisted with the webhook ID, event type, attempt number, HTTP status code, response time in milliseconds, and a timestamp

**Scenario:** Delivery log is queryable
- **Given** a set of logged delivery attempts
- **When** queried by webhook ID, status (success/failed), event type, or date range
- **Then** the matching log entries are returned in reverse chronological order

### Out of Scope

- Management UI for viewing logs (Task 4)
- Manual retry trigger (Task 5)
- Webhook analytics/metrics dashboard
- Rate limiting per endpoint

### References

- Spec: silver-beacon webhook-spec.md — "Delivery Pipeline" section, retry schedule details
- Queue: Bull's built-in backoff and retry mechanisms
- Storage: PostgreSQL for delivery log persistence

---

## Task 4: Management UI

### Description

This task builds the React-based management interface where users configure and monitor their webhooks. It is the primary surface through which non-technical users interact with the webhook system. The UI connects to the CRUD API from Task 1 and the delivery log API from Task 3.

The interface has two main views: a webhook list/configuration view and a delivery log view. The configuration view supports full CRUD — users can create new webhooks (specifying URL and selecting event types), edit existing ones, toggle them active/inactive, and delete them. The delivery log view shows historical delivery attempts with filtering by status (success, failed), event type, and date range, giving users visibility into whether their integrations are working.

**Technical decisions:**
- Event type selection uses a multi-select component since each webhook can subscribe to multiple event types. This keeps the interface compact while supporting fine-grained subscriptions.
- Delivery log defaults to showing the most recent entries in reverse chronological order with filters for status, event type, and date range — matching common patterns users expect from log/audit UIs.
- Secrets are never displayed in the UI after creation. The API does not return decrypted secrets, and the UI should reflect this (e.g., show a masked placeholder or a "regenerate" option, but never the actual value).

### Acceptance Criteria

**Scenario:** Create a webhook via UI
- **Given** a user on the webhook management page
- **When** they fill in a URL, select one or more event types, and submit the form
- **Then** the webhook is created via the API and appears in the webhook list

**Scenario:** Edit a webhook
- **Given** a user viewing an existing webhook
- **When** they change the URL or modify the event type subscriptions and save
- **Then** the updated configuration is persisted and reflected in the UI

**Scenario:** Delete a webhook
- **Given** a user viewing an existing webhook
- **When** they click delete and confirm
- **Then** the webhook is removed from the list and deleted via the API

**Scenario:** Toggle active state
- **Given** a user viewing an active webhook
- **When** they toggle the active/inactive switch
- **Then** the webhook's state is updated via the API and the UI reflects the new status

**Scenario:** View delivery log
- **Given** a user navigating to the delivery log for a specific webhook
- **When** the log view loads
- **Then** recent delivery attempts are displayed with event type, status, HTTP response code, response time, and timestamp

**Scenario:** Filter delivery log
- **Given** a user viewing the delivery log with multiple entries
- **When** they apply filters for status (e.g., "failed"), event type, or date range
- **Then** only matching log entries are displayed

### Out of Scope

- Test ping functionality (Task 5)
- Manual retry button (Task 5)
- Webhook analytics/metrics dashboard
- Bulk operations on webhooks

### References

- Spec: silver-beacon webhook-spec.md — "Management UI" section
- Stack: React
- API: CRUD endpoints from Task 1, delivery log query endpoint from Task 3

---

## Task 5: Test Ping & Manual Retry

### Description

This is the final integration task that ties together the delivery pipeline and the management UI with two user-facing actions: test ping and manual retry.

Test ping lets a user send a synthetic event to a webhook endpoint to verify their configuration works before real events start flowing. This is critical for the setup experience — without it, users would have to trigger a real event and hope their URL, secret, and server are configured correctly. The ping sends a well-known test payload through the normal delivery pipeline so the receiving server exercises the same signature verification path it would for real events.

Manual retry lets a user re-trigger delivery for a specific failed event from the delivery log. Instead of waiting for the automatic retry schedule or giving up, users can fix their endpoint and immediately test that the fix works by retrying the original payload. The retry goes through the normal delivery pipeline and is logged as a new attempt.

**Technical decisions:**
- Test ping uses the actual delivery pipeline (publishes a synthetic event to the queue) rather than making a direct HTTP call, so the receiving server sees the same signature, headers, and payload format as real deliveries. This ensures the test is representative.
- Manual retry re-enqueues the original event payload for the specific webhook, so it goes through the same worker and logging path. It is logged as a new delivery attempt linked to the original event.

### Acceptance Criteria

**Scenario:** Test ping succeeds
- **Given** a user viewing a configured webhook in the management UI
- **When** they click the test ping button
- **Then** a synthetic test event is sent through the delivery pipeline to the webhook's URL with a valid HMAC signature, and the UI displays the delivery result (success with response code)

**Scenario:** Test ping fails
- **Given** a user viewing a webhook with an unreachable or misconfigured endpoint
- **When** they click the test ping button
- **Then** the UI displays the failure reason (e.g., connection refused, 401 response) so the user can diagnose the issue

**Scenario:** Manual retry of a failed delivery
- **Given** a user viewing a failed delivery entry in the delivery log
- **When** they click the retry button
- **Then** the original event payload is re-delivered to the webhook endpoint through the normal delivery pipeline, and a new delivery attempt is logged

**Scenario:** Manual retry succeeds after endpoint fix
- **Given** a previously failed delivery where the user has since fixed their endpoint
- **When** they trigger a manual retry
- **Then** the delivery succeeds, the new attempt is logged as successful, and the UI reflects the updated status

### Out of Scope

- Automatic retry logic (Task 3 — this task only adds the manual trigger)
- Webhook CRUD (Task 1)
- Webhook analytics/metrics dashboard
- Bulk retry of multiple failed deliveries

### References

- Spec: silver-beacon webhook-spec.md — "Management UI" section (test ping button, manual retry button)
- Delivery pipeline: Event queue and worker from Task 2, logging from Task 3
- UI: Management interface from Task 4
