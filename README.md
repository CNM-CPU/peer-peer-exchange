# Peer Exchange

A React + TypeScript marketplace preview for discovering peer-to-peer currency exchange listings. The initial audience is Zimbabwean students in Russia, as described in the project proposal.

> **Preview only:** sample listings and rates are fictional. The app does not process payments, hold funds, verify identity, or arrange settlement. The proposal calls for legal and regulatory review before real exchange activity is facilitated.

## Run locally

```sh
npm install
npm run dev
```

Without Supabase environment variables, the app displays clearly labeled sample listings. To connect a Supabase project, copy `.env.example` to `.env.local` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (a publishable/anon key only; never use a service-role key in the browser)

The app reads open rows from `public.marketplace_listings`. Apply [`supabase/migrations/20261112000000_create_marketplace_listings.sql`](./supabase/migrations/20261112000000_create_marketplace_listings.sql) in the Supabase SQL Editor or through the Supabase CLI. The migration enables row-level security and grants public read access only to open listings and non-identifying listing columns. For `have` listings, `amount` is in the available currency; for `need` listings, it is in the requested currency. This preview does not include sign-in or listing creation.

## Deploy to Vercel

1. Import this repository into Vercel; Vercel will detect Vite.
2. Keep the build command as `npm run build` and the output directory as `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel project’s environment variables if using Supabase.
4. Deploy. The same variables must be present for each environment where Supabase data should load.

## Checks

```sh
npm run lint
npm run build
```
