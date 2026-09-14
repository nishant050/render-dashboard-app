$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$logFiles = Get-ChildItem -Path $repoRoot -Recurse -File -Include *.log |
    Where-Object {
        $_.FullName -notlike "*\node_modules\*" -and
        $_.FullName -notlike "*\.git\*"
    }

if (-not $logFiles) {
    Write-Output "No log files found."
    exit 0
}

$deletedCount = 0
$clearedCount = 0
$failedFiles = @()

foreach ($logFile in $logFiles) {
    try {
        Remove-Item -LiteralPath $logFile.FullName -Force
        $deletedCount++
        continue
    } catch {
        try {
            Clear-Content -LiteralPath $logFile.FullName -Force
            $clearedCount++
        } catch {
            $failedFiles += $logFile.FullName
        }
    }
}

Write-Output ("Deleted {0} log file(s)." -f $deletedCount)
Write-Output ("Cleared {0} in-use log file(s)." -f $clearedCount)

if ($failedFiles.Count -gt 0) {
    Write-Output "Could not clean these files:"
    $failedFiles | ForEach-Object { Write-Output $_ }
    exit 1
}
