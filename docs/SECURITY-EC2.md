# Sécurité production (EC2)

Checklist après audit pentest — actions **infra** (hors dépôt) et **déploiement**.

## Priorité immédiate (infra AWS / nginx)

1. **PostgreSQL (5432)** — Security Group : autoriser uniquement `127.0.0.1` ou le SG de l’instance app, **jamais** `0.0.0.0/0`.
2. **HTTPS** — Certbot + nginx `listen 443`, redirection HTTP → HTTPS.
3. **Variables d’environnement** sur le serveur :
   - `NEXT_PUBLIC_SITE_URL=https://bloxking.com` (ou ton domaine)
   - `SESSION_COOKIE_SECURE=true` (si HTTPS actif)
4. Recharger nginx : `sudo nginx -t && sudo systemctl reload nginx`
5. Redéployer l’app : `git pull && bash scripts/apply-db-migrations.sh && npm ci && npm run build && pm2 restart bloxking`

## Correctifs applicatifs (ce dépôt)

| Finding | Fichier / mécanisme |
|--------|---------------------|
| RSC bypass admin | `middleware.ts` (401 sans cookie sur RSC) + `app/admin/layout.tsx` (`requireAdminPanel`) |
| Emails publics `/classement` | `src/app/classement/page.tsx` — email retiré de `data-search` |
| Rate-limit login/register | `src/lib/security/rate-limit.ts` + `src/app/auth/actions.ts` |
| Mots de passe faibles | `src/lib/security/password-policy.ts` + signup |
| Erreurs Postgres client | `src/lib/security/sanitize-error.ts` + `query.ts` / `play/actions.ts` |
| Security headers | `src/lib/security/headers.ts` + `middleware.ts` |
| Cookie Secure | `src/lib/auth/session.ts` + `SESSION_COOKIE_SECURE` / HTTPS URL |
| Body size SA | `infra/nginx/bloxking.conf` — `client_max_body_size 2m` (upload 60M séparé) |
| `X-Powered-By` | `next.config.ts` — `poweredByHeader: false` |

## Non implémenté (roadmap)

- Réinitialisation mot de passe
- Vérification e-mail à l’inscription
- Rate-limit distribué (Redis / Upstash) si plusieurs instances
- Re-encode uploads (sharp) contre polyglots

## Vérification rapide post-déploiement

```bash
# Pas d’email dans le classement public
curl -sS https://TON_DOMAINE/classement | grep -c '@'  # doit être 0 ou très bas (pas dans data-search)

# Admin RSC sans cookie → 401
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "RSC: 1" -H "Accept: text/x-component" \
  https://TON_DOMAINE/admin/litiges

# Port 5432 fermé depuis Internet
nc -zv TON_IP_PUBLIQUE 5432  # doit échouer / timeout
```
