<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (RentBerry)

- Sign-in is phone OTP checked server-side (`src/lib/auth.functions.ts`), then a Cloud session is minted via an admin magic-link token for an internal `p<digits>@phone.borrowbee.local` address (legacy domain kept so existing sign-ins keep matching); public sign-up stays disabled. Why: keeps the original Twilio phone flow while using Cloud sessions and RLS.
- SMS and Stripe fall back to demo mode (fixed code / instant "connected") when their secrets are absent. Why: mirrors the source app so the preview works without credentials.
- `public.profiles` has no FK to `auth.users` so the seeded sample owners can exist; private member fields live in `member_private` (owner-read only, server-written). Why: names are public, phone/verification/Stripe data are not.
- Cross-user writes (rentals, conversations, messages, notifications) go through server functions using the admin client after explicit participant checks; clients only read via RLS. Why: availability checks need to see other borrowers' rentals.
- Listing media lives in the private `listing-media` bucket and is served by `/api/public/media/*` (workspace blocks public buckets). Media URLs are validated against the owner's folder.
- Member-only screens live under `src/routes/_authenticated/` (`ssr: false`, requires a verified member). Why: sessions are browser-held.
- The offline service worker registers only on the published site (never preview/iframe/dev).
- Admin access needs the `admin` row in `public.user_roles` (granted at sign-in for numbers in server-only `public.admin_phones`) plus the `ADMIN_PASSCODE` secret on every admin server function (`src/lib/admin.functions.ts` → `src/server/admin.server.ts`). Why: the demo SMS code would otherwise let anyone who knows the admin number in.
- Suspension sets `member_private.suspended_at`; `is_verified()`/`getVerifiedMember` treat suspended members as unverified and sign-in refuses them. Why: one flag blocks every member action and RLS write.
