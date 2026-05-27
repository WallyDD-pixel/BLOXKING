# Migration Vercel -> AWS EC2 (Docker + Nginx)

Architecture choisie:
- Next.js dans un container Docker sur EC2
- Nginx en reverse proxy
- PostgreSQL existant conservé (même instance actuelle)

## 1) Préparer EC2

Sur Amazon Linux 2023:

```bash
sudo dnf update -y
sudo dnf install -y docker nginx git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker
```

Installer Docker Compose plugin:

```bash
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p $DOCKER_CONFIG/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
docker compose version
```

### Sans domaine (publication sur l’IP)

- Dans `.env.production` :  
  `NEXT_PUBLIC_SITE_URL=http://<IP-PUBLIQUE>` (ex. `http://13.62.55.67`)
- Pas de HTTPS Let’s Encrypt sur une IP seule : reste en HTTP.
- Le fichier `infra/nginx/bloxking.conf` est prêt pour ça (`server_name _` + `default_server`).
- **Security Group** : ouvre le port **80** (HTTP) depuis `0.0.0.0/0` pour le test publique.  
  Garde **22** (SSH) pour toi si possible.
- Ignore les sections **HTTPS** et **DNS** tant que tu n’as pas de nom de domaine.

## 2) Variables d'environnement prod

Dans le repo EC2:

```bash
cd ~/BLOXKING
cp .env.example .env.production
```

Adapter au minimum:
- `DATABASE_URL` (base actuelle)
- `DATABASE_SSL=false` (si Postgres local/tunnel, sinon `true` si TLS activé)
- `NEXT_PUBLIC_SITE_URL` : `http://<IP-PUBLIQUE-EC2>` sans domaine, ou `https://ton-domaine` plus tard
- SMTP/YouTube si utilisés
- `DISPUTE_EVIDENCE_DIR=/var/bloxking/dispute-evidence`

Créer le dossier des preuves:

```bash
sudo mkdir -p /var/bloxking/dispute-evidence
sudo chown -R ec2-user:ec2-user /var/bloxking
```

## 3) Déployer l'app

```bash
cd ~/BLOXKING
chmod +x scripts/deploy-ec2.sh
bash scripts/deploy-ec2.sh
```

L'app écoute en local sur `127.0.0.1:3000`.

## 4) Nginx

Copier la conf:

```bash
sudo cp infra/nginx/bloxking.conf /etc/nginx/conf.d/bloxking.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

## 5) HTTPS (Let's Encrypt)

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bloxking.fr -d www.bloxking.fr
```

## 6) DNS cutover (direct)

Dans ton DNS:
- `A @` -> IP publique EC2
- `A www` -> IP publique EC2

Puis vérifier:

```bash
curl -I https://bloxking.fr
```

## 7) Post-migration

- Lancer les migrations SQL au besoin (`scripts/apply-db-migrations.sh`)
- Vérifier:
  - connexion/inscription
  - matchmaking
  - litiges + uploads
  - notifications (`/notifications`)

