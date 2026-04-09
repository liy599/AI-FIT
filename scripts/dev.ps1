$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

function Test-ExternalOk {
  param(
    [Parameter(Mandatory=$true)][string]$File,
    [Parameter(Mandatory=$false)][string[]]$Args
  )
  try {
    & $File @Args 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

$pythonForVenv = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
  $pythonForVenv = (Get-Command python).Source
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  $pythonForVenv = (Get-Command py).Source
} else {
  throw 'Python not found on PATH. Install Python 3.10+ and retry.'
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw 'npm.cmd not found on PATH. Install Node.js 18+ and retry.'
}

$backendEnv = Join-Path $backendDir ".env"
if (-not (Test-Path $backendEnv)) {
  Copy-Item (Join-Path $backendDir ".env.example") $backendEnv
}

$frontendEnv = Join-Path $frontendDir ".env"
if (-not (Test-Path $frontendEnv)) {
  Copy-Item (Join-Path $frontendDir ".env.example") $frontendEnv
}

$dockerAvailable = $false
if (Get-Command docker -ErrorAction SilentlyContinue) {
  if (Test-ExternalOk -File "docker" -Args @("info")) {
    $dockerAvailable = $true
  }
}

if ($dockerAvailable) {
  & docker compose up -d db
  if ($LASTEXITCODE -ne 0) {
    $dockerAvailable = $false
  } else {
    for ($i = 0; $i -lt 30; $i++) {
      if (Get-Command Test-NetConnection -ErrorAction SilentlyContinue) {
        try {
          if (Test-NetConnection -ComputerName "127.0.0.1" -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue) {
            break
          }
        } catch {
        }
      }
      Start-Sleep -Seconds 1
    }
  }
}

if (-not $dockerAvailable) {
  throw "Docker Desktop / Docker daemon is required for consistent local environment. Start Docker Desktop and retry."
}

$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
  & $pythonForVenv -m venv (Join-Path $backendDir ".venv")
}

& $venvPython -m pip install -r (Join-Path $backendDir "requirements.txt")

Push-Location $frontendDir
try {
  & npm.cmd install
} finally {
  Pop-Location
}

$backendCmd = "cd `"$backendDir`"; & `"$venvPython`" run.py"
$frontendCmd = "cd `"$frontendDir`"; & npm.cmd run dev"

Start-Process -FilePath "powershell" -ArgumentList @("-NoExit", "-Command", $backendCmd) | Out-Null
Start-Process -FilePath "powershell" -ArgumentList @("-NoExit", "-Command", $frontendCmd) | Out-Null

Write-Host "Database: Postgres (Docker)"
Write-Host "Backend: http://127.0.0.1:5000/api/health"
Write-Host "Frontend: http://localhost:5173"
