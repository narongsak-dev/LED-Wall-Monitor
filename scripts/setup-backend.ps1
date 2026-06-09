$ErrorActionPreference = 'Stop'

Write-Host '=== Step 1: Check Docker services ===' -ForegroundColor Cyan
docker compose ps

Write-Host '=== Step 2: Wait for EMQX (max 60s) ===' -ForegroundColor Cyan
$timeout = 60
$elapsed = 0
$status = ''
while ($elapsed -lt $timeout) {
    $status = docker inspect --format '{{.State.Health.Status}}' monitor-emqx 2>$null
    if ($status -eq 'healthy') {
        Write-Host 'EMQX healthy' -ForegroundColor Green
        break
    }
    Write-Host ('  EMQX status: ' + $status)
    Start-Sleep -Seconds 3
    $elapsed = $elapsed + 3
}

Write-Host '=== Step 3: npm install ===' -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }

Write-Host '=== Step 4: Prisma generate ===' -ForegroundColor Cyan
npm --workspace backend run prisma:generate
if ($LASTEXITCODE -ne 0) { throw 'prisma generate failed' }

Write-Host '=== Step 5: Prisma migrate ===' -ForegroundColor Cyan
Write-Host 'If prompted for migration name type init and press Enter' -ForegroundColor Yellow
npm --workspace backend run prisma:migrate
if ($LASTEXITCODE -ne 0) { throw 'prisma migrate failed' }

Write-Host '=== Step 6: TimescaleDB hypertable ===' -ForegroundColor Cyan
Get-Content backend\prisma\migrations\timescale-init.sql | docker exec -i monitor-postgres psql -U monitor -d monitor
if ($LASTEXITCODE -ne 0) { throw 'timescale init failed' }

Write-Host '=== Step 7: Seed database ===' -ForegroundColor Cyan
npm --workspace backend run prisma:seed
if ($LASTEXITCODE -ne 0) { throw 'prisma seed failed' }

Write-Host '=== Setup complete ===' -ForegroundColor Green
Write-Host 'Login: admin / admin1234'
Write-Host 'Next: npm run dev'
