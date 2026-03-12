# Session-to-JWT Auth Migration Tasks
> From: **prompt** | Codename: **drifting-lantern**

**Goal:** Migrate authentication from session-based (Redis-backed) to JWT across the Express.js API, React frontend, and React Native mobile app while maintaining backward compatibility for a gradual rollout.

## Task Overview

| # | Task | Depends on | Parallel |
|---|------|-----------|----------|
| 1 | JWT token infrastructure in the API | — | Yes |
| 2 | Dual-auth middleware (backward-compatible session + JWT) | 1 | No |
| 3 | Auth API endpoints for JWT lifecycle | 2 | No |
| 4 | React frontend JWT integration | 3 | Yes |
| 5 | React Native mobile app JWT integration | 3 | Yes |
| 6 | Session deprecation and cleanup tooling | 4, 5 | No |

---

## Task 1: JWT Token Infrastructure in the API

### Description

The system currently authenticates all requests using server-side sessions stored in Redis. We are migrating to JWT to reduce infrastructure dependency on Redis for auth, enable stateless authentication across services, and simplify mobile auth flows.

This task lays the foundation by building the JWT token generation, validation, and refresh infrastructure in the Express.js API. This is the lowest layer of the migration — nothing else can proceed until the API can issue and verify JWTs.

The token system needs to support both access tokens (short-lived) and refresh tokens (long-lived). Refresh tokens must be stored server-side (in the existing database, not Redis) so they can be revoked. This is critical for security parity with sessions, which are inherently revocable.

**Technical decisions:**
- Use asymmetric signing (RS256) rather than symmetric (HS256) so that other services can verify tokens using only the public key without needing access to the signing secret. This supports future service-to-service auth without sharing secrets.
- Access tokens should be short-lived (15 minutes) to limit the blast radius of a leaked token. Refresh tokens should be longer-lived (7 days) and rotated on each use.
- Refresh tokens are persisted in the database (not Redis) with a reference to the user and device/client, enabling per-device revocation. This replaces the session-revocation capability that Redis sessions currently provide.
- Token payload should include user ID, roles, and a session-migration flag that downstream middleware can use to distinguish JWT-authenticated requests from session-authenticated ones during the migration period.

### Acceptance Criteria

**Scenario:** Access token generation
- **Given** a valid user identity and role set
- **When** the token infrastructure generates an access token
- **Then** the token is signed with RS256 and contains user ID, roles, and an expiry of 15 minutes

**Scenario:** Refresh token generation and persistence
- **Given** a valid user identity and a client identifier
- **When** the token infrastructure generates a refresh token
- **Then** the refresh token is persisted in the database tied to the user and client, with a 7-day expiry

**Scenario:** Token verification
- **Given** a valid, non-expired access token
- **When** it is passed to the verification function
- **Then** the decoded payload is returned with user ID and roles

**Scenario:** Expired token rejection
- **Given** an access token that has passed its expiry time
- **When** it is passed to the verification function
- **Then** verification fails with a clear "token expired" error distinguishable from other auth failures

**Scenario:** Refresh token rotation
- **Given** a valid refresh token is used
- **When** a new access/refresh token pair is issued
- **Then** the old refresh token is invalidated and a new one is persisted

### Out of Scope

