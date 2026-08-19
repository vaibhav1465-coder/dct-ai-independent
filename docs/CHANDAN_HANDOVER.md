# DCT handover for Chandan Kumar

This document is the working handover for the DCT (Digital Coaching Tool) product so Chandan can run, maintain, and update it independently.

## 1) What this product is

DCT is a private editorial coaching web application for Indian Express Group.

It does four main things:

- lets a signed-in user paste draft copy
- sends the draft to Claude from the server only
- returns a structured coaching review
- stores only metadata, audit logs, access records, and feedback data

Important privacy rule:

- full draft copy, assembled prompts, and coaching output are not stored in the database

## 2) Tech stack

- Next.js 16
- React 19
- TypeScript
- NextAuth with Google sign-in
- Anthropic Claude Sonnet 4.6
- Prisma ORM
- PostgreSQL
- Upstash Redis
- Resend for email notifications and feedback delivery
- Vercel for deployment

## 3) Most important files

These are the main files Chandan should know first.

### Product UI

- [app/page.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/page.tsx) — main product page
- [app/ui/check-form.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/ui/check-form.tsx) — draft form, active session history, result actions, sharing, rating
- [app/ui/header.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/ui/header.tsx) — top navigation
- [app/ui/user-menu.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/ui/user-menu.tsx) — logged-in user dropdown
- [app/feedback.css](C:/Users/Online/Documents/dct-independent-web-app%202/app/feedback.css) — main product styling
- [app/standards/page.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/standards/page.tsx) — Editorial Framework page
- [app/auth/signin/page.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/auth/signin/page.tsx) — sign-in screen
- [app/auth/signedout/page.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/auth/signedout/page.tsx) — signed-out page

### Admin and access control

- [app/admin/page.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/admin/page.tsx) — admin dashboard
- [app/admin/admin-tables.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/admin/admin-tables.tsx) — admin data tables
- [app/admin/access-actions.ts](C:/Users/Online/Documents/dct-independent-web-app%202/app/admin/access-actions.ts) — add/remove approved users
- [lib/access-policy.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/access-policy.ts) — who is allowed in, admin logic
- [lib/access-email.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/access-email.ts) — access notification emails

### AI and validation

- [lib/anthropic.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/anthropic.ts) — Claude call and response handling
- [lib/validation.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/validation.ts) — input validation and output format validation
- [app/api/check/route.ts](C:/Users/Online/Documents/dct-independent-web-app%202/app/api/check/route.ts) — core API route for editorial checks
- [lib/knowledge.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/knowledge.ts) — loads locked prompt and knowledge documents

### Auth, DB and limits

- [lib/auth.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/auth.ts)
- [lib/auth-options.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/auth-options.ts)
- [app/api/auth/[...nextauth]/route.ts](C:/Users/Online/Documents/dct-independent-web-app%202/app/api/auth/%5B...nextauth%5D/route.ts)
- [lib/prisma.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/prisma.ts)
- [prisma/schema.prisma](C:/Users/Online/Documents/dct-independent-web-app%202/prisma/schema.prisma)
- [lib/rate-limit.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/rate-limit.ts)

### Feedback and rating

- [app/api/feedback/route.ts](C:/Users/Online/Documents/dct-independent-web-app%202/app/api/feedback/route.ts)
- [app/api/user-feedback/route.ts](C:/Users/Online/Documents/dct-independent-web-app%202/app/api/user-feedback/route.ts)

### Verification and tests

- [tests/requested-feedback.test.mjs](C:/Users/Online/Documents/dct-independent-web-app%202/tests/requested-feedback.test.mjs)
- [tests/session-feedback.test.mjs](C:/Users/Online/Documents/dct-independent-web-app%202/tests/session-feedback.test.mjs)
- [tests/access-control.test.mjs](C:/Users/Online/Documents/dct-independent-web-app%202/tests/access-control.test.mjs)
- [tests/rendered-html.test.mjs](C:/Users/Online/Documents/dct-independent-web-app%202/tests/rendered-html.test.mjs)
- [scripts/verify-integrity.mjs](C:/Users/Online/Documents/dct-independent-web-app%202/scripts/verify-integrity.mjs)

