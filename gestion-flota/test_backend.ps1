$baseUrl = "https://saas-carcare-production.up.railway.app"

Write-Host "1. Testing Health Endpoint..."
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/auth/health" -Method Get
    Write-Host "✅ Health Check Passed: $($health.status) (Version: $($health.version))" -ForegroundColor Green
} catch {
    Write-Host "❌ Health Check Failed: $_" -ForegroundColor Red
    Write-Host "   NOTE: If this fails with 404, the new code hasn't been deployed yet."
}

Write-Host "`n2. Testing Admin Existence (using a known admin email or random)..."
# We can't easily valid admin existence without credentials, but we can try to register a conductor with a non-existent admin
$testEmail = "test_conductor_$(Get-Random)@test.com"
$payload = @{
    nombre = "Test Driver"
    email = $testEmail
    password = "password123"
    empresaEmail = "nonexistent_admin@test.com"
}

try {
    Invoke-RestMethod -Uri "$baseUrl/api/auth/register/conductor" -Method Post -Body ($payload | ConvertTo-Json) -ContentType "application/json"
} catch {
    $err = $_.Exception.Response
    if ($err.StatusCode -eq [System.Net.HttpStatusCode]::BadRequest) {
         Write-Host "✅ Backend Responded 400 (Expected for non-existent admin)" -ForegroundColor Green
    } else {
         Write-Host "⚠️ Backend Responded with unexpected status: $($err.StatusCode)" -ForegroundColor Yellow
         Write-Host "   Details: $($_.ErrorDetails.Message)"
    }
}
