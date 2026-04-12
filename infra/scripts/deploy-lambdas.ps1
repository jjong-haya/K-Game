param(
  [Parameter(Mandatory = $true)]
  [string]$FunctionName,

  [Parameter(Mandatory = $true)]
  [string]$LambdaDir,

  [string]$Region = "us-east-1",

  [string]$ZipName = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$resolvedLambdaDir = Join-Path $repoRoot $LambdaDir

if (-not (Test-Path $resolvedLambdaDir)) {
  throw "Lambda directory not found: $resolvedLambdaDir"
}

$lambdaLeaf = Split-Path $resolvedLambdaDir -Leaf
$resolvedZipName = if ($ZipName) { $ZipName } else { "$lambdaLeaf.zip" }
$zipPath = Join-Path $resolvedLambdaDir $resolvedZipName

Push-Location $resolvedLambdaDir
try {
  if (Test-Path "package.json") {
    if (-not (Test-Path "node_modules")) {
      npm ci
    }

    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($packageJson.scripts.check) {
      npm run check
    }
  }

  if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
  }

  $rootHandlerFiles = @("index.js", "index.mjs", "index.cjs") |
    Where-Object { Test-Path $_ }

  $packageItems = @(
    $rootHandlerFiles
    "src"
    "tests"
    "package.json"
    "package-lock.json"
    "README.md"
    "node_modules"
  ) | Where-Object { $_ -and (Test-Path $_) }

  if (-not $packageItems.Count) {
    throw "No packageable items found in $resolvedLambdaDir"
  }

  Write-Host ("Packaging Lambda files: " + ($packageItems -join ", "))
  Compress-Archive -Path $packageItems -DestinationPath $zipPath -Force

  aws lambda update-function-code `
    --function-name $FunctionName `
    --zip-file "fileb://$zipPath" `
    --region $Region
}
finally {
  Pop-Location
}
