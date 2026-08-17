[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

$endpoints = @(
  @{ Name = "Diagnostic"; Method = "GET"; Path = "/api/db-diagnostic"; Body = $null },
  @{ Name = "Admin Login"; Method = "POST"; Path = "/api/auth/login"; Body = @{ email = "fahadriazcs@gmail.com"; password = "Fahad@6599" } },
  @{ Name = "Heartbeat"; Method = "POST"; Path = "/api/auth/heartbeat"; Body = @{} },
  @{ Name = "Auth Me"; Method = "GET"; Path = "/api/auth/me"; Body = $null },
  @{ Name = "Users List"; Method = "GET"; Path = "/api/users"; Body = $null },
  @{ Name = "Admin Dashboard"; Method = "GET"; Path = "/api/dashboard/admin"; Body = $null },
  @{ Name = "Team Leader Dashboard"; Method = "GET"; Path = "/api/dashboard/team-leader"; Body = $null },
  @{ Name = "Caller Dashboard"; Method = "GET"; Path = "/api/dashboard/caller"; Body = $null },
  @{ Name = "Lead Queue"; Method = "GET"; Path = "/api/leads/manage"; Body = $null },
  @{ Name = "Lead Batches"; Method = "GET"; Path = "/api/leads/batches"; Body = $null },
  @{ Name = "Visibility Audit"; Method = "GET"; Path = "/api/admin/diagnostic/visibility"; Body = $null },
  @{ Name = "Call Logs"; Method = "GET"; Path = "/api/call-logs"; Body = $null },
  @{ Name = "Callback Notifications"; Method = "GET"; Path = "/api/notifications/callbacks"; Body = $null },
  @{ Name = "Industries"; Method = "GET"; Path = "/api/industries"; Body = $null },
  @{ Name = "Audit Logs"; Method = "GET"; Path = "/api/audit-logs"; Body = $null },
  @{ Name = "Concurrency Test"; Method = "POST"; Path = "/api/concurrency-test"; Body = @{} },
  @{ Name = "CSV Export"; Method = "GET"; Path = "/api/export/csv"; Body = $null }
)

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "🚀 EXECUTING COMPLETE PRODUCTION API VERIFICATION ON VERCEL" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan

$token = ""
$userId = "usr_admin"

foreach ($ep in $endpoints) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $headers = @{ "x-user-id" = $userId }
    if ($token) { $headers["x-session-token"] = $token; $headers["Authorization"] = "Bearer $token" }
    
    $params = @{
      Uri = "https://safer-solution-crm-nine.vercel.app$($ep.Path)"
      Method = $ep.Method
      Headers = $headers
      UseBasicParsing = $true
      TimeoutSec = 10
    }
    if ($ep.Body) {
      $params["Body"] = ($ep.Body | ConvertTo-Json)
      $params["ContentType"] = "application/json"
    }

    $res = Invoke-RestMethod @params
    $sw.Stop()

    if ($ep.Name -eq "Admin Login" -and $res.token) {
      $token = $res.token
      $userId = $res.id
    }

    Write-Host "  ✅ [200 OK] $($ep.Name) ($($sw.ElapsedMilliseconds)ms)" -ForegroundColor Green
  } catch {
    $sw.Stop()
    Write-Host "  ❌ [FAIL] $($ep.Name) - $($_.Exception.Message) ($($sw.ElapsedMilliseconds)ms)" -ForegroundColor Red
  }
}

Write-Host "===============================================================" -ForegroundColor Cyan