## 4) The master prompt and knowledge files

The prompt is not inside the UI code. It is assembled from locked knowledge files.

### Master prompt

- [knowledge/DCT_Master_Prompt_v2.2_F.md](C:/Users/Online/Documents/dct-independent-web-app%202/knowledge/DCT_Master_Prompt_v2.2_F.md)

### Active knowledge files currently used at runtime

- [knowledge/active/Andrea_s_Editing_Guide.md](C:/Users/Online/Documents/dct-independent-web-app%202/knowledge/active/Andrea_s_Editing_Guide.md)
- [knowledge/active/Ten_ways_to_strengthen_your_news_writing.md](C:/Users/Online/Documents/dct-independent-web-app%202/knowledge/active/Ten_ways_to_strengthen_your_news_writing.md)
- [knowledge/active/Feedback with v1.3 by DG.md](<C:/Users/Online/Documents/dct-independent-web-app 2/knowledge/active/Feedback with v1.3 by DG.md>)
- [knowledge/active/Express_Web_Banned_Words.md](C:/Users/Online/Documents/dct-independent-web-app%202/knowledge/active/Express_Web_Banned_Words.md)
- [knowledge/active/Seven_ways_to_boost_engagement.md](C:/Users/Online/Documents/dct-independent-web-app%202/knowledge/active/Seven_ways_to_boost_engagement.md)
- [knowledge/active/INCOMPLETE_Indian_Express_Style_Guide.md](C:/Users/Online/Documents/dct-independent-web-app%202/knowledge/active/INCOMPLETE_Indian_Express_Style_Guide.md)
- [knowledge/active/Finding_feature_story_ideas.md](C:/Users/Online/Documents/dct-independent-web-app%202/knowledge/active/Finding_feature_story_ideas.md)

### Integrity reference

- [docs/PROMPT_INTEGRITY.md](C:/Users/Online/Documents/dct-independent-web-app%202/docs/PROMPT_INTEGRITY.md)

Important:

- if Chandan edits the master prompt or any active knowledge file, the integrity check will fail until the checksum process is updated intentionally
- archive files under `knowledge/archive` are not part of the runtime prompt

## 5) What Chandan needs on his laptop

### Software

- Node.js 22 or newer
- npm
- Git
- a code editor such as VS Code

### Access he needs

- GitHub access to the private repo
- Vercel access to the deployed project
- Google Cloud access for OAuth client settings
- Anthropic API key
- PostgreSQL database connection string
- Upstash Redis credentials
- Resend API key

Important:

- he cannot run the full AI workflow without valid service credentials
- the model does not run locally offline; the app calls Anthropic over the network from the server

## 6) Environment variables

Create a local file named `.env.local` in the project root.

Use this as the starting template:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ORGANISATION_DAILY_LIMIT=500
PER_USER_CHECK_LIMIT=5
DCT_LOCAL_ADMIN=false
RESEND_API_KEY=
ACCESS_NOTIFICATION_FROM=DCT Access <access@your-verified-domain.example>
```

Notes:

- `DCT_LOCAL_ADMIN=true` can be used only for local development if needed
- do not use production secrets in a shared document
- Chandan should receive actual secret values securely from the current owners, not from Git

## 7) Setup steps on Chandan’s laptop

### Step 1 — get the code

Clone the repository and open the project folder:

```bash
git clone https://github.com/vaibhav1465-coder/dct-independent-web-app.git
cd dct-independent-web-app
```

### Step 2 — install packages

```bash
npm ci
```

### Step 3 — create local environment file

- copy `.env.example` to `.env.local`
- fill in all required values

### Step 4 — prepare the database

```bash
npx prisma generate
npx prisma migrate deploy
```

If he is using a brand-new local database instead of the shared one, he can use:

```bash
npx prisma migrate dev
```

### Step 5 — run the app

```bash
npm run dev
```

Then open:

- [http://localhost:3000](http://localhost:3000)

## 8) Recommended local verification before making changes

Run these before pushing changes:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Optional end-to-end check:

```bash
npm run test:e2e
```

## 9) Google sign-in setup Chandan should know

In Google Cloud, the OAuth app must include the correct redirect URLs.

For local use:

- `http://localhost:3000/api/auth/callback/google`

