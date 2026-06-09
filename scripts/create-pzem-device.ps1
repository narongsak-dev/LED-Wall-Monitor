$ErrorActionPreference = 'Stop'

Write-Host '=== Login to backend ===' -ForegroundColor Cyan
$loginBody = @{ username = 'admin'; password = 'admin1234' } | ConvertTo-Json
$loginResp = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$token = $loginResp.accessToken
if (-not $token) { throw 'Login failed - no accessToken in response' }
Write-Host 'Login OK' -ForegroundColor Green

$headers = @{ 'Authorization' = 'Bearer ' + $token }

Write-Host '=== Find SITE-001 id ===' -ForegroundColor Cyan
$sitesResp = Invoke-RestMethod -Uri 'http://localhost:3000/api/sites' -Headers $headers
$siteWrapper = $sitesResp | Where-Object { $_.site.code -eq 'SITE-001' }
$site = $siteWrapper.site
if (-not $site) { throw 'SITE-001 not found - run seed first' }
Write-Host ('SITE-001 id=' + $site.id) -ForegroundColor Green

Write-Host '=== Create device PZEM-001 ===' -ForegroundColor Cyan
$deviceBody = @{
    siteId     = $site.id
    code       = 'PZEM-001'
    name       = 'PZEM-004T meter (HKL-EA8)'
    deviceType = 'power_meter'
    model      = 'PZEM-004T v3.0'
} | ConvertTo-Json

try {
    $device = Invoke-RestMethod -Uri 'http://localhost:3000/api/devices' -Method Post -Headers $headers -Body $deviceBody -ContentType 'application/json'
    Write-Host ('Device created: id=' + $device.id + ' code=' + $device.code) -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
        Write-Host 'Device PZEM-001 already exists - OK' -ForegroundColor Yellow
    } else {
        throw
    }
}

Write-Host '=== Done ===' -ForegroundColor Green
Write-Host 'Backend now accepts MQTT topic:'
Write-Host '  sites/SITE-001/devices/PZEM-001/telemetry'
