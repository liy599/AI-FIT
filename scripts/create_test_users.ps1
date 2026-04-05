param(
  [string]$BaseUrl = "http://127.0.0.1:5000",
  [int]$Count = 5,
  [string]$Prefix = "test",
  [string]$EmailDomain = "example.com",
  [string]$Password = "",
  [string]$OutFile = "",
  [switch]$FailOnError
)

$ErrorActionPreference = "Stop"

function New-RandomPassword {
  param([int]$Length = 16)

  $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^*-_+"
  $bytes = New-Object byte[] $Length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $sb = New-Object System.Text.StringBuilder
  foreach ($b in $bytes) {
    $null = $sb.Append($chars[$b % $chars.Length])
  }
  $sb.ToString()
}

function New-JsonBody {
  param(
    [Parameter(Mandatory = $true)][string]$Email,
    [Parameter(Mandatory = $true)][string]$Username,
    [Parameter(Mandatory = $true)][string]$UserPassword
  )
  (@{ email = $Email; username = $Username; password = $UserPassword } | ConvertTo-Json -Compress)
}

$BaseUrl = ($BaseUrl -replace '`', '').Trim()
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

if (-not $OutFile) {
  $OutFile = Join-Path (Get-Location) ("test-accounts-{0}.csv" -f $timestamp)
}

$results = New-Object System.Collections.Generic.List[object]

$registerUrl = ($BaseUrl.TrimEnd("/")) + "/api/auth/register"
$loginUrl = ($BaseUrl.TrimEnd("/")) + "/api/auth/login"

for ($i = 1; $i -le $Count; $i++) {
  $suffix = "{0}{1:00}" -f $timestamp, $i
  $email = "{0}+{1}@{2}" -f $Prefix, $suffix, $EmailDomain
  $username = "{0}{1}" -f $Prefix, $suffix
  $pw = if ($Password) { $Password } else { New-RandomPassword }

  $body = New-JsonBody -Email $email -Username $username -UserPassword $pw

  try {
    $resp = Invoke-RestMethod $registerUrl -Method Post -ContentType "application/json" -Body $body

    $loginOk = $false
    try {
      $loginBody = (@{ email = $email; password = $pw } | ConvertTo-Json -Compress)
      $null = Invoke-RestMethod $loginUrl -Method Post -ContentType "application/json" -Body $loginBody
      $loginOk = $true
    } catch {
      $loginOk = $false
    }

    $results.Add([pscustomobject]@{
      email = $email
      username = $username
      password = $pw
      user_id = $resp.user.id
      register_ok = $true
      login_ok = $loginOk
      error = ""
    }) | Out-Null
  } catch {
    $msg = $_.Exception.Message
    $results.Add([pscustomobject]@{
      email = $email
      username = $username
      password = $pw
      user_id = ""
      register_ok = $false
      login_ok = $false
      error = $msg
    }) | Out-Null
  }
}

$results | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $OutFile

"Created accounts: $($results.Count)"
"Saved to: $OutFile"
$results | Format-Table -AutoSize

if ($FailOnError) {
  $bad = $results | Where-Object { $_.register_ok -ne $true -or $_.login_ok -ne $true }
  if ($bad.Count -gt 0) {
    exit 1
  }
}
