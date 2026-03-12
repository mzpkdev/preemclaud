# Auth Migration: Session-Based to JWT

Migrate authentication from Redis-backed sessions to JWT across the Express.js API, React web frontend, and React Native mobile app. Maintain backward compatibility throughout to enable gradual rollout.

---

## Phase 1: Foundation -- JWT Infrastructure on the API

### Task 1.1: Create JWT token service module
- **What:** Build a standalone `TokenService` module that handles JWT creation, verification, and refresh logic.
- **Where:** API (Express.js)
- **Details:**
  - Implement `generateAccessToken(payload)` returning a short-lived token (e.g., 15 minutes).
  - Implement `generateRefreshToken(payload)` returning a long-lived token (e.g., 7 days).
  - Implement `verifyToken(token)` that validates signature and expiry, returns decoded payload or throws.
  - Use RS256 (asymmetric) signing so that other services can verify tokens without the private key. Fall back to HS256 if key management is out of scope for now.
  - Store signing secrets/keys in environment variables (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
  - Write unit tests covering: valid token round-trip, expired token rejection, tampered token rejection, malformed input handling.

### Task 1.2: Create refresh token storage and rotation
- **What:** Set up server-side storage for refresh tokens to support revocation and rotation.
- **Where:** API (Express.js), database/Redis
- **Details:**
  - Create a `refresh_tokens` table or Redis key-set storing: `token_id`, `user_id`, `token_hash`, `expires_at`, `created_at`, `revoked_at`.
  - Hash refresh tokens before storage (never store raw).
  - Implement `storeRefreshToken`, `revokeRefreshToken`, `revokeAllUserTokens`, and `isTokenRevoked` functions.
  - Implement refresh token rotation: when a refresh token is used, revoke it and issue a new one. If a revoked refresh token is presented, revoke the entire token family (detects token theft).
  - Write unit tests for each function and the rotation/theft-detection flow.

### Task 1.3: Create JWT authentication middleware
- **What:** Build an Express middleware that authenticates requests via JWT, to run alongside (not replace) the existing session middleware.
- **Where:** API (Express.js)
- **Details:**
  - Read the `Authorization: Bearer <token>` header.
  - Verify the access token using `TokenService.verifyToken`.
  - On success, populate `req.user` with the decoded payload (same shape the session middleware currently uses).
  - On failure (missing, expired, invalid), call `next()` without setting `req.user` -- do NOT reject the request, because the session middleware may still authenticate it (dual-mode support, see Task 2.1).
  - Write unit tests with mocked tokens.

---

## Phase 2: Dual-Mode Authentication (Backward Compatibility)

### Task 2.1: Implement dual-mode auth strategy on the API
- **What:** Allow both session-based and JWT-based requests to coexist so clients can migrate independently.
- **Where:** API (Express.js)
- **Details:**
  - Wire middleware in order: (1) existing session middleware, (2) new JWT middleware from Task 1.3.
  - Create a final `requireAuth` guard middleware that checks if `req.user` is populated by either mechanism. If not, return 401.
  - Replace all current direct session-auth checks in route handlers with `requireAuth`.
  - Add a `req.authMethod` field (`"session"` or `"jwt"`) so downstream code and logging can distinguish.
  - Add structured logging for auth method per request to monitor rollout progress.
  - Write integration tests: session-only request succeeds, JWT-only request succeeds, no-auth request is rejected, both-present request uses JWT (define precedence).

### Task 2.2: Create JWT login and refresh endpoints
- **What:** Add new API endpoints that issue JWTs upon login and handle token refresh.
- **Where:** API (Express.js)
- **Details:**
  - `POST /api/auth/token` -- accepts credentials (same as current login), validates them, returns `{ accessToken, refreshToken, expiresIn }`. The existing `POST /api/auth/login` session endpoint must remain unchanged.
  - `POST /api/auth/token/refresh` -- accepts a refresh token, validates it, rotates it (Task 1.2), returns new token pair.
  - `POST /api/auth/token/revoke` -- accepts a refresh token, revokes it (for logout).
  - All endpoints must validate input, rate-limit, and return appropriate HTTP status codes.
  - Write integration tests for each endpoint: happy path, invalid credentials, expired refresh token, revoked refresh token, rate limiting.

### Task 2.3: Create JWT logout and session cleanup endpoint
- **What:** Ensure logout works cleanly for both auth modes.
- **Where:** API (Express.js)
- **Details:**
  - Update or create `POST /api/auth/logout` so it: (a) destroys the session if one exists, and (b) revokes the refresh token if one is provided in the request body.
  - Clients in transition may have both a session and JWT tokens; logout must clear both.
  - Write integration tests.

---

## Phase 3: React Web Frontend Migration

### Task 3.1: Create a JWT auth service module in the frontend
- **What:** Build a client-side service that manages JWT tokens.
- **Where:** React web app
- **Details:**
  - Implement `login(credentials)` calling `POST /api/auth/token`, storing tokens on success.
  - Implement `refreshAccessToken()` calling `POST /api/auth/token/refresh`.
  - Implement `logout()` calling `POST /api/auth/token/revoke` then clearing local state.
  - Implement `getAccessToken()` that returns the current token, triggering a refresh if it will expire within a buffer window (e.g., 60 seconds).
  - Store the access token in memory only (not localStorage) to limit XSS exposure. Store the refresh token in an httpOnly cookie if possible (requires API support) or in memory with a fallback to localStorage.
  - Write unit tests.

### Task 3.2: Create an Axios/fetch interceptor for automatic token attachment
- **What:** Transparently attach JWT to all API requests and handle token expiry.
- **Where:** React web app
- **Details:**
  - Add a request interceptor that calls `getAccessToken()` and sets the `Authorization: Bearer` header.
  - Add a response interceptor that, on 401, attempts a single token refresh and retries the original request. If refresh also fails, redirect to login.
  - Queue concurrent requests during refresh to avoid multiple simultaneous refresh calls.
  - Write unit tests with mocked HTTP.

### Task 3.3: Add feature flag to toggle between session and JWT auth
- **What:** Control which auth mechanism the frontend uses via a feature flag so rollout can be gradual and reversible.
- **Where:** React web app
- **Details:**
  - Introduce a feature flag (`USE_JWT_AUTH`) sourced from environment variable, remote config, or a simple constant.
  - When the flag is off, the app uses existing session-based auth (no behavior change).
  - When the flag is on, the app uses the JWT auth service from Task 3.1 and the interceptor from Task 3.2.
  - The auth context/provider should abstract this so the rest of the app does not need to know which mechanism is active.
  - Write tests covering both flag states.

### Task 3.4: Update auth context, login page, and protected routes for JWT support
- **What:** Wire the JWT auth service into the existing React auth flow.
- **Where:** React web app
- **Details:**
  - Update the auth context/provider to use the JWT auth service when the feature flag is on.
  - Update the login page to call the JWT login flow.
  - Ensure protected route wrappers work with the JWT auth state (checking `getAccessToken()` rather than relying on a session cookie).
  - Handle page refresh: on mount, attempt a silent token refresh to restore auth state.
  - Write integration/component tests.

---

## Phase 4: React Native Mobile App Migration

### Task 4.1: Create a JWT auth service module for mobile
- **What:** Build a mobile-specific service that manages JWT tokens using secure storage.
- **Where:** React Native app
- **Details:**
  - Same API contract as Task 3.1 (`login`, `refreshAccessToken`, `logout`, `getAccessToken`).
  - Store tokens using `react-native-keychain` or `expo-secure-store` instead of in-memory/localStorage.
  - On app launch, load tokens from secure storage and attempt a silent refresh.
  - Write unit tests.

### Task 4.2: Create a fetch/axios interceptor for the mobile app
- **What:** Automatically attach JWTs to all API requests from the mobile app.
- **Where:** React Native app
- **Details:**
  - Same pattern as Task 3.2: request interceptor adds `Authorization` header, response interceptor handles 401 with refresh + retry.
  - Ensure the refresh-and-retry queue handles the mobile-specific case where the app may wake from background with an expired token.
  - Write unit tests.

### Task 4.3: Add feature flag and wire JWT auth into the mobile app
- **What:** Gradual rollout toggle for mobile, wired into the app's auth flow.
- **Where:** React Native app
- **Details:**
  - Introduce a feature flag (`USE_JWT_AUTH`) via remote config (e.g., LaunchDarkly, Firebase Remote Config, or a simple API flag endpoint).
  - Update the auth provider/context to switch between session and JWT flows based on the flag.
  - On flag flip, handle the transition: if a user has an active session but no JWT, prompt re-login or silently obtain JWT tokens using a migration endpoint (see Task 5.2).
  - Write tests covering both flag states and the transition path.

---

## Phase 5: Migration Support and Rollout

### Task 5.1: Add auth-method metrics and monitoring
- **What:** Instrument the API to track the ratio of session vs. JWT authentications so you know when it is safe to remove sessions.
- **Where:** API (Express.js)
- **Details:**
  - Emit a metric/log for each authenticated request indicating `authMethod` (from Task 2.1).
  - Build or configure a dashboard (Datadog, Grafana, CloudWatch, etc.) showing: JWT vs. session request counts over time, JWT-specific errors (expired, revoked, invalid), refresh token usage rates.
  - Set up alerts for spikes in JWT auth failures.

### Task 5.2: Create a session-to-JWT migration endpoint
- **What:** Allow currently-logged-in session users to obtain JWT tokens without re-entering credentials.
- **Where:** API (Express.js)
- **Details:**
  - `POST /api/auth/token/exchange` -- requires a valid session. Issues a JWT token pair for the session's user, then optionally destroys the session.
  - This enables clients to transparently migrate active users: call this endpoint when the feature flag flips on, obtain tokens, then operate in JWT mode.
  - Rate-limit and log usage.
  - Write integration tests.

### Task 5.3: Write a runbook for the gradual rollout
- **What:** Document the step-by-step rollout plan so the team can execute it safely.
- **Where:** Documentation
- **Details:**
  - Step 1: Deploy API changes (Phase 1 + 2) with no client changes. Verify dual-mode works in staging.
  - Step 2: Enable JWT on the web frontend for internal/beta users via feature flag. Monitor for errors.
  - Step 3: Enable JWT on mobile for internal/beta users. Monitor for errors.
  - Step 4: Gradually increase rollout percentage (10%, 25%, 50%, 100%) with monitoring at each step.
  - Step 5: Once 100% JWT and metrics confirm zero session usage for N days, proceed to Phase 6.
  - Include rollback steps for each stage (flip flag off, clients fall back to sessions).

---

## Phase 6: Deprecation and Cleanup

### Task 6.1: Remove session auth from the API
- **What:** Once all clients are on JWT and metrics confirm zero session traffic, remove the legacy session code.
- **Where:** API (Express.js)
- **Details:**
  - Remove session middleware, `express-session` configuration, and the session-based login/logout endpoints.
  - Remove the dual-mode logic from `requireAuth`; it should now only check JWT.
  - Remove the `/api/auth/token/exchange` migration endpoint.
  - Remove the `connect-redis` session store dependency.
  - Update all integration tests to remove session-based test cases.
  - Keep Redis itself if it is used for other purposes (caching, rate limiting, etc.).

### Task 6.2: Remove feature flags and legacy auth code from frontends
- **What:** Clean up the session-based auth paths in both client apps.
- **Where:** React web app, React Native app
- **Details:**
  - Remove the `USE_JWT_AUTH` feature flag and all conditional branches.
  - Remove any session-related auth code (cookie handling, session login calls).
  - Simplify the auth context/provider to only use JWT.
  - Update tests.

### Task 6.3: Remove Redis session store (if no longer needed)
- **What:** If Redis was only used for sessions, decommission it to reduce infrastructure cost and complexity.
- **Where:** Infrastructure
- **Details:**
  - Confirm Redis has no other consumers (caching, queues, rate limiting).
  - Remove Redis connection configuration from the API.
  - Decommission the Redis instance.
  - Update deployment/infrastructure-as-code configs.

---

## Dependency Map

```
Phase 1 (no dependencies)
  1.1 ─┬─> 1.3 ──> 2.1
       └─> 1.2 ──> 2.2
                    2.2 ──> 2.3
                    2.1 + 2.2 ──> 5.2

Phase 3 (depends on Phase 2)
  3.1 ──> 3.2 ──> 3.3 ──> 3.4

Phase 4 (depends on Phase 2)
  4.1 ──> 4.2 ──> 4.3

Phase 5 (depends on Phases 2-4)
  5.1 (can start with 2.1)
  5.2 (depends on 2.1 + 2.2)
  5.3 (depends on all above being planned)

Phase 6 (depends on successful full rollout)
  6.1, 6.2, 6.3 (all depend on 5.3 completion and confirmed zero session traffic)
```
