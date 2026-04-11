param(
  [Parameter(Mandatory = $true)]
  [string]$BucketName,

  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,

  [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$webDir = Join-Path $repoRoot "apps\web"

Push-Location $webDir
try {
  $env:REACT_APP_API_BASE_URL = $ApiBaseUrl
  npm run build

  aws s3 sync build "s3://$BucketName" --delete --region $Region
}
finally {
  Pop-Location
}
