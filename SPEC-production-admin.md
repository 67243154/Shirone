# Production administration

Status: implemented and deployed; browser trust for the existing self-signed certificate remains an owner action.

## Objective

Make the deployed `/admin/` usable by the blog owner. The current static build
disables editing and has no write API; changing a client flag alone cannot fix it.
Keep the public blog static, with an independently authenticated administration
service behind Nginx. The existing editor, Chinese field labels and image previews
remain the user interface.

Assumptions for review:

- Reuse the owner's existing local admin password by transferring only its
  existing salt/hash credential file through SSH. Never print or commit it.
- Editing saves authoritative source files on the server. Successful saves queue
  a production rebuild; publishing switches to the new static release only if
  the build succeeds. Failed builds keep the last successful public release.
- Use HTTPS for admin login and API requests. Add an HTTPS listener on the free
  port 443 using the server's existing IP certificate. Redirect HTTP admin routes
  to HTTPS. The existing certificate is self-signed and may require the owner to
  trust it in their browser. Public HTTP browsing on port 80 remains available.
- Existing Thunder on 8443 and knowledge-base-rag on 8082 retain their services.

## Commands

Existing checks:

```powershell
pnpm.cmd exec astro check
pnpm.cmd exec playwright test --config playwright.admin.config.ts tests/site/admin-auth.spec.ts tests/site/admin-settings.spec.ts
pnpm.cmd build
```

The implementation will provide an explicit production admin build/start command
and a systemd unit. Validate deployed Nginx configuration with `sudo nginx -t`.

## Project structure

- Reuse `src/integration/vite/admin-auth.ts`, the post store, document store and
  image resolver; keep the local Vite plugin's loopback restrictions intact.
- Add a standalone server entry with authentication, API routing and build queue.
- Update `src/pages/admin/index.astro` and `AdminWorkspace.svelte` to support an
  explicitly enabled production backend; ordinary static builds stay read-only.
- Add deployment templates under `deploy/` and focused server/security tests
  under `tests/admin/`, plus production editor coverage under `tests/site/`.
- Server source and private credentials live outside the public document root.

## Code style

Use existing TypeScript and Svelte runes conventions; all user-visible messages
use existing i18n keys or new keys in every locale. Preserve component layering.

```typescript
if (!auth.authenticated(session)) {
    throw new AdminAuthError("unauthorized", 401);
}
```

## Acceptance and testing

1. HTTP `/admin/` redirects to HTTPS; login works with the existing password.
2. Unauthenticated callers cannot read posts, drafts, config source or images.
3. Preserve scrypt password hashing, constant-time comparison, 6–20 character
   validation, rate limiting, expiry, HttpOnly/SameSite cookies; HTTPS cookies use
   Secure. Public password setup is disabled once credentials are provisioned.
4. Enforce exact trusted origin/host, same-origin writes, editing token, payload
   limits, explicit file allowlists, traversal/symlink rejection and version checks.
5. Test post and configuration editing, list input focus and image previews.
6. Test a real saved edit through rebuilding and public release activation; restore
   verification changes. Concurrent saves queue builds without concurrent writes.
7. Failed builds leave the live release intact and return a useful status.
8. The backend runs as a dedicated non-root service bound to loopback, with only
   required filesystem permissions. No source, secret or credential files are
   available through static Nginx routes.

## Boundaries

Always: retain current release and Nginx backups; use a private credential file;
run focused tests, production build and deployment health checks.

Requires owner/external action: browser trust for a self-signed certificate and
cloud security-group access to TCP 443 if it is not already permitted. Do not
bypass a browser certificate warning or enter credentials over HTTP.

Never: expose the Astro development server, remove local API guards, store a
plaintext password, provide unauthenticated remote setup, expose arbitrary paths,
run the administrator service as root, or overwrite existing application data.

## Verification

- Astro check: zero errors, warnings or hints.
- Production build, Pagefind and font budget check passed.
- Six focused browser tests passed: authentication, input focus and light/dark accessibility.
- All ten server-side tests passed on Linux, including failed publication rollback.
- A real authenticated API save built and activated a release; the verification draft was removed and a clean release published.
- Public HTTPS admin returned 200; unauthenticated post access returned 401; HTTP admin redirected with 308.
- Initial uncached image processing exceeded the build timeout. Limited CPU, Node memory and image concurrency, and reused immutable image caches. Subsequent complete builds took about 35 seconds.
- Production backend listens on loopback only; existing Thunder HTTPS remains available.
