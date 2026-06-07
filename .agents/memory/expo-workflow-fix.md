---
name: Expo workflow port detection fix
description: Expo Metro bundler doesn't respond to ensurePreviewReachable health checks — remove that field from artifact.toml
---

The Expo artifact.toml scaffold includes `ensurePreviewReachable = "/status"` in the service definition. Metro bundler does not serve HTTP at arbitrary paths, so the `restart_workflow` tool fails with "didn't open port" even though Metro IS running.

**Why:** The platform's workflow health check fetches `ensurePreviewReachable` to confirm the service is up. Metro only serves its own routes, not `/status`.

**How to apply:** Remove `ensurePreviewReachable` from the Expo service block in `artifact.toml`. Use `verifyAndReplaceArtifactToml` to edit it safely.

Correct Expo service block:
```toml
[[services]]
name = "expo"
paths = [ "/mobile/" ]
localPort = 25190
```
