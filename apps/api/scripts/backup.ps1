<#
.SYNOPSIS
  pg_dump a database to <repo>/backups/<db>-<timestamp>.dump (custom format).
.EXAMPLE
  ./apps/api/scripts/backup.ps1 -DatabaseUrl "postgresql://user:pass@host:5432/elearning"
  Without -DatabaseUrl it uses $env:DATABASE_URL. Prints the dump path last.
#>
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$OutDir = (Join-Path $PSScriptRoot '..\..\..\backups')
)

. (Join-Path $PSScriptRoot 'pg-common.ps1')

try {
  if (-not $DatabaseUrl) { throw 'Pass -DatabaseUrl or set DATABASE_URL.' }
  $url = ConvertTo-LibpqUrl $DatabaseUrl
  $db = Get-DbName $url
  if (-not $db) { throw 'The URL has no database name.' }

  New-Item -ItemType Directory -Force $OutDir | Out-Null
  $file = Join-Path (Resolve-Path $OutDir) ("{0}-{1}.dump" -f $db, (Get-Date -Format 'yyyyMMdd-HHmmss'))

  Write-Host "Dumping $(Hide-Password $url)"
  # --no-owner/--no-acl: the dump restores into a database owned by any role.
  Invoke-Pg (Find-PgTool 'pg_dump') @('-Fc', '--no-owner', '--no-acl', '-f', $file, '-d', $url)

  $size = (Get-Item $file).Length
  if ($size -eq 0) { throw "Dump file is empty: $file" }
  Write-Host ("Wrote {0} ({1:N0} bytes)" -f $file, $size)
  Write-Output $file
}
catch {
  Write-Error $_ -ErrorAction Continue
  if ($file -and (Test-Path $file)) { Remove-Item $file -Force }
  exit 1
}
