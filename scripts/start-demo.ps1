# 演示前一键启动：依次打开 4 个窗口（数据库、AI 服务、后端、前端），
# 等每个服务就绪后再开下一个，最后重置演示数据、体检向量服务、打开浏览器。
# 用法：双击项目根目录的 start-demo.cmd，或在 PowerShell 里运行 .\scripts\start-demo.ps1
# 4 个服务窗口演示期间不要关；演示完逐个关掉（或在窗口里按 Ctrl+C）。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# IPv4 和 IPv6 都要试：Vite 前端默认只监听 IPv6 的 ::1，只试 127.0.0.1 会一直以为它没启动
function Test-Port([int]$port) {
  foreach ($address in @('127.0.0.1', '::1')) {
    $ip = [System.Net.IPAddress]::Parse($address)
    $client = New-Object System.Net.Sockets.TcpClient($ip.AddressFamily)
    try {
      $client.Connect($ip, $port)
      return $true
    } catch {
      # 这个地址不通，试下一个
    } finally {
      $client.Close()
    }
  }
  return $false
}

function Start-ServiceWindow([string]$title, [string]$command) {
  # 用 EncodedCommand 传给新窗口，避免中文标题和路径在命令行里被转坏
  $script = "`$Host.UI.RawUI.WindowTitle = '$title'; $command"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
  Start-Process powershell -WorkingDirectory $root -ArgumentList '-NoExit', '-EncodedCommand', $encoded
}

function Wait-Port([string]$name, [int]$port, [int]$timeoutSeconds) {
  Write-Host "等待 $name 就绪（端口 $port）" -NoNewline
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port $port) {
      Write-Host ' ✓' -ForegroundColor Green
      return
    }
    Write-Host '.' -NoNewline
    Start-Sleep -Seconds 2
  }
  Write-Host ''
  Write-Host "$name 在 $timeoutSeconds 秒内没有启动，请看「$name」窗口里的报错。" -ForegroundColor Red
  Read-Host '按回车退出'
  exit 1
}

$services = @(
  @{ Name = '1 数据库'; Port = 27017; Timeout = 60; Command = 'npm run db:local' },
  @{ Name = '2 AI 服务'; Port = 5001; Timeout = 180; Command = '.\whisper-service\.venv\Scripts\python.exe .\whisper-service\app.py' },
  @{ Name = '3 后端'; Port = 3000; Timeout = 60; Command = 'npm run dev' },
  @{ Name = '4 前端'; Port = 5173; Timeout = 60; Command = 'npm --prefix feynman-platform-frontend run dev' }
)

Write-Host '费曼学习平台 · 演示启动' -ForegroundColor Cyan
Write-Host "项目目录：$root"
Write-Host ''

# 端口已被占用说明上次的服务没关，直接再开会报错
$busy = $services | Where-Object { Test-Port $_.Port }
if ($busy) {
  Write-Host '下面这些端口已经被占用，可能是之前开的服务还没关：' -ForegroundColor Yellow
  $busy | ForEach-Object { Write-Host "  $($_.Name)：端口 $($_.Port)" }
  Write-Host '请先关掉之前的服务窗口（或重启电脑），再运行本脚本。'
  Read-Host '按回车退出'
  exit 1
}

foreach ($service in $services) {
  Start-ServiceWindow $service.Name $service.Command
  Wait-Port $service.Name $service.Port $service.Timeout
}

Write-Host ''
Write-Host '重置演示账号和知识点、建向量索引…' -ForegroundColor Cyan
Push-Location $root
try {
  npm run seed:demo
  Write-Host ''
  Write-Host '体检向量服务…' -ForegroundColor Cyan
  npm run rag:check
} finally {
  Pop-Location
}

Start-Process 'http://localhost:5173'
Write-Host ''
Write-Host '全部就绪，浏览器已打开 http://localhost:5173（建议用 Chrome）。' -ForegroundColor Green
Write-Host '4 个服务窗口演示期间不要关。这个窗口可以关掉。'
Read-Host '按回车关闭本窗口'
