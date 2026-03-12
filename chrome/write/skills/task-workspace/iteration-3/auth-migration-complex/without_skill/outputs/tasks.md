# Auth Migration: Session-Based to JWT

## Overview

Migrate authentication from session-based (Redis-backed) to JWT across the Express.js API, React frontend, and React Native mobile app. Backward compatibility must be maintained throughout the migration to support a gradual rollout.

---

## Phase 1: Foundation — JWT Infrastructure on the API

### Task 1.1: Design JWT token schema and signing strategy
- Define access token and refresh token payload structure (claims: `sub`, `iat`, `exp`, `iss`, roles/permissions)
- Choose signing algorithm (RS256 recommended for multi-service verification)
- Decide on token lifetimes (e.g., access: 15 min, refresh: 7 days)
- Document the token rotation and refresh strategy
- **Output:** ADR or design doc covering token schema, signing keys, lifetimes, and refresh flow

### Task 1.2: Implement JWT utility module
- Create a shared module for signing, verifying, and decoding tokens
- Support key rotation (e.g., `kid` header, JWKS endpoint or config-based)
- Include helpers for extracting claims from tokens
- Write unit tests for signing, verification, expiry, and malformed token handling
- **Output:** `lib/jwt.js` (or similar) with full test coverage

### Task 1.3: Implement refresh token storage
- Design a refresh token store (can reuse Redis or use a DB table)
- Support token family tracking for refresh token rotation and reuse detection
- Implement revocation (single token, all tokens for a user, all tokens globally)
- Write unit tests
- **Output:** Refresh token persistence layer with revocation support

### Task 1.4: Create JWT authentication middleware (dual-mode)
- Build new Express middleware that accepts **both** session cookies and JWT Bearer tokens
- Check for `Authorization: Bearer <token>` header first; fall back to existing session check
- Populate `req.user` identically regardless of auth method so downstream handlers are unaffected
- Add feature flag (`AUTH_MODE`: `session`, `dual`, `jwt`) to control which mechanisms are active
- Write integration tests covering all three modes
- **Output:** Dual-mode auth middleware behind a feature flag

---

## Phase 2: API Auth Endpoints

### Task 2.1: Add JWT login endpoint
- Create `POST /auth/token` (or extend existing `/auth/login`) that returns `{ accessToken, refreshToken }` in the response body
- Existing session login endpoint must continue to work unchanged
- When in `dual` mode, the login endpoint should issue **both** a session cookie and JWT tokens
- Write integration tests
- **Output:** Login endpoint that issues JWTs

### Task 2.2: Add token refresh endpoint
- Create `POST /auth/token/refresh` accepting a refresh token and returning a new access/refresh token pair
- Implement refresh token rotation (old refresh token is invalidated on use)
- Detect reuse of already-rotated tokens and revoke the entire token family (security measure)
- Write integration tests
- **Output:** Refresh endpoint with rotation and reuse detection

### Task 2.3: Add JWT logout / token revocation endpoint
- Create `POST /auth/token/revoke` to revoke refresh tokens
- In `dual` mode, also destroy the session if one exists
- Write integration tests
- **Output:** Revocation endpoint

### Task 2.4: Update all protected API routes to use the dual-mode middleware
- Replace the existing session-only middleware with the dual-mode middleware from Task 1.4 on all protected routes
- Verify no route-specific session assumptions break (e.g., `req.session.someFlag`)
- Audit for any direct Redis session reads outside of middleware and abstract them
- Write regression tests
- **Output:** All protected routes accept both session and JWT auth

---

## Phase 3: React Frontend Migration

### Task 3.1: Create a JWT auth service in the frontend
- Implement a service/module that handles token storage (memory for access token; `httpOnly` cookie or secure storage for refresh token), token refresh logic, and logout
- Access tokens should ideally be held in memory (not `localStorage`) to mitigate XSS risk
- Implement silent refresh (proactive refresh before expiry, or on 401 response)
- Write unit tests
- **Output:** Frontend JWT auth service

### Task 3.2: Create an Axios/fetch interceptor for JWT
- Add a request interceptor that attaches the `Authorization: Bearer` header
- Add a response interceptor that catches 401s, attempts a token refresh, and retries the original request
- Queue concurrent requests during a refresh to avoid multiple refresh calls
- Write unit tests
- **Output:** HTTP client interceptor with automatic refresh

### Task 3.3: Update the frontend login flow
- Modify the login page/component to call the JWT login endpoint (or consume JWT tokens from the dual-mode endpoint)
- Store tokens via the auth service from Task 3.1
- Ensure the auth context/provider reflects the new token-based state
- Write integration/E2E tests for login
- **Output:** Frontend login flow issuing and storing JWTs

### Task 3.4: Update the frontend logout flow
- Call the revocation endpoint on logout
- Clear tokens from memory/storage
- Redirect to login
- Write tests
- **Output:** Frontend logout using JWT revocation

