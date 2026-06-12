$ErrorActionPreference = "Stop"
# Some developer shells expose both `Path` and `PATH`; Start-Process treats
# those as duplicate keys. Reinsert one canonical entry before launching.
$canonicalPath = $env:Path
Remove-Item Env:Path -ErrorAction SilentlyContinue
$env:Path = $canonicalPath
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:TEMP "threatflix-judge-demo"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Write-Host "Resetting the isolated judge-demo tenant..."
Push-Location (Join-Path $root "Backend")
bun run seed:judge-demo
Pop-Location

function Start-DemoProcess([string]$name, [string]$workingDirectory, [string]$command) {
  $stdout = Join-Path $logDir "$name.out.log"
  $stderr = Join-Path $logDir "$name.err.log"
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/d", "/c", $command `
    -WorkingDirectory $workingDirectory `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden | Out-Null
}

Start-DemoProcess "ml" (Join-Path $root "Backend\models\service") '.venv\Scripts\uvicorn.exe app:app --host 127.0.0.1 --port 8001'
Start-DemoProcess "backend" (Join-Path $root "Backend") 'set JWT_SECRET=judge-demo-secret&& set OLLAMA_MODEL=gemma3n:e2b&& set THREATFLIX_DEMO_DEFER_ANALYSIS=true&& bun run dev'
Start-DemoProcess "frontend" (Join-Path $root "FrontEnd") 'npm run dev -- --host 127.0.0.1 --port 5173'
Start-DemoProcess "northstar" $PSScriptRoot 'bun run dev'

Start-Sleep -Seconds 4
Write-Host ""
Write-Host "ThreatFlix judge demo is ready."
Write-Host "Northstar:    http://127.0.0.1:4100"
Write-Host "Integration:  http://127.0.0.1:5173/integration"
Write-Host "Case desk:    http://127.0.0.1:5173/dashboard"
Write-Host ""
Write-Host "ThreatFlix login: judge.demo@threatflix.local / JudgeDemo!2026"
Write-Host "SDK file:         $PSScriptRoot\\threatflix.ts"
Write-Host "Run attacks:      python attack_runner.py --scenario all"
Write-Host "LLM reports:      start Ollama separately if you want live interpretation"
Write-Host "Logs:             $logDir"
