# fix_build_tools.ps1

Write-Host "Setting up Electron Build Tools (Bypassing SSL checks)..." -ForegroundColor Cyan

# 1. Force PowerShell to ignore SSL Errors
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

# 2. Define Cache Paths
$BaseCache = "$env:LOCALAPPDATA\electron-builder\Cache"
$WinCodeSignDir = "$BaseCache\winCodeSign"
$NsisDir = "$BaseCache\nsis"

# Create Directories
New-Item -ItemType Directory -Force -Path $WinCodeSignDir | Out-Null
New-Item -ItemType Directory -Force -Path $NsisDir | Out-Null

# 3. Download WinCodeSign
$WinCodeSignUrl = "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z"
$WinCodeSignPath = "$WinCodeSignDir\winCodeSign-2.6.0.7z"

if (-Not (Test-Path $WinCodeSignPath)) {
    Write-Host "Downloading WinCodeSign (2.6.0)..." -ForegroundColor Yellow
    try {
        (New-Object System.Net.WebClient).DownloadFile($WinCodeSignUrl, $WinCodeSignPath)
        Write-Host "Success!" -ForegroundColor Green
    } catch {
        Write-Error "Failed to download WinCodeSign: $_"
    }
} else {
    Write-Host "WinCodeSign already exists." -ForegroundColor Gray
}

# 4. Download NSIS
$NsisUrl = "https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z"
$NsisPath = "$NsisDir\nsis-3.0.4.1.7z"

if (-Not (Test-Path $NsisPath)) {
    Write-Host "Downloading NSIS (3.0.4.1)..." -ForegroundColor Yellow
    try {
        (New-Object System.Net.WebClient).DownloadFile($NsisUrl, $NsisPath)
        Write-Host "Success!" -ForegroundColor Green
    } catch {
        Write-Error "Failed to download NSIS: $_"
    }
} else {
    Write-Host "NSIS already exists." -ForegroundColor Gray
}

Write-Host "------------------------------------------------"
Write-Host "All tools downloaded. Now try running 'npm run build'" -ForegroundColor Cyan
