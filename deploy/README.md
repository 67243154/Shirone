# Server deployment

The public blog is served by Nginx at `http://62.234.3.154/` on port 80.
Build on the authoring machine using `pnpm.cmd build`, then upload only `dist/`.
Do not upload local admin password files, SSH keys, source credentials or `node_modules`.

## Layout

- Site configuration: `/etc/nginx/sites-available/shirone`
- Enabled configuration: `/etc/nginx/sites-enabled/shirone`
- Static releases: `/var/www/shirone/releases/<release-id>`
- Active release symlink: `/var/www/shirone/current`
- Deployment backups: `/var/backups/shirone/<deployment-id>`

`nginx-shirone.conf` is the production configuration template. Check it with
`sudo nginx -t` before `sudo systemctl reload nginx`.
For subsequent releases, upload to a new release directory and update the
`current` symlink after verifying the build. Keep the previous release for rollback.

## Existing applications

The existing `knowledge-base-rag` Nginx site moves from port 80 to port 8082.
Its document root, API proxy and `/boxhead/` proxy stay in its original configuration.
The existing Boxhead listener on 8081 and Thunder HTTPS listener on 8443 remain in place.
Access to port 8082 from the internet depends on the cloud security group rules.

The production blog is static. `/admin/` does not provide server-side content editing;
edit through the local authenticated admin, commit, build and deploy.

## Rollback

Each initial port migration backs up the original `knowledge-base-rag` configuration.
To restore the original port-80 site, restore that backup, remove only the enabled
`shirone` symlink, run `sudo nginx -t`, then reload Nginx.
To roll back only a blog update, point `current` to the previous release.
