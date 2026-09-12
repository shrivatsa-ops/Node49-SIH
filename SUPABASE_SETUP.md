# Connect KrishiSetu to Supabase

The website works in local demo mode until Supabase is connected. In that mode, lots and offers are saved only in the current browser.

## 1. Create a project

1. Create a free project at [Supabase](https://supabase.com/dashboard).
2. Wait until its status is healthy.

## 2. Create the database tables

1. In the project, open **SQL Editor**.
2. Choose **New query**.
3. Copy everything from `supabase/schema.sql`, paste it, then select **Run**.
4. If you had already run the earlier schema, also run `supabase/chat-migration.sql` to add the role-aware chat fields.

## 3. Add the public connection values

1. Open **Project Settings > API**.
2. Copy the **Project URL** and the **anon / publishable key**.
3. Put them in `supabase-config.js`:

```js
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-OR-PUBLISHABLE-KEY';
```

The anon/publishable key may be used in a browser. Never add the `service_role` key to this website or share it.

## 4. Deploy the update

Deploy the complete `SIH` folder to Netlify again. On the next page refresh, new crop lots and submitted offers will save in Supabase and be visible from any device using the website.

## Demo vs production

This is an SIH demo configuration. Its database policies allow public anonymous demo access. Before collecting real farmers' information, replace the demo policies with Supabase Auth and strict per-user policies; use a server-side SMS OTP flow; and do not collect Aadhaar numbers, Aadhaar OTPs, or biometrics.