- Modifying any existing session-based auth flow — this task only adds new infrastructure alongside it
- API endpoint creation (that's Task 3)
- Any frontend or mobile changes
- Redis session store modifications

### References

- Express.js API authentication layer (existing session middleware)
- Database models for users and roles
- Redis session store configuration (for understanding current auth flow, not for modification)

---

## Task 2: Dual-Auth Middleware (Backward-Compatible Session + JWT)

### Description

The most critical requirement of this migration is that it happens gradually. We cannot flip a switch and move all clients to JWT at once — the frontend and mobile app will migrate on different timelines, and there may be older app versions in the wild that still use sessions.

This task builds a dual-auth middleware for the Express.js API that accepts both session cookies and JWT Bearer tokens. During the migration period, every protected route will run through this middleware. It checks for a JWT first; if none is found or it's invalid, it falls back to the existing session-based auth. The request proceeds as authenticated if either mechanism succeeds.

This middleware replaces the current session-only auth middleware on all protected routes. It must produce a normalized auth context (user ID, roles, auth method) regardless of which mechanism authenticated the request. Downstream route handlers should not need to know or care which auth method was used.

**Technical decisions:**
- JWT takes precedence over sessions when both are present. This ensures that once a client migrates to JWT, its behavior is deterministic even if stale session cookies are still being sent.
- The middleware attaches an `authMethod` property (`"jwt"` or `"session"`) to the request context. This enables logging and metrics to track migration progress without affecting business logic.
- The middleware is a drop-in replacement for the existing session auth middleware. It delegates to the existing session middleware internally when falling back, so session handling logic doesn't need to be duplicated or rewritten.
- All existing session-based tests must continue to pass without modification after this middleware is deployed — this is the primary validation of backward compatibility.

### Acceptance Criteria

**Scenario:** JWT-authenticated request
- **Given** a request with a valid JWT in the Authorization Bearer header
- **When** the request hits a protected route
- **Then** the request is authenticated, `authMethod` is set to `"jwt"`, and the normalized user context is available to downstream handlers

**Scenario:** Session-authenticated request (backward compatibility)
- **Given** a request with a valid session cookie and no JWT
- **When** the request hits a protected route
- **Then** the request is authenticated via the existing session mechanism, `authMethod` is set to `"session"`, and the normalized user context is available

**Scenario:** Both JWT and session present
- **Given** a request with both a valid JWT and a valid session cookie
- **When** the request hits a protected route
- **Then** the JWT is used for authentication and the session is ignored

**Scenario:** Neither JWT nor session present
- **Given** a request with no JWT and no session cookie
- **When** the request hits a protected route
- **Then** the request is rejected with a 401 Unauthorized response

**Scenario:** Invalid JWT with valid session fallback
- **Given** a request with an expired or malformed JWT and a valid session cookie
- **When** the request hits a protected route
- **Then** the session is used as fallback and the request proceeds as authenticated

**Scenario:** Existing session-based tests unchanged
- **Given** the full existing test suite for authenticated routes
- **When** run against the API with the dual-auth middleware in place
- **Then** all tests pass without modification

### Out of Scope

- Creating new API endpoints for JWT login/refresh (Task 3)
- Migrating any specific routes to JWT-only auth
- Removing or modifying Redis session storage
- Frontend or mobile app changes

### References

- Existing session auth middleware in the Express.js API
- JWT token infrastructure built in Task 1
- Redis session store configuration
- Existing authenticated route test suite

---

## Task 3: Auth API Endpoints for JWT Lifecycle

### Description

With the token infrastructure (Task 1) and dual-auth middleware (Task 2) in place, clients need endpoints to actually obtain, refresh, and revoke JWTs. This task builds the API surface that the frontend and mobile app will use to migrate to JWT auth.

Three endpoints are needed: one to exchange credentials (or a valid session) for a JWT pair, one to refresh an access token using a refresh token, and one to revoke refresh tokens (logout). The credential-exchange endpoint is particularly important for the migration: it should accept an existing valid session as proof of identity, allowing already-logged-in users on the frontend to silently upgrade to JWT without re-entering credentials.

**Technical decisions:**
- The login endpoint accepts both username/password credentials and a valid session cookie for token issuance. Session-based token issuance enables a "silent upgrade" path where the frontend can call this endpoint in the background for users who are already logged in, getting a JWT without any user-facing flow.
- The refresh endpoint must be callable without a valid access token (since the access token is expired when you need to refresh). It authenticates via the refresh token itself.
- The revoke endpoint invalidates all refresh tokens for a given user-client combination. This is the JWT equivalent of "logout" — it doesn't invalidate existing access tokens (they'll expire naturally within 15 minutes), but it prevents new ones from being issued.
- Rate limiting should be applied to the login and refresh endpoints to mitigate brute-force and token-stuffing attacks.

### Acceptance Criteria

**Scenario:** Login with credentials
- **Given** a valid username and password
- **When** the login endpoint is called
- **Then** an access token and refresh token pair is returned, and the refresh token is persisted

**Scenario:** Silent upgrade from session
- **Given** a request to the login endpoint with a valid session cookie and no credentials
- **When** the endpoint processes the request
- **Then** a JWT pair is issued for the session's user without requiring credentials

**Scenario:** Token refresh
- **Given** a valid, non-expired refresh token
- **When** the refresh endpoint is called
- **Then** a new access/refresh token pair is returned and the old refresh token is invalidated

**Scenario:** Refresh with expired refresh token
- **Given** an expired or revoked refresh token
- **When** the refresh endpoint is called
- **Then** the request is rejected with a 401 and the client must re-authenticate

**Scenario:** Logout / token revocation
- **Given** an authenticated user
- **When** the revoke endpoint is called with a client identifier
- **Then** all refresh tokens for that user-client pair are invalidated

**Scenario:** Rate limiting on login
- **Given** more than the allowed number of login attempts from a single source in a time window
- **When** the next login attempt is made
- **Then** the request is rejected with a 429 Too Many Requests response

### Out of Scope

- Modifying existing session-based login/logout endpoints — they continue to work as-is for clients that haven't migrated
- OAuth or third-party provider flows (those can be JWT-ified in a follow-up)
- Admin endpoints for managing other users' tokens
- Frontend or mobile app integration (Tasks 4 and 5)

