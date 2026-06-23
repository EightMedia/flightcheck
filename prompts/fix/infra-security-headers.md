## Infra — security headers

Applies to missing security response headers (CSP, X-Frame-Options / frame-ancestors,
X-Content-Type-Options, Referrer-Policy, Permissions-Policy).

## Where to fix

**Prefer repo config over a hosting dashboard** so the change is reviewable and versioned:

- **Vercel / Next.js** → `headers()` in `next.config.js`, or a `vercel.json` `headers` block.
- **Netlify** → `netlify.toml` `[[headers]]` or `public/_headers`.
- **Other** → middleware or the server/CDN config.

Only touch the hosting dashboard if there is no repo config path — and follow the approval flow in
`../BASE.md` before any live change.

## Fix strategy

1. Add safe, broadly-compatible defaults: `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`,
   a minimal `Permissions-Policy`.
2. **CSP needs care** — a wrong policy breaks the site. Build it from the resources the report shows
   the site actually uses (e.g. CMS image CDN, font hosts, analytics/tag-manager domains). If you
   cannot verify the full set, propose a `Content-Security-Policy-Report-Only` first and say so.

## Package-specific verification

- After deploy, check response headers: `curl -sI https://<site>/ | grep -i -E 'content-security|x-frame|x-content-type|referrer|permissions'`.
- After flightcheck, the security-header warnings should clear.
