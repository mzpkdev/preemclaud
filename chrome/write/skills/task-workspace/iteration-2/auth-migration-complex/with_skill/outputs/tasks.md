# Session-to-JWT Auth Migration Tasks
> From: **prompt** | Codename: **velvet-gateway**

**Goal:** Migrate authentication from session-based (Redis-backed) to JWT across the Express.js API, React frontend, and React Native mobile app, with backward compatibility for gradual rollout.

## Task Overview

| # | Task | Depends on | Parallel |
|---|------|-----------|----------|
| 1 | JWT infrastructure and token service | — | Yes |
| 2 | Dual-auth middleware (backward-compatible) | 1 | No |
| 3 | API auth endpoints (JWT issuance and refresh) | 1 | No |
| 4 | React frontend auth migration | 2, 3 | No |
| 5 | React Native mobile auth migration | 2, 3 | No |
| 6 | Feature flag and gradual rollout controls | 2 | No |
| 7 | Session deprecation and cleanup | 4, 5, 6 | No |

---

## Task 1: JWT Infrastructure and Token Service

### Description

The current auth system stores sessions in Redis. We're moving to JWT, but need a clean token service layer before anything else can change. This task creates the foundational JWT module that all other tasks depend on.

Build a standalone token service that handles JWT creation, validation, and refresh token management. This service will be consumed by the auth middleware (Task 2) and the auth endpoints (Task 3). It should be a self-contained module with no dependencies on the existing session logic — the two systems will coexist during migration.

**Technical decisions:**
- **Access + refresh token pair:** Access tokens are short-lived (15 minutes) and stateless. Refresh tokens are long-lived (7 days) and stored in the database (not Redis) so they can be revoked individually. This gives us the stateless benefit of JWT for request auth while retaining revocation capability through refresh tokens.
- **RS256 signing algorithm:** Use asymmetric keys (RS256) rather than a shared secret (HS256). This allows services to verify tokens without holding the signing key, which is important for a multi-app architecture (API, web, mobile).
- **Token payload structure:** Include `sub` (user ID), `iat`, `exp`, `jti` (unique token ID for revocation tracking), and `roles`. Keep the payload lean — no PII in the token.
- **Key rotation support:** Design the service to accept multiple public keys for verification (identified by `kid` in the JWT header) so keys can be rotated without invalidating all active tokens.

### Acceptance Criteria

**Scenario:** Generate a valid access token
- **Given** a user object with ID and roles
- **When** the token service `generateAccessToken` method is called
- **Then** it returns a signed JWT with `sub`, `roles`, `iat`, `exp` (15 min), and `jti` claims, signed with RS256

**Scenario:** Generate a refresh token
- **Given** a user object with ID
- **When** the token service `generateRefreshToken` method is called
- **Then** it returns a signed refresh token with a 7-day expiry and persists a record in the database linking the `jti` to the user

**Scenario:** Validate an access token
- **Given** a valid, non-expired access token
- **When** the token service `verifyAccessToken` method is called
- **Then** it returns the decoded payload with user ID and roles

**Scenario:** Reject an expired access token
- **Given** an access token that has passed its `exp` time
- **When** the token service `verifyAccessToken` method is called
- **Then** it throws a `TokenExpiredError` with a clear error code

**Scenario:** Revoke a refresh token
- **Given** a valid refresh token `jti`
- **When** the token service `revokeRefreshToken` method is called
- **Then** the database record for that `jti` is marked as revoked, and subsequent attempts to use that refresh token fail

**Scenario:** Key rotation verification
- **Given** tokens signed with the previous key (identified by `kid`)
- **When** the token service verifies them after a key rotation
- **Then** verification succeeds because the service checks `kid` and uses the corresponding public key

### Out of Scope

