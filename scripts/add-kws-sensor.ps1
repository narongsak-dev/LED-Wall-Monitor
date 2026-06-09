$ErrorActionPreference = 'Stop'

$login = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method Post -Body (@{username='admin';password='admin1234'} | ConvertTo-Json) -ContentType 'application/json'
$headers = @{ 'Authorization' = 'Bearer ' + $login.accessToken }
Write-Host 'Login OK' -ForegroundColor Green

$boards = Invoke-RestMethod -Uri 'http://localhost:3000/api/boards' -Headers $headers
$board = $boards | Where-Object { $_.code -eq 'BOARD-001' }
if (-not $board) { throw 'BOARD-001 not found' }
Write-Host ('BOARD-001 id=' + $board.id) -ForegroundColor Green

$body = @{
    boardId    = $board.id
    code       = 'KWS-001'
    name       = 'KWS-AC301L on RS485'
    sensorType = 'power_meter'
    model      = 'KWS-AC301L'
    channel    = 'rs485'
} | ConvertTo-Json

try {
    $sensor = Invoke-RestMethod -Uri 'http://localhost:3000/api/sensors' -Method Post -Headers $headers -Body $body -ContentType 'application/json'
    Write-Host ('Sensor created: id=' + $sensor.id + ' code=' + $sensor.code) -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
        Write-Host 'KWS-001 already exists - OK' -ForegroundColor Yellow
    } else { throw }
}
