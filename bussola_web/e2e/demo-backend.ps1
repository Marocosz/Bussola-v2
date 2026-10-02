# Sobe a API do Bussola com um banco demo descartavel para os testes E2E.
# Usa variaveis de ambiente (tem precedencia sobre .env): nenhum segredo real.
# Python: $env:BUSSOLA_PY ou ..\bussola_api\venvbussola\Scripts\python.exe
$ErrorActionPreference = 'Stop'
$api = Resolve-Path (Join-Path $PSScriptRoot '..\..\bussola_api')
$py = if ($env:BUSSOLA_PY) { $env:BUSSOLA_PY } else { Join-Path $api 'venvbussola\Scripts\python.exe' }
if (-not (Test-Path $py)) { throw "Python nao encontrado em '$py'. Defina `$env:BUSSOLA_PY." }

$env:PROJECT_NAME = 'Bussola E2E'
$env:API_V1_STR = '/api/v1'
$env:DEPLOYMENT_MODE = 'SELF_HOSTED'
$env:ENABLE_PUBLIC_REGISTRATION = 'False'
$env:SECRET_KEY = 'e2e-only-secret-key-not-for-production-0000000000'
$env:ENCRYPTION_KEY = 'Yo8EA350JXTXrOlBcXiRufoPG6nRGnetlC6-FYqwaMw='   # chave Fernet so de teste
$env:ACCESS_TOKEN_EXPIRE_MINUTES = '1440'
$env:ALGORITHM = 'HS256'
$env:DATABASE_URL = 'sqlite:///./data/e2e_demo.db'
$env:REDIS_URL = 'redis://127.0.0.1:6399/0'   # inexistente de proposito: o app degrada sem Redis
foreach ($k in 'GROQ_API_KEY','GEMINI_API_KEY','OPENAI_API_KEY','OPENWEATHER_API_KEY','NEWS_API_KEY',
               'GOOGLE_CLIENT_ID','VITE_GOOGLE_CLIENT_ID','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET',
               'DISCORD_BOT_TOKEN','DISCORD_CLIENT_ID') { Set-Item "env:$k" 'dummy' }
$env:MAIL_USERNAME = 'e2e@example.com'; $env:MAIL_PASSWORD = 'dummy'; $env:MAIL_FROM = 'e2e@example.com'
$env:MAIL_PORT = '587'; $env:MAIL_SERVER = 'localhost'; $env:MAIL_FROM_NAME = 'E2E'
$env:MAIL_STARTTLS = 'False'; $env:MAIL_SSL_TLS = 'False'
$env:FRONTEND_URL = 'http://127.0.0.1:5173'
$env:BACKEND_CORS_ORIGINS = '["http://127.0.0.1:5173","http://localhost:5173"]'

Set-Location $api
New-Item -ItemType Directory -Force data | Out-Null
if (-not (Test-Path 'data\e2e_demo.db')) {
    & $py -c "import app.main" | Out-Null      # create_all das tabelas
    & $py scripts/create_user.py --email demo@bussola.dev --password 'Demo12345!'
    & $py scripts/populate_db.py
}
& $py -m uvicorn app.main:app --host 127.0.0.1 --port 8000
