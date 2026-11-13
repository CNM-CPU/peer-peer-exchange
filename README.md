# Peer Exchange

A minimal, mobile-first listing board for peer-to-peer currency exchange. The frontend is React + TypeScript + Vite; Supabase provides email-link authentication, PostgreSQL, row-level security, atomic reservations, and the listing API.

The board does not process payments or provide in-app chat. Users contact advertisers and arrange any negotiation or settlement on WhatsApp.

## Run locally

```sh
npm install
npm run dev
```

The app starts at sign-in. Without Supabase environment variables, it shows that account services are unavailable and offers a clearly labeled, read-only sample preview in development only. Preview records have no phone numbers and cannot be contacted or reserved. To connect a Supabase project, copy `.env.example` to `.env.local` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (a publishable/anon key only; never use a service-role key in the browser)

Apply any migrations you have not already run, in order, using the Supabase CLI or SQL Editor. Do not rerun migrations that have already been applied:

1. [`20261112000000_create_marketplace_listings.sql`](./supabase/migrations/20261112000000_create_marketplace_listings.sql)
2. [`20261113000000_add_whatsapp_reservations.sql`](./supabase/migrations/20261113000000_add_whatsapp_reservations.sql)
3. [`20261114000000_add_advert_management.sql`](./supabase/migrations/20261114000000_add_advert_management.sql)
4. [`20261115000000_add_profile_settings_and_owned_adverts.sql`](./supabase/migrations/20261115000000_add_profile_settings_and_owned_adverts.sql)

Enable the email provider in Supabase Auth and add the app URL to its redirect allow-list. The app supports password and email-link sign-up/sign-in, password recovery, and email-change confirmation. New users must confirm their email before the session is established. The profile migration adds private avatar storage and owner-only advert editing/removal for available adverts.

Advertiser contact details are available to authenticated users viewing available listings with a valid WhatsApp number. Existing listings without a number remain hidden until the advertiser's contact details are added. A listing's `exchange_rate` means **want currency per one unit of available currency** (for example, `1 RUB = 0.011 ECUSD`). The selector finds listings in the opposite direction and sorts by ascending `exchange_rate`, so the user pays less of their currency per unit received.

Pressing **Contact on WhatsApp** atomically reserves the listing for 20 minutes before opening a prefilled WhatsApp message. This global reservation removes it from all users' available listings. The user can mark the reservation completed after arranging the exchange. If left unconfirmed, polling marks it expired, then makes it available again. Authenticated clients poll every 15 seconds; listings update for other active users within that interval.

Listings should store international WhatsApp numbers in E.164 format, such as `+263771234567`. The `ECUSD` currency code is used for EcoCash USD, distinct from cash USD.

Signed-in users can publish adverts from **Add advert**. The advertiser's rate is want-currency per one available-currency unit. Their advert appears to other users searching the opposite direction; users do not see their own advert as a contactable listing.

The hamburger menu provides **Marketplace**, **Add advert**, and **My adverts** for signed-in users, plus **Admin dashboard** for admins. The account menu provides account settings, password reset, and sign-out. Account settings support display name, email confirmation, password updates, and a private profile picture.

## Admin and analytics

The admin screen is available only to accounts whose server-managed Supabase `app_metadata.role` is `admin`. Designate the initial admin in Supabase Auth (do not use user-editable `user_metadata`), then sign out and back in to refresh the role claim. Admins can view registered users and suspend/reactivate non-admin accounts; role changes and account deletion are intentionally kept in Supabase Auth rather than exposed in the app.

The dashboard counts only listings explicitly marked `completed` after both parties arrange the exchange. It also shows available/reserved inventory and monthly completion counts. The migration creates restricted listing-status events (created, reserved, expired, completed, reopened) as the foundation for future analytics. Event-based monthly analytics begin when this migration is applied; the all-time completed count includes previously closed listings.

Suspension is enforced by row-level security and the reservation/completion functions, not only by hiding the UI. Advert creation and listing discovery also require an active signed-in account.

## Deploy to Vercel

1. Import this repository into Vercel; Vercel will detect Vite.
2. Keep the build command as `npm run build` and the output directory as `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the Vercel environment, then redeploy.
4. Add the deployed URL to the Supabase Auth redirect allow-list.

## Checks

```sh
npm run lint
npm run build
```
