# Production de www.ucicle.fr sur un serveur Linux

Tout tourne sur un seul serveur avec Docker Compose (`deploy/docker-compose.yml`) :

| Service | Image | Rôle |
|---|---|---|
| `db` | `postgres:17` | Base de l'Index (tables de `functions/migrations`). Volume `db_data`. Non exposée hors des conteneurs. |
| `web` | `ghcr.io/g3wis/ucicle-web` (`deploy/web.Dockerfile`, depuis `front/`) | Serveur Astro (`node dist/server/entry.mjs`, port 4321, utilisateur non root). Lit la base avec le rôle en lecture seule `ucicle_web`. |
| `jobs` | `ghcr.io/g3wis/ucicle-jobs` (`deploy/jobs.Dockerfile`, depuis `functions/`) | `yarn migrate` au démarrage, puis la séquence de nuit (voir plus bas). Rôle propriétaire de la base. Volume `jobs_data` (archive brute DataRide, état du planning). |
| `nginx` | `nginx:1.30-alpine` | Seul service exposé (ports 80 et 443). TLS, redirections, gzip, cache court. Configuration `deploy/nginx/ucicle.conf`. |

Ce qui reste hors du serveur : la fonction Scaleway du jeu (`functions/deploy.js`, job `deploy_functions` de
`.github/workflows/cd.yml`) écrit toujours `riders.json` et `secret_rider.json` dans le bucket `ucicle.com` ; le
site les relit depuis `GAME_DATA_ORIGIN` (`https://s3.fr-par.scw.cloud/ucicle.com` par défaut). Le bucket et la
fonction restent donc en place.

## Prérequis du serveur

- Linux **x86_64** (les images sont construites sur les runners `ubuntu-latest` de GitHub, en `linux/amd64`). Pour
  un serveur ARM, ajouter `platforms: linux/arm64` aux deux étapes `docker/build-push-action` de `cd.yml`.
- Docker Engine avec le plugin Compose v2 (2.17 ou plus récent si l'on construit les images sur le serveur :
  `additional_contexts`).
- `git` et `certbot` (paquet de la distribution ou snap).
- Mémoire : `yarn rate` autorise Node à utiliser jusqu'à 8 Go (`--max-old-space-size=8192`). La consommation réelle
  n'a pas été mesurée ; prévoir 8 Go de RAM, ou du swap.
- Disque : la base occupait 2,3 Go en local après la collecte complète, l'archive brute DataRide 130 Mo ; ajouter
  les images Docker (quelques centaines de Mo par version) et les sauvegardes.
- Ports 80 et 443 ouverts en entrée ; sortie HTTPS vers `dataride.uci.ch`, `query.wikidata.org`,
  `s3.fr-par.scw.cloud` et `ghcr.io`.

## Première installation

Les chemins ci-dessous supposent le dépôt cloné dans `/srv/ucicle` (valeur par défaut de la variable GitHub
`DEPLOY_DIR`) et un utilisateur `deploy` membre du groupe `docker`.

### 1. Code et configuration

```bash
sudo mkdir -p /srv/ucicle && sudo chown deploy: /srv/ucicle
git clone https://github.com/g3wis/ucicle.git /srv/ucicle   # dépôt privé : clé de déploiement en lecture seule
cd /srv/ucicle/deploy
cp .env.example .env && chmod 600 .env
```

Dans `.env`, remplacer chaque `<...>`. Mots de passe en lettres et chiffres seulement (`openssl rand -hex 24`),
pour que les URL n'aient pas besoin d'encodage. `WEB_DATABASE_URL` reprend `POSTGRES_WEB_PASSWORD`,
`JOBS_DATABASE_URL` reprend `POSTGRES_PASSWORD`.

