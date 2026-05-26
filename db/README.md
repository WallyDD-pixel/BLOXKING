# Base de données PostgreSQL (sans Supabase)

## 1. Auth

```bash
psql -U bloxking -d bloxking -h localhost -f db/00_auth.sql
```

## 2. Ranked (matchmaking, litiges, ELO)

Si une migration a déjà échoué :

```bash
psql -U bloxking -d bloxking -h localhost -f db/98_reset_ranked.sql
```

Puis :

```bash
git pull   # récupère les SQL corrigés
psql -U bloxking -d bloxking -h localhost -f db/01_ranked.sql
```

(En dev local : `npm run db:patch-ranked` régénère `db/01_ranked.sql`.)

## 3. Stockage preuves (serveur)

```bash
sudo mkdir -p /var/bloxking/dispute-evidence
sudo chown -R ec2-user:ec2-user /var/bloxking
```

Dans `.env.local` :

```
DISPUTE_EVIDENCE_DIR=/var/bloxking/dispute-evidence
DISPUTE_VIDEO_MAX_BYTES=52428800
```

## 4. Vidéos sur les tickets litige (base déjà en prod)

```bash
psql -U bloxking -d bloxking -h localhost -f db/02_dispute_video_attachments.sql
```

Règles : **1 vidéo max** par message (MP4/WebM, ~50 Mo), jusqu’à **5 pièces jointes** au total (images + vidéo). Lecture en **streaming** (pas de chargement complet en RAM).
