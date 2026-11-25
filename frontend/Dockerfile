# syntax=docker/dockerfile:1

# Frontend image. The build context is the repository root, not frontend/: the
# production build reads pnpm-lock.yaml, pnpm-workspace.yaml and
# design/prototype/assets/tokens.css, all of which sit outside frontend/
# (system-design component list, this file's row; frontend-skeleton design D8).
# Two stages, so the served image carries only the static output - no Node, no
# node_modules, no Playwright (system-design D6).

# --- builder: install the locked workspace dependencies and build dist/ -------
FROM node:22-alpine AS builder

# pnpm comes from the packageManager field through Corepack, and the prompt is
# turned off so the build is not interactive. Never npm install (Hard Rule 3).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true

RUN corepack enable pnpm

WORKDIR /src

# Every workspace package's manifest has to be in place before the install: with
# one missing, the lockfile's importers no longer match the workspace and
# --frozen-lockfile fails instead of installing (system-design component list).
# pnpm-workspace.yaml lists frontend and e2e, so that is root + two.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY e2e/package.json ./e2e/

# --frozen-lockfile fails instead of rewriting pnpm-lock.yaml. `frontend...`
# resolves to the frontend package plus its workspace dependencies, so e2e's
# @playwright/test is never downloaded into this stage.
RUN pnpm install --frozen-lockfile --filter frontend...

# The extract-tokens Vite plugin resolves the token file relative to
# frontend/build/, so the repository layout is reproduced here; without it the
# build fails loudly (frontend-skeleton design D8).
COPY design/prototype/assets ./design/prototype/assets
COPY frontend ./frontend

# Empty by default: this image's own nginx serves the API from the same origin,
# so the browser calls relative paths and readApiConfig accepts the empty value
# (system-design D6). Declared after the copies above so overriding it does not
# invalidate the install layer.
# The Content-Security-Policy in frontend/nginx.conf allows API calls to the
# same origin only (connect-src 'self'). Setting a cross-origin URL here means
# adding that origin to connect-src, and to the expected value in
# scripts/check-security-headers.sh, in the same change; otherwise the browser
# blocks every API call (#568 system-design D7).
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm --filter frontend build

# --- runtime: nginx serves the build output and is the only public entrypoint -
FROM nginx:alpine AS runtime

# One server block, dropped into the include directory the base image already
# scans; it replaces the image's own default.conf.
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /src/frontend/dist /usr/share/nginx/html

EXPOSE 80

# The base image's entrypoint and CMD are kept as they are: it renders
# /etc/nginx/templates and then runs nginx in the foreground.
