# Session-to-JWT Auth Migration Tasks
> From: **prompt** | Codename: **shifting-beacon**

**Goal:** Migrate authentication from session-based (Redis-backed) to JWT across the Express.js API, React frontend, and React Native mobile app, with backward compatibility for a gradual rollout.

## Task Overview

| # | Task | Depends on | Parallel |
|---|------|-----------|----------|
| 1 | JWT token infrastructure (API) | — | Yes |
| 2 | Dual-auth middleware (API) | 1 | No |
| 3 | Auth API endpoints — JWT issuance and refresh | 1 | No |
| 4 | React frontend auth migration | 2, 3 | No |
| 5 | React Native mobile app auth migration | 2, 3 | No |
| 6 | Session deprecation and cleanup tooling | 2, 3, 4, 5 | No |

---

## Task 1: JWT Token Infrastructure (API)

**Objective:** Build the core JWT utility layer — signing, verification, token structure, key management — that all other tasks depend on.

### Context

The system currently authenticates users via server-side sessions stored in Redis (likely using `express-session` with `connect-redis`). We're moving to stateless JWT authentication. This task builds the foundational token layer that the rest of the migration depends on. Nothing in this task changes how the API handles incoming requests yet — that's Task 2. This task only creates the tools for producing and validating tokens.

Key design decisions:
- **Token pair model:** Use short-lived access tokens (e.g., 15 minutes) and longer-lived refresh tokens (e.g., 7 days). This is standard practice — short-lived access tokens limit the blast radius of a leaked token, and refresh tokens let users stay logged in without re-entering credentials.
- **Signing algorithm:** Use RS256 (asymmetric) rather than HS256. RS256 lets services verify tokens without having the signing key, which matters if the architecture grows. If the team prefers HS256 for simplicity, the interface should abstract over this so it's swappable.
- **Key management:** Store signing keys outside the codebase. Environment variables for now; a secrets manager later. Support key rotation by including a `kid` (key ID) header in issued tokens.
- **Token payload:** Include `sub` (user ID), `iat`, `exp`, `jti` (unique token ID — needed for revocation later), and any roles/permissions the API currently pulls from the session object. Examine the existing session schema to ensure nothing is lost.

### Requirements

- Create a token service module (e.g., `src/services/tokenService.js` or `.ts`) with functions: `signAccessToken(user)`, `signRefreshToken(user)`, `verifyAccessToken(token)`, `verifyRefreshToken(token)`
- Define the access token payload structure based on the existing session data (user ID, roles, permissions, any feature flags stored in session)
- Implement key loading from environment variables with clear error messages if keys are missing at startup
- Include `kid` header support for future key rotation
- Add a refresh token store — this can be a Redis set or a DB table. Refresh tokens must be revocable (e.g., on logout or password change), so they cannot be purely stateless
- Write unit tests for signing, verification, expired token rejection, and malformed token handling

### Acceptance Criteria

- [ ] `signAccessToken` produces a valid JWT with the defined payload structure
- [ ] `verifyAccessToken` returns decoded payload for valid tokens and throws/returns error for expired or tampered tokens
- [ ] Refresh tokens are stored in a persistent store and can be revoked by user ID or token ID
- [ ] Keys are loaded from environment, not hardcoded
- [ ] Unit tests pass covering: valid token round-trip, expired token rejection, tampered token rejection, missing key startup error

### Dependencies

- **Blocked by:** None
- **Blocks:** 2, 3

### References

- Existing session configuration (look for `express-session` and `connect-redis` setup in middleware or config files)
- Existing session schema — whatever is stored on `req.session` (user ID, roles, permissions) must be present in the JWT payload
- `jsonwebtoken` npm package (or `jose` for a more modern alternative)

---

## Task 2: Dual-Auth Middleware (API)

**Objective:** Replace the existing session-only auth middleware with a dual-mode middleware that accepts both session cookies and JWT Bearer tokens, enabling gradual client migration.

### Context

This is the critical backward-compatibility piece. The current API presumably has auth middleware that checks `req.session` for a logged-in user and attaches user context (e.g., `req.user`) for downstream route handlers. We need to replace this with middleware that:

1. Checks for a `Bearer` token in the `Authorization` header first
2. If present, verifies the JWT and populates `req.user` from the token payload
3. If no Bearer token, falls back to checking the existing session (the current behavior)
4. If neither is present, returns 401

This means **every existing session-authenticated request continues to work unchanged**. New clients (or updated clients) can start sending JWTs instead. Both paths populate `req.user` identically so downstream route handlers don't need to change at all.

