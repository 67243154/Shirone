# Dynamic application implementation plan

Approved scope: SPEC-dynamic-app.md. Local changes only.

1. Add explicit dynamic Node/SSR mode, keeping static builds unchanged.
2. Add safe filesystem content access, revision caches and a runtime settings document store; preserve original sources and backups.
3. Route existing components through runtime content/config adapters, preserving server output and Markdown features.
4. Connect the authenticated admin to immediate writes and cache invalidation; separate deployment settings.
5. Add live search, runtime appearance parameters and Swup configuration synchronization.
6. Verify a real local production server: edits without build/restart, persistence, draft privacy, metadata, styling, Markdown/MDX, authentication, and static mode regression.

Configuration overrides remain JSON data. Arbitrary source code remains a deployment action. No server deployment or GitHub push in this task.
