param(
  [string]$Csv = "",
  [string]$Prefix = "",
  [string]$EmailDomain = "",
  [switch]$Commit
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$backendDir = Join-Path $root "backend"
$python = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
  throw "backend/.venv not found. Run dev.ps1 once to create the venv."
}

$script = Join-Path $backendDir "delete_test_users.py"
$argsList = @()

if ($Csv) {
  if (-not (Test-Path $Csv)) {
    Write-Host "CSV not found: $Csv"
    $candidates = Get-ChildItem -Path $root -Filter "test-accounts-*.csv" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if ($candidates) {
      Write-Host "Available CSV files:" 
      $candidates | Select-Object -First 20 FullName, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host
    }
    throw "Provide an existing -Csv path, or use -Prefix and -EmailDomain."
  }
  $argsList += "--csv"
  $argsList += (Resolve-Path $Csv).Path
} else {
  if (-not $Prefix -or -not $EmailDomain) {
    throw "Provide -Csv or both -Prefix and -EmailDomain."
  }
  $argsList += "--prefix"
  $argsList += $Prefix
  $argsList += "--email-domain"
  $argsList += $EmailDomain
}

if ($Commit) {
  $argsList += "--commit"
}

& $python $script @argsList