Images : si les paquets ghcr.io sont privés (cas par défaut d'un premier envoi), se connecter une fois avec un
jeton personnel GitHub ayant le droit `read:packages` (`docker login ghcr.io`), ou rendre les deux paquets publics
dans GitHub (Packages > Package settings). Sinon, construire sur le serveur : `docker compose build`.

### 2. Base, site et jobs (sans nginx)

```bash
docker compose pull db web jobs        # ou : docker compose build web jobs
docker compose up -d db web jobs
docker compose logs jobs               # « Database schema up to date » ou « N migration(s) applied »
```

Au premier démarrage du volume `db_data`, `db/init/01-roles.sql` crée le rôle `ucicle_web` (lecture seule,
`SELECT` sur les tables présentes et futures). Ce script ne s'exécute plus ensuite ; sur une base déjà
initialisée, le lancer à la main :

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/01-roles.sql'
```

### 3. Collecte complète, puis calcul de l'Index

La séquence de nuit ne fait que la collecte récente (14 jours). Le premier remplissage se lance à la main, dans
un conteneur détaché (il survit à la fin de la session SSH) :

```bash
docker compose run -d --name ucicle-backfill jobs yarn collect --seasons 2027,2026,2025,2024,2023,2022,2021,2020,2019
docker logs -f ucicle-backfill
docker rm ucicle-backfill                # une fois terminé
```

Durée mesurée en local : 73,7 minutes pour 3 226 compétitions (21 785 requêtes, médiane 141 ms), soit environ
1 h 15 à 1 h 30 avec le registre des coureurs. La commande est reprenable : relancée, elle saute ce qui est déjà
collecté. Si le résumé final dit `partial` (quelques erreurs), la relancer une fois.

Puis :

```bash
docker compose exec jobs yarn rate              # environ 45 s en local
docker compose exec jobs yarn enrich:wikidata   # noms d'affichage, tailles, poids (sinon dimanche suivant)
docker compose exec jobs yarn rate              # pour que les pages reprennent les noms enrichis
```

Vérifier le site sans DNS :

```bash
docker compose exec web node -e "fetch('http://127.0.0.1:4321/classement/').then(r => console.log(r.status))"
```

### 4. DNS

Aujourd'hui `www.ucicle.fr` est un CNAME géré par le pipeline Edge Services `ucicle-fr`, et `ucicle.fr` un ALIAS
vers la fonction `ucicle-apex-redirect` (README racine, « Hosting »). Pour basculer :

1. Baisser le TTL des deux enregistrements quelques heures avant.
2. Retirer le domaine `www.ucicle.fr` du pipeline Edge Services et le domaine `ucicle.fr` de la fonction
   `ucicle-apex-redirect` (sinon la zone ne se laisse pas modifier).
3. Créer `A` (et `AAAA` si le serveur a une IPv6) pour `ucicle.fr` et `www.ucicle.fr` vers le serveur.
4. Attendre la propagation : `dig +short www.ucicle.fr` et `dig +short ucicle.fr` donnent l'adresse du serveur.

Le site est indisponible entre le changement DNS et le démarrage de nginx (étape 5) : enchaîner les deux.

### 5. Certificats TLS (certbot sur l'hôte)

Un seul certificat pour les deux noms, dans `/etc/letsencrypt/live/www.ucicle.fr/` (chemin écrit dans
`nginx/ucicle.conf`). Premier certificat en mode `standalone`, nginx arrêté (le port 80 doit être libre) :

```bash
sudo certbot certonly --standalone -d www.ucicle.fr -d ucicle.fr --cert-name www.ucicle.fr
```

Renouvellements par `webroot`, nginx en marche (il sert `/.well-known/acme-challenge/` depuis `ACME_WEBROOT`,
`/var/www/certbot` par défaut). Dans `/etc/letsencrypt/renewal/www.ucicle.fr.conf`, remplacer
`authenticator = standalone` par `authenticator = webroot` et ajouter :

```ini
[[webroot_map]]
www.ucicle.fr = /var/www/certbot
ucicle.fr = /var/www/certbot
```

Puis recharger nginx après chaque renouvellement :

```bash
sudo mkdir -p /var/www/certbot
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh >/dev/null <<'EOF'
#!/bin/sh
docker compose -f /srv/ucicle/deploy/docker-compose.yml exec -T nginx nginx -s reload
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Le timer du paquet certbot (`systemctl list-timers | grep certbot`) lance `certbot renew` deux fois par jour.
Une fois nginx démarré : `sudo certbot renew --dry-run`.

### 6. nginx

```bash
docker compose up -d
curl -sI https://www.ucicle.fr/ | head -1                                # HTTP/2 200
curl -sI --compressed https://www.ucicle.fr/ | grep -i content-encoding  # gzip
curl -sI http://ucicle.fr/ | grep -i location                            # https://www.ucicle.fr/
curl -s https://www.ucicle.fr/sitemap-index.xml | head                   # liste les sitemaps coureurs
```

Ce sont les vérifications du fait `gzip-check` de `front/scripts/launch-facts.json`.

### 7. GitHub

Dans le dépôt (Settings > Secrets and variables > Actions) :

| Nom | Type | Valeur |
|---|---|---|
| `DEPLOY_HOST` | secret | Adresse ou nom du serveur |
| `DEPLOY_USER` | secret | Utilisateur SSH (`deploy`), membre du groupe `docker`, propriétaire de `/srv/ucicle` |
| `DEPLOY_SSH_KEY` | secret | Clé privée SSH dédiée (`ssh-keygen -t ed25519 -N ''`) ; la clé publique va dans `~deploy/.ssh/authorized_keys` |
| `DEPLOY_KNOWN_HOSTS` | secret | Sortie de `ssh-keyscan -p <port> <serveur>`, vérifiée contre l'empreinte du serveur |
| `DEPLOY_PORT` | secret, optionnel | Port SSH (22 par défaut) |
| `DEPLOY_DIR` | variable, optionnelle | Dossier du dépôt sur le serveur (`/srv/ucicle` par défaut) |

Les images sont poussées avec le `GITHUB_TOKEN` du workflow (permission `packages: write`) ; le même jeton,
valable le temps du job, sert au serveur pour `docker compose pull`, puis il est déconnecté. Tant que les quatre
secrets obligatoires manquent, le workflow construit et pousse les images et saute le déploiement (avis dans le
résumé du run).

Les secrets et variables existants (`ACCESS_KEY`, `SECRET_KEY`, `DOMAIN`, `REGION`, `BUCKET_NAME`, `FUNCTION_ID`)
restent utilisés par `deploy_functions`.

### 8. Ancien hébergement

Après vérification : supprimer le pipeline Edge Services `ucicle-fr` et la fonction `ucicle-apex-redirect`
(nginx fait la redirection de l'apex). Garder le bucket `ucicle.com` (fichiers du jeu) et la fonction
`ucicle-load-riders`.

## Exploitation courante

### Journaux

```bash
cd /srv/ucicle/deploy
docker compose ps
docker compose logs -f --tail 100 web
docker compose logs -f --tail 100 jobs      # planning et sorties de collect / rate / enrich
docker compose logs -f --tail 100 nginx     # accès : rt=, ut=, cache=HIT|MISS|STALE|UPDATING|REVALIDATED
```

Rotation : 5 fichiers de 10 Mo par conteneur. Les exécutions de la collecte sont aussi dans la table `job_run` :

```bash
docker compose exec db psql -U ucicle -d ucicle -c "select id, kind, status, started_at, finished_at, errors from job_run order by id desc limit 10"
```

### Séquence de nuit

Le conteneur `jobs` n'a pas de cron : une boucle shell (`deploy/jobs/scheduler.sh`) regarde l'heure chaque
minute, à l'heure de `TZ` (`Europe/Paris`). Chaque jour à `NIGHTLY_AT` (04:00), dans l'ordre :

1. `yarn collect --recent 14` ;
2. le dimanche (`WEEKLY_DAY=7`), `yarn enrich:wikidata` ;
3. `yarn rate` (même si la collecte a échoué : il recalcule sur ce qui est en base) ;
4. si `rate` a réussi, demande à nginx de vider son cache (`deploy/nginx/50-ucicle-cache-purge.sh`, qui vérifie
   toutes les 30 s).

Le jour de la dernière exécution est noté dans le volume `jobs_data` (`/data/scheduler/last-nightly`). Un
conteneur arrêté à 04:00 rattrape la séquence à son redémarrage le même jour. Une collecte lancée à la main
pendant la nuit fait refuser celle de la séquence (« still running ») ; `rate` tourne quand même.

Changer l'heure : `NIGHTLY_AT` dans `.env`, puis `docker compose up -d jobs`.

### Lancer un job à la main

```bash
docker compose exec jobs yarn collect --recent 14
docker compose exec jobs yarn rate
docker compose exec jobs yarn enrich:wikidata
docker compose exec jobs yarn calibrate --quick      # manuel seulement ; long et gourmand en mémoire
docker compose exec jobs yarn rate --dry-run
docker compose exec jobs touch /var/run/ucicle-signal/purge-cache   # vider le cache nginx
```

`calibrate --freeze` réécrit `src/rating/params.ts` dans le conteneur, pas dans le dépôt : geler de nouveaux
paramètres se fait sur un poste de développement, puis passe par un commit et un déploiement.

### Cache

nginx garde les pages selon les en-têtes de l'application (`front/src/server/http.ts`) : `s-maxage=3600` pour les
pages de l'Index, 300 s pour l'accueil, rien pour les réponses `no-store` (recherche). `/api/recherche` et
`/api/fiche` ne passent jamais par le cache. Une page expirée est revalidée par son ETag ; une copie périmée est
servie pendant la mise à jour ou si le serveur Astro répond en erreur. L'en-tête `X-Cache-Status` le montre.

### Sauvegardes

Rien n'est automatisé. Exemple de sauvegarde quotidienne (crontab de `deploy`, 06:00, après la séquence de nuit) :

```bash
mkdir -p /srv/backups
# crontab -e
0 6 * * * cd /srv/ucicle/deploy && docker compose exec -T db pg_dump -U ucicle -d ucicle -Fc > /srv/backups/ucicle-$(date +\%F).dump && find /srv/backups -name 'ucicle-*.dump' -mtime +14 -delete
```

Copier ces fichiers hors du serveur. Restauration dans une base vide :

```bash
docker compose stop web jobs
docker compose exec -T db pg_restore -U ucicle -d ucicle --clean --if-exists < /srv/backups/ucicle-AAAA-MM-JJ.dump
docker compose start web jobs
```

Les données sont recollectables depuis DataRide (étape 3) ; l'archive brute du volume `jobs_data` n'est pas
indispensable à sauvegarder.

## Mises à jour

Automatique : chaque push sur `master` construit les deux images (étiquettes `latest` et `sha-<commit>`), puis,
sur le serveur : `git pull --ff-only`, `docker compose pull web jobs`, `docker compose up -d`, rechargement de
nginx si sa configuration a changé, suppression des images de plus de 30 jours.

À la main, avec les images de ghcr.io :

```bash
cd /srv/ucicle && git pull --ff-only && cd deploy
docker compose pull web jobs && docker compose up -d
docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload
```

Ou en construisant sur le serveur : `docker compose build web jobs && docker compose up -d`.

Une nouvelle migration s'applique au redémarrage du conteneur `jobs` (`yarn migrate`).

## Retour arrière

Les images de chaque commit restent sur ghcr.io (`sha-<commit complet>`). Dans `.env` :

```bash
IMAGE_TAG=sha-<commit>
```

puis `docker compose pull web jobs && docker compose up -d`. Tant que `IMAGE_TAG` est figé, les déploiements
suivants gardent cette version ; remettre `IMAGE_TAG=latest` pour reprendre. Pour la configuration (`deploy/`),
`git checkout <commit> -- deploy/` puis `docker compose up -d`.

Les migrations ne se défont pas : une image ancienne tourne sur un schéma plus récent. Si ce n'est pas
compatible, restaurer une sauvegarde antérieure à la migration.

## Ce qui n'est pas automatisé

- La collecte complète initiale (`--seasons ...`) et toute recollecte d'une saison entière.
- Le premier certificat et la configuration du renouvellement par webroot (étape 5) ; ensuite le timer certbot
  de l'hôte s'en charge.
- Les DNS et l'arrêt de l'ancien hébergement Scaleway.
- Les sauvegardes et leur copie hors du serveur.
- `yarn calibrate` et le gel des paramètres de l'Index.
- La relecture des doublons de coureurs (`rider_review`).
- La surveillance : aucune alerte si le site ou la séquence de nuit échoue (seulement les journaux, `job_run` et
  le healthcheck Docker de `web`, qui n'entraîne pas de redémarrage).
- Les mises à jour du système et de Docker. `node:26-alpine` est repris à chaque construction des images par le
  CD ; `postgres:17` et `nginx:1.30-alpine` ne changent que par un `docker compose pull db nginx && docker compose up -d`
  fait à la main.
- Le passage d'une version majeure de PostgreSQL (`pg_dump` / restauration).
- La fonction Scaleway du jeu et le bucket : inchangés, gérés par `deploy_functions`.
