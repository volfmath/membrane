[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDist,

  [string]$SourceAssetsDir,
  [string]$CaseId = "wx-smoke-bootstrap",
  [string]$RepoRoot,
  [string]$ReportPath = "wx-project\reports\last-sync.json",
  [switch]$CleanDist,
  [switch]$CleanAssets
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-RepoPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return (Resolve-Path -LiteralPath $Path).Path
  }

  return (Resolve-Path -LiteralPath (Join-Path $RepoRoot $Path)).Path
}

function Clear-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DirectoryPath
  )

  if (-not (Test-Path -LiteralPath $DirectoryPath -PathType Container)) {
    return
  }

  Get-ChildItem -LiteralPath $DirectoryPath -Force | Where-Object { $_.Name -notin @(".gitkeep", ".gitignore") } | Remove-Item -Recurse -Force
}

function Copy-DirectoryContents {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDirectory,

    [Parameter(Mandatory = $true)]
    [string]$TargetDirectory
  )

  Get-ChildItem -LiteralPath $SourceDirectory -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $TargetDirectory -Recurse -Force
  }
}

$sourceDistPath = Resolve-RepoPath -Path $SourceDist
$targetDistDir = Join-Path $RepoRoot "wx-project\dist"
$targetAssetsDir = Join-Path $RepoRoot "wx-project\assets"
$resolvedReportPath = if ([System.IO.Path]::IsPathRooted($ReportPath)) { $ReportPath } else { Join-Path $RepoRoot $ReportPath }
$reportDir = Split-Path -Parent $resolvedReportPath

New-Item -ItemType Directory -Path $targetDistDir -Force | Out-Null
New-Item -ItemType Directory -Path $targetAssetsDir -Force | Out-Null
New-Item -ItemType Directory -Path $reportDir -Force | Out-Null

$sourceDistItem = Get-Item -LiteralPath $sourceDistPath
$distAction = "skipped"

if ($sourceDistItem.PSIsContainer) {
  $sourceDistDir = $sourceDistItem.FullName
  $targetDistNormalized = [System.IO.Path]::GetFullPath($targetDistDir)
  $sourceDistNormalized = [System.IO.Path]::GetFullPath($sourceDistDir)

  if ($sourceDistNormalized -ne $targetDistNormalized) {
    if ($CleanDist) {
      Clear-Directory -DirectoryPath $targetDistDir
    }

    Copy-DirectoryContents -SourceDirectory $sourceDistDir -TargetDirectory $targetDistDir
    $distAction = "copied-directory"
  } else {
    $distAction = "already-target-directory"
  }
} else {
  $targetDistFile = Join-Path $targetDistDir "index.js"
  $targetDistNormalized = [System.IO.Path]::GetFullPath($targetDistFile)
  $sourceDistNormalized = [System.IO.Path]::GetFullPath($sourceDistItem.FullName)

  if ($sourceDistNormalized -ne $targetDistNormalized) {
    Copy-Item -LiteralPath $sourceDistItem.FullName -Destination $targetDistFile -Force
    $distAction = "copied-file"
  } else {
    $distAction = "already-target-file"
  }
}

$assetsAction = "skipped"
if ($SourceAssetsDir) {
  $sourceAssetsPath = Resolve-RepoPath -Path $SourceAssetsDir
  $targetAssetsNormalized = [System.IO.Path]::GetFullPath($targetAssetsDir)
  $sourceAssetsNormalized = [System.IO.Path]::GetFullPath($sourceAssetsPath)

  if ($sourceAssetsNormalized -ne $targetAssetsNormalized) {
    if ($CleanAssets) {
      Clear-Directory -DirectoryPath $targetAssetsDir
    }

    Copy-DirectoryContents -SourceDirectory $sourceAssetsPath -TargetDirectory $targetAssetsDir
    $assetsAction = "copied-directory"
  } else {
    $assetsAction = "already-target-directory"
  }
}

$report = [ordered]@{
  syncedAtUtc    = (Get-Date).ToUniversalTime().ToString("o")
  caseId         = $CaseId
  sourceDist     = $sourceDistPath
  sourceDistType = if ($sourceDistItem.PSIsContainer) { "directory" } else { "file" }
  distAction     = $distAction
  sourceAssets   = if ($SourceAssetsDir) { Resolve-RepoPath -Path $SourceAssetsDir } else { $null }
  assetsAction   = $assetsAction
  targetDist     = $targetDistDir
  targetAssets   = $targetAssetsDir
}

$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $resolvedReportPath -Encoding utf8

Write-Host "Dist sync complete."
Write-Host "  caseId: $CaseId"
Write-Host "  distAction: $distAction"
Write-Host "  assetsAction: $assetsAction"
Write-Host "  report: $resolvedReportPath"
