# vm-connect-mcp installer — native Windows (PowerShell 5.1+).
#
# Usage:
#   .\install.ps1 [-Binary] [-Source] [-RepoUrl URL] [-InstallDir PATH] [-BinDir PATH] [-SkipBun]
# Defaults: repo github.com/raghavdwd/vm-connect-mcp, dir ~\vm-connect-mcp,
# bin %LocalAppData%\vm-connect\bin (added to user PATH).
param(
  [string]$RepoUrl = "https://github.com/raghavdwd/vm-connect-mcp.git",
  [string]$InstallDir = (Join-Path $HOME "vm-connect-mcp"),
  [string]$BinDir = (Join-Path $env:LocalAppData "vm-connect\bin"),
  [switch]$Binary,
  [switch]$Source,
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
  Write-Host "downloading prebuilt binary ($BinName)..."
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $ExePath = Join-Path $BinDir "vm.exe"
  try {
    Invoke-WebRequest -Uri $Url -OutFile $ExePath -UseBasicParsing -ErrorAction Stop
    Copy-Item -Path $ExePath -Destination (Join-Path $BinDir "vm-connect.exe") -Force
    return $true
  } catch {
    if (Test-Path $ExePath) { Remove-Item -Force $ExePath }
    return $false
  }
}

$Mode = ""
if ($Binary) { $Mode = "binary" }
elseif ($Source) { $Mode = "source" }
elseif (-not (Test-Path (Join-Path $InstallDir "packages\cli\src\cli.ts"))) {
  Write-Host ""
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host "  vm-connect-mcp installation" -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host "Choose installation method:"
  Write-Host "  1) Prebuilt binary [Recommended] (instant, zero dependencies)"
  Write-Host "  2) Build from source (requires Git & Bun)"
  $inputChoice = Read-Host "Enter choice [1-2] (default: 1)"
  if ($inputChoice -eq "2" -or $inputChoice -eq "source") {
    $Mode = "source"
  } else {
    $Mode = "binary"
  }
  Write-Host ""
} else {
  $Mode = "source"
}

if ($Mode -eq "binary") {
  Write-Host "installing via prebuilt binary..."
  if (Try-DownloadBinary) {
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (($userPath -split ";" | ForEach-Object { $_.TrimEnd('\') }) -notcontains $BinDir.TrimEnd('\')) {
      [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$BinDir", "User")
      Write-Host "added to user PATH: $BinDir (restart shell to pick up)"
    }
    Refresh-Path
    & (Join-Path $BinDir "vm.exe") --help | Out-Null
    Write-Host "installed successfully to $BinDir\vm.exe."
    Write-Host "next: vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519"
    exit 0
  } else {
    Write-Host "prebuilt binary download failed (release asset not found or network error)." -ForegroundColor Yellow
    $fallback = Read-Host "Would you like to build from source instead? [y/N]"
    if ($fallback -notmatch "^[yY]") {
      Write-Host "aborted."
      exit 1
    }
  }
}

Write-Host "building from source..."
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
Write-Host "installed successfully from source."
Write-Host "next: vm add default --host <HOST> --user ubuntu --key ~/.ssh/id_ed25519"
