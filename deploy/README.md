# Deploy — LED Wall Monitor

Bring the full stack up on an Ubuntu host without disturbing existing workloads.

## What you get

| Service | Image | Network exposure |
|---|---|---|
| postgres (TimescaleDB) | `timescale/timescaledb:latest-pg16` | internal only |
| redis | `redis:7-alpine` | internal only |
| emqx | `emqx/emqx:5.8` | MQTT **1883 + 8883** on `0.0.0.0`, dashboard on `127.0.0.1:18083` |
| backend (NestJS) | built from `backend/Dockerfile` | `127.0.0.1:3001` |
| frontend (Vite + nginx) | built from `frontend/Dockerfile` | `127.0.0.1:8081` |

All five live on a private bridge network `monitor-net`. The host's existing nginx fronts the frontend + backend through the config in [`nginx-monitor.conf`](nginx-monitor.conf).

## Why it won't break your existing services

- **No port collisions** — the only ports we publish to the host are 1883, 8883, and 127.0.0.1 loopback on 3001 / 8081 / 18083. Your `bfouroa` Next.js on 3000, MySQL on 3306, PHP on 8080, and nginx on 80 are all untouched.
- **Project-scoped compose** — every container, network, and volume is named `ledmonitor-*` thanks to `-p ledmonitor`. Nothing collides with other Docker projects on the same host.
- **Data lives in `./data/`** under this folder — a clean rollback is just `docker compose down -v && rm -rf data/`.
- **Memory caps per container** — Postgres ≤ 2 GB, EMQX ≤ 1 GB, backend ≤ 1 GB, redis ≤ 512 MB, frontend ≤ 256 MB. Total ≤ ~5 GB under load.

## First-time setup

```bash
# 1. Pull this repo to the server
cd /opt
sudo git clone https://github.com/.../LED-Wall-Monitor.git ledmonitor
sudo chown -R "$USER:$USER" ledmonitor
cd ledmonitor/deploy

# 2. Run the setup helper (installs Docker, prepares data dirs, drops in
#    the nginx site config, auto-generates secrets in .env)
bash setup-server.sh

# 3. Review the generated .env — at minimum confirm CORS_ORIGIN matches
#    the domain you'll serve from.
vim .env

# 4. Build images + start the stack
docker compose -p ledmonitor -f docker-compose.prod.yml up -d --build

# 5. Watch the backend come up (Prisma migrations + seed run here)
docker compose -p ledmonitor -f docker-compose.prod.yml logs -f backend
```

Open <http://monitor.dragontrusts.com> (or your custom domain). Default admin login is `admin / admin1234` — **change it immediately** from the Users page.

## Day-2 operations

### Update to a new release

```bash
cd /opt/ledmonitor
git pull
cd deploy
docker compose -p ledmonitor -f docker-compose.prod.yml up -d --build
```

Migrations run automatically on backend start.

### Backup data

```bash
# Stop the stack briefly so Postgres has a clean snapshot, OR use pg_dump live.
docker compose -p ledmonitor -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U monitor monitor | gzip > backup-$(date +%F).sql.gz

# emqx + redis persist alongside postgres in ./data/
sudo tar czf data-$(date +%F).tar.gz data/
```

### Restore

```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | \
  docker compose -p ledmonitor -f docker-compose.prod.yml exec -T postgres \
  psql -U monitor monitor
```

### Tail logs

```bash
docker compose -p ledmonitor -f docker-compose.prod.yml logs -f backend
docker compose -p ledmonitor -f docker-compose.prod.yml logs -f emqx
```

### Open a postgres shell

```bash
docker compose -p ledmonitor -f docker-compose.prod.yml exec postgres \
  psql -U monitor monitor
```

### Stop everything (data preserved)

```bash
docker compose -p ledmonitor -f docker-compose.prod.yml down
```

### Wipe everything (DESTRUCTIVE — full reset)

```bash
docker compose -p ledmonitor -f docker-compose.prod.yml down -v
sudo rm -rf data/
```

## TLS / public access

Once `monitor.dragontrusts.com` resolves to this host's public IP:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d monitor.dragontrusts.com
```

Certbot edits the nginx block in place and auto-renews via cron.

For the MQTT broker over TLS (board connections from the public internet):
- Open ports 8883 (and optionally 1883) on the firewall / router NAT
- Either reuse the certbot cert (mount `/etc/letsencrypt/...` into EMQX) or use a separate cert for the broker's hostname

## Moving from dev → prod server

The whole stack is portable:

```bash
# On dev server
docker compose -p ledmonitor -f docker-compose.prod.yml down
tar czf ledmonitor-data.tar.gz data/

# Copy + extract on prod server, then up
docker compose -p ledmonitor -f docker-compose.prod.yml up -d --build
```

Schemas, telemetry, sites, users — everything in `./data/` moves intact.

## Troubleshooting

**Backend keeps restarting** — almost always migrations failing because the schema in code is ahead of the DB. Check `docker compose logs backend` and run `npx prisma migrate deploy` manually inside the container if needed.

**MQTT connections refused** — confirm port 1883/8883 is open on the host firewall (`sudo ufw status` / `sudo iptables -L`) and on any upstream router NAT.

**Frontend shows blank page / 502** — host nginx isn't proxying. Run `sudo nginx -t && sudo systemctl reload nginx`, or check `docker compose ps frontend` is healthy.

**Want LAN-direct access (no nginx)** — edit `docker-compose.prod.yml`, change the frontend / backend port mappings from `127.0.0.1:...` to `0.0.0.0:...`, then `docker compose up -d`. Hit `http://<host-LAN-IP>:8081` directly.