### Task 3.5: Add feature flag to toggle frontend auth mode
- Support a runtime or build-time flag to switch between session mode and JWT mode
- In session mode, the frontend behaves exactly as before (cookie-based, no Bearer header)
- In JWT mode, the frontend uses the new auth service and interceptor
- This allows gradual rollout (e.g., percentage-based, per-user, or environment-based)
- **Output:** Feature flag controlling frontend auth mechanism

---

## Phase 4: React Native Mobile App Migration

### Task 4.1: Create a JWT auth service for React Native
- Implement token storage using secure storage (e.g., `react-native-keychain` or `expo-secure-store`)
- Implement token refresh logic (similar to frontend but adapted for mobile lifecycle: backgrounding, cold starts)
- Handle token restoration on app launch
- Write unit tests
- **Output:** Mobile JWT auth service with secure storage

### Task 4.2: Create an HTTP interceptor for the mobile app
- Attach `Authorization: Bearer` header to all API requests
- Handle 401 refresh + retry (same pattern as frontend, adapted for the mobile HTTP client)
- Handle edge cases: app waking from background with expired tokens, no network during refresh
- Write unit tests
- **Output:** Mobile HTTP interceptor

### Task 4.3: Update mobile login and logout flows
- Modify login screen to consume JWT tokens from the API
- Store tokens via the mobile auth service
- Update logout to call revocation endpoint and clear secure storage
- Write tests
- **Output:** Mobile login/logout using JWTs

### Task 4.4: Add feature flag for mobile auth mode
- Support a remote config flag (e.g., via LaunchDarkly, Firebase Remote Config, or a custom endpoint) to toggle between session and JWT auth
- Allow server-driven rollout without requiring an app update
- **Output:** Mobile feature flag for auth mode

---

## Phase 5: Validation and Gradual Rollout

### Task 5.1: Add observability and monitoring
- Log auth method used per request on the API (`session` vs `jwt`) for traffic analysis
- Add metrics/dashboards: JWT auth success rate, refresh token usage, revocation events, error rates by auth method
- Set up alerts for anomalies (spike in 401s, refresh failures)
- **Output:** Monitoring dashboards and alerts

### Task 5.2: Write end-to-end migration tests
- E2E test: user logged in via session can continue using the app without re-authenticating when API switches to `dual` mode
- E2E test: new login in `dual` mode produces valid JWTs that work for all API calls
- E2E test: user logged in via JWT can use all protected endpoints
- E2E test: refresh token rotation works correctly end-to-end
- E2E test: logout revokes tokens and invalidates access
- **Output:** E2E test suite covering the migration transition

### Task 5.3: Gradual rollout plan and execution
- Roll out `dual` mode on the API (all sessions still work, JWTs also accepted)
- Enable JWT mode on the frontend for a small percentage of users via feature flag
- Enable JWT mode on mobile via remote config for a small percentage
- Monitor error rates and user reports; increase rollout percentage incrementally
- **Output:** Rollout runbook with rollback procedures

---

## Phase 6: Cleanup and Deprecation

### Task 6.1: Remove session-based auth from the API
- Once 100% of traffic is on JWT, remove the session middleware and session login/logout endpoints
- Remove the Redis session store dependency (or repurpose it for refresh tokens if used)
- Remove the feature flag and dual-mode logic; JWT-only middleware remains
- Update API documentation
- **Output:** Session auth removed; JWT is the sole auth mechanism

### Task 6.2: Remove session-related code from frontend and mobile
- Remove session-mode branches behind feature flags
- Remove any cookie-based auth handling
- Clean up feature flag configuration
- **Output:** Clean frontend and mobile codebases with JWT-only auth

### Task 6.3: Update documentation and runbooks
- Update API docs, developer onboarding guides, and operational runbooks to reflect JWT auth
- Document token refresh behavior, revocation, and key rotation procedures
- **Output:** Updated documentation

---

## Dependency Graph

```
Phase 1 (1.1 → 1.2 → 1.3 → 1.4)
    ↓
Phase 2 (2.1, 2.2, 2.3 can parallel after 1.4 → 2.4 after all)
    ↓
Phase 3 + Phase 4 (can run in parallel, both depend on Phase 2)
    ↓
Phase 5 (depends on Phase 3 + Phase 4)
    ↓
Phase 6 (after full rollout)
```

## Key Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Token theft via XSS | Store access tokens in memory, not localStorage. Use httpOnly cookies for refresh tokens where possible. |
| Refresh token reuse attack | Implement token family tracking with automatic revocation on reuse detection (Task 2.2). |
| Service disruption during migration | Dual-mode middleware + feature flags ensure backward compatibility at every step. |
| Mobile app users on old versions | Keep `dual` mode on the API for a deprecation period; use remote config to push JWT mode to updated apps. |
| Key compromise | Support key rotation via `kid` headers and JWKS (Task 1.2). Have a runbook for emergency key rotation. |
