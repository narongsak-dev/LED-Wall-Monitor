# syntax=docker/dockerfile:1.6
#
# Multi-stage build for the NestJS backend. Built from the repo root so the
# `@monitor/shared` workspace can be compiled in the same stage and consumed
# by the backend without publishing a separate package.
#
#   docker build -f backend/Dockerfile -t ledmonitor-backend .

# ─── Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# 1. Install dependencies (workspace-aware). The lockfile + workspace
#    manifests are copied first so this layer caches as long as deps
#    don't change.
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --workspaces --include-workspace-root --no-audit --no-fund

# 2. Copy sources we actually need to compile.
COPY shared ./shared
COPY backend ./backend

# 3. Build the shared package, then generate Prisma client + compile backend.
RUN npm run build --workspace @monitor/shared && \
    cd backend && npx prisma generate && npm run build

# ─── Runner ─────────────────────────────────────────────────────────
# Slim production image — just node_modules + dist + prisma artifacts.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Tools for the entrypoint: openssl is needed by Prisma's binary engine.
RUN apk add --no-cache openssl

# Copy production-ready artifacts only. With npm workspaces, dependencies
# are hoisted to /app/node_modules; the backend's per-workspace folder is
# usually empty (or only holds Prisma's generated client). We copy what's
# present in shared + backend separately.
COPY --from=builder /app/node_modules        ./node_modules
COPY --from=builder /app/shared/dist         ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/backend/dist        ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/prisma      ./backend/prisma

WORKDIR /app/backend
EXPOSE 3000

# Run migrations then start the server. Migrations are idempotent so it's safe
# to rerun on every restart — they only apply when the schema version changes.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
