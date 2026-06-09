$ErrorActionPreference = 'Stop'

Write-Host '=== Step 1: Kill any backend on port 3000 ===' -ForegroundColor Cyan
$p = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($p) {
    Stop-Process -Id $p -Force
    Start-Sleep -Seconds 2
    Write-Host ('Killed PID ' + $p)
} else {
    Write-Host 'Port 3000 free'
}

Write-Host '=== Step 2: Reset Postgres volume (drops all DB data) ===' -ForegroundColor Cyan
docker compose down -v
docker compose up -d
Write-Host 'Waiting 10s for Postgres to initialize...'
Start-Sleep -Seconds 10

Write-Host '=== Step 3: Clean caches ===' -ForegroundColor Cyan
Remove-Item -Recurse -Force backend\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force shared\dist -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -Filter '*.tsbuildinfo' -ErrorAction SilentlyContinue | Remove-Item -Force
Remove-Item -Recurse -Force backend\prisma\migrations\20* -ErrorAction SilentlyContinue
Write-Host 'Clean done'

Write-Host '=== Step 4: Build shared workspace ===' -ForegroundColor Cyan
npm --workspace shared run build
if ($LASTEXITCODE -ne 0) { throw 'shared build failed' }

Write-Host '=== Step 5: Prisma generate ===' -ForegroundColor Cyan
npm --workspace backend run prisma:generate
if ($LASTEXITCODE -ne 0) { throw 'prisma generate failed' }

Write-Host '=== Step 6: Prisma migrate (creates new tables) ===' -ForegroundColor Cyan
npm --workspace backend run prisma:migrate
if ($LASTEXITCODE -ne 0) { throw 'prisma migrate failed' }

Write-Host '=== Step 7: TimescaleDB hypertable ===' -ForegroundColor Cyan
Get-Content backend\prisma\migrations\timescale-init.sql | docker exec -i monitor-postgres psql -U monitor -d monitor
if ($LASTEXITCODE -ne 0) { throw 'timescale init failed' }

Write-Host '=== Step 8: Seed (creates admin + SITE-001 + BOARD-001 + PZEM-001) ===' -ForegroundColor Cyan
npm --workspace backend run prisma:seed
if ($LASTEXITCODE -ne 0) { throw 'prisma seed failed' }

Write-Host '=== Step 9: Build backend ===' -ForegroundColor Cyan
npm --workspace backend run build
if ($LASTEXITCODE -ne 0) { throw 'backend build failed' }

Write-Host '=== All done ===' -ForegroundColor Green
Write-Host 'Login: admin / admin1234'
Write-Host 'Next: npm --workspace backend run start:dev'
