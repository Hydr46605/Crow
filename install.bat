@echo off
setlocal
REM Crow installer (cmd.exe).
REM
REM   curl -o install.bat https://raw.githubusercontent.com/Hydr46605/Crow/main/install.bat && install.bat
REM
REM Clones the repo, builds it, links the `crow` command, then starts the setup
REM wizard. Pass --no-setup to skip the wizard.

set "REPO_URL=https://github.com/Hydr46605/Crow.git"
if not defined CROW_INSTALL_DIR set "CROW_INSTALL_DIR=%USERPROFILE%\.crow\app"
if not defined CROW_BIN_DIR set "CROW_BIN_DIR=%USERPROFILE%\.local\bin"
set "RUN_SETUP=1"

if /i "%~1"=="--no-setup" set "RUN_SETUP=0"
if /i "%~1"=="-h" goto usage
if /i "%~1"=="--help" goto usage

where git  >nul 2>nul || (echo [error] Missing required command: git  & exit /b 1)
where node >nul 2>nul || (echo [error] Missing required command: node & exit /b 1)
where npm  >nul 2>nul || (echo [error] Missing required command: npm  & exit /b 1)

echo [1/4] Installing Crow...
if exist "%CROW_INSTALL_DIR%\.git" (
  echo Updating existing install at %CROW_INSTALL_DIR%
  git -C "%CROW_INSTALL_DIR%" fetch --depth 1 origin main
  git -C "%CROW_INSTALL_DIR%" reset --hard origin/main
) else (
  git clone --depth 1 "%REPO_URL%" "%CROW_INSTALL_DIR%"
)
if errorlevel 1 (echo [error] Failed to fetch Crow & exit /b 1)

echo [2/4] Installing dependencies...
pushd "%CROW_INSTALL_DIR%"
call npm ci
if errorlevel 1 (popd & echo [error] npm ci failed & exit /b 1)

echo [3/4] Building...
call npm run build
if errorlevel 1 (popd & echo [error] build failed & exit /b 1)
popd

echo [4/4] Linking crow command...
if not exist "%CROW_BIN_DIR%" mkdir "%CROW_BIN_DIR%"
>  "%CROW_BIN_DIR%\crow.cmd" echo @echo off
>> "%CROW_BIN_DIR%\crow.cmd" echo node "%CROW_INSTALL_DIR%\dist\index.js" %%*

echo [ok] Installed. The crow command is at %CROW_BIN_DIR%\crow.cmd
echo Add %CROW_BIN_DIR% to your PATH if it isn't already.

if "%RUN_SETUP%"=="1" (
  echo.
  call node "%CROW_INSTALL_DIR%\dist\index.js" setup
)

echo.
echo Done. Run "crow doctor" to verify, and point your MCP client at "crow".
exit /b 0

:usage
echo Usage: install.bat [--no-setup]
exit /b 0
