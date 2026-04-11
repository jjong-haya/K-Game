param(
  [Parameter(Mandatory = $true)]
  [string]$DbHost,

  [Parameter(Mandatory = $true)]
  [string]$DbUser,

  [Parameter(Mandatory = $true)]
  [string]$DbPassword,

  [Parameter(Mandatory = $true)]
  [string]$DbName
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$schemaPath = Join-Path $repoRoot "services\api\sql\schema.sql"

$mysqlCommand = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlCommand) {
  throw "mysql client not found. Install mysql client first."
}

$env:MYSQL_PWD = $DbPassword
try {
  Get-Content $schemaPath | & mysql -h $DbHost -u $DbUser $DbName
}
finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