Key design decisions:
- **`req.user` contract must be identical** regardless of auth method. Audit the existing middleware to see exactly what shape `req.user` has and replicate it from the JWT payload. If the JWT payload from Task 1 has a slightly different shape, normalize it in this middleware.
- **Auth method tagging:** Attach `req.authMethod = 'jwt' | 'session'` so logging and metrics can track the migration's progress. This is invaluable for knowing when it's safe to remove session support.
- **No route handler changes.** The entire point of this middleware is that the rest of the API is unaware of the migration.

### Requirements

- Create a new auth middleware that attempts JWT verification first, then falls back to session verification
- Populate `req.user` with the same shape/properties regardless of auth method
- Add `req.authMethod` property indicating which method authenticated the request
- Maintain all existing session middleware configuration (don't remove `express-session` setup) — sessions must keep working
- Handle edge cases: expired JWT with valid session (should fall back to session), valid JWT with expired/missing session (should succeed on JWT alone)
- Add integration tests covering: JWT-only auth, session-only auth, both present (JWT wins), neither present (401), expired JWT falls back to session

### Acceptance Criteria

- [ ] All existing API tests pass without modification (proves backward compatibility)
- [ ] Requests with valid `Authorization: Bearer <token>` are authenticated via JWT
- [ ] Requests with valid session cookies (no Bearer header) are authenticated via session
- [ ] `req.user` has the same shape for both auth methods
- [ ] `req.authMethod` is set correctly for logging/metrics
- [ ] 401 is returned when neither auth method succeeds

### Dependencies

- **Blocked by:** 1
- **Blocks:** 4, 5, 6

### References

- Existing auth middleware (search for `req.session`, `isAuthenticated`, `passport`, or similar patterns)
- Token service from Task 1
- Existing `req.user` population logic — this is the contract that must be preserved

---

## Task 3: Auth API Endpoints — JWT Issuance and Refresh

**Objective:** Add API endpoints for JWT login, token refresh, and JWT-aware logout, alongside the existing session-based login flow.

### Context

The existing login endpoint(s) likely create a session (e.g., `req.session.userId = user.id` or use Passport's `req.login()`). We need new endpoints — or augmented existing endpoints — that return JWTs. This task is about the endpoints themselves; the token creation logic comes from Task 1.

Key design decisions:
- **Augment vs. new endpoints:** The recommended approach is to augment the existing login endpoint. If the client sends an `Accept: application/json` header or a specific query parameter (e.g., `?auth=jwt`), return tokens in the response body. Otherwise, behave as before (set session cookie). This avoids duplicating login logic and validation. If the existing endpoint already returns JSON, use a response field like `{ token, refreshToken, ...existingFields }` and rely on clients opting in.
- **Refresh endpoint:** New endpoint `POST /auth/refresh` accepts a refresh token, validates it against the refresh token store (Task 1), issues a new access token (and optionally rotates the refresh token). This endpoint doesn't exist today.
- **Logout:** The existing logout endpoint destroys the session. It should also accept and revoke a refresh token if one is provided, so JWT-authenticated clients can clean up. Failing to revoke on logout is a security gap.
- **Token response format:** `{ accessToken: string, refreshToken: string, expiresIn: number }`. The `expiresIn` field tells clients when to proactively refresh.

### Requirements

- Modify the login endpoint to optionally return JWT tokens (access + refresh) based on client opt-in
- Create `POST /auth/refresh` endpoint that validates a refresh token, revokes the old one, and issues a new access + refresh token pair
- Modify the logout endpoint to revoke the provided refresh token (if any) in addition to destroying the session
- Ensure login validation, rate limiting, and error handling remain unchanged — this task only changes what's returned after successful authentication
- Add tests for: JWT login flow, token refresh, refresh with revoked token (should fail), logout with refresh token revocation

### Acceptance Criteria

- [ ] Login endpoint returns JWT tokens when client opts in
- [ ] Login endpoint still creates a session when client does not opt in (backward compatible)
- [ ] `POST /auth/refresh` returns new tokens and revokes the old refresh token
- [ ] `POST /auth/refresh` rejects revoked or expired refresh tokens with 401
- [ ] Logout revokes the provided refresh token
- [ ] Existing login/logout tests still pass

### Dependencies

- **Blocked by:** 1
- **Blocks:** 4, 5, 6

### References

- Existing login endpoint(s) — search for routes handling `/login`, `/auth/login`, or Passport `authenticate()` calls
- Existing logout endpoint
- Token service from Task 1
- Refresh token store from Task 1

---

## Task 4: React Frontend Auth Migration

**Objective:** Update the React web app to authenticate via JWT instead of session cookies, with a seamless transition for logged-in users.

### Context

The React frontend currently relies on session cookies for authentication. The browser sends cookies automatically with every request, and the API's session middleware handles the rest. Moving to JWT means:

1. The frontend must explicitly store tokens (access + refresh) and attach the access token as an `Authorization: Bearer` header on every API request.
2. The frontend must handle token refresh — when an access token expires, use the refresh token to get a new one, then retry the failed request.
3. Existing logged-in users have a valid session but no tokens. They shouldn't be forced to re-login. The dual-auth middleware (Task 2) handles this on the API side — their session cookies will keep working. The frontend migration can be gradual: new logins get tokens, existing sessions keep working until they expire.

Key design decisions:
- **Token storage:** Store tokens in memory (a module-level variable or React context) for the access token, and use an `httpOnly` secure cookie or `localStorage` for the refresh token. Memory is preferred for the access token because it's not accessible to XSS. If `localStorage` is used for the refresh token, ensure the refresh endpoint is protected against CSRF.
- **Axios/fetch interceptor:** Add a request interceptor that attaches the Bearer header, and a response interceptor that catches 401s, attempts a token refresh, and retries the original request. This should be transparent to the rest of the app.
- **Login flow change:** After successful login, store the returned tokens instead of (or in addition to) relying on the session cookie. The login API call itself may need a flag to request JWT tokens (per Task 3).
- **Logout flow change:** On logout, call the logout endpoint with the refresh token, then clear stored tokens.

### Requirements

- Update the HTTP client (Axios, fetch wrapper, or similar) to attach `Authorization: Bearer <accessToken>` on all API requests
- Implement a token refresh interceptor: on 401 response, attempt refresh, retry original request, and if refresh fails, redirect to login
- Update the login flow to request and store JWT tokens from the login endpoint
- Update the logout flow to send the refresh token for revocation and clear local token storage
- Ensure existing sessions continue working during migration — users with valid sessions but no tokens should not be logged out (the API's dual-auth middleware handles this, but the frontend should not break if no token is present and a session cookie is)
- Handle the token refresh race condition: if multiple requests fail simultaneously with 401, only one refresh request should be in flight; the others should queue and retry after the refresh completes

### Acceptance Criteria

- [ ] New logins receive and store JWT tokens
- [ ] API requests include the Bearer token header when a token is available
- [ ] Expired access tokens trigger an automatic refresh and request retry
- [ ] Failed refresh (expired/revoked refresh token) redirects to login
- [ ] Logout clears tokens and revokes the refresh token on the server
- [ ] Users with existing sessions (no tokens) can continue using the app without re-login
- [ ] Concurrent 401s result in a single refresh request, not multiple

### Dependencies

- **Blocked by:** 2, 3
- **Blocks:** 6

### References

- Existing HTTP client setup (Axios instance, fetch wrapper — search for `axios.create`, base URL config, or request interceptors)
- Existing login/logout components or hooks
- Existing auth state management (React context, Redux, Zustand, or similar)
- Token response format from Task 3: `{ accessToken, refreshToken, expiresIn }`

---

## Task 5: React Native Mobile App Auth Migration

**Objective:** Update the React Native mobile app to authenticate via JWT instead of session cookies, using secure native storage for tokens.

### Context

Mobile apps and session cookies have always been an awkward fit. The React Native app likely uses a cookie jar or a custom header approach to maintain sessions. JWT is actually a more natural fit for mobile because mobile apps already manage auth state explicitly.

The core flow is similar to the React frontend (Task 4), but mobile has different storage and lifecycle concerns:

- **Secure storage:** Mobile apps should store tokens in the platform's secure storage — iOS Keychain via `react-native-keychain` or `expo-secure-store`, Android Keystore. This is significantly more secure than `AsyncStorage` (which is unencrypted).
- **App lifecycle:** Unlike a browser tab, a mobile app can be killed and restarted. Tokens must survive app restarts (hence secure persistent storage), and the app must check for a valid token on launch and refresh if needed.
- **Background/foreground transitions:** When the app comes to the foreground after being backgrounded, the access token may have expired. The app should proactively check and refresh on foreground events.
- **Offline handling:** Mobile apps often deal with spotty connectivity. If a token refresh fails due to network issues (not a 401 from the server), the app should retry rather than immediately forcing re-login.

Key design decisions:
- **Token storage:** Use `react-native-keychain` or `expo-secure-store` — NOT `AsyncStorage`. This is a security requirement, not a preference.
- **HTTP client interceptor:** Same pattern as the React frontend — intercept requests to add Bearer header, intercept 401s to refresh. If the app uses a different HTTP client than the web app, the interceptor logic will need to be adapted but the pattern is the same.
- **Biometric re-auth (optional/future):** Storing the refresh token in secure storage with biometric protection is a future enhancement. For now, just use secure storage.

### Requirements

- Store JWT tokens (access + refresh) in platform secure storage (`react-native-keychain`, `expo-secure-store`, or equivalent)
- Update the HTTP client to attach `Authorization: Bearer <accessToken>` on all API requests
- Implement token refresh interceptor (same pattern as Task 4, adapted for the mobile HTTP client)
- On app launch, load tokens from secure storage, verify the access token, and refresh if expired
- On foreground transition (AppState change from background to active), check token expiry and refresh proactively
- Update login flow to request and store JWT tokens
- Update logout flow to revoke the refresh token, clear secure storage
- Handle network failures during token refresh gracefully — retry with backoff rather than forcing re-login

### Acceptance Criteria

- [ ] Tokens are stored in platform secure storage, not AsyncStorage or equivalent unencrypted store
- [ ] API requests include the Bearer token header
- [ ] Token refresh works transparently on 401 responses
- [ ] App restarts restore auth state from secure storage without requiring re-login (if tokens are still valid)
- [ ] Foregrounding the app after a long background period triggers a proactive token refresh if the access token is expired
- [ ] Network failures during refresh are retried, not treated as auth failures
- [ ] Logout clears tokens from secure storage and revokes the refresh token

### Dependencies

- **Blocked by:** 2, 3
- **Blocks:** 6

### References

- Existing mobile auth flow (search for login screens, auth state management, cookie/session handling)
- Existing HTTP client setup in the React Native app
- `react-native-keychain` or `expo-secure-store` documentation
- React Native `AppState` API for foreground detection
- Token response format from Task 3: `{ accessToken, refreshToken, expiresIn }`

---

## Task 6: Session Deprecation and Cleanup Tooling

**Objective:** Build the observability and tooling needed to track migration progress and eventually remove session-based auth entirely.

### Context

Tasks 1-5 set up JWT auth and ensure backward compatibility. This task is about the end game — knowing when it's safe to turn off sessions and actually doing it cleanly.

The dual-auth middleware from Task 2 tags requests with `req.authMethod`. This task uses that data to build visibility into the migration and creates the tooling for the final cutover.

This task can begin development once the dual-auth middleware is in place (Task 2), but it becomes actionable only after the clients (Tasks 4, 5) have been updated and deployed. It's listed last because it's the tail end of the migration, but parts of it (monitoring, metrics) should be set up early to track progress from the start.

Key design decisions:
- **Metrics-driven cutover:** Don't remove sessions based on a calendar date. Remove them when metrics show zero (or near-zero) session-based requests over a sustained period. This protects against forgotten clients or slow mobile app update adoption.
- **Feature flag for session enforcement:** Add a feature flag or environment variable that, when enabled, rejects session-based auth (returns 401 with a message to update the client). Enable this in staging first, then production. This is safer than removing session code — you can flip back if something breaks.
- **Redis cleanup:** Once sessions are fully deprecated, the Redis session store can be decommissioned. Don't remove it while the feature flag is in "warn" mode — only after "enforce" has been stable.

### Requirements

- Add logging/metrics to the dual-auth middleware that track auth method usage (count of JWT vs. session requests over time, broken down by endpoint and client type if possible)
- Create a dashboard or reporting endpoint (`GET /admin/auth-migration-stats`) that shows: percentage of requests by auth method, list of endpoints still receiving session-based requests, trend over time
- Implement a feature flag (`ENFORCE_JWT_AUTH`) that when enabled: rejects session-based auth with a 401 and a response body indicating the client should update, or optionally a "warn" mode that allows sessions but logs a deprecation warning
- Write a cleanup checklist or script that removes session-related code: `express-session` middleware, `connect-redis` setup, session-related environment variables — to be executed after the feature flag has been in "enforce" mode with zero session requests for an agreed period
- Add tests for: metrics tracking, feature flag enforcement (reject sessions when flag is on), feature flag warn mode

### Acceptance Criteria

- [ ] Auth method usage metrics are collected and queryable (via logs, metrics endpoint, or monitoring system)
- [ ] A reporting mechanism shows the current session vs. JWT split
- [ ] `ENFORCE_JWT_AUTH` feature flag in "enforce" mode rejects session-based requests with an informative 401
- [ ] `ENFORCE_JWT_AUTH` feature flag in "warn" mode allows sessions but emits deprecation warnings
- [ ] A cleanup checklist documents what to remove and in what order once sessions are fully deprecated
- [ ] Feature flag behavior is tested

### Dependencies

- **Blocked by:** 2, 3, 4, 5
- **Blocks:** None

### References

- Dual-auth middleware from Task 2 (specifically `req.authMethod`)
- Existing logging/metrics infrastructure (search for logging middleware, metrics libraries like `prom-client`, or APM setup)
- Existing feature flag system (if any) — otherwise, an environment variable check is fine
- Redis session store configuration (to be eventually removed)
