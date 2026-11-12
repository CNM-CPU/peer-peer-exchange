# Peer Exchange

A minimal, mobile-first listing board for peer-to-peer currency exchange. The frontend is React + TypeScript + Vite; Supabase provides email-link authentication, PostgreSQL, row-level security, atomic reservations, and the listing API.

The board does not process payments or provide in-app chat. Users contact advertisers and arrange any negotiation or settlement on WhatsApp.

## Run locally

```sh
npm install
npm run dev
```

Without Supabase environment variables, the app displays clearly labeled sample listings. Those records have no phone numbers and cannot be contacted or reserved. To connect a Supabase project, copy `.env.example` to `.env.local` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (a publishable/anon key only; never use a service-role key in the browser)

Apply migrations in order using the Supabase CLI or SQL Editor:

1. [`20261112000000_create_marketplace_listings.sql`](./supabase/migrations/20261112000000_create_marketplace_listings.sql)
2. [`20261113000000_add_whatsapp_reservations.sql`](./supabase/migrations/20261113000000_add_whatsapp_reservations.sql)

Create existing user accounts in Supabase Auth and enable the email provider. The app signs in existing users using a magic link; it does not create accounts. The Supabase auth redirect allow-list must include the app URL.

Advertiser contact details are available to authenticated users viewing available listings with a valid WhatsApp number. Existing listings without a number remain hidden until the advertiser's contact details are added. A listing's `exchange_rate` means **want currency per one unit of available currency** (for example, `1 RUB = 0.011 ECUSD`). The selector finds listings in the opposite direction and sorts by ascending `exchange_rate`, so the user pays less of their currency per unit received.

Pressing **Contact on WhatsApp** atomically reserves the listing for 20 minutes before opening a prefilled WhatsApp message. This global reservation removes it from all users' available listings. The user can mark the reservation completed after arranging the exchange. If left unconfirmed, polling marks it expired, then makes it available again. Authenticated clients poll every 15 seconds; listings update for other active users within that interval.

Listings should store international WhatsApp numbers in E.164 format, such as `+263771234567`. The `ECUSD` currency code is used for EcoCash USD, distinct from cash USD.

## Deploy to Vercel

1. Import this repository into Vercel; Vercel will detect Vite.
2. Keep the build command as `npm run build` and the output directory as `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the Vercel environment if using Supabase.
4. Add the deployed URL to the Supabase Auth redirect allow-list.

## Checks

```sh
npm run lint
npm run build
```
