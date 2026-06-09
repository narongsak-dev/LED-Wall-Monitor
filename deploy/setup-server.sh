#!/usr/bin/env bash
# First-time setup for the LED Wall Monitor stack on an Ubuntu host.
#
# What this script does (and equally important, what it does NOT do):
#   ✓ Installs Docker Engine + compose plugin via the official apt repo
#   ✓ Adds the current user to the `docker` group
#   ✓ Creates the persistent-data directories under ./data/
#   ✓ Generates a starter `.env` from `.env.example` if one is missing
#   ✓ Installs the nginx server block (asks before overwriting)
#   ✗ Does NOT touch the existing `bfouroa` nginx site
#   ✗ Does NOT bring containers up — run that yourself after reviewing .env
#
# Re-runnable: every step is guarded by a check, so it's safe to invoke this
# script multiple times.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

say()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

# ─── 1. Docker install ─────────────────────────────────────────────
if command -v docker >/dev/null 2>&1; then
  ok "Docker already installed ($(docker --version))"
else
  say "Installing Docker Engine from docker.com apt repo..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
                          docker-buildx-plugin docker-compose-plugin
  ok "Docker installed: $(docker --version)"
fi

# ─── 2. Docker group ───────────────────────────────────────────────
if id -nG "$USER" | grep -qw docker; then
  ok "User $USER is in the docker group"
else
  say "Adding $USER to the docker group..."
  sudo usermod -aG docker "$USER"
  warn "You must log out and back in (or run \`newgrp docker\`) before the
       \`docker\` command works without sudo."
fi

# ─── 3. Data directories ───────────────────────────────────────────
say "Creating ./data subdirectories..."
mkdir -p data/postgres data/redis data/emqx data/emqx-log
ok "data/ ready"

# ─── 4. .env bootstrap ─────────────────────────────────────────────
if [[ -f .env ]]; then
  ok ".env already exists — not touching it"
else
  say "Creating .env from .env.example with auto-generated secrets..."
  cp .env.example .env
  # Replace CHANGE_ME placeholders with random hex strings (32 bytes = 64 hex).
  rand() { openssl rand -hex 32; }
  sed -i "s|CHANGE_ME_pg_strong_password|$(rand)|" .env
  sed -i "s|CHANGE_ME_emqx_dashboard|$(rand)|" .env
  # The "..._different" placeholder must be replaced first because the
  # shorter "CHANGE_ME_64_hex_chars" prefix would otherwise match both.
  sed -i "s|CHANGE_ME_64_hex_chars_different|$(rand)|" .env
  sed -i "s|CHANGE_ME_64_hex_chars|$(rand)|" .env
  chmod 600 .env
  ok ".env written (mode 0600). Edit CORS_ORIGIN + domain before going public."
fi

# ─── 5. nginx site config ──────────────────────────────────────────
NGINX_TARGET=/etc/nginx/sites-available/monitor
NGINX_LINK=/etc/nginx/sites-enabled/monitor
if command -v nginx >/dev/null 2>&1; then
  if [[ -f "$NGINX_TARGET" ]]; then
    warn "nginx-monitor.conf already at $NGINX_TARGET — skipping (edit manually if needed)"
  else
    say "Installing nginx-monitor.conf to $NGINX_TARGET..."
    sudo cp nginx-monitor.conf "$NGINX_TARGET"
    [[ -L "$NGINX_LINK" ]] || sudo ln -s "$NGINX_TARGET" "$NGINX_LINK"
    if sudo nginx -t; then
      sudo systemctl reload nginx
      ok "nginx config installed + reloaded"
    else
      warn "nginx -t failed. Check $NGINX_TARGET and \`sudo nginx -t\`."
    fi
  fi
else
  warn "nginx is not installed on this host. The frontend container is bound
       to 127.0.0.1:8081 and the backend to 127.0.0.1:3001; install nginx or
       edit deploy/docker-compose.prod.yml to publish on 0.0.0.0 for direct
       LAN access."
fi

# ─── 6. Next steps ─────────────────────────────────────────────────
cat <<EOF

$(printf '\033[1;36m')╔════════════════════════════════════════════════════════════╗
║              SETUP COMPLETE — next steps                   ║
╚════════════════════════════════════════════════════════════╝$(printf '\033[0m')

1. Review the secrets and domain in $(pwd)/.env :
     vim .env

2. Pull base images + build app images:
     docker compose -p ledmonitor -f docker-compose.prod.yml build

3. Bring the stack up:
     docker compose -p ledmonitor -f docker-compose.prod.yml up -d

4. Watch logs while the backend runs Prisma migrations and the seed:
     docker compose -p ledmonitor -f docker-compose.prod.yml logs -f backend

5. (Optional) Generate the TLS cert once your domain DNS resolves to
   this host's public IP:
     sudo certbot --nginx -d monitor.dragontrusts.com

6. Login at http://monitor.dragontrusts.com/   (default: admin / admin1234)
   Change the password from the Users page immediately.

To stop the stack:
     docker compose -p ledmonitor -f docker-compose.prod.yml down

To wipe ALL data (DESTRUCTIVE — full reset):
     docker compose -p ledmonitor -f docker-compose.prod.yml down -v
     rm -rf data/

EOF
