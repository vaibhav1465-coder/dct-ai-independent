# Security checklist

- [x] Server-side identity and role checks
- [x] Verified domain and administrator allow-list
- [x] Same-origin and CSRF request checks
- [x] CSP, HSTS, nosniff, referrer and permissions policies
- [x] Request size and input length limits
- [x] Provider keys absent from browser code
- [x] Drafts and outputs excluded from persistence
- [x] Metadata-only schema and audit table
- [ ] Set production Redis-compatible credentials
- [ ] Set credential-encryption key in hosting secrets
- [ ] Confirm private Sites access policy before publishing
- [ ] Run provider connection test after secrets are set
