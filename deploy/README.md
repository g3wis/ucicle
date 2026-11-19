# Production de www.ucicle.fr

Le site et les tâches de l'Index tournent sur le VPS `cabigi.xyz`, comme stack `ucicle` du dépôt
d'infrastructure **g3wis/infra** : `stacks/ucicle/` (`compose.yaml`, `stack.yml`, `env.vault`),
derrière le Traefik de la machine. La conception, les écarts avec l'ancien déploiement et la mise
en service pas à pas sont dans
`g3wis/infra` → `docs/superpowers/specs/2026-11-18-ucicle-stack-design.md`.

Ce dépôt-ci fournit les **images** ; le dépôt d'infrastructure fournit **tout le reste** (compose,
secrets, TLS, DNS, sauvegardes, supervision).

| Service | Image | Construite depuis |
|---|---|---|
| `db` | `postgres:17` | — |
| `web` | `ghcr.io/g3wis/ucicle/web` | `deploy/web.Dockerfile`, contexte `front/` |
| `jobs` | `ghcr.io/g3wis/ucicle/jobs` | `deploy/jobs.Dockerfile`, contexte `functions/` + `deploy/jobs/` |

Ce qui reste chez Scaleway : la fonction du jeu (`deploy_functions` de `cd.yml`) et le bucket
`ucicle.com` où elle écrit `riders.json` et `secret_rider.json`. Le site les relit depuis
`GAME_DATA_ORIGIN`.

## Publication

À chaque push sur `master`, `.github/workflows/cd.yml` :

1. `build_server` construit les deux images depuis le même commit et les pousse avec les tags
   `sha-<7 caractères>` et `latest` ;
2. `deploy_server` dispatche `deploy-stack.yml` sur g3wis/infra (`stack=ucicle`,
   `tag=sha-<7>`). Ce workflow épingle le tag dans `stacks/ucicle/compose.yaml` (commit
   `deploy(ucicle): sha-…` sur `main`) et redéploie le stack seul.

Le seul secret de ce dépôt pour cela est `INFRA_DEPLOY_TOKEN` : un PAT fin limité à
`g3wis/infra`, permission *Actions: write*, rien d'autre. Sans lui, les images sont poussées et la
publication est sautée (avertissement dans le run).

Une nouvelle migration s'applique au redémarrage de `jobs` (`yarn migrate`), c'est-à-dire à chaque
publication.

**Retour arrière** (depuis un poste avec `gh`) :

```bash
gh workflow run deploy-stack.yml --repo g3wis/infra --ref main -f stack=ucicle -f tag=sha-<ancien>
```

Les migrations ne se défont pas : une image ancienne tourne sur un schéma plus récent. Si ce n'est
pas compatible, restaurer un `pg_dump` antérieur (runbook `restore-from-backup.md` de g3wis/infra).

## Les deux rôles de la base

- `ucicle` (propriétaire, celui de l'image postgres) : `jobs` s'en sert pour les migrations, la
  collecte et le calcul.
- `ucicle_web` (lecture seule, `default_transaction_read_only`) : celui de `web`. `yarn migrate`
  le crée ou le remet à jour après les migrations quand `WEB_DATABASE_PASSWORD` est fourni
  (`functions/src/db/webRole.ts`). Son mot de passe : 16 lettres et chiffres au moins.

## Séquence de nuit

Le conteneur `jobs` n'a pas de cron : une boucle shell (`deploy/jobs/scheduler.sh`) regarde l'heure
chaque minute, à l'heure de `TZ` (`Europe/Paris`). Chaque jour à `NIGHTLY_AT` (04:00), dans
l'ordre :

1. `yarn collect --recent 14` ;
2. le dimanche (`WEEKLY_DAY=7`), `yarn enrich:wikidata` ;
3. `yarn rate` (même si la collecte a échoué : il recalcule sur ce qui est en base).

Le site lit le nouvel index aussitôt : son ETag est la version de l'index, et aucun cache partagé
ne garde de pages (Traefik route directement vers `web`). Le navigateur garde une page 5 minutes.

Le jour de la dernière exécution est noté dans le volume `ucicle_jobs`
(`/data/scheduler/last-nightly`). Un conteneur arrêté à 04:00 rattrape la séquence à son
redémarrage le même jour. Une collecte lancée à la main pendant la nuit fait refuser celle de la
séquence (« still running ») ; `rate` tourne quand même.

Ces réglages sont écrits en clair dans `stacks/ucicle/compose.yaml` (g3wis/infra) : les changer
là, puis `just release ucicle` (sans tag : redéploie la version épinglée).

## Exploitation courante

Sur le serveur, dans le dossier du stack :

```bash
ssh ansible@cabigi.xyz
cd /opt/stacks/ucicle
docker compose ps
docker compose logs -f --tail 100 web
docker compose logs -f --tail 100 jobs      # planning et sorties de collect / rate / enrich
docker compose exec db psql -U ucicle -d ucicle -c "select id, kind, status, started_at, finished_at, errors from job_run order by id desc limit 10"
```

Lancer un job à la main :

```bash
docker compose exec jobs yarn collect --recent 14
docker compose exec jobs yarn rate
docker compose exec jobs yarn enrich:wikidata
docker compose exec jobs yarn rate --dry-run
```

Collecte complète (premier remplissage, ou recollecte de saisons entières ; reprenable, environ
1 h 15 pour 2019 à 2027) :

```bash
docker compose run -d --name ucicle-backfill jobs \
  yarn collect --seasons 2027,2026,2025,2024,2023,2022,2021,2020,2019
docker logs -f ucicle-backfill && docker rm ucicle-backfill
docker compose exec jobs yarn rate
```

`yarn calibrate` ne tourne pas sur le serveur : il demande jusqu'à 8 Go et `jobs` est limité à
3 Go. Calibrer et geler des paramètres se fait sur un poste de développement, puis passe par un
commit et une publication.

## Mémoire

La machine a 7,7 Go, dont environ 4,2 pris par les autres services. `yarn rate` culmine à
environ 540 Mo (mesuré en local le 2026-11-18) ; son tas Node est plafonné à 2 Go
(`functions/package.json`) et le conteneur `jobs` à 3 Go (`mem_limit`).

## Construire les images en local

```bash
docker build -f deploy/web.Dockerfile front
docker build -f deploy/jobs.Dockerfile --build-context scheduler=deploy/jobs functions
```

## Ce que fait le dépôt d'infrastructure

- TLS (Let's Encrypt par Traefik), redirection `ucicle.fr` → `www.ucicle.fr`, compression, HSTS ;
- les secrets (`env.vault` : les deux mots de passe de la base) ;
- les enregistrements DNS de `ucicle.fr` (Terraform) ;
- les sauvegardes restic chaque nuit à 03:30 : `pg_dump` de la base et le volume `ucicle_jobs`
  (archive brute DataRide, qui permet de recalculer sans DataRide) ;
- la sonde HTTP de `https://www.ucicle.fr`.

## Ce qui n'est pas automatisé

- La collecte complète initiale et toute recollecte d'une saison entière.
- `yarn calibrate` et le gel des paramètres de l'Index.
- La relecture des doublons de coureurs (`rider_review`).
- Une alerte si la séquence de nuit échoue (seulement les journaux et la table `job_run`).
- Le passage d'une version majeure de PostgreSQL (`pg_dump` / restauration).
- La fonction Scaleway du jeu et le bucket : inchangés, gérés par `deploy_functions`.
