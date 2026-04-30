param(
  [switch]$BackendOnly,
  [switch]$FrontendOnly,
  [switch]$SkipDb
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'

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
    Write-Host 'Starting PostgreSQL container (docker compose up -d db)...'
    Set-Location -LiteralPath $repoRoot
    docker compose up -d db | Out-Host
  }
}

function Start-Backend {
  $backendCmd = @"
Set-Location -LiteralPath '$backendDir'
if (Test-Path '.\\.venv\\Scripts\\python.exe') {
  & '.\\.venv\\Scripts\\python.exe' '.\\run.py'
} else {
  python '.\\run.py'
}
"@
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $backendCmd)
}

function Start-Frontend {
  $frontendCmd = @"
Set-Location -LiteralPath '$frontendDir'
npm.cmd run dev
"@
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $frontendCmd)
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
