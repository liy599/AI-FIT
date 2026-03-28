$base = "http://127.0.0.1:5000"

$health = Invoke-RestMethod "$base/api/health"
"HEALTH: $($health.ok)"

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "demo+$suffix@example.com"
$username = "demo$suffix"

$reg = Invoke-RestMethod "$base/api/auth/register" -Method Post -ContentType "application/json" -Body (@{
  email = $email
  username = $username
  password = "pass1234"
} | ConvertTo-Json)

$token = $reg.access_token
"REGISTER: user=$($reg.user.username) token_len=$($token.Length)"

$me = Invoke-RestMethod "$base/api/auth/me" -Headers @{ Authorization = "Bearer $token" }
"ME: $($me.email)"

$fbJson = (@{
  type = "review"
  content = "Demo feedback"
  rating = 5
  contact_email = $email
} | ConvertTo-Json -Compress)

$fb = Invoke-RestMethod "$base/api/feedback" -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($fbJson))
"FEEDBACK: ok=$($fb.ok)"

