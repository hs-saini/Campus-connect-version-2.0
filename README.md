# CampusConnect 2.0

CampusConnect is a college event portal with student accounts, persistent Student IDs, event registration, and an admin portal. Student IDs are stored centrally, so logging in with the same account on another device returns the same ID.

## Local development

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the server-only settings.
4. Run `vercel dev`.

The API creates the required database tables and default events when first used. The production database should be Neon Postgres.

## Production environment variables

Set these in Vercel's **Production** environment. Do not commit `.env.local` or share secret values:

- `DATABASE_URL` — Neon Postgres connection string.
- `SESSION_SECRET` — a random secret of at least 32 characters.
- `MASTER_ADMIN_USERNAME` — the master admin username.
- `MASTER_ADMIN_PASSWORD_HASH` — generated locally with `npm run hash-admin-password`; the password is entered without being echoed.

Student signup requires a unique email and roll number. Passwords are hashed on the server, and login uses secure, HTTP-only cookies. Events, registrations, payment status, and entry verification are stored in the shared database.

## Demo limitations

This is not a payment processor. Payment proofs are submitted for admin review, and student email ownership is not verified. Do not use real payment data until email verification and production operational safeguards are configured.
