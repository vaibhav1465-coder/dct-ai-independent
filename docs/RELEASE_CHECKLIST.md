# Release checklist

- [ ] `npm ci`, typecheck, lint, tests and production build pass
- [ ] Playwright smoke tests pass against the release candidate
- [ ] Prompt and active knowledge checksums match `PROMPT_INTEGRITY.md`
- [ ] No archive document is imported by runtime code
- [ ] No secrets, drafts or coaching outputs appear in repository or logs
- [ ] Access-control tests pass with journalist, administrator and denied users
- [ ] D1 migration reviewed and applied
- [ ] Provider timeouts, retries, budget and organisation limit verified
- [ ] Existing reference ChatGPT Site remains untouched
