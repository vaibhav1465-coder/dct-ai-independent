# Architecture

The application is a Next.js 16 / React 19 TypeScript application compiled by Vinext to a Cloudflare Worker. Browser pages call same-origin server routes; providers are never called from the browser. Dispatcher-authenticated identity headers are verified server-side and mapped to JOURNALIST or ADMIN. D1 stores approved metadata, settings and audit events only. Drafts, prompts and coaching output remain request-scoped and are discarded after the response.

The analysis boundary assembles the checksum-locked master prompt, seven checksum-locked active documents, and the submitted publication/headline/article. Archive documents are physically separated. A provider adapter should enforce timeout, retry and one format-repair attempt; output validation occurs before the response. Production rate limiting uses the configured Redis-compatible service; the included local limiter provides equivalent per-process development behaviour.
