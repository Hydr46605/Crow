# Crow installer (PowerShell).
#
#   irm https://raw.githubusercontent.com/Hydr46605/Crow/main/install.ps1 | iex
#
# Clones the repo, builds it, links the `crow` command, then starts the setup
# wizard. Pass -NoSetup to skip the wizard.
[CmdletBinding()]
param(
  [switch]$NoSetup
)

$ErrorActionPreference = 'Stop'

$RepoUrl    = 'https://github.com/Hydr46605/Crow.git'
$InstallDir = if ($env:CROW_INSTALL_DIR) { $env:CROW_INSTALL_DIR } else { Join-Path $HOME '.crow\app' }
$BinDir     = if ($env:CROW_BIN_DIR) { $env:CROW_BIN_DIR } else { Join-Path $HOME '.local\bin' }

function Fail([string]$Message) {
  Write-Host "[error] $Message" -ForegroundColor Red
  exit 1
}

foreach ($cmd in @('git', 'node', 'npm')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Fail "Missing required command: $cmd"
  }
}

$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 22) {
  Fail "Crow requires Node.js >= 22 (found: $(node -v))."
}

Write-Host '=> Installing Crow...' -ForegroundColor Cyan

if (Test-Path (Join-Path $InstallDir '.git')) {
  Write-Host "Updating existing install at $InstallDir"
  git -C $InstallDir fetch --depth 1 origin main
  git -C $InstallDir reset --hard origin/main
} else {
  New-Item -ItemType Directory -Force -Path (Split-Path $InstallDir) | Out-Null
  git clone --depth 1 $RepoUrl $InstallDir
}

Push-Location $InstallDir
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { Fail 'npm ci failed.' }
  npm run build
  if ($LASTEXITCODE -ne 0) { Fail 'npm run build failed.' }
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

$cmdShim = Join-Path $BinDir 'crow.cmd'
$shim    = "@echo off`r`nnode `"$InstallDir\dist\index.js`" %*"
Set-Content -Path $cmdShim -Value $shim -Encoding ascii

Write-Host "[ok] Installed. The crow command is at $cmdShim" -ForegroundColor Green

if (-not ($env:Path -split ';' -contains $BinDir)) {
  Write-Host "Add $BinDir to your PATH to use crow from anywhere." -ForegroundColor Yellow
}

if (-not $NoSetup) {
  Write-Host ''
  & node "$InstallDir\dist\index.js" setup
}

Write-Host ''
Write-Host 'Done. Run "crow doctor" to verify, and point your MCP client at "crow".'
