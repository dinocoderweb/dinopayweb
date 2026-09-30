# Print Desk

A shared booking, schedule, order, and manual-payment workspace for a small custom-print studio. Customers send a booking request from a public link. Staff use individual accounts to manage requests, production status, quotes, and payments received by cash, UPI, or bank transfer.

## What is included

- A customer booking page for contact details, product, quantity, design notes, and a requested date and time.
- A private staff dashboard with booking status, schedule, quotes, and a payment ledger.
- Individual staff sign-ins and invitation links. Changes are stored in one hosted database and shared across devices.
- Database access policies that keep each studio's records private. Payment entries are append-only and cannot exceed the order's quoted balance.
- Workspace settings for studio name, currency, schedule time zone, and public booking availability.

This app records payments that the studio has already received. It does not collect money or store card or bank credentials.

## Set up the shared database

1. Create a Supabase project at https://supabase.com/.
2. Open the project's SQL Editor and run the complete migration at supabase/migrations/202609300001_print_desk.sql.
   Keep the migration's private schema out of Supabase's exposed API schemas; the app calls only the limited wrappers in public.
3. In Supabase Authentication settings, enable email and password sign-in. Set the site's URL and allowed redirect URLs to your app's address. If email confirmations are enabled, staff confirm their email before signing in.
4. Copy the Project URL and its publishable API key from the project's API settings. The older anon key is also accepted by this app while Supabase supports it.
5. Copy .env.example to .env.local and fill in:

       NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
       NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key

   The publishable key is intended for browser apps; database row-level security controls access. Never put a Supabase secret or service-role key in a NEXT_PUBLIC_ variable or commit it to GitHub.

## Run locally

Use Node.js 20.9 or newer and pnpm:

    pnpm install
    pnpm dev

Open http://localhost:3000. Create the first account and studio workspace. The owner can generate an invite link in Settings and send it to a teammate; that person accepts it using the invited email address and creates an individual login.

## Deploy

Deploy this Next.js application to a host that supports the Next.js App Router (for example, Vercel). Add the same two public environment variables in the hosting project's settings, then deploy. Add the deployed app URL to Supabase's allowed redirect URLs. Share the booking link shown under Settings.

The first studio defaults to INR and Asia/Kolkata. The owner can change currency and time zone before the first booking; they lock after an order is added so recorded amounts and requested times are not silently reinterpreted.

## Notes

- The database migration is required before the app can create workspaces or accept bookings.
- Public booking requests are unconfirmed until the studio changes their status.
- Team invite links expire after seven days and can only be accepted by the invited email address.
- Bookings are retained as an order history; cancel an order instead of deleting it. Payment entries cannot be edited or deleted from the app.
