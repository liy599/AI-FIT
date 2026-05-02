param(
  [switch]$BackendOnly,
  [switch]$FrontendOnly,
  [switch]$SkipDb
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
 $backendHealthUrl = 'http://127.0.0.1:5000/api/health'

if (-not (Test-Path $backendDir)) { throw "Backend directory not found: $backendDir" }
if (-not (Test-Path $frontendDir)) { throw "Frontend directory not found: $frontendDir" }

function Start-Db {
  if ($SkipDb) {
    Write-Host 'SkipDb enabled: skip docker compose db startup.'
    return
  }

  $dockerOk = $false
  try {
    $null = docker --version
    $null = docker compose version
    $dockerOk = $true
  } catch {
    throw 'Docker is required for PostgreSQL startup. Install/start Docker Desktop or use -SkipDb with an existing PostgreSQL service.'
  }

  if ($dockerOk) {
    # docker compose parses the whole file even when starting only `db`.
    # Provide safe local defaults for required interpolation vars if missing.
    if (-not $env:SECRET_KEY) { $env:SECRET_KEY = 'local-dev-secret-key-please-change-32chars' }
    if (-not $env:JWT_SECRET_KEY) { $env:JWT_SECRET_KEY = 'local-dev-jwt-secret-key-change-32chars' }
    if (-not $env:REDIS_URL) { $env:REDIS_URL = 'redis://redis:6379/0' }

    Write-Host 'Starting PostgreSQL container (docker compose up -d db)...'
    Set-Location -LiteralPath $repoRoot
    docker compose up -d db | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw 'Failed to start PostgreSQL container via docker compose.'
    }
  }
}

function Start-Backend {
  Ensure-BackendPortAvailable

  $backendCmd = @"
Set-Location -LiteralPath '$backendDir'
if (Test-Path '.\\.venv\\Scripts\\python.exe') {
  & '.\\.venv\\Scripts\\python.exe' '.\\run.py'
} else {
  python '.\\run.py'
}
"@
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $backendCmd)
  Wait-BackendHealthy
}

function Start-Frontend {
  $frontendCmd = @"
Set-Location -LiteralPath '$frontendDir'
npm.cmd run dev
"@
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $frontendCmd)
}

function Ensure-BackendPortAvailable {
  try {
    $listeners = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction Stop
  } catch {
    return
  }
  if (-not $listeners) { return }

  $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($ownerPid in $pids) {
    try {
      $proc = Get-Process -Id $ownerPid -ErrorAction Stop
    } catch {
      continue
    }
    if ($proc.ProcessName -notlike 'python*') {
      throw "Port 5000 is occupied by non-python process '$($proc.ProcessName)' (PID=$ownerPid). Stop it manually, then retry."
    }
    try {
      Stop-Process -Id $ownerPid -Force -ErrorAction Stop
      Write-Host "Stopped existing backend process on port 5000 (PID=$ownerPid)."
    } catch {
      throw "Failed to stop existing python process on port 5000 (PID=$ownerPid): $($_.Exception.Message)"
    }
  }
}

function Wait-BackendHealthy {
  $maxAttempts = 40
  for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri $backendHealthUrl -Method Get -TimeoutSec 2 -ErrorAction Stop
      if ($resp.StatusCode -eq 200 -and $resp.Content -match '"ok"\s*:\s*true') {
        Write-Host 'Backend health check passed.'
        return
      }
    } catch {
      # backend still starting
    }
  }
  throw "Backend health check failed at $backendHealthUrl within timeout."
}

if ($BackendOnly -and $FrontendOnly) {
  throw 'Cannot use -BackendOnly and -FrontendOnly together.'
}

Start-Db

if ($BackendOnly) {
  Start-Backend
  Write-Host 'Started backend only.'
  exit 0
}

if ($FrontendOnly) {
  Start-Frontend
  Write-Host 'Started frontend only.'
  exit 0
}

Start-Backend
Start-Sleep -Milliseconds 1000
Start-Frontend
Write-Host 'Started backend and frontend in separate PowerShell windows.'
