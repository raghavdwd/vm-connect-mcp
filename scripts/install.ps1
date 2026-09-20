# vm-connect-mcp installer — native Windows (PowerShell 5.1+).
#
# Usage:
#   .\install.ps1 [-RepoUrl URL] [-InstallDir PATH] [-BinDir PATH] [-SkipBun]
# Defaults: repo github.com/raghavdwd/vm-connect-mcp, dir ~\vm-connect-mcp,
# bin %LocalAppData%\vm-connect\bin (added to user PATH).
param(
  [string]$RepoUrl = "https://github.com/raghavdwd/vm-connect-mcp.git",
  [string]$InstallDir = (Join-Path $HOME "vm-connect-mcp"),
  [string]$BinDir = (Join-Path $env:LocalAppData "vm-connect\bin"),
  [switch]$SkipBun
)
$ErrorActionPreference = "Stop"

function Refresh-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") +
    ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Try-DownloadBinary {
  $BinName = "vm-connect-windows-x64.exe"
  $Url = "https://github.com/raghavdwd/vm-connect-mcp/releases/latest/download/$BinName"
  Write-Host "checking prebuilt standalone binary ($BinName)..."
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $ExePath = Join-Path $BinDir "vm.exe"
  try {
    Invoke-WebRequest -Uri $Url -OutFile $ExePath -UseBasicParsing -ErrorAction Stop
    Copy-Item -Path $ExePath -Destination (Join-Path $BinDir "vm-connect.exe") -Force
    Write-Host "installed prebuilt binary into $ExePath"
    return $true
  } catch {
    if (Test-Path $ExePath) { Remove-Item -Force $ExePath }
    return $false
  }
}

if (-not (Test-Path (Join-Path $InstallDir "packages\cli\src\cli.ts"))) {
  if (Try-DownloadBinary) {
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (($userPath -split ";" | ForEach-Object { $_.TrimEnd('\') }) -notcontains $BinDir.TrimEnd('\')) {
      [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$BinDir", "User")
      Write-Host "added to user PATH: $BinDir (restart shell to pick up)"
    }
    Refresh-Path
    & (Join-Path $BinDir "vm.exe") --help | Out-Null
    Write-Host "installed. next: vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519"
    exit 0
  }
  Write-Host "prebuilt binary not yet published; falling back to lean source build..."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "missing: git — install it first: https://git-scm.com"
}
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  if ($SkipBun) { throw "missing: bun — install it first: https://bun.sh" }
  Write-Host "installing Bun..."
  & { Invoke-RestMethod https://bun.sh/install.ps1 | Invoke-Expression }
  Refresh-Path
}
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  throw "Bun install did not land on PATH — restart shell and rerun."
}
$BunBin = (Get-Command bun).Source

if ((Test-Path (Join-Path $InstallDir "packages\cli\src\cli.ts")) -or (Test-Path (Join-Path $InstallDir "src\cli.ts"))) {
  Write-Host "using existing checkout: $InstallDir"
} elseif (Test-Path $InstallDir) {
  throw "error: $InstallDir exists but is not a vm-connect-mcp checkout"
} else {
  Write-Host "cloning CLI into $InstallDir (skipping web app)..."
  git clone --depth 1 $RepoUrl $InstallDir
  if (Test-Path (Join-Path $InstallDir "apps")) {
    Remove-Item -Recurse -Force (Join-Path $InstallDir "apps")
  }
}

Push-Location $InstallDir
try {
  bun install
  bun run build:cli
} finally { Pop-Location }

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$Target = Join-Path $InstallDir "dist\cli.js"
foreach ($name in @("vm", "vm-connect")) {
  "@echo off`r`n`"$BunBin`" `"$Target`" %*`r`n" |
    Out-File -FilePath (Join-Path $BinDir "$name.cmd") -Encoding ascii
}

$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if (($userPath -split ";" | ForEach-Object { $_.TrimEnd('\') }) -notcontains $BinDir.TrimEnd('\')) {
  [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$BinDir", "User")
  Write-Host "added to user PATH: $BinDir (restart shell to pick up)"
}
Refresh-Path

& (Join-Path $BinDir "vm.cmd") --help | Out-Null
Write-Host "installed. next: vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519"