For production:

- `https://dct-independent-web-app.vercel.app/api/auth/callback/google`

If preview deployments are used, preview callback URLs may also need to be added.

## 10) Current production deployment flow

Main flow today:

- code pushed to GitHub
- Vercel pulls from GitHub
- Vercel uses the configured environment variables
- production build runs `npm run vercel-build`

That script is defined in:

- [package.json](C:/Users/Online/Documents/dct-independent-web-app%202/package.json)

Current build chain:

- integrity verification
- Prisma client generation
- Prisma migrations
- Next.js production build

## 11) Where to make common future changes

### If he wants to change labels, buttons, screen layout, mobile behavior

Use:

- [app/ui/check-form.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/ui/check-form.tsx)
- [app/feedback.css](C:/Users/Online/Documents/dct-independent-web-app%202/app/feedback.css)
- [app/ui/header.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/ui/header.tsx)
- [app/standards/page.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/standards/page.tsx)

### If he wants to change coaching output behavior or input requirements

Use:

- [lib/validation.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/validation.ts)
- [lib/anthropic.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/anthropic.ts)
- [app/api/check/route.ts](C:/Users/Online/Documents/dct-independent-web-app%202/app/api/check/route.ts)
- [knowledge/DCT_Master_Prompt_v2.2_F.md](C:/Users/Online/Documents/dct-independent-web-app%202/knowledge/DCT_Master_Prompt_v2.2_F.md)

### If he wants to add or remove users/admins

Use:

- [app/admin/access-actions.ts](C:/Users/Online/Documents/dct-independent-web-app%202/app/admin/access-actions.ts)
- [lib/access-policy.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/access-policy.ts)

### If he wants to change email notifications

Use:

- [lib/access-email.ts](C:/Users/Online/Documents/dct-independent-web-app%202/lib/access-email.ts)
- [app/api/feedback/route.ts](C:/Users/Online/Documents/dct-independent-web-app%202/app/api/feedback/route.ts)
- `RESEND_API_KEY`
- `ACCESS_NOTIFICATION_FROM`

### If he wants to change admin dashboard metrics or tables

Use:

- [app/admin/page.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/admin/page.tsx)
- [app/admin/admin-tables.tsx](C:/Users/Online/Documents/dct-independent-web-app%202/app/admin/admin-tables.tsx)

## 12) Security and operational rules

Chandan should keep these unchanged unless there is a deliberate product decision:

- do not move provider calls to the browser
- do not store full article drafts in database tables
- do not store final coaching text in database tables
- keep access control server-side
- keep prompt and active knowledge integrity checks in place

Useful reference docs:

- [docs/ARCHITECTURE.md](C:/Users/Online/Documents/dct-independent-web-app%202/docs/ARCHITECTURE.md)
- [docs/SECURITY_CHECKLIST.md](C:/Users/Online/Documents/dct-independent-web-app%202/docs/SECURITY_CHECKLIST.md)
- [docs/THREAT_MODEL.md](C:/Users/Online/Documents/dct-independent-web-app%202/docs/THREAT_MODEL.md)
- [docs/RELEASE_CHECKLIST.md](C:/Users/Online/Documents/dct-independent-web-app%202/docs/RELEASE_CHECKLIST.md)

## 13) Practical handover checklist

Before handover is considered complete, Chandan should have:

- repo access
- Vercel project access
- Google Cloud OAuth access
- Anthropic key
- DB access
- Upstash access
- Resend access
- successful local sign-in
- successful local editorial check
- successful feedback email test
- successful local build

## 14) Short summary for Chandan

If Chandan only reads one thing, it should be this:

1. open the repo
2. fill `.env.local`
3. run Prisma
4. run `npm run dev`
5. most UI work is in `app/ui/check-form.tsx` and `app/feedback.css`
6. most AI behavior is in `lib/anthropic.ts`, `lib/validation.ts`, and the master prompt in `knowledge/DCT_Master_Prompt_v2.2_F.md`