### References

- JWT token infrastructure (Task 1)
- Dual-auth middleware (Task 2)
- Existing login and session-creation endpoints in the Express.js API
- Rate limiting configuration or middleware already in use in the API

---

## Task 4: React Frontend JWT Integration

### Description

The React frontend currently authenticates by sending session cookies with every request. This task migrates it to use JWTs instead, using the API endpoints built in Task 3.

The migration needs to be invisible to users. Logged-in users should be silently upgraded to JWT by exchanging their existing session for a token pair (via the silent upgrade endpoint from Task 3). New logins should go through the JWT login endpoint directly. The frontend should store tokens securely, automatically refresh access tokens before they expire, and handle token-related errors (expiry, revocation) gracefully.

This is one of two client-side migration tasks (alongside the React Native task). They are independent and can be worked on in parallel.

**Technical decisions:**
- Access tokens are stored in memory only (a module-scoped variable or React context), not in localStorage or sessionStorage. This limits XSS exposure. Refresh tokens are stored in an httpOnly secure cookie set by the API (not managed by frontend JavaScript). This means the refresh endpoint should use cookie-based refresh tokens rather than requiring the frontend to store and send them in a request body.
- The frontend implements proactive token refresh — it refreshes the access token before it expires (e.g., when 80% of the TTL has elapsed) rather than waiting for a 401. This avoids user-visible auth interruptions.
- On initial page load, if no in-memory access token exists but a refresh cookie is present, the app calls the refresh endpoint to bootstrap an access token. If that fails and a session cookie exists, it falls back to the silent upgrade endpoint. This three-tier bootstrap ensures continuity for users in any state during the migration.
- The HTTP client (likely Axios or fetch wrapper) is updated to attach the JWT Bearer header to all API requests when a token is available, and to intercept 401 responses as a fallback refresh trigger.

### Acceptance Criteria

**Scenario:** Silent upgrade for existing session users
- **Given** a user with an active session but no JWT
- **When** the frontend loads
- **Then** the app silently exchanges the session for a JWT pair and proceeds with JWT-authenticated requests

**Scenario:** New login via JWT
- **Given** a user who is not logged in
- **When** they submit credentials on the login page
- **Then** the login calls the JWT login endpoint and stores the resulting access token in memory

**Scenario:** Proactive token refresh
- **Given** the access token is approaching expiry (80% of TTL elapsed)
- **When** the refresh timer fires
- **Then** a new access token is obtained via the refresh endpoint without user interaction

**Scenario:** Token refresh on 401
- **Given** an API request returns 401 due to an expired access token
- **When** the HTTP client intercepts the response
- **Then** it attempts a token refresh and retries the original request exactly once

**Scenario:** Full auth loss
- **Given** both the access token and refresh token are invalid or expired
- **When** any authenticated API request is attempted
- **Then** the user is redirected to the login page

**Scenario:** Page refresh persistence
- **Given** a user refreshes the browser page
- **When** the app re-initializes
- **Then** it bootstraps an access token from the refresh cookie without requiring re-login

### Out of Scope

- Modifying API endpoints (those are in Task 3)
- React Native mobile app changes (Task 5)
- Removing session cookie handling from the frontend — that stays until Task 6
- OAuth or social login flows

### References

- Existing HTTP client configuration in the React frontend (Axios instance or fetch wrapper)
- Existing auth context/store in the React app (where session state is currently managed)
- JWT API endpoints from Task 3 (login, refresh, revoke)
- Login page and auth-gated routing logic

---

## Task 5: React Native Mobile App JWT Integration

### Description

The React Native mobile app currently authenticates via sessions (likely stored as cookies in a cookie jar or via a session token header). This task migrates it to JWT, using the API endpoints from Task 3.

Mobile has different constraints than the web frontend. There's no httpOnly cookie mechanism, so the refresh token storage strategy differs. The app also needs to handle backgrounding, network loss, and app restarts more robustly than the web app.

This task is independent of the React frontend migration (Task 4) and can be done in parallel.

**Technical decisions:**
- Tokens are stored in the platform's secure storage (Keychain on iOS, Keystore on Android) via a library like `react-native-keychain` or `expo-secure-store`. Never in AsyncStorage, which is unencrypted.
- The access token is also held in memory for quick access during the app's lifecycle. On app launch, the token is loaded from secure storage and validated (checking expiry locally). If expired, a refresh is attempted before any authenticated API call proceeds.
- The refresh token is sent in the request body to the refresh endpoint (not as a cookie, unlike the web frontend). The API refresh endpoint should already support both cookie-based and body-based refresh tokens, but if it doesn't, coordinate with Task 3 to ensure it does.
- Background-to-foreground transitions trigger a token freshness check. If the access token expired while the app was backgrounded, a silent refresh happens before resuming API calls.

