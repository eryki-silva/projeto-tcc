@echo off
setlocal
cd /d "%~dp0"
title Ancient - Dota Coach
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 24 LTS em https://nodejs.org e abra este arquivo novamente.
  pause
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>24||(major===24&&minor>=5)?0:1)"
if errorlevel 1 (
  echo Atualize o Node.js para 24.5 ou superior em https://nodejs.org.
  pause
  exit /b 1
)
echo A chave sera solicitada de forma oculta e usada somente nesta sessao.
echo Nao feche esta janela enquanto estiver usando o aplicativo.
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; if (-not $env:DOTA_OPENAI_API_KEY -and -not $env:OPENAI_API_KEY -and -not (Test-Path '.env')) { $secret=Read-Host 'Cole sua chave OpenAI e pressione Enter' -AsSecureString; $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret); try { $env:DOTA_OPENAI_API_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) } }; & node --env-file-if-exists=.env --use-env-proxy launch.mjs; exit $LASTEXITCODE"
if errorlevel 1 pause
