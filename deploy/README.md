# Authenticated production administration

The public site remains static. The server runs the existing post/config/image
stores and scrypt authentication through an independent loopback Node service.
Build output is staged inside `/opt/shirone/app/.shirones` before copying to the
public release directory. This avoids cross-mount renames under systemd isolation.
Saving in `/admin/` queues an Astro + Pagefind build and atomically switches the
public release on success. A failed build keeps the previous live release;
source changes remain saved and the editor reports publication failure.

## Server layout

- HTTPS administration: `https://62.234.3.154/admin/`
- HTTP port 80 stays available; admin/API routes redirect to HTTPS port 443.
- Source and dependencies: `/opt/shirone/app` (dedicated `shirone` account)
- Private salt/hash credential: `/opt/shirone/private/auth`, mode 600
- Runtime: `/opt/shirone/runtime/node` and `/opt/shirone/runtime/pnpm`
- Service environment: `/etc/shirone/admin.env`, root-only
- Service: `shirone-admin.service`, listening only on `127.0.0.1:4324`
- Nginx: `/etc/nginx/sites-available/shirone`
- Releases: `/var/www/shirone/releases/<release-id>`
- Active release: `/var/www/shirone/current`
- Configuration backups: `/var/backups/shirone/<deployment-id>`

The existing IP certificate is self-signed. Trust it in the owner's browser or
replace it with a trusted certificate; do not enter the password over HTTP.
The local password remains valid when its existing salt/hash file is provisioned
through SSH. Neither plaintext passwords nor SSH keys belong in the project or
public document root. Remote password setup is disabled.

## Build and start

Install dependencies with the pinned pnpm version, then bundle the existing API:

```sh
pnpm install --frozen-lockfile
node scripts/admin/build.mjs
```

Configure these variables in `/etc/shirone/admin.env`:

```ini
SHIRONE_ADMIN_PROJECT=/opt/shirone/app
SHIRONE_ADMIN_AUTH_FILE=/opt/shirone/private/auth
SHIRONE_ADMIN_PUBLIC_ROOT=/var/www/shirone
SHIRONE_ADMIN_PNPM=/opt/shirone/runtime/pnpm/node_modules/.bin/pnpm
SHIRONE_ADMIN_ORIGIN=https://62.234.3.154
SHIRONE_ADMIN_PORT=4324
```

Provision credentials with owner `shirone` and mode 600, install the service
unit, and start it with `systemctl enable --now shirone-admin`. Only builds with
`SHIRONE_REMOTE_ADMIN=1` enable the remote editor. Ordinary static builds remain
read-only. This runner supports the source checkout; local npm-package authoring
continues to use its existing resolved directories and loopback Vite plugin.

For an initial release, run `scripts/admin/build-site.mjs <release-directory>`
with `SHIRONE_REMOTE_ADMIN=1` and the pnpm path above; validate the output before
switching `current`. Check Nginx with `sudo nginx -t` before reloading.
The service limits CPU and memory; image processing uses two workers and one
libvips thread. Keep `node_modules/.astro/assets` between deployments to reuse
immutable image transforms. Builds time out after eight minutes; API/proxy/editor
wait up to nine minutes. Use `journalctl -u shirone-admin` for build errors. Run `node --experimental-strip-types
--test tests/admin/*.test.ts tests/admin/publish.test.mjs` for API and publication
checks. Publication symlink tests run on Linux.

Server edits are authoritative source files and do not automatically commit or
push to GitHub. Back up/synchronize them before replacing server source on a
future deployment. The API preserves allowlists, type validation, version checks,
path and symlink checks, sessions, write tokens and origin checks.

## Existing applications and rollback

Thunder HTTPS on 8443, Boxhead on 8081 and knowledge-base-rag on 8082 keep their
existing services. TCP 443 must be allowed by the cloud security group.
Roll back a blog publication by pointing `current` at a previous release.
Restore the backed-up Nginx file, test configuration, then reload if routing
changes need rollback. Never remove the previous live release during deployment.
