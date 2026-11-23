# syntax=docker/dockerfile:1
# The website (Astro SSR, @astrojs/node standalone). Build context: front/
#   docker build -f deploy/web.Dockerfile front
# Ignore file: deploy/web.Dockerfile.dockerignore (BuildKit reads it next to this file).

# Node major of front/.nvmrc (the CD workflow passes it; keep this default in step with it).
ARG NODE_VERSION=26
# Yarn 1 (the lockfile is a yarn v1 lockfile); Node 25+ images ship neither yarn nor corepack.
ARG YARN_VERSION=1.22.22

FROM node:${NODE_VERSION}-alpine AS base
ARG YARN_VERSION
RUN npm install --global --no-fund --no-audit "yarn@${YARN_VERSION}" && npm cache clean --force
WORKDIR /app

# Full install (dev dependencies included) and build.
FROM base AS build
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY . .
RUN yarn build

# Production dependencies only: the server bundle imports them at run time.
FROM base AS prod-deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive --production && yarn cache clean

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321
WORKDIR /app
# Root-owned and read-only for the process: it writes nothing to disk.
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
