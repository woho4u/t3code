param(
  [ValidateSet("build", "install", "dev", "sync")]
  [string]$Command = "build",
  [string]$Version
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$vitePlusBin = Join-Path $env:LOCALAPPDATA "vite-plus\bin"
$vitePlus = Join-Path $vitePlusBin "vp.exe"

if (-not (Test-Path -LiteralPath $vitePlus)) {
  throw "Vite+ was not found at $vitePlus. Install it from https://viteplus.dev first."
}

$env:PATH = "$vitePlusBin;$env:PATH"
$env:T3CODE_DESKTOP_UPDATE_REPOSITORY = "woho4u/t3code"
$outputDir = Join-Path $repoRoot "release\personal"

function Get-PersonalVersion {
  if ($Version) {
    return $Version
  }

  $desktopPackage = Get-Content (Join-Path $repoRoot "apps\desktop\package.json") -Raw | ConvertFrom-Json
  $parts = $desktopPackage.version.Split(".")
  if ($parts.Count -ne 3) {
    throw "Expected a three-part desktop version, got $($desktopPackage.version)."
  }

  $personalPatch = [int]$parts[2] + 1
  $stamp = Get-Date -Format "yyyyMMdd.HHmm"
  return "$($parts[0]).$($parts[1]).$personalPatch-personal.$stamp"
}

function Build-PersonalApp {
  $buildVersion = Get-PersonalVersion
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

  # The stock app ships the same tiny Rust monitor this fork currently builds. Reuse that
  # binary when the optional MSVC Spectre libraries are absent, which keeps the personal
  # app buildable without expanding the machine-wide Visual Studio installation.
  $installedMonitor = Join-Path $env:LOCALAPPDATA "Programs\t3code\resources\resource-monitor\t3-resource-monitor.exe"
  $cachedMonitor = Join-Path $repoRoot "native\resource-monitor\target\x86_64-pc-windows-msvc\release\t3-resource-monitor.exe"
  if (Test-Path -LiteralPath $installedMonitor) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $cachedMonitor) | Out-Null
    Copy-Item -LiteralPath $installedMonitor -Destination $cachedMonitor -Force
    $env:T3CODE_DESKTOP_REUSE_RESOURCE_MONITOR = "true"
    Write-Host "Reusing the resource monitor from the installed T3 Code app."
  }

  Push-Location $repoRoot
  try {
    & node "scripts/build-desktop-artifact.ts" `
      --platform win `
      --target nsis `
      --arch x64 `
      --build-version $buildVersion `
      --output-dir $outputDir
    if ($LASTEXITCODE -ne 0) {
      throw "Personal desktop build failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }

  $installer = Get-ChildItem -LiteralPath $outputDir -Filter "T3-Code-$buildVersion-x64.exe" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $installer) {
    throw "The build finished but its installer was not found in $outputDir."
  }
  return $installer
}

switch ($Command) {
  "build" {
    $installer = Build-PersonalApp
    Write-Host "Personal installer ready: $($installer.FullName)"
  }
  "install" {
    $installer = Build-PersonalApp
    Write-Host "Opening $($installer.FullName)"
    Write-Host "The installer replaces the stock T3 Code app and keeps its existing user data."
    Start-Process -FilePath $installer.FullName
  }
  "dev" {
    $devHome = Join-Path $repoRoot ".t3\personal-desktop-dev"
    Push-Location $repoRoot
    try {
      & $vitePlus run dev:desktop --home-dir $devHome
      if ($LASTEXITCODE -ne 0) {
        throw "Desktop development session failed with exit code $LASTEXITCODE."
      }
    }
    finally {
      Pop-Location
    }
  }
  "sync" {
    Push-Location $repoRoot
    try {
      if (git status --porcelain) {
        throw "Commit or stash local changes before syncing upstream."
      }
      git fetch upstream main
      if ($LASTEXITCODE -ne 0) { throw "Fetching upstream failed." }
      git merge --no-edit upstream/main
      if ($LASTEXITCODE -ne 0) { throw "The upstream merge needs manual conflict resolution." }
    }
    finally {
      Pop-Location
    }
  }
}
