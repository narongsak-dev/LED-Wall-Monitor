# syntax=docker/dockerfile:1.6
#
# Multi-stage build for the React + Vite frontend. Built from the repo root
# so the `@monitor/shared` workspace can be compiled in the same stage.
#
#   docker build -f frontend/Dockerfile -t ledmonitor-frontend .

# ─── Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --workspaces --include-workspace-root --no-audit --no-fund

COPY shared ./shared
COPY frontend ./frontend

# Vite reads VITE_API_URL at build time (baked into the bundle) — see
# frontend/src/lib/axios.ts. The compose file passes it through via
# --build-arg. Leave empty in prod so axios uses same-origin relative URLs;
# the SPA's nginx proxies /api and /socket.io back to the backend.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

# Strip the committed dev .env so Vite doesn't bake "http://localhost:3000"
# into the production bundle. Vite walks the source tree at build time and
# picks up any `.env*` file it finds.
RUN rm -f /app/frontend/.env /app/frontend/.env.local /app/frontend/.env.development

RUN npm run build --workspace @monitor/shared && \
    npm run build --workspace @monitor/frontend

# ─── Runner ─────────────────────────────────────────────────────────
# Tiny nginx image serving the static SPA + proxying /api and /socket.io
# back to the backend container on the docker network.
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