### Acceptance Criteria

**Scenario:** Silent upgrade for existing session users
- **Given** a mobile user with an active session but no JWT stored
- **When** the app opens or the migration code runs
- **Then** the app exchanges the session for a JWT pair and stores tokens in secure storage

**Scenario:** New login via JWT
- **Given** a user who is not logged in
- **When** they submit credentials in the app
- **Then** the app calls the JWT login endpoint and stores the tokens in secure storage

**Scenario:** App restart persistence
- **Given** the app is force-closed and restarted
- **When** the app initializes
- **Then** it loads tokens from secure storage, validates the access token, and refreshes if needed — without requiring re-login

**Scenario:** Background-to-foreground refresh
- **Given** the app was backgrounded long enough for the access token to expire
- **When** the app returns to the foreground
- **Then** it detects the expired token and refreshes before making any API calls

**Scenario:** Token refresh
- **Given** the access token is expired and a valid refresh token exists in secure storage
- **When** an authenticated API call is attempted
- **Then** the refresh happens transparently, the new tokens are stored, and the original call proceeds

**Scenario:** Full auth loss on mobile
- **Given** both the access token and refresh token are invalid or expired
- **When** any authenticated action is attempted
- **Then** the user is returned to the login screen and secure storage is cleared

### Out of Scope

- API endpoint changes (Task 3)
- React web frontend changes (Task 4)
- Push notification token management (separate from auth tokens)
- Biometric authentication integration (can be layered on after migration)
- Removing legacy session handling from the app — that stays until Task 6

### References

- Existing auth/session management in the React Native app
- Secure storage library currently in use (or to be adopted)
- API client configuration in the React Native app
- App lifecycle event handlers (foreground/background)
- JWT API endpoints from Task 3

---

## Task 6: Session Deprecation and Cleanup Tooling

### Description

Once the frontend (Task 4) and mobile app (Task 5) have migrated to JWT, sessions become vestigial. But "once migrated" is a process, not an event — there will be a period where some users are on JWT and others are still on sessions (old app versions, cached pages, etc.).

This task builds the monitoring, tooling, and eventual cleanup path for removing session-based auth. It does not actually remove sessions — that's a future decision gated by metrics from this task. The goal is to make the migration's progress visible and the eventual cutoff safe.

**Technical decisions:**
- Add metrics/logging that track the ratio of JWT-authenticated vs. session-authenticated requests over time (using the `authMethod` property from the dual-auth middleware in Task 2). This is the primary input for deciding when to cut over.
- Build an admin endpoint or dashboard query that reports active session counts, active refresh token counts, and the percentage of requests using each auth method over a configurable time window.
- Create a feature flag or configuration toggle for "session auth enabled." When toggled off, the dual-auth middleware rejects session-based auth and returns a response indicating that the client should upgrade. This allows gradual rollout: disable sessions for internal users first, then beta users, then everyone.
- Document the full cutoff checklist: what metrics thresholds to watch, what to communicate to users on old app versions, how to drain Redis session data, and how to remove the session middleware code.

### Acceptance Criteria

**Scenario:** Auth method tracking
- **Given** the dual-auth middleware is processing requests
- **When** requests are authenticated via JWT or session
- **Then** the auth method is logged and available for metric aggregation

**Scenario:** Migration progress reporting
- **Given** an admin or operator queries the migration status
- **When** the report is generated
- **Then** it shows the percentage of requests using JWT vs. sessions, the count of active sessions, and the count of active refresh tokens over a configurable time window

**Scenario:** Session auth feature flag — off
- **Given** the session auth feature flag is toggled off
- **When** a request arrives with only a session cookie (no JWT)
- **Then** the request is rejected with a response indicating the client needs to upgrade to JWT auth

**Scenario:** Session auth feature flag — on
- **Given** the session auth feature flag is toggled on (default state)
- **When** a request arrives with only a session cookie
- **Then** the request is authenticated normally via session (no change from current behavior)

**Scenario:** Gradual rollout of session disablement
- **Given** the feature flag supports targeting rules (e.g., by user group or percentage)
- **When** sessions are disabled for a targeted group
- **Then** only that group's session-only requests are rejected; all other users are unaffected

### Out of Scope

- Actually removing session middleware, Redis session store, or session-related code — that's a future task gated by the metrics this task provides
- Migrating OAuth or third-party auth flows
- User-facing communication about the migration (that's a product/ops concern)

### References

- Dual-auth middleware from Task 2 (specifically the `authMethod` property)
- Existing metrics/logging infrastructure in the API
- Feature flag system in use (or to be adopted)
- Redis session store configuration (for understanding what gets cleaned up eventually)
