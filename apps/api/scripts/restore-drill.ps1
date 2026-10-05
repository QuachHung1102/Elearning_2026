<#
.SYNOPSIS
  Restore a pg_dump into a scratch database and prove the restore is usable.
.DESCRIPTION
  1. Without -DumpFile, dumps -SourceUrl first (backup.ps1).
  2. Refuses a target with the source's name, a non-empty target, or a name that
     does not look like a scratch database - unless -Force.
  3. pg_restore --no-owner --no-acl into the target.
  4. Checks _prisma_migrations against prisma/migrations (fails on failed or
     unknown migrations, warns on pending ones) and, with -SourceUrl, row counts
     per table against the source.
  5. With -RunE2e, runs the API e2e suite (which reads apps/api/.env.test, so its
     DATABASE_URL must already point at the target). Its global setup runs
     prisma migrate deploy, so pending migrations get applied on top of the dump.
.EXAMPLE
  ./apps/api/scripts/restore-drill.ps1 -SourceUrl $env:DATABASE_URL `
    -TargetUrl 'postgresql://elearning_test:elearning_test@localhost:5432/elearning_restore' -RunE2e
#>
param(
  [Parameter(Mandatory = $true)][string]$TargetUrl,
  [string]$SourceUrl,
  [string]$DumpFile,
  [switch]$RunE2e,
  [switch]$Force
)

. (Join-Path $PSScriptRoot 'pg-common.ps1')
$apiDir = Resolve-Path (Join-Path $PSScriptRoot '..')

try {
  if (-not $SourceUrl -and -not $DumpFile) { throw 'Pass -SourceUrl, -DumpFile, or both.' }
  $target = ConvertTo-LibpqUrl $TargetUrl
  $targetDb = Get-DbName $target
  if ($SourceUrl) { $source = ConvertTo-LibpqUrl $SourceUrl }

  # --- Safety checks ----------------------------------------------------------
  if ($source) {
    if ((Get-DbName $source) -eq $targetDb) {
      if ((Get-DbHost $source) -eq (Get-DbHost $target)) { throw "Target is the source database ($targetDb). Refusing, even with -Force." }
      if (-not $Force) { throw "Target has the same name as the source ($targetDb). Use -Force if they really are different servers." }
    }
  }
  if ($targetDb -notmatch '(test|scratch|restore|drill|tmp)' -and -not $Force) {
    throw "Target '$targetDb' does not look like a scratch database (name must contain test/scratch/restore/drill/tmp). Use -Force to override."
  }
  $tables = [int](Invoke-PsqlQuery $target "select count(*) from information_schema.tables where table_schema = 'public'" | Select-Object -First 1)
  if ($tables -gt 0 -and -not $Force) {
    throw "Target '$targetDb' is not empty ($tables tables in public). Use -Force to restore over it."
  }

  # --- Dump and restore -------------------------------------------------------
  if (-not $DumpFile) {
    $DumpFile = & (Join-Path $PSScriptRoot 'backup.ps1') -DatabaseUrl $source | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0) { throw 'backup.ps1 failed.' }
  }
  if (-not (Test-Path $DumpFile)) { throw "Dump file not found: $DumpFile" }

  Write-Host "Restoring $DumpFile into $(Hide-Password $target)"
  $restoreArgs = @('--no-owner', '--no-acl', '--exit-on-error', '-d', $target)
  if ($tables -gt 0) { $restoreArgs += @('--clean', '--if-exists') }
  Invoke-Pg (Find-PgTool 'pg_restore') ($restoreArgs + $DumpFile)

  # --- Migrations -------------------------------------------------------------
  $expected = @(Get-ChildItem (Join-Path $apiDir 'prisma\migrations') -Directory | ForEach-Object Name | Sort-Object)
  $applied = @(Invoke-PsqlQuery $target 'select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by 1')
  $failed = @(Invoke-PsqlQuery $target 'select migration_name from _prisma_migrations where finished_at is null or rolled_back_at is not null')
  if ($failed.Count -gt 0) { throw "Unfinished or rolled-back migrations in the dump: $($failed -join ', ')" }
  $unknown = @($applied | Where-Object { $expected -notcontains $_ })
  if ($unknown.Count -gt 0) { throw "Dump has migrations this repo does not: $($unknown -join ', '). Check out the matching commit." }
  $pending = @($expected | Where-Object { $applied -notcontains $_ })
  Write-Host "Migrations: $($applied.Count)/$($expected.Count) of prisma/migrations applied in the dump."
  # A dump older than the code is normal (the source was not migrated yet); prisma migrate deploy applies the rest.
  $pending | ForEach-Object { Write-Warning "pending (not in the dump): $_" }

  # --- Row counts -------------------------------------------------------------
  if ($source) {
    # Exact count(*) per table in one round trip.
    $countSql = "select table_name || '=' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text " +
      "from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"
    $src = @{}; Invoke-PsqlQuery $source $countSql | ForEach-Object { $k, $v = $_ -split '=', 2; $src[$k] = $v }
    $dst = @{}; Invoke-PsqlQuery $target $countSql | ForEach-Object { $k, $v = $_ -split '=', 2; $dst[$k] = $v }
    $rows = @($src.Keys) + @($dst.Keys) | Sort-Object -Unique | ForEach-Object {
      [pscustomobject]@{ Table = $_; Source = $src[$_]; Restored = $dst[$_]; Match = ($src[$_] -eq $dst[$_]) }
    }
    $rows | Format-Table -AutoSize | Out-String | Write-Host
    $bad = @($rows | Where-Object { -not $_.Match })
    if ($bad.Count -gt 0) { throw "Row counts differ in $($bad.Count) table(s): $($bad.Table -join ', ')" }
    Write-Host "Row counts: $(@($rows).Count) tables match the source."
  }

  # --- e2e --------------------------------------------------------------------
  if ($RunE2e) {
    $envTest = Get-Content (Join-Path $apiDir '.env.test') | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    $e2eDb = Get-DbName (ConvertTo-LibpqUrl ($envTest -replace '^\s*DATABASE_URL\s*=\s*', ''))
    if ($e2eDb -ne $targetDb) { throw "apps/api/.env.test points at '$e2eDb', not '$targetDb'. Point its DATABASE_URL at the target first." }
    Write-Host 'Running API e2e against the restored database (it truncates the data).'
    Push-Location $apiDir
    try { & corepack pnpm test:e2e } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "e2e failed (exit $LASTEXITCODE)." }
  }

  Write-Host 'Restore drill passed.'
}
catch {
  Write-Error $_ -ErrorAction Continue
  exit 1
}
