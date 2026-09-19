# Uptown City Vibe — Event Hub

Solely Uptown City Vibe's event registration, ticketing, membership, and gallery website. Built on React + Vite + Supabase — no custom backend server, no local file database. Supabase provides Postgres, Auth, Storage, and (via Edge Functions) the payment/email logic.

## Local development
```
npm install
npm run dev
```

## What's real vs. what needs your input

**Fully working, no setup needed:**
- Public site: homepage with slideshow hero, upcoming events, gallery, membership form
- Free event registration with QR confirmation + email
- Organizer dashboard: events, ticket types, flyer uploads, attendees, members, gallery
- Camera-based QR check-in (and manual code entry)
- Invite-only team member onboarding (`/join/:token`, generated from `/admin`)
- Real Row-Level Security — attendee/member PII is never publicly readable, only by your team

**Needs your API keys to fully activate (currently returns a clear "not configured" error instead of pretending to work):**
- **Real ticket payments** — set `PAYSTACK_SECRET_KEY` and `FRONTEND_URL` as secrets on your Supabase project's Edge Functions (Project Settings → Edge Functions → Secrets). Also set your Paystack webhook URL (in your Paystack dashboard) to:
  `https://ioiprebkdjawczkygkxy.supabase.co/functions/v1/paystack-webhook`
- **Real email confirmations** — set `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` the same way, using a Resend account and a verified sending domain (or their sandbox address for testing).

Until those secrets are set, ticket checkout and confirmation emails will fail gracefully with a clear error rather than silently pretending to succeed.

## Also worth doing in the Supabase dashboard
- Authentication → Providers → Email → Password: enable "Leaked password protection" (flagged by Supabase's own security advisor; a one-click toggle).

## Deployment
This is a static site — deploy the `dist` folder to Netlify (config already in `netlify.toml`) or any static host. There is no server to deploy separately; Supabase Edge Functions are already live.

## What's intentionally NOT built yet
- Editing/deleting an existing ticket type (adding new ones works)
- Formal privacy policy, refund policy, rate limiting, monitoring/alerting
- Automated backups (Supabase's own project-level backups still apply on paid tiers)
