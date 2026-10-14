# Documentation

| Folder | What lives here |
|---|---|
| [`planning/`](planning/) | What is being built and what is left |
| [`product/`](product/) | What gets charged for, and why |
| [`operations/`](operations/) | Running it in production |
| [`archive/`](archive/) | Point-in-time snapshots, kept for history |

## Start here

- **Setting the site up for real** — [`operations/production-setup.md`](operations/production-setup.md).
  The manual dashboard work: Resend domain verification, the `support@` mailbox,
  Netlify environment variables, DNS, and the scheduled refresh. Nothing in it
  can be committed, and none of it is done by CI.
- **Moving to a VPS** — [`operations/vps-migration.md`](operations/vps-migration.md).
  SSH, deploy key, PostgreSQL, a real subscriber table, systemd, Nginx, TLS and
  backups — and an honest account of which steps are code rather than config.
- **What to build next** — [`product/premium-features.md`](product/premium-features.md).
  Five features graded by what the codebase already has, in build order.
- **The commercial plan** — [`product/monetization.md`](product/monetization.md).
  Tiers, pricing, revenue mix, KPIs.
- **Engineering state** — [`planning/execution-plan.md`](planning/execution-plan.md)
  (the phased hardening plan and what each gate returned) and
  [`planning/remaining-work.md`](planning/remaining-work.md) (open work).

## Archive

[`archive/audit-2026-07-31.md`](archive/audit-2026-07-31.md) audited Next 16.2.1
on the `redesign/dark-four-colour-palette` branch. Superseded by
`planning/remaining-work.md` and by everything since; kept because it records
measurements taken against a live feed at that date, which cannot be recreated.
