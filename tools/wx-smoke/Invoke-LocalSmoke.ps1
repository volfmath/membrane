[CmdletBinding()]
param(
  [string]$RepoRoot,
  [string]$ReportPath = "wx-project\reports\local-smoke.log"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$Utf8Encoding = New-Object System.Text.UTF8Encoding($false)

function Write-Utf8Lines {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [AllowEmptyString()]
    [string[]]$Lines
  )

  [System.IO.File]::WriteAllLines($Path, $Lines, $Utf8Encoding)
}

function Append-Utf8Lines {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [AllowEmptyString()]
    [string[]]$Lines
  )

  [System.IO.File]::AppendAllLines($Path, $Lines, $Utf8Encoding)
}

function Resolve-RepoPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path $RepoRoot $Path
}

function Invoke-SmokeNode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath,

    [Parameter(Mandatory = $true)]
    [string]$ResolvedReportPath
  )

  $fullPath = Resolve-RepoPath -Path $RelativePath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    throw "Smoke entry not found: $RelativePath"
  }

  $commandLabel = "node $RelativePath"
  Write-Host "==> $commandLabel"
  Append-Utf8Lines -Path $ResolvedReportPath -Lines @("==> $commandLabel")

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $relativePathForNode = $RelativePath -replace '\\', '/'

  try {
    Push-Location $RepoRoot
    try {
      $commandOutput = if ($RelativePath -like "wx-project\*") {
        & node --input-type=commonjs --eval "const { createRequire } = require('module'); const { resolve } = require('path'); const req = createRequire(resolve('wx-project/package.json')); req(resolve('$relativePathForNode'));" 2>&1 | ForEach-Object {
          if ($_ -is [System.Management.Automation.ErrorRecord]) {
            $_.ToString()
          } else {
            [string]$_
          }
        }
      } else {
        & node $fullPath 2>&1 | ForEach-Object {
          if ($_ -is [System.Management.Automation.ErrorRecord]) {
            $_.ToString()
          } else {
            [string]$_
          }
        }
      }
    } finally {
      Pop-Location
    }
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  foreach ($line in $commandOutput) {
    Write-Host $line
  }

  Append-Utf8Lines -Path $ResolvedReportPath -Lines $commandOutput
  if ($LASTEXITCODE -ne 0) {
    throw "Smoke command failed: $commandLabel (exit $LASTEXITCODE)"
  }
}

$resolvedReportPath = Resolve-RepoPath -Path $ReportPath
$reportDir = Split-Path -Parent $resolvedReportPath
New-Item -ItemType Directory -Path $reportDir -Force | Out-Null

$reportHeader = @(
  "Membrane local smoke"
  "startedAtUtc=$((Get-Date).ToUniversalTime().ToString('o'))"
  "repoRoot=$RepoRoot"
  ""
)
Write-Utf8Lines -Path $resolvedReportPath -Lines $reportHeader

Invoke-SmokeNode -RelativePath "wx-project\dist\index.js" -ResolvedReportPath $resolvedReportPath
Invoke-SmokeNode -RelativePath "wx-project\game.js" -ResolvedReportPath $resolvedReportPath

Write-Host "Local smoke passed."
Append-Utf8Lines -Path $resolvedReportPath -Lines @("result=pass")
