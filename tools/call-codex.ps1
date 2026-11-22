# 코덱스 호출 래퍼 (읽기 전용, 60초 제한, 후손 프로세스까지 종료)
# 사용: .\call-codex.ps1 -WorkDir <좁은 폴더> -Model <목록에서 확인한 ID> -Prompt "<문장>"
param(
  [Parameter(Mandatory)][string]$WorkDir,
  [string]$Model = '',   # 비우면 계정 기본 모델 사용
  [Parameter(Mandatory)][string]$Prompt,
  [int]$TimeoutSec = 60
)
$ErrorActionPreference = 'Stop'

# 실행 파일과 인수를 분리: node.exe + codex.js 직접 호출 (셸 문자열 조합·eval 없음)
$node = (Get-Command node.exe).Source
$js = Join-Path $env:APPDATA 'npm\node_modules\@openai\codex\bin\codex.js'
if (-not (Test-Path -LiteralPath $js)) { throw 'codex.js 없음: 설치 확인 필요' }
if (-not (Test-Path -LiteralPath $WorkDir -PathType Container)) { throw '작업 폴더 없음' }
$WorkDir = (Resolve-Path -LiteralPath $WorkDir).Path

# PowerShell 5.1(.NET Framework)에는 ArgumentList가 없어 인수를 하나씩 안전하게 따옴표 처리
function ConvertTo-QuotedArg([string]$a) {
  if ($a -ne '' -and $a -notmatch '[\s"]') { return $a }
  $s = $a -replace '(\\*)"', '$1$1\"'
  $s = $s -replace '(\\+)$', '$1$1'
  return '"' + $s + '"'
}
$argv = @($js, 'exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral',
          '--cd', $WorkDir)
if ($Model -ne '') { $argv += @('--model', $Model) }
$argv += $Prompt

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $node
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

if (-not $p.WaitForExit($TimeoutSec * 1000)) {
  & taskkill.exe /PID $p.Id /T /F | Out-Null   # 후손까지 종료
  Write-Output 'RESULT=TIMEOUT'
  exit 2
}
$p.WaitForExit()
$out = $outTask.Result.Trim()
$err = $errTask.Result.Trim()
# 비밀 흔적 제거 후 짧게 요약
$errShort = ($err -replace '(?i)(sk-|bearer\s+|token[=:]\s*)\S+', '$1***')
if ($errShort.Length -gt 400) { $errShort = $errShort.Substring($errShort.Length - 400) }

if ($p.ExitCode -ne 0) { Write-Output "RESULT=ERROR exit=$($p.ExitCode) err=$errShort"; exit 1 }
if ([string]::IsNullOrWhiteSpace($out)) { Write-Output 'RESULT=EMPTY'; exit 3 }
Write-Output "RESULT=OK"
Write-Output $out
