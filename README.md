# Dispatcher Panel

SvelteKit panel for running one Shopify store's daily dispatch work: confirming
orders, tracking shipped parcels, products, inventory audits and variant
weights (restock planning lives in the accounting panel). Payments, fulfilment, refunds and order edits stay in the
Shopify admin.

**One store per deployment.** Each store gets its own Vercel project and its own
Turso database, all built from this repo — a push to `main` deploys every store.

## Accounts

- Every account signs in with email + password + 2FA (authenticator app).
- The **owner** also sees **Team** (add, edit, disable people, reset 2FA) and
  **Activity** (what everyone did). There is no separate admin panel.
- The owner account is created by the first visit to `/login` on an empty database.

## Setting up a new store

1. **Shopify app** — in the store's admin, create a custom app with the scopes
   listed in `src/lib/shopify-scopes.ts`, install it and copy the Admin API
   access token (`shpat_…`).
2. **Database** — create a new Turso database and an auth token for it.
3. **Create the tables** — with `DATABASE_URL` / `DATABASE_AUTH_TOKEN` pointing at the
   new database, run `npm run db:push`.
4. **Vercel project** — import this repo as a new project and set every variable from
   `.env.example`:
   - `DATABASE_URL`, `DATABASE_AUTH_TOKEN` — the new database
   - `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ACCESS_TOKEN` — from step 1
   - `ENCRYPTION_KEY` — a fresh random value (don't reuse another store's)
5. **Deploy**, open `/login`, create the owner account and set up 2FA. The store row is
   created automatically on first use.
6. Add the rest of the team from **Team**.

## Developing

```sh
npm install
cp .env.example .env   # then fill it in
npm run dev
```

`npm run check` type-checks; `npm run build` builds for Vercel.
