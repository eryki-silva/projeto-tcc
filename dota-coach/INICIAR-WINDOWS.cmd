@echo off
setlocal
cd /d "%~dp0"
title Ancient - Dota Coach
rem Procura uma versao compativel no PATH e nos locais comuns de instalacao.
rem O Explorer pode manter um PATH antigo depois que o Node e instalado.
set "DOTA_NODE_EXEC="
for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do call :try_node "%%N"
call :try_node "%ProgramFiles%\nodejs\node.exe"
call :try_node "%ProgramW6432%\nodejs\node.exe"
call :try_node "%LOCALAPPDATA%\Programs\nodejs\node.exe"
call :try_node "%LOCALAPPDATA%\nodejs\node.exe"
call :try_node "%NVM_SYMLINK%\node.exe"
call :try_node "%VOLTA_HOME%\bin\node.exe"
call :try_node "%LOCALAPPDATA%\Volta\bin\node.exe"
if not defined DOTA_NODE_EXEC goto :node_missing
echo Node encontrado em: "%DOTA_NODE_EXEC%"
"%DOTA_NODE_EXEC%" --version
echo A chave sera solicitada de forma oculta e usada somente nesta sessao.
echo Nao feche esta janela enquanto estiver usando o aplicativo.
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; if (-not $env:DOTA_OPENAI_API_KEY -and -not $env:OPENAI_API_KEY -and -not (Test-Path '.env')) { $secret=Read-Host 'Cole sua chave OpenAI e pressione Enter' -AsSecureString; $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret); try { $env:DOTA_OPENAI_API_KEY=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) } }; & $env:DOTA_NODE_EXEC --env-file-if-exists=.env --use-env-proxy launch.mjs; exit $LASTEXITCODE"
if errorlevel 1 pause
exit /b

:try_node
if defined DOTA_NODE_EXEC exit /b
if not exist "%~1" exit /b
"%~1" -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>24||(major===24&&minor>=5)?0:1)" >nul 2>nul
if errorlevel 1 exit /b
set "DOTA_NODE_EXEC=%~1"
exit /b

:node_missing
echo Nao encontrei Node.js 24.5 ou superior nas instalacoes verificadas.
echo Se ele ja esta instalado, nao precisa reinstalar agora.
echo Abra um novo PowerShell e execute: node -v
echo Depois execute: where.exe node
echo Envie essas duas saidas para identificar sua instalacao.
pause
exit /b 1
