# Threat model

Protected assets include provider keys, drafts, coaching output, identity, settings and operational metadata. Threats include forged identity headers, cross-site requests, oversized payloads, prompt injection, credential disclosure, privilege escalation, model-output confusion and sensitive logging.

Controls include dispatcher-owned authentication, email/domain allow-listing, server-side RBAC, same-origin and CSRF checks, restrictive security headers, input bounds and sanitisation, no-store responses, provider-key isolation, encrypted stored credentials, rate and daily limits, audit events, metadata-only analytics and deterministic output validation. Hosting must strip client-supplied identity headers before injecting trusted values. Human editorial judgement remains mandatory.
