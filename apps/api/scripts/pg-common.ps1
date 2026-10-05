# Shared helpers for backup.ps1 and restore-drill.ps1 (dot-sourced).

$ErrorActionPreference = 'Stop'

function Find-PgTool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $hit = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$Name.exe" -ErrorAction SilentlyContinue |
    Sort-Object { $_.Directory.Parent.Name -as [int] } -Descending |
    Select-Object -First 1
  if ($hit) { return $hit.FullName }
  throw "$Name not found on PATH or under C:\Program Files\PostgreSQL\*\bin"
}

# libpq rejects Prisma's ?schema=public, so drop it; keep sslmode and friends.
function ConvertTo-LibpqUrl([string]$Url) {
  $u = $Url.Trim().Trim('"')
  $u = $u -replace '([?&])schema=[^&]*&?', '$1'
  return $u.TrimEnd('?', '&')
}

function Get-DbName([string]$Url) {
  $path = ([Uri]$Url).AbsolutePath.TrimStart('/')
  return [Uri]::UnescapeDataString($path)
}

function Get-DbHost([string]$Url) {
  $u = [Uri]$Url
  return "$($u.Host):$($u.Port)"
}

# For log lines: never print the password.
function Hide-Password([string]$Url) {
  return $Url -replace '://([^:/@]+):[^@]*@', '://$1:***@'
}

# Native stderr (pg_restore warnings) must not become a terminating error in
# PowerShell 5.1; the exit code decides.
function Invoke-Pg([string]$Tool, [string[]]$Arguments) {
  $ErrorActionPreference = 'Continue'
  & $Tool @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$(Split-Path $Tool -Leaf) exited with code $LASTEXITCODE" }
}

# One value per line, no header; psql -X ignores the user's psqlrc.
function Invoke-PsqlQuery([string]$Url, [string]$Sql) {
  $ErrorActionPreference = 'Continue'
  $psql = Find-PgTool 'psql'
  $out = & $psql -X -A -t -q -v ON_ERROR_STOP=1 -d $Url -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE" }
  return @($out | Where-Object { $_ -ne '' })
}
