# Déployer BloXKING sur Vercel

Next.js fonctionne très bien sur Vercel. En revanche, **PostgreSQL** et le **stockage des preuves de litige** ne sont pas hébergés par Vercel : il faut les configurer séparément.

## 1. Préparer le dépôt

- Pouss ton code sur **GitHub** (ou GitLab / Bitbucket lié à Vercel).

## 2. Créer le projet Vercel

1. Va sur [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. **Import** ton repo.
3. Laisse les réglages par défaut (**Framework**: Next.js, **Root**: racine si le projet est à la racine).
4. Clique **Deploy** une première fois (il peut échouer tant que les variables d’env ne sont pas là — ça permet de créer le projet).

---

## 3. Variables d’environnement

Dans le projet Vercel : **Settings** → **Environment Variables**.

| Variable | Où la mettre | Rôle |
|----------|----------------|------|
| `DATABASE_URL` | Production (et Preview si tu veux tester) | URL PostgreSQL (voir ci‑dessous) |
| `DATABASE_SSL` | `true` si ton hébergeur Postgres impose SSL | Ex. Neon, Supabase, RDS avec SSL |
| `NEXT_PUBLIC_SITE_URL` | Production | URL publique, ex. `https://bloxking.vercel.app` ou ton domaine |
| `YOUTUBE_API_KEY` | optionnel | Bloc live + dernière vidéo (quota Google ~10 000 unités/jour ; éviter `search.list` répété) |
| `YOUTUBE_CHANNEL_HANDLE` | optionnel | ex. `warrenoff` (sans `@`) |
| `DISPUTE_VIDEO_MAX_BYTES` | optionnel | Défaut 52428800 (50 Mo) |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | optionnel | Pub Google AdSense (`ca-pub-…`) |
| `NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR_LEFT` | optionnel | ID bloc pub colonne gauche |
| `NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR_RIGHT` | optionnel | ID bloc pub colonne droite |
| `NEXT_PUBLIC_ADSENSE_SLOT_BANNER_TOP` | optionnel | ID bannière horizontale sous le header |
| `NEXT_PUBLIC_ADS_PLACEHOLDERS` | optionnel | `true` = cadres debug uniquement (jamais en prod) |
| `ADMIN_EMAILS` | optionnel | Emails admin séparés par des virgules (accès `/admin`) |

**Important après la première mise en ligne**

- Mets `NEXT_PUBLIC_SITE_URL` avec l’URL **réelle** (celle qui s’affiche dans la barre d’adresse).
- Pour un **nom de domaine custom** : configure le domaine dans Vercel, puis mets cette URL dans `NEXT_PUBLIC_SITE_URL`.

Redéploie après chaque modification des variables (**Deployments** → **⋯** → **Redeploy**).

---

## 4. PostgreSQL depuis Vercel

Vercel lance tes routes en **serverless** : la base doit être **accessible sur Internet**.

### Option A — Recommandée : Postgres managé

Exemples : **Neon**, **Supabase** (PostgreSQL), **Railway**, **Render**, etc.

1. Crée une base dans le même cloud.
2. Récupère la **chaîne `DATABASE_URL`** (souvent avec `sslmode=require`).
3. Copie tes schémas : exécute `db/00_auth.sql` puis `db/01_ranked.sql` puis `db/02_dispute_video_attachments.sql` (si tu les utilises), via le client SQL du fournisseur ou `psql`.

### Option B — Ta base sur EC2

Possible mais plus délicat :

- Postgres doit **écouter** sur une IP reachable (pas seulement `127.0.0.1`).
- Les **firewall / security groups** doivent autoriser le port Postgres depuis Internet (⚠ exposition du port).
- Vercel n’a pas d’IP fixes sur le tier gratuit/pro : whitelist par IP peu pratique.
- Mets `DATABASE_SSL=true` si tu actives TLS sur Postgres.

Souvent plus simple pour la prod Vercel : **migrer la base** vers Neon (ou équivalent), ou garder l’API sur EC2 et ne mettre que le front sur Vercel (hors périmètre de ce guide).

---

## 5. Preuves de litige (fichiers sur disque)

Le code écrit sous `DISPUTE_EVIDENCE_DIR` ou sous `.data/dispute-evidence`.

Sur **Vercel**, le disque d’une fonction serverless est **éphémère** : deux requêtes peuvent passer sur deux instances différentes, et les fichiers ne sont pas un stockage durable.

Pour la prod sérieuse sur Vercel il faudra plus tard :

- **Vercel Blob**, **AWS S3**, ou un autre objet storage compatible ;  
et adapter upload + lecture (`/api/dispute-evidence/...`) pour utiliser ce stockage.

Pour un **premier déploiement de démo**, tu peux quand même mettre en ligne **sans litiges actifs**, ou accepter que les uploads de preuves ne soient pas fiables jusqu’à migration du stockage.

---

## 6. Réglages Vercel utiles

- **Node.js** : 20.x LTS ou 22 si supporté — le fichier `package.json` peut contenir `"engines": { "node": ">=20" }`.
- **Build Command** : `npm run build` (défaut).
- **Output** : aucun besoin de `output: export` (site dynamique SSR).

Si le build dépasse le timeout gratuit, passe en équipe avec limites plus hautes ou optimise.

---

## 7. Récap checklist

1. [ ] Postgres accessible depuis Internet avec `DATABASE_URL` + `DATABASE_SSL` si besoin  
2. [ ] SQL migrations appliquées sur cette base  
3. [ ] `NEXT_PUBLIC_SITE_URL` = URL définitive du site  
4. [ ] `YOUTUBE_*` si tu veux les blocs YouTube  
5. [ ] Plan pour preuves litige : accepter la limite ou migrer vers object storage  

Tu peux déclencher un nouveau **Deploy** : le site doit répondre sur `https://…vercel.app` (ou ton domaine).

Pour un domaine personnalisé : **Settings** → **Domains** dans Vercel, puis suivre DNS (TTL peut prendre jusqu’à 48 h, souvent quelques minutes).
