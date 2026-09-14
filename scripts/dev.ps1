param(
  [switch]$BackendOnly,
  [switch]$FrontendOnly,
  [switch]$SkipDb,
  [switch]$ResetDb,
  [switch]$UseSqlite
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$backendHealthUrl = 'http://127.0.0.1:5000/api/health'
$composeRedisUrl = 'redis://redis:6379/0'
$hostBackendRedisUrl = ''

if (-not (Test-Path $backendDir)) { throw "Backend directory not found: $backendDir" }
if (-not (Test-Path $frontendDir)) { throw "Frontend directory not found: $frontendDir" }

function Start-Db {
  if ($UseSqlite) {
    $sqlitePath = Join-Path $backendDir 'instance\aifitguard_dev.db'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $sqlitePath) | Out-Null
    $env:DATABASE_URL = "sqlite:///$($sqlitePath.Replace('\', '/'))"
    $env:DB_AUTO_INIT = '1'
    $env:REDIS_URL = ''
    $env:EMAIL_VERIFY_REQUIRED = '0'
    $env:PASSWORD_RESET_DEBUG_RETURN_LINK = '1'
    $env:EMAIL_VERIFY_DEBUG_RETURN_LINK = '1'
    Write-Host "UseSqlite enabled: using local SQLite database at $sqlitePath."
    return
  }

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
    $env:DB_AUTO_INIT = '1'
    $env:EMAIL_VERIFY_REQUIRED = '0'
    $env:PASSWORD_RESET_DEBUG_RETURN_LINK = '1'
    $env:EMAIL_VERIFY_DEBUG_RETURN_LINK = '1'
    # docker compose parses the whole file even when starting only `db`.
    # Provide safe local defaults for required interpolation vars if missing.
    if (-not $env:SECRET_KEY) { $env:SECRET_KEY = 'local-dev-secret-key-please-change-32chars' }
    if (-not $env:JWT_SECRET_KEY) { $env:JWT_SECRET_KEY = 'local-dev-jwt-secret-key-change-32chars' }
    if (-not $env:REDIS_URL) { $env:REDIS_URL = $composeRedisUrl }

    $backendEnvPath = Join-Path $backendDir '.env'
    if (-not (Test-Path $backendEnvPath)) {
      $envText = @(
        'APP_ENV=development'
        'DB_AUTO_INIT=1'
        'SECRET_KEY=local-dev-secret-key-please-change-32chars'
        'JWT_SECRET_KEY=local-dev-jwt-secret-key-change-32chars'
        'DATABASE_URL=postgresql+psycopg://aifitguard:aifitguard@localhost:5432/aifitguard'
        'REDIS_URL='
        'FRONTEND_BASE_URL=http://localhost:5173'
        'CORS_ORIGINS=http://localhost:5173'
        'ADMIN_EMAIL=dev@example.com'
      ) -join "`n"
      Set-Content -LiteralPath $backendEnvPath -Value $envText -Encoding utf8
      Write-Host "Created missing backend env file: $backendEnvPath"
    }

    Set-Location -LiteralPath $repoRoot
    if ($ResetDb) {
      Write-Host 'ResetDb enabled: stopping containers and removing volumes (docker compose down -v)...'
      docker compose down -v | Out-Host
      if ($LASTEXITCODE -ne 0) {
        throw 'Failed to reset docker compose volumes.'
      }
    }

    Write-Host 'Starting PostgreSQL and Redis containers (docker compose up -d db redis)...'
    Set-Location -LiteralPath $repoRoot
    docker compose up -d db redis | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw 'Failed to start PostgreSQL/Redis containers via docker compose.'
    }
    Wait-PostgresHealthy
    Wait-RedisHealthy
  }
}

function Start-Backend {
  Ensure-BackendPortAvailable

  $backendCmd = @"
Set-Location -LiteralPath '$backendDir'
`$env:REDIS_URL = '$hostBackendRedisUrl'
if (-not (Test-Path '.\\.venv\\Scripts\\python.exe')) {
  python -m venv .venv
  if (`$LASTEXITCODE -ne 0) { throw 'Failed to create backend virtualenv (.venv). Ensure Python is installed and on PATH.' }
  & '.\\.venv\\Scripts\\python.exe' -m pip install --upgrade pip
  & '.\\.venv\\Scripts\\python.exe' -m pip install -r '.\\requirements.txt'
  if (`$LASTEXITCODE -ne 0) { throw 'Failed to install backend dependencies (pip install -r requirements.txt).' }
}
if (Test-Path '.\\.venv\\Scripts\\python.exe') {
  & '.\\.venv\\Scripts\\python.exe' -m pip install -r '.\\requirements.txt'
  if (`$LASTEXITCODE -ne 0) { throw 'Failed to install backend dependencies (pip install -r requirements.txt).' }
  if (`$env:DB_AUTO_INIT -eq '0') {
    & '.\\.venv\\Scripts\\python.exe' -m flask --app wsgi db upgrade
    if (`$LASTEXITCODE -ne 0) { throw 'Database migration failed (flask db upgrade). Check DATABASE_URL and PostgreSQL status.' }
  } else {
    Write-Host 'DB_AUTO_INIT=1: skip historical migrations; the app will create the development schema.'
  }
  & '.\\.venv\\Scripts\\python.exe' '.\\run.py'
} else {
  python -m pip install -r '.\\requirements.txt'
  if (`$LASTEXITCODE -ne 0) { throw 'Failed to install backend dependencies (pip install -r requirements.txt).' }
  if (`$env:DB_AUTO_INIT -eq '0') {
    python -m flask --app wsgi db upgrade
    if (`$LASTEXITCODE -ne 0) { throw 'Database migration failed (flask db upgrade). Check DATABASE_URL and PostgreSQL status.' }
  } else {
    Write-Host 'DB_AUTO_INIT=1: skip historical migrations; the app will create the development schema.'
  }
  python '.\\run.py'
}
"@
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $backendCmd)
  Wait-BackendHealthy
}

function Wait-PostgresHealthy {
  $maxAttempts = 40
  for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $out = docker compose exec -T db pg_isready -U aifitguard -d aifitguard 2>$null
      if ($LASTEXITCODE -eq 0 -and $out -match 'accepting connections') {
        Write-Host 'PostgreSQL health check passed.'
        return
      }
    } catch {
      # db still starting
    }
  }
  throw 'PostgreSQL health check failed (pg_isready did not report accepting connections).'
}

function Wait-RedisHealthy {
  $maxAttempts = 40
  for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $null = docker compose exec -T redis redis-cli ping 2>$null
      if ($LASTEXITCODE -eq 0) {
        $pong = docker compose exec -T redis redis-cli ping
        if ($pong -match 'PONG') {
          Write-Host 'Redis health check passed.'
          return
        }
      }
    } catch {
      # redis still starting
    }
  }
  throw 'Redis health check failed (redis-cli ping did not return PONG).'
}

function Start-Frontend {
  $frontendCmd = @"
Set-Location -LiteralPath '$frontendDir'
try {
  `$null = node --version
  `$null = npm.cmd --version
} catch {
  throw 'Node.js (and npm) is required for frontend startup. Install Node.js 18+ and ensure it is on PATH.'
}

if (-not (Test-Path '.\\node_modules')) {
  if (Test-Path '.\\package-lock.json') {
    npm.cmd ci
  } else {
    npm.cmd install
  }
  if (`$LASTEXITCODE -ne 0) { throw 'Failed to install frontend dependencies.' }
}
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
