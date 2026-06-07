---
name: Bearer token auth for React Native / Expo
description: Use in-memory tokenStore + Authorization Bearer header instead of session cookies for Expo apps
---

Session cookies (express-session) don't work reliably in React Native / Expo Go because the fetch API doesn't persist cookies across requests by default.

**Why:** React Native's fetch doesn't use a cookie jar, so `req.session` is always empty on mobile clients.

**How to apply:**
1. Server: create `lib/tokenStore.ts` — a simple `Map<token, {userId, username, role}>`. Login returns `{ user, token }`.
2. Mobile: store token in AsyncStorage, call `setAuthTokenGetter(() => token)` from `@workspace/api-client-react` to attach `Authorization: Bearer <token>` to all API calls.
3. Server middleware: check `req.headers.authorization?.startsWith('Bearer ')` first, then fall back to session for web clients.
