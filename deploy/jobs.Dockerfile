# syntax=docker/dockerfile:1
# The data jobs of the Index (functions/: migrate, collect, rate, enrich:wikidata) and their schedule.
# Build context: functions/, plus the named context `scheduler` = deploy/jobs/ (the schedule script):
#   docker build -f deploy/jobs.Dockerfile --build-context scheduler=deploy/jobs functions
# Ignore file: deploy/jobs.Dockerfile.dockerignore (BuildKit reads it next to this file).
# The game's serverless function (functions/deploy.js, Scaleway) is not part of this image's schedule.

# Node major of functions/.nvmrc (the CD workflow passes it; keep this default in step with it).
ARG NODE_VERSION=26
# Yarn 1 (the lockfile is a yarn v1 lockfile); Node 25+ images ship neither yarn nor corepack.
ARG YARN_VERSION=1.22.22

FROM node:${NODE_VERSION}-alpine AS base
ARG YARN_VERSION
RUN npm install --global --no-fund --no-audit "yarn@${YARN_VERSION}" && npm cache clean --force
WORKDIR /app

# Full install (TypeScript) and build (tsc -> build/).
FROM base AS build
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY . .
RUN yarn build

FROM base AS prod-deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive --production && yarn cache clean

FROM base AS runtime
# tzdata: the schedule reads the wall clock in TZ (Europe/Paris).
RUN apk add --no-cache tzdata
ENV NODE_ENV=production \
    TZ=Europe/Paris \
    RAW_ARCHIVE_DIR=/data/raw
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# build/db/migrate.js reads ../../migrations/ (= /app/migrations).
COPY migrations ./migrations
COPY --from=scheduler scheduler.sh /usr/local/bin/ucicle-scheduler
# /data (raw DataRide archive, schedule state) and the signal directory shared with nginx belong to
# `node`, so that empty named volumes mounted there start owned by it.
RUN chmod 0755 /usr/local/bin/ucicle-scheduler \
 && mkdir -p /data/raw /data/scheduler /var/run/ucicle-signal \
 && chown -R node:node /data /var/run/ucicle-signal
USER node
CMD ["/usr/local/bin/ucicle-scheduler"]
