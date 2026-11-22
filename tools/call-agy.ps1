# 안티그래비티(agy) 호출 래퍼 (sandbox + plan 모드, 60초 제한, 후손 프로세스까지 종료)
# 주의: --sandbox/plan은 완전한 파일 읽기 격리를 보장하지 않음. 좁은 빈 폴더에서만 사용.
# 사용: .\call-agy.ps1 -WorkDir <좁은 폴더> -Model <agy models에서 확인한 ID> -Prompt "<문장>"
param(
  [Parameter(Mandatory)][string]$WorkDir,
  [Parameter(Mandatory)][string]$Model,
  [Parameter(Mandatory)][string]$Prompt,
  [int]$TimeoutSec = 60
)
$ErrorActionPreference = 'Stop'

$agy = (Get-Command agy.exe -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $WorkDir -PathType Container)) { throw '작업 폴더 없음' }
$WorkDir = (Resolve-Path -LiteralPath $WorkDir).Path

function ConvertTo-QuotedArg([string]$a) {
  if ($a -ne '' -and $a -notmatch '[\s"]') { return $a }
  $s = $a -replace '(\\*)"', '$1$1\"'
  $s = $s -replace '(\\+)$', '$1$1'
  return '"' + $s + '"'
}
$argv = @('--sandbox', '--mode', 'plan', '--model', $Model,
          '--print-timeout', ("{0}s" -f $TimeoutSec), '--print', $Prompt)

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $agy
$psi.Arguments = ($argv | ForEach-Object { ConvertTo-QuotedArg $_ }) -join ' '
$psi.WorkingDirectory = $WorkDir
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.RedirectStandardInput = $true
$psi.CreateNoWindow = $true
$psi.StandardOutputEncoding = [Text.Encoding]::UTF8
$psi.StandardErrorEncoding = [Text.Encoding]::UTF8

$p = [System.Diagnostics.Process]::Start($psi)
$p.StandardInput.Close()
$outTask = $p.StandardOutput.ReadToEndAsync()
$errTask = $p.StandardError.ReadToEndAsync()

# agy 자체 제한(--print-timeout)보다 5초 여유를 두고 바깥에서도 강제 종료
if (-not $p.WaitForExit(($TimeoutSec + 5) * 1000)) {
  & taskkill.exe /PID $p.Id /T /F | Out-Null
  Write-Output 'RESULT=TIMEOUT'
  exit 2
}
$p.WaitForExit()
$out = $outTask.Result.Trim()
$err = $errTask.Result.Trim()
$errShort = ($err -replace '(?i)(sk-|bearer\s+|token[=:]\s*)\S+', '$1***')
if ($errShort.Length -gt 400) { $errShort = $errShort.Substring($errShort.Length - 400) }

if ($p.ExitCode -ne 0) { Write-Output "RESULT=ERROR exit=$($p.ExitCode) err=$errShort"; exit 1 }
if ([string]::IsNullOrWhiteSpace($out)) { Write-Output 'RESULT=EMPTY'; exit 3 }
Write-Output "RESULT=OK"
Write-Output $out
