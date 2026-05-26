# Base de données PostgreSQL (sans Supabase)

## 1. Auth

```bash
psql -U bloxking -d bloxking -h localhost -f db/00_auth.sql
```

## 2. Ranked (matchmaking, litiges, ELO)

```bash
npm run db:patch-ranked   # régénère db/01_ranked.sql depuis supabase/setup_bloxking_ranked.sql
psql -U bloxking -d bloxking -h localhost -f db/01_ranked.sql
```

## 3. Stockage preuves (serveur)

```bash
sudo mkdir -p /var/bloxking/dispute-evidence
sudo chown -R ec2-user:ec2-user /var/bloxking
```

Dans `.env.local` :

```
DISPUTE_EVIDENCE_DIR=/var/bloxking/dispute-evidence
```
