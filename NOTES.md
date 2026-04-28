# Notes — Configuration triggers

## Resend setup completado · 2026-04-28

DNS records verificados en send.finpathia.com:
- DKIM TXT (resend._domainkey) ✅
- SPF MX (send) ✅
- SPF TXT (send) ✅

Env var `RESEND_API_KEY` configurada en Netlify (Site configuration → Environment variables).
Este redeploy fuerza que la Function family-invite-email re-lea las env vars al inicializar.
