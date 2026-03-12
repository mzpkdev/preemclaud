# Webhook Notification System Spec
> Codename: **silver-beacon**

**Goal:** Allow users to configure webhook endpoints that receive real-time notifications when events occur in the system.

**Approach:** Event-driven architecture with a webhook registry, delivery pipeline with retry logic, and a management UI for configuring and monitoring webhooks.

**Tech Stack:** Node.js, PostgreSQL, Redis (for queue), React

## Decision Log

| Decision | Chosen | Why | Alternatives Considered |
|----------|--------|-----|------------------------|
| Queue system | Redis + Bull | Already in stack, handles retries natively | RabbitMQ (overkill), SQS (vendor lock-in) |
| Signature verification | HMAC-SHA256 | Industry standard, simple to implement | JWT (heavier than needed) |
| Retry strategy | Exponential backoff, max 5 attempts | Balances reliability with not hammering failing endpoints | Fixed interval (too aggressive), manual retry only (poor UX) |

## Design

### Webhook Registry
- CRUD API for webhook configurations (URL, events, secret, active/inactive)
- Each webhook subscribes to specific event types
- Secrets stored encrypted, used for HMAC signing

### Delivery Pipeline
- Events published to Redis queue
- Worker picks up events, fans out to matching webhooks
- Each delivery attempt logged with status, response code, response time
- Failed deliveries retried with exponential backoff (1m, 5m, 25m, 2h, 12h)

### Management UI
- List/create/edit/delete webhooks
- Event type selector
- Delivery log with filtering (status, event type, date range)
- Manual retry button for failed deliveries
- Test ping button

## Scope

**In scope:**
- Webhook CRUD API and data model
- Event queue and delivery worker
- Retry logic with exponential backoff
- HMAC-SHA256 signature on payloads
- Management UI (list, create, edit, delete, logs)
- Test ping functionality

**Out of scope:**
- Webhook analytics/metrics dashboard
- Rate limiting per endpoint
- Webhook versioning
- Bulk operations

## Open Questions

- Should we support custom headers on webhook requests?
- Maximum payload size?
