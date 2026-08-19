# DCT AI Independent

Private, clean-room Digital Coaching Tool for Indian Express Group. The reference ChatGPT Site is not connected to this repository.

## Production architecture

- Next.js 16 and React 19 on Vercel
- Google OAuth through NextAuth with verified-email allow-listing
- Anthropic Claude Sonnet 4.6 called only from the server
- Prisma ORM with PostgreSQL metadata storage
- Upstash Redis distributed employee and organisation usage limits
- Exact checksum-locked master prompt and seven active knowledge documents

Full article drafts, assembled prompts and coaching output are never written to the database or application logs.

## Local development

Copy `.env.example` to `.env.local`, configure the services, then run `npm ci`, `npx prisma migrate dev`, and `npm run dev`. `DCT_LOCAL_ADMIN=true` is permitted only for local interface development; production must omit it or set it to `false`.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`. The build fails if the master prompt or active knowledge files differ from the supplied checksums.

## Deployment

Use the private GitHub repository with Vercel Git deployment. Configure all variables from `.env.example` in Vercel, attach PostgreSQL and Redis, run `npm run db:migrate`, and register `/api/auth/callback/google` for both preview and production domains in Google Cloud.