- Modifying existing session middleware or Redis logic (that's Task 2)
- HTTP endpoints for login/refresh (that's Task 3)
- Database migration scripts for the refresh token table (include the schema definition, but actual migration tooling depends on project conventions — implementer should follow existing migration patterns)

### References

- Express.js API codebase — look for existing auth/session modules to understand the current pattern
- `jsonwebtoken` npm package (or equivalent) for JWT signing/verification
- Database ORM/query layer used by the project for refresh token storage

---

## Task 2: Dual-Auth Middleware (Backward-Compatible)

### Description

This is the critical backward-compatibility layer that makes gradual rollout possible. The existing Express.js API uses session-based auth middleware that checks Redis for a valid session on every request. We need to replace this with a dual-mode middleware that accepts **either** a valid session cookie **or** a valid JWT Bearer token.

During the migration period, both old clients (sending session cookies) and new clients (sending JWTs) will hit the same API. The middleware must transparently handle both, normalizing the result into a consistent `req.user` object regardless of which auth method was used. This means downstream route handlers don't need to change at all — they keep reading `req.user` as they always have.

The middleware should check for a JWT in the `Authorization: Bearer <token>` header first. If present and valid, authenticate via JWT. If no JWT is present, fall back to the existing session check. If neither is valid, return 401.

**Technical decisions:**
- **JWT-first, session-fallback order:** Check JWT before session. This means once a client switches to JWT, there's no ambiguity. It also means we can measure JWT adoption by tracking which auth path is taken.
- **Consistent `req.user` shape:** Both auth paths must produce the same `req.user` object shape (at minimum: `id`, `roles`). The session path may need a small adapter to match.
- **Auth method tagging:** Attach `req.authMethod = 'jwt' | 'session'` so downstream code and logging can distinguish which path was used. This is essential for monitoring rollout progress.
- **No changes to route handlers:** The middleware swap must be invisible to all existing route handlers. This is the key constraint that enables gradual rollout without rewriting the API.

### Acceptance Criteria

**Scenario:** Authenticate with a valid JWT
- **Given** a request with `Authorization: Bearer <valid-jwt>` header
- **When** the request hits a protected route
- **Then** `req.user` is populated with user data from the JWT payload, `req.authMethod` is `'jwt'`, and the request proceeds

**Scenario:** Fall back to session when no JWT is present
- **Given** a request with a valid session cookie but no `Authorization` header
- **When** the request hits a protected route
- **Then** `req.user` is populated from the Redis session (same shape as JWT path), `req.authMethod` is `'session'`, and the request proceeds

**Scenario:** Reject when neither auth method is valid
- **Given** a request with no valid JWT and no valid session
- **When** the request hits a protected route
- **Then** the middleware returns a 401 response with a clear error message

**Scenario:** Invalid JWT falls back to session
- **Given** a request with an invalid/expired JWT in the `Authorization` header but a valid session cookie
- **When** the request hits a protected route
- **Then** the middleware does NOT fall back to session — it returns 401. (If a client sends a JWT, that's its declared auth method; falling back silently would mask token issues.)

**Scenario:** Consistent `req.user` shape
- **Given** two requests — one authenticated via JWT, one via session
- **When** a route handler accesses `req.user`
- **Then** both have the same object shape with at least `id` and `roles` fields

### Out of Scope

- Modifying any route handlers — they must remain untouched
- Login/logout endpoint changes (that's Task 3)
- Frontend or mobile changes (Tasks 4 and 5)
- Feature flag logic for controlling which users get JWT (that's Task 6 — this middleware simply accepts both)

### References

- Existing session middleware in the Express.js API (find it and understand how `req.user` is currently populated)
- Token service from Task 1 (`verifyAccessToken` method)
- Redis session store configuration

---

## Task 3: API Auth Endpoints (JWT Issuance and Refresh)

### Description

The existing API has login and logout endpoints that create and destroy Redis sessions. This task adds new JWT-based auth endpoints alongside the existing ones. The old endpoints stay untouched — clients will switch to the new ones as they migrate.

Build three new endpoints: one for login (returns access + refresh tokens), one for token refresh (exchanges a valid refresh token for a new access token), and one for logout (revokes the refresh token). These endpoints use the token service from Task 1.

The login endpoint authenticates the user with the same credential validation the existing login uses (username/password, or whatever the current flow is), but instead of creating a Redis session, it returns a JWT pair. This means the credential validation logic should be shared or reused — don't duplicate the password hashing/checking logic.

**Technical decisions:**
- **Separate endpoints, not modified existing ones:** New endpoints (e.g., `/auth/jwt/login`, `/auth/jwt/refresh`, `/auth/jwt/logout`) rather than modifying `/auth/login`. This ensures zero risk to the existing session flow and makes it clear which flow a client is using.
- **Refresh token in httpOnly cookie:** The refresh token is returned as an `httpOnly`, `Secure`, `SameSite=Strict` cookie rather than in the response body. This prevents XSS from accessing it. The access token goes in the response body since it's short-lived and the client needs to attach it to headers.
- **Refresh token rotation:** Each time a refresh token is used, issue a new one and revoke the old one. This limits the damage window if a refresh token is leaked.
- **Rate limiting on refresh endpoint:** Apply rate limiting to the refresh endpoint to prevent abuse. Use the same rate-limiting approach the project already uses.

### Acceptance Criteria

**Scenario:** JWT login with valid credentials
- **Given** a user with valid credentials
- **When** they POST to `/auth/jwt/login` with username and password
- **Then** the response includes an access token in the body and sets a refresh token as an httpOnly cookie, and both tokens are valid per the token service

**Scenario:** JWT login with invalid credentials
- **Given** invalid credentials
- **When** they POST to `/auth/jwt/login`
- **Then** the response is 401 with an error message, and no tokens are issued

**Scenario:** Token refresh with valid refresh token
- **Given** a valid, non-revoked refresh token in the request cookie
- **When** they POST to `/auth/jwt/refresh`
- **Then** a new access token is returned in the body, a new refresh token replaces the old cookie, and the old refresh token is revoked in the database

**Scenario:** Token refresh with revoked refresh token
- **Given** a refresh token that has been revoked (e.g., from a previous refresh rotation)
- **When** they POST to `/auth/jwt/refresh`
- **Then** the response is 401, and all refresh tokens for that user are revoked (potential token theft — revoke the family)

**Scenario:** JWT logout
- **Given** a user with a valid refresh token
- **When** they POST to `/auth/jwt/logout`
- **Then** the refresh token is revoked in the database, the refresh token cookie is cleared, and subsequent requests with the old access token continue to work until it expires (stateless — can't revoke access tokens)

**Scenario:** Existing session endpoints still work
- **Given** the existing `/auth/login` and `/auth/logout` endpoints
- **When** a client uses them
- **Then** they function exactly as before — no changes to session-based flow

### Out of Scope

- Modifying existing session-based login/logout endpoints
- OAuth/social login flows (migrate those separately if they exist)
- Account creation/registration (out of scope for auth migration)
- Admin endpoints for token management

### References

- Existing login endpoint and credential validation logic (reuse, don't duplicate)
- Token service from Task 1 (`generateAccessToken`, `generateRefreshToken`, `revokeRefreshToken`)
- Existing rate-limiting middleware/pattern in the API

---

## Task 4: React Frontend Auth Migration

### Description

The React frontend currently authenticates by sending session cookies automatically with every API request (likely via `fetch` with `credentials: 'include'` or an Axios instance with `withCredentials: true`). After migration, it needs to store the JWT access token in memory and attach it as a `Bearer` token in the `Authorization` header on every request.

This task updates the frontend's auth layer — the HTTP client configuration, token storage, automatic refresh logic, and auth state management. The goal is that the rest of the frontend (components, pages, hooks) doesn't need to change at all. The auth layer handles everything transparently.

Because we're rolling out gradually (Task 6), the frontend needs to support being told "use JWT" or "use sessions" — likely via a feature flag or a configuration setting. During the transition, the frontend checks which mode it's in and behaves accordingly.

**Technical decisions:**
- **Access token stored in memory only (not localStorage):** Store the access token in a JavaScript variable (e.g., module-scoped or in a React context). This is more secure than localStorage (not accessible to XSS). The tradeoff is that it's lost on page refresh, but the refresh token (in the httpOnly cookie) handles re-authentication transparently.
- **Axios/fetch interceptor for token attachment:** Use a request interceptor to automatically attach the `Authorization: Bearer <token>` header to every outgoing API request. This keeps the change out of individual API call sites.
- **Automatic silent refresh:** Use a response interceptor that catches 401 responses, attempts a token refresh via the `/auth/jwt/refresh` endpoint, and retries the original request. Queue concurrent requests during refresh to avoid multiple refresh calls.
- **Auth mode switching:** Read a feature flag (from config, environment variable, or the feature flag system from Task 6) to determine whether to use JWT or session mode. In session mode, the existing cookie-based behavior is preserved exactly.

### Acceptance Criteria

**Scenario:** Login via JWT flow
- **Given** the frontend is in JWT mode
- **When** the user submits the login form
- **Then** the frontend calls `/auth/jwt/login`, stores the access token in memory, and the refresh token cookie is set automatically by the browser

**Scenario:** Authenticated API requests in JWT mode
- **Given** the user is logged in via JWT
- **When** any API request is made from the frontend
- **Then** the `Authorization: Bearer <access-token>` header is automatically attached

**Scenario:** Silent token refresh
- **Given** the user is logged in via JWT and the access token has expired
- **When** an API request returns 401
- **Then** the frontend automatically calls `/auth/jwt/refresh`, obtains a new access token, stores it in memory, and retries the failed request — without the user seeing an error

**Scenario:** Concurrent requests during token refresh
- **Given** multiple API requests fail simultaneously due to expired token
- **When** the refresh interceptor triggers
- **Then** only one refresh request is made; all failed requests are queued and retried after the new token is obtained

**Scenario:** Page refresh persistence
- **Given** the user previously logged in via JWT and refreshes the page
- **When** the app initializes
- **Then** it silently calls `/auth/jwt/refresh` (the httpOnly cookie is still present), obtains a new access token, and restores the authenticated state without showing a login screen

**Scenario:** Session mode unchanged
- **Given** the frontend is in session mode (feature flag off)
- **When** the user logs in and makes API requests
- **Then** the existing cookie-based auth flow works exactly as before — no JWT logic runs

### Out of Scope

- UI changes to login/logout pages (only the underlying auth mechanism changes)
- New auth-related UI (e.g., "session expired" modals — follow existing patterns)
- React Native changes (that's Task 5)
- Feature flag infrastructure (that's Task 6 — this task consumes the flag)

### References

- Existing frontend HTTP client setup (Axios instance or fetch wrapper)
- Existing auth context/store (Redux, Context API, Zustand, etc.)
- Login page component and its API call
- JWT login and refresh endpoints from Task 3

---

## Task 5: React Native Mobile Auth Migration

### Description

The React Native mobile app needs the same JWT migration as the web frontend, but mobile has different constraints. Mobile apps can't rely on httpOnly cookies for refresh token storage (the cookie jar behavior varies across platforms and HTTP libraries). Instead, the refresh token needs to be stored in the platform's secure storage (Keychain on iOS, Keystore/EncryptedSharedPreferences on Android).

This task updates the mobile app's auth layer to use JWT. Like the frontend task, the goal is that screens, navigation, and components don't change — only the auth plumbing. The mobile app should also respect feature flags for gradual rollout.

**Technical decisions:**
- **Secure storage for refresh token:** Use `react-native-keychain` (or the project's existing secure storage library) to store the refresh token. Do NOT use AsyncStorage — it's not encrypted. The access token can be kept in memory since it's short-lived.
- **Refresh token sent as a request body parameter (not cookie):** Since mobile doesn't reliably use httpOnly cookies, the refresh endpoint should also accept the refresh token in the request body. The API endpoints (Task 3) should support both cookie and body — coordinate with Task 3 on this. If Task 3 only supports cookies, this task should update the refresh endpoint to accept body too.
- **Background token refresh:** Mobile apps can be backgrounded for long periods. On app foreground, check if the access token is expired and proactively refresh before making any API calls. This avoids a flash of unauthenticated state.
- **Biometric re-auth fallback:** If the refresh token is also expired (user hasn't opened the app in 7+ days), fall back to the existing login flow. If the app supports biometric auth, this is a good place to prompt for it — but implementing biometric auth from scratch is out of scope.

### Acceptance Criteria

**Scenario:** Login via JWT flow on mobile
- **Given** the mobile app is in JWT mode
- **When** the user logs in
- **Then** the app calls `/auth/jwt/login`, stores the access token in memory, and stores the refresh token in platform secure storage (Keychain/Keystore)

**Scenario:** Authenticated API requests in JWT mode
- **Given** the user is logged in via JWT on mobile
- **When** any API request is made
- **Then** the `Authorization: Bearer <access-token>` header is automatically attached

**Scenario:** Token refresh on mobile
- **Given** the access token has expired
- **When** an API request returns 401
- **Then** the app retrieves the refresh token from secure storage, calls `/auth/jwt/refresh` with the token in the request body, stores the new tokens, and retries the failed request

**Scenario:** App foregrounded after background period
- **Given** the app was backgrounded and the access token has expired
- **When** the app returns to the foreground
- **Then** it proactively refreshes the access token using the stored refresh token before making any API calls

**Scenario:** Refresh token expired (long inactivity)
- **Given** the user hasn't opened the app in over 7 days and the refresh token has expired
- **When** the app attempts to refresh
- **Then** the user is redirected to the login screen and secure storage is cleared

**Scenario:** Session mode unchanged
- **Given** the mobile app is in session mode (feature flag off)
- **When** the user uses the app
- **Then** the existing auth flow works exactly as before

### Out of Scope

- UI changes to login/registration screens
- Implementing biometric authentication from scratch (only use it if it already exists)
- Push notification token management (separate concern)
- Offline mode or offline token caching beyond secure storage

### References

- Existing mobile HTTP client setup (Axios, fetch, or apisauce)
- Existing mobile auth state management
- `react-native-keychain` or project's existing secure storage solution
- JWT login and refresh endpoints from Task 3
- Note: Coordinate with Task 3 — the refresh endpoint must accept refresh token in request body (not just cookie) for mobile support

---

## Task 6: Feature Flag and Gradual Rollout Controls

### Description

We're not flipping everyone to JWT at once. This task builds the controls that let us gradually roll out the JWT auth to specific users, user segments, or percentages of traffic. This is what makes the backward-compatible migration safe — we can start with internal users, expand to 5%, then 25%, and so on, reverting quickly if issues arise.

The feature flag determines which auth mode clients should use. It could be a server-side flag (API tells the client which mode to use), a client-side config, or both. The flag should be queryable on both the API side (so the dual-auth middleware from Task 2 can log/monitor which mode is being used) and the client side (so the frontend and mobile app know which login flow to use).

**Technical decisions:**
- **Server-driven flag preferred:** The API should expose an endpoint or include auth-mode information in an existing config/bootstrap endpoint. This way the server controls rollout without requiring client app updates. Clients call this on startup and configure their auth layer accordingly.
- **Flag granularity — per-user:** The flag should support per-user targeting (e.g., "all users in the internal-testers group use JWT") and percentage-based rollout (e.g., "10% of all users use JWT"). If the project already has a feature flag system (LaunchDarkly, Unleash, Flagsmith, custom), integrate with that. If not, build a simple one with a database table.
- **Sticky assignment:** Once a user is assigned to JWT mode, they stay on JWT mode (don't flip back and forth based on percentage rolls). Store the assignment so it's consistent.
- **Kill switch:** Include a global override that forces everyone back to session mode. This is the emergency rollback mechanism.
- **Monitoring hooks:** Emit metrics or logs when auth mode is determined for a user — this feeds into rollout dashboards.

### Acceptance Criteria

**Scenario:** User targeted for JWT rollout
- **Given** a user who has been flagged for JWT (via user group or percentage rollout)
- **When** they request auth configuration from the API
- **Then** the response indicates JWT mode, and the client configures accordingly

**Scenario:** User not in JWT rollout
- **Given** a user who is not yet in the JWT rollout
- **When** they request auth configuration
- **Then** the response indicates session mode, and the client continues using cookies

**Scenario:** Percentage-based rollout
- **Given** the JWT rollout is set to 10%
- **When** a new user (not previously assigned) requests auth configuration
- **Then** they have a 10% chance of being assigned to JWT mode, and the assignment is stored for consistency

**Scenario:** Sticky assignment
- **Given** a user was previously assigned to JWT mode at 10% rollout
- **When** the rollout percentage changes to 5%
- **Then** the user remains on JWT mode (assignment is sticky)

**Scenario:** Kill switch activation
- **Given** the global kill switch is activated
- **When** any user requests auth configuration
- **Then** all users are forced to session mode regardless of individual assignments

**Scenario:** Monitoring
- **Given** any user's auth mode is determined
- **When** the flag is evaluated
- **Then** a log entry or metric is emitted recording the user ID, assigned mode, and evaluation reason

### Out of Scope

- Building a full-featured feature flag platform (use existing infra or keep it simple)
- Rollout automation (deciding when to increase percentage — that's an operational decision)
- A/B testing or analytics beyond basic auth-mode metrics
- UI for managing flags (admin API or database changes are fine for now)

### References

- Existing feature flag system (if any) in the project
- Task 2's dual-auth middleware (consumes the flag for logging)
- Task 4 (React frontend) and Task 5 (React Native) consume the flag to choose auth mode
- Monitoring/metrics infrastructure in the project (StatsD, Prometheus, Datadog, etc.)

---

## Task 7: Session Deprecation and Cleanup

### Description

Once JWT rollout reaches 100% and has been stable, the session infrastructure can be removed. This task is the final cleanup — removing the session middleware, the Redis session store dependency, the old login/logout endpoints, and the dual-auth fallback logic. It also removes the feature flag controls since they're no longer needed.

This task should NOT be started until JWT rollout is at 100% and has been stable for a defined period (e.g., 2 weeks with no rollback). It's included in the decomposition for completeness and to make sure the cleanup is planned, not forgotten.

**Technical decisions:**
- **Phased removal:** First, stop creating new sessions (disable session login endpoints). Monitor for a period (session TTL + buffer). Then remove session middleware. Then remove Redis session config. This avoids a hard cutover.
- **Redis session store decommission:** Don't just delete the Redis connection — verify no other features depend on the same Redis instance (e.g., caching, rate limiting). Only remove the session-specific configuration.
- **Remove dual-auth middleware fallback:** Simplify the dual-auth middleware from Task 2 into a JWT-only middleware. The session fallback branch is deleted.
- **Remove feature flag:** Clean up the rollout flag, sticky assignments table, and kill switch. These are no longer needed.
- **Database cleanup:** Remove or archive expired refresh tokens from the database on a schedule. Add a cron job or background task.

### Acceptance Criteria

**Scenario:** Session login endpoints removed
- **Given** JWT is at 100% rollout and stable
- **When** a client calls the old `/auth/login` (session-based)
- **Then** the endpoint returns 410 Gone with a message indicating the new endpoint

**Scenario:** Session middleware removed
- **Given** no active sessions remain (Redis TTL expired)
- **When** a request arrives with only a session cookie (no JWT)
- **Then** the middleware returns 401 (session fallback no longer exists)

**Scenario:** Redis session store removed
- **Given** session cleanup is complete
- **When** inspecting the API's Redis usage
- **Then** no session-related keys exist, and the session store configuration is removed from the codebase (other Redis uses like caching remain)

**Scenario:** JWT-only middleware
- **Given** cleanup is complete
- **When** examining the auth middleware
- **Then** it only handles JWT — no session fallback, no `req.authMethod` branching, simplified code

**Scenario:** Feature flag cleaned up
- **Given** cleanup is complete
- **When** examining the feature flag system
- **Then** the auth-mode flag, sticky assignments, and kill switch are removed

### Out of Scope

- Removing Redis entirely (it may be used for caching, rate limiting, etc.)
- Migrating other Redis-dependent features
- Changing JWT implementation (token service stays as built in Task 1)

### References

- Dual-auth middleware from Task 2 (simplify to JWT-only)
- Session-based login/logout endpoints (remove)
- Redis configuration (remove session store, keep other uses)
- Feature flag from Task 6 (remove)
- Refresh token table (add cleanup job)
