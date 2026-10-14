# Server configuration, as deployed

The files in this directory are copies of what is running on the VPS, kept here
so a change to the server is reviewable in a diff rather than discovered later
by reading the box.

| File | Lives at |
|---|---|
| `nginx-ekjhalak.conf` | `/etc/nginx/sites-available/ekjhalak` |
| `ekjhalak.service` | `/etc/systemd/system/ekjhalak.service` |
| `ekjhalak-refresh.service` | `/etc/systemd/system/ekjhalak-refresh.service` |
| `ekjhalak-refresh.timer` | `/etc/systemd/system/ekjhalak-refresh.timer` |

They are not applied from here. Editing one and committing changes nothing on
the server until it is copied across and the unit reloaded — see
`docs/operations/vps-migration.md`.

## Two settings that look arbitrary and are not

**`proxy_read_timeout 90s`.** A cold regeneration measured 17 seconds on this
box and `AGGREGATE_BUDGET_MS` allows 45. Nginx's default 60 would cut the slow
tail of that, and the reader would get a 504 for a pass that was working.

**`X-Forwarded-For`.** `lib/rate-limit.ts` reads the first entry to identify a
client. Without this header every visitor arrives as 127.0.0.1, shares one
bucket, and the limiter stops limiting anything.

## What nginx deliberately does not send

The security headers. `next.config.ts` sets all five, HSTS included, and nginx
adding them too put every one of them on every response twice. The app owns
them; nginx proxies them.
