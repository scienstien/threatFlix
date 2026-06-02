$json = '{"projectId":"demo-project","event":"failed_login","user":"admin","ip":"192.168.1.5","service":"auth-service"}'
$headers = @{ "X-API-Key" = "demo-key" }

Write-Host "=== TEST 1: POST /events ==="
try {
    $result = Invoke-RestMethod -Uri http://localhost:8000/events -Method Post -Body $json -ContentType "application/json" -Headers $headers
    $result | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
}

Write-Host "`n=== TEST 2: POST /auth/login (admin) ==="
try {
    $loginBody = '{"email":"demo@threatflix.dev","password":"demo123"}'
    $loginResult = Invoke-RestMethod -Uri http://localhost:8000/auth/login -Method Post -Body $loginBody -ContentType "application/json"
    $loginResult | ConvertTo-Json -Depth 5
    $token = $loginResult.token
} catch {
    Write-Host "Error: $_"
}

Write-Host "`n=== TEST 3: GET /events/latest (with JWT) ==="
try {
    $authHeaders = @{ "Authorization" = "Bearer $token" }
    $events = Invoke-RestMethod -Uri "http://localhost:8000/events/latest?projectId=demo-project" -Headers $authHeaders
    $events | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
}

Write-Host "`n=== TEST 4: GET /alerts (with JWT) ==="
try {
    $alerts = Invoke-RestMethod -Uri "http://localhost:8000/alerts?projectId=demo-project" -Headers $authHeaders
    $alerts | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
}

Write-Host "`n=== TEST 5: GET /health ==="
try {
    $health = Invoke-RestMethod -Uri http://localhost:8000/health
    $health | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
}

Write-Host "`n=== TEST 6: POST /events without API key (should 401) ==="
try {
    Invoke-RestMethod -Uri http://localhost:8000/events -Method Post -Body $json -ContentType "application/json"
} catch {
    Write-Host "Got expected error: $($_.Exception.Response.StatusCode) - $($_.ErrorDetails.Message)"
}

Write-Host "`n=== TEST 7: GET /admin/stats (admin only) ==="
try {
    $stats = Invoke-RestMethod -Uri http://localhost:8000/admin/stats -Headers $authHeaders
    $stats | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_"
}
