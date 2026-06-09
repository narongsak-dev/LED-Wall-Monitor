param(
    [string]$BoardIp = "10.88.1.160",
    [string]$Sketch = "firmware\pzem_mqtt"
)

# Over-the-air firmware upload via ArduinoOTA.
# Usage:
#   .\scripts\upload-ota.ps1                 # uses defaults (10.88.1.160, pzem_mqtt)
#   .\scripts\upload-ota.ps1 -BoardIp 10.88.1.170 -Sketch firmware\pzem_mqtt
#
# Prereq: board firmware v0.3.0+ already flashed once via USB so it has the
# ArduinoOTA listener running.

$cli = 'C:\Program Files\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'

Write-Host ('Uploading ' + $Sketch + ' -> ' + $BoardIp + ' via OTA...') -ForegroundColor Cyan
& $cli compile --upload --port $BoardIp --fqbn 'esp32:esp32:esp32:FlashSize=16M' $Sketch

if ($LASTEXITCODE -eq 0) {
    Write-Host 'OTA upload succeeded. Board will restart with new firmware.' -ForegroundColor Green
} else {
    Write-Host 'OTA upload failed. Common causes:' -ForegroundColor Red
    Write-Host '  - Board is offline (check Web UI: http://' + $BoardIp -ForegroundColor Yellow
    Write-Host '  - Board still running pre-OTA firmware (need one more USB flash)' -ForegroundColor Yellow
    Write-Host '  - Firewall blocking outbound to board' -ForegroundColor Yellow
}
